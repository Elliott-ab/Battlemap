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

// Fellowship list: users invited by the current user and accepted the invite
export default function FellowshipModal({ open, onClose }) {
  const { user } = useAuth();
  const [rows, setRows] = React.useState([]); // [{ id, display_name, username }]
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
        // Expected schema: public.fellowships(inviter_id uuid, invitee_id uuid, status text)
        const { data, error: err } = await supabase
          .from('fellowships')
          .select('invitee_id')
          .eq('inviter_id', user.id)
          .eq('status', 'accepted');
        if (err) throw err;
        const ids = (data || []).map(r => r.invitee_id);
        if (ids.length === 0) { if (active) setRows([]); return; }
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', ids);
        if (pErr) throw pErr;
        if (!active) return;
        setRows((profs || []).map(p => ({ id: p.id, display_name: p.display_name || '', username: p.username || '' })));
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
    return rows.filter(r => (r.display_name || '').toLowerCase().includes(q) || (r.username || '').toLowerCase().includes(q));
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
    } catch (e) {
      setError(e.message || 'Failed to send invite');
    }
    setInviteEmail('');
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
                <TableCell sx={{ color: '#fff' }}>Name</TableCell>
                <TableCell sx={{ color: '#fff' }}>Username</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.id} hover sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}>
                  <TableCell sx={{ color: '#fff' }}>{r.display_name || r.username || r.id}</TableCell>
                  <TableCell sx={{ color: '#fff' }}>{r.username || '—'}</TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>No accepted fellowship members yet.</Typography>
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
