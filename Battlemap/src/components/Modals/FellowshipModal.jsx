import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { supabase } from '../../supabaseClient';
import { createNotification } from '../../Utils/notificationsService.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useGameSession } from '../../Utils/GameSessionContext.jsx';

// Fellowship list: users invited by the current user and accepted the invite
export default function FellowshipModal({ open, onClose }) {
  const { user } = useAuth();
  const { game } = useGameSession();
  const [rows, setRows] = React.useState([]); // [{ key, invitee_id, invitee_email, username, status }]
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    if (!open || !user?.id) { setRows([]); return; }
    let active = true;
    (async () => {
      try {
        setError('');
        setMessage('');
        // Load all invites sent by current user, including pending/declined/accepted
        // Expected schema: public.fellowships(inviter_id uuid, invitee_id uuid, invitee_email text, status text)
        const { data, error: err } = await supabase
          .from('fellowships')
          .select('invitee_id, invitee_email, status')
          .eq('inviter_id', user.id);
        if (err) throw err;
        const list = Array.isArray(data) ? data : [];
        const ids = list.map(r => r.invitee_id).filter(Boolean);
        let profs = [];
        if (ids.length > 0) {
          const { data: pRows, error: pErr } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', ids);
          if (pErr) throw pErr;
          profs = Array.isArray(pRows) ? pRows : [];
        }
        const usernameById = new Map(profs.map(p => [p.id, p.username || '']));
        if (!active) return;
        setRows(list.map(r => ({
          key: `${r.invitee_id || 'none'}|${r.invitee_email || 'none'}`,
          invitee_id: r.invitee_id || null,
          invitee_email: r.invitee_email || '',
          username: usernameById.get(r.invitee_id) || '',
          status: r.status || 'pending',
        })));
      } catch (e) {
        if (!active) return;
        setError(e.message || 'Failed to load fellowship. Ensure the fellowships and profiles tables are configured.');
      }
    })();
    return () => { active = false; };
  }, [open, user?.id]);

  const filtered = React.useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.username || '').toLowerCase().includes(q) || (r.invitee_email || '').toLowerCase().includes(q));
  }, [rows, query]);

  const paged = React.useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const handleInvite = async () => {
    setError('');
    setMessage('');
    const email = (inviteEmail || '').trim();
    if (!email) { setError('Enter an email address.'); return; }
    try {
      // Ensure a pending fellowship row exists (by inviter and invitee_email)
      await supabase
        .from('fellowships')
        .upsert({ inviter_id: user?.id, invitee_email: email, status: 'pending' }, { onConflict: 'inviter_id,invitee_email' });
      // Determine inviter display name/username for the message
      let inviterName = '';
      try {
        const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', user?.id).maybeSingle();
        inviterName = (prof?.display_name || prof?.username || '').trim();
      } catch (_) {}
      const msg = `${inviterName || 'A user'} has invited you to join their fellowship`;
      await createNotification({ recipientEmail: email, type: 'fellowship_invite', message: msg, payload: { inviter_id: user?.id } });
      setMessage('Invite sent.');
      // Refresh list
      setQuery(q => q); // no-op to keep search; below, reload effect uses open+user
    } catch (e) {
      setError(e.message || 'Failed to send invite');
    }
    setInviteEmail('');
  };

  async function refreshRows() {
    if (!user?.id) return;
    try {
      const { data, error: err } = await supabase
        .from('fellowships')
        .select('invitee_id, invitee_email, status')
        .eq('inviter_id', user.id);
      if (err) throw err;
      const list = Array.isArray(data) ? data : [];
      const ids = list.map(r => r.invitee_id).filter(Boolean);
      let profs = [];
      if (ids.length > 0) {
        const { data: pRows } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', ids);
        profs = Array.isArray(pRows) ? pRows : [];
      }
      const usernameById = new Map(profs.map(p => [p.id, p.username || '']));
      setRows(list.map(r => ({
        key: `${r.invitee_id || 'none'}|${r.invitee_email || 'none'}`,
        invitee_id: r.invitee_id || null,
        invitee_email: r.invitee_email || '',
        username: usernameById.get(r.invitee_id) || '',
        status: r.status || 'pending',
      })));
    } catch (e) {
      // ignore refresh errors
    }
  }

  const handleCancelInvite = async (row) => {
    setError(''); setMessage('');
    try {
      let q = supabase.from('fellowships').delete().eq('inviter_id', user?.id);
      if (row.invitee_id) q = q.eq('invitee_id', row.invitee_id);
      else if (row.invitee_email) q = q.eq('invitee_email', row.invitee_email);
      await q;
      setMessage('Invite cancelled.');
      await refreshRows();
    } catch (e) {
      setError(e.message || 'Failed to cancel invite');
    }
  };

  const handleResendInvite = async (row) => {
    setError(''); setMessage('');
    const email = row.invitee_email || '';
    if (!email) { setError('Cannot resend invite: no email on file.'); return; }
    try {
      // Set status back to pending
      await supabase
        .from('fellowships')
        .upsert({ inviter_id: user?.id, invitee_email: email, invitee_id: row.invitee_id || null, status: 'pending' }, { onConflict: 'inviter_id,invitee_email' });
      // Send notification
      let inviterName = '';
      try {
        const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', user?.id).maybeSingle();
        inviterName = (prof?.display_name || prof?.username || '').trim();
      } catch (_) {}
      const msg = `${inviterName || 'A user'} has invited you to join their fellowship`;
      await createNotification({ recipientEmail: email, type: 'fellowship_invite', message: msg, payload: { inviter_id: user?.id } });
      setMessage('Invite resent.');
      await refreshRows();
    } catch (e) {
      setError(e.message || 'Failed to resend invite');
    }
  };

  const handleInviteToGame = async (row) => {
    setError(''); setMessage('');
    if (!game?.code || !game?.id) { setError('Start or open a game to send an invite.'); return; }
    try {
      // Craft message
      let inviterName = '';
      try {
        const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', user?.id).maybeSingle();
        inviterName = (prof?.display_name || prof?.username || '').trim();
      } catch (_) {}
      const msg = `${inviterName || 'A user'} invited you to join their game (${game.code}).`;
      const payload = { game_id: game.id, game_code: game.code, inviter_id: user?.id };
      if (row.invitee_id) {
        await createNotification({ recipientId: row.invitee_id, type: 'game_invite', message: msg, payload });
      } else if (row.invitee_email) {
        await createNotification({ recipientEmail: row.invitee_email, type: 'game_invite', message: msg, payload });
      } else {
        setError('Unable to determine recipient for game invite.');
        return;
      }
      setMessage('Game invite sent.');
    } catch (e) {
      setError(e.message || 'Failed to send game invite');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ bgcolor: '#2f2f2f', color: '#fff' }}>Fellowship</DialogTitle>
      <DialogContent sx={{ bgcolor: '#2f2f2f', color: '#fff' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            label="Search fellowship (username or email)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            fullWidth
            size="small"
            InputLabelProps={{ sx: { color: '#bbb' } }}
            InputProps={{
              sx: {
                color: '#fff',
                bgcolor: '#1f1f1f',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#aaa' },
              },
            }}
          />
        </Box>
        <TableContainer component={Paper} sx={{ bgcolor: '#2f2f2f' }}>
          <Table size="small" sx={{ '& .MuiTableCell-root': { color: '#fff', borderColor: 'rgba(255,255,255,0.12)' } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#fff' }}>Username</TableCell>
                <TableCell sx={{ color: '#fff' }}>Email</TableCell>
                <TableCell sx={{ color: '#fff' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.key} hover sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}>
                  <TableCell sx={{ color: '#fff' }}>{r.username || '—'}</TableCell>
                  <TableCell sx={{ color: '#fff' }}>{r.invitee_email || '—'}</TableCell>
                  <TableCell sx={{ color: '#fff' }}>
                    {r.status === 'pending' && (
                      <Button variant="outlined" size="small" onClick={() => handleCancelInvite(r)} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa' }, mr: 1 }}>
                        Cancel invite
                      </Button>
                    )}
                    {r.status === 'declined' && (
                      <>
                        <Button variant="outlined" size="small" onClick={() => handleResendInvite(r)} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa' }, mr: 1 }}>
                          Resend invite
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => handleCancelInvite(r)} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa' } }}>
                          Cancel invite
                        </Button>
                      </>
                    )}
                    {r.status === 'accepted' && (
                      <Button variant="outlined" size="small" onClick={() => handleInviteToGame(r)} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa' } }} disabled={!game?.id || !game?.code}>
                        Invite to game
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>No sent fellowship invites yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{ color: '#fff', '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { color: '#fff' }, '& .MuiSelect-select': { color: '#fff' } }}
        />
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <TextField label="Invite to fellowship (email)" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} fullWidth sx={{ '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' } }} />
          <Button variant="contained" onClick={handleInvite}>Send</Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#2f2f2f' }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
