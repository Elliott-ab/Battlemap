import React from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
  Tooltip,
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';

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
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  React.useEffect(() => {
    if (!open || !user?.id) { setRows([]); return; }
    let active = true;
    (async () => {
      try {
        setError('');
        setMessage('');
        // Load all invites sent by current user, plus accepted connections where current user is the invitee
        const { data: sent, error: errSent } = await supabase
          .from('fellowships')
          .select('inviter_id, invitee_id, invitee_email, status')
          .eq('inviter_id', user.id);
        if (errSent) throw errSent;
        const { data: receivedAccepted, error: errRecv } = await supabase
          .from('fellowships')
          .select('inviter_id, invitee_id, invitee_email, status')
          .eq('invitee_id', user.id)
          .eq('status', 'accepted');
        if (errRecv) throw errRecv;
        const sentArr = Array.isArray(sent) ? sent : [];
        const recvArr = Array.isArray(receivedAccepted) ? receivedAccepted : [];
        // Build a lookup of the other user's email from sent rows (inviter=current user)
        const emailByOtherId = new Map();
        for (const r of sentArr) {
          if (r?.invitee_id && (r?.invitee_email || '').trim()) {
            emailByOtherId.set(r.invitee_id, r.invitee_email.trim());
          }
        }
        // Compute mutual accepted otherIds
        const sentAccepted = new Set(sentArr.filter(r => r.status === 'accepted').map(r => r.invitee_id).filter(Boolean));
        const recvAccepted = new Set(recvArr.filter(r => r.status === 'accepted').map(r => r.inviter_id).filter(Boolean));
        const mutualAccepted = new Set([...sentAccepted].filter(id => recvAccepted.has(id)));
        // Build rows: include all sent non-accepted; include accepted only if mutual; include received accepted only if mutual and not already in map
        const byOtherId = new Map();
        // Add sent rows (pending/declined always; accepted only if mutual)
        for (const r of sentArr) {
          const otherId = r.invitee_id;
          if (!otherId) continue;
          if (r.status === 'accepted' && !mutualAccepted.has(otherId)) continue;
          const key = `${otherId}|${r.invitee_email || ''}`;
          byOtherId.set(otherId, {
            key,
            invitee_id: otherId,
            invitee_email: r.invitee_email || '',
            username: '', // fill later
            status: r.status || 'pending',
          });
        }
        // Add received accepted rows (only if mutual and not already present)
        for (const r of recvArr) {
          const otherId = r.inviter_id;
          if (!otherId) continue;
          if (!mutualAccepted.has(otherId)) continue;
          if (byOtherId.has(otherId)) {
            // ensure status shows accepted
            const existing = byOtherId.get(otherId);
            existing.status = 'accepted';
            // Do not copy invitee_email from received row since it is likely the current user's email
            continue;
          }
          const key = `${otherId}|none`;
          byOtherId.set(otherId, {
            key,
            invitee_id: otherId,
            // Prefer email recorded on a sent row if available; otherwise blank
            invitee_email: emailByOtherId.get(otherId) || '',
            username: '',
            status: 'accepted',
          });
        }
        const values = Array.from(byOtherId.values());
        const ids = values.map(v => v.invitee_id).filter(Boolean);
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
        // Ensure we never display the current user's own email in the Email column
        setRows(values.map(v => ({
          ...v,
          username: usernameById.get(v.invitee_id) || '',
          invitee_email: (v.invitee_email && v.invitee_email !== (user?.email || '')) ? v.invitee_email : '',
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
      // First try to update an existing invite by email; if none updated, insert a new row
      let didUpdate = false;
      try {
        const { data: updated, error: updErr } = await supabase
          .from('fellowships')
          .update({ status: 'pending' })
          .eq('inviter_id', user?.id)
          .eq('invitee_email', email)
          .select('inviter_id');
        if (updErr) throw updErr;
        didUpdate = Array.isArray(updated) && updated.length > 0;
      } catch (e) {
        // If RLS blocks update with select, try blind update without select
        try {
          await supabase
            .from('fellowships')
            .update({ status: 'pending' })
            .eq('inviter_id', user?.id)
            .eq('invitee_email', email);
          didUpdate = true; // assume success if no error
        } catch (_) {}
      }
      if (!didUpdate) {
        const { error: insErr } = await supabase
          .from('fellowships')
          .insert([{ inviter_id: user?.id, invitee_email: email, status: 'pending' }]);
        if (insErr) throw insErr;
      }
      // Best-effort notification (ignore RLS errors)
      try {
        let inviterName = '';
        try {
          const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', user?.id).maybeSingle();
          inviterName = (prof?.display_name || prof?.username || '').trim();
        } catch (_) {}
  const msg = `${inviterName || 'A user'} has invited you to join their fellowship`;
  await createNotification({ recipientEmail: email, type: 'fellowship_invite', message: msg, payload: { inviter_id: user?.id, inviter_email: user?.email || null } });
      } catch (_) {
        // ignore notification failures due to RLS; the invite still exists in fellowships
      }
      setMessage('Invite sent.');
      await refreshRows();
    } catch (e) {
      setError(e.message || 'Failed to send invite');
    }
    setInviteEmail('');
  };

  async function refreshRows() {
    if (!user?.id) return;
    try {
      const { data: sent } = await supabase
        .from('fellowships')
        .select('inviter_id, invitee_id, invitee_email, status')
        .eq('inviter_id', user.id);
      const { data: receivedAccepted } = await supabase
        .from('fellowships')
        .select('inviter_id, invitee_id, invitee_email, status')
        .eq('invitee_id', user.id)
        .eq('status', 'accepted');
      const sentArr = Array.isArray(sent) ? sent : [];
      const recvArr = Array.isArray(receivedAccepted) ? receivedAccepted : [];
      const emailByOtherId = new Map();
      for (const r of sentArr) {
        if (r?.invitee_id && (r?.invitee_email || '').trim()) {
          emailByOtherId.set(r.invitee_id, r.invitee_email.trim());
        }
      }
      const sentAccepted = new Set(sentArr.filter(r => r.status === 'accepted').map(r => r.invitee_id).filter(Boolean));
      const recvAccepted = new Set(recvArr.filter(r => r.status === 'accepted').map(r => r.inviter_id).filter(Boolean));
      const mutualAccepted = new Set([...sentAccepted].filter(id => recvAccepted.has(id)));
      const byOtherId = new Map();
      for (const r of sentArr) {
        const otherId = r.invitee_id;
        if (!otherId) continue;
        if (r.status === 'accepted' && !mutualAccepted.has(otherId)) continue;
        const key = `${otherId}|${r.invitee_email || ''}`;
        byOtherId.set(otherId, {
          key,
          invitee_id: otherId,
          invitee_email: r.invitee_email || '',
          username: '',
          status: r.status || 'pending',
        });
      }
      for (const r of recvArr) {
        const otherId = r.inviter_id;
        if (!otherId) continue;
        if (!mutualAccepted.has(otherId)) continue;
        if (byOtherId.has(otherId)) {
          const existing = byOtherId.get(otherId);
          existing.status = 'accepted';
          // Do not assign current user's email; keep existing or use emailByOtherId
          if (!existing.invitee_email) existing.invitee_email = emailByOtherId.get(otherId) || '';
          continue;
        }
        const key = `${otherId}|none`;
        byOtherId.set(otherId, {
          key,
          invitee_id: otherId,
          invitee_email: emailByOtherId.get(otherId) || '',
          username: '',
          status: 'accepted',
        });
      }
      const values = Array.from(byOtherId.values());
      const ids = values.map(v => v.invitee_id).filter(Boolean);
      let profs = [];
      if (ids.length > 0) {
        const { data: pRows } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', ids);
        profs = Array.isArray(pRows) ? pRows : [];
      }
      const usernameById = new Map(profs.map(p => [p.id, p.username || '']));
      // Ensure we never display the current user's own email in the Email column
      setRows(values.map(v => ({
        ...v,
        username: usernameById.get(v.invitee_id) || '',
        invitee_email: (v.invitee_email && v.invitee_email !== (user?.email || '')) ? v.invitee_email : '',
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
      // Try update to set status back to pending; fallback to insert if missing
      let didUpdate = false;
      try {
        const { data: updated, error: updErr } = await supabase
          .from('fellowships')
          .update({ status: 'pending', invitee_id: row.invitee_id || null })
          .eq('inviter_id', user?.id)
          .eq('invitee_email', email)
          .select('inviter_id');
        if (updErr) throw updErr;
        didUpdate = Array.isArray(updated) && updated.length > 0;
      } catch (e) {
        try {
          await supabase
            .from('fellowships')
            .update({ status: 'pending', invitee_id: row.invitee_id || null })
            .eq('inviter_id', user?.id)
            .eq('invitee_email', email);
          didUpdate = true;
        } catch (_) {}
      }
      if (!didUpdate) {
        const { error: insErr } = await supabase
          .from('fellowships')
          .insert([{ inviter_id: user?.id, invitee_email: email, invitee_id: row.invitee_id || null, status: 'pending' }]);
        if (insErr) throw insErr;
      }
      // Best-effort notification
      try {
        let inviterName = '';
        try {
          const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', user?.id).maybeSingle();
          inviterName = (prof?.display_name || prof?.username || '').trim();
        } catch (_) {}
    const msg = `${inviterName || 'A user'} has invited you to join their fellowship`;
    await createNotification({ recipientEmail: email, type: 'fellowship_invite', message: msg, payload: { inviter_id: user?.id, inviter_email: user?.email || null } });
      } catch (_) {}
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
      const send = async () => {
        if (row.invitee_id) {
          return await createNotification({ recipientId: row.invitee_id, type: 'game_invite', message: msg, payload }, { bestEffort: true });
        }
        if (row.invitee_email) {
          return await createNotification({ recipientEmail: row.invitee_email, type: 'game_invite', message: msg, payload }, { bestEffort: true });
        }
        return null;
      };
      const res = await send();
      if (!row.invitee_id && !row.invitee_email) {
        setError('Unable to determine recipient for game invite.');
        return;
      }
      // Even if notifications insert was blocked by RLS, broadcast an ephemeral invite to the recipient's channel
      try {
        const target = row.invitee_id || row.invitee_email || null;
        if (target) {
          // Prefer user-id channels; if only email is known, still broadcast to a shared email channel
          const chName = row.invitee_id ? `user-${row.invitee_id}-signals` : `email-${row.invitee_email}-signals`;
          const ch = supabase.channel(chName);
          await ch.subscribe();
          await ch.send({ type: 'broadcast', event: 'game-invite', payload: { message: msg, payload } });
          supabase.removeChannel(ch);
        }
      } catch (_) {}
      // Treat as sent
      setMessage('Game invite sent.');
    } catch (e) {
      // Swallow RLS errors gracefully
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('row-level security') || msg.includes('rls') || e?.status === 403) {
        setMessage('Game invite sent.');
      } else {
        setError(e.message || 'Failed to send game invite');
      }
    }
  };

  const handleRemoveConnection = async (row) => {
    setError(''); setMessage('');
    const otherId = row.invitee_id || null;
    if (!otherId) { setError('Unable to determine connection to remove.'); return; }
    try {
      // Best-effort: try to delete regardless of which side initiated the connection
      try {
        await supabase
          .from('fellowships')
          .delete()
          .eq('inviter_id', user?.id)
          .eq('invitee_id', otherId);
      } catch (_) {}
      try {
        await supabase
          .from('fellowships')
          .delete()
          .eq('inviter_id', otherId)
          .eq('invitee_id', user?.id);
      } catch (_) {}
      setMessage('Connection removed.');
      await refreshRows();
    } catch (e) {
      setError(e.message || 'Failed to remove connection');
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
                <TableCell sx={{ color: '#fff' }}>Status</TableCell>
                <TableCell sx={{ color: '#fff' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.key} hover sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}>
                  <TableCell sx={{ color: '#fff' }}>{r.username || '—'}</TableCell>
                  <TableCell sx={{ color: '#fff' }}>{r.invitee_email || '—'}</TableCell>
                  <TableCell sx={{ color: '#fff' }}>
                    {(() => {
                      const status = (r.status || 'pending').toLowerCase();
                      const color = status === 'accepted' ? 'success' : status === 'declined' ? 'error' : 'warning';
                      const label = status.charAt(0).toUpperCase() + status.slice(1);
                      return <Chip label={label} size="small" color={color} variant="filled" />;
                    })()}
                  </TableCell>
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
                      <>
                        <Button variant="outlined" size="small" onClick={() => handleInviteToGame(r)} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa' }, mr: 1 }} disabled={!game?.id || !game?.code}>
                          Invite to game
                        </Button>
                        <Tooltip title="Remove connection">
                          <IconButton aria-label="Remove connection" size="small" onClick={() => setDeleteTarget(r)} sx={{ color: '#f28b82', border: '1px solid #c77' }}>
                            <FontAwesomeIcon icon={faTrashCan} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
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
      {/* Confirm removal dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove connection?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will remove the connection for both users. Are you sure you want to continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => { const t = deleteTarget; setDeleteTarget(null); await handleRemoveConnection(t); }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
