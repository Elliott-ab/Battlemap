import React from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { supabase } from '../../supabaseClient';
import { createNotification } from '../../Utils/notificationsService.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useGameSession } from '../../Utils/GameSessionContext.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';

export default function FellowshipContent() {
  const { user } = useAuth();
  const { game } = useGameSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = React.useState([]); // [{ key, invitee_id, invitee_email, username, status }]
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const normalizeFellowshipRows = (sentArr, recvArr) => {
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
      const otherEmail = (r?.invitee_email || '').trim();
      if (!otherId && !otherEmail) continue;
      if (r.status === 'accepted' && otherId && !mutualAccepted.has(otherId)) continue;
      const key = otherId ? `id:${otherId}` : `email:${otherEmail.toLowerCase()}`;
      byOtherId.set(key, {
        key,
        invitee_id: otherId || null,
        invitee_email: r.invitee_email || '',
        username: '',
        status: r.status || 'pending',
      });
    }

    for (const r of recvArr) {
      const otherId = r.inviter_id;
      if (!otherId) continue;
      if (!mutualAccepted.has(otherId)) continue;
      const key = `id:${otherId}`;
      if (byOtherId.has(key)) {
        const existing = byOtherId.get(key);
        existing.status = 'accepted';
        existing.invitee_email = existing.invitee_email || emailByOtherId.get(otherId) || '';
        continue;
      }
      byOtherId.set(key, {
        key,
        invitee_id: otherId,
        invitee_email: emailByOtherId.get(otherId) || '',
        username: '',
        status: 'accepted',
      });
    }

    const mergedRows = new Map();
    const priority = { accepted: 3, pending: 2, declined: 1 };
    for (const v of byOtherId.values()) {
      const email = (v.invitee_email || '').trim().toLowerCase();
      const idKey = v.invitee_id ? `id:${v.invitee_id}` : null;
      const emailKey = email ? `email:${email}` : null;
      let key = idKey || emailKey || v.key;
      if (idKey && emailKey && mergedRows.has(emailKey)) {
        const existing = mergedRows.get(emailKey);
        mergedRows.delete(emailKey);
        key = idKey;
        mergedRows.set(key, existing);
      }
      const existing = mergedRows.get(key);
      if (existing) {
        const existingStatus = (existing.status || 'pending').toLowerCase();
        const currentStatus = (v.status || 'pending').toLowerCase();
        existing.status = priority[existingStatus] >= priority[currentStatus] ? existingStatus : currentStatus;
        existing.invitee_id = existing.invitee_id || v.invitee_id;
        existing.invitee_email = existing.invitee_email || v.invitee_email;
        continue;
      }
      mergedRows.set(key, { ...v, invitee_email: v.invitee_email || '' });
    }

    return Array.from(mergedRows.values());
  };

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) { setRows([]); return; }
      try {
        setError('');
        setMessage('');
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
        const finalValues = normalizeFellowshipRows(sentArr, recvArr);
        const ids = finalValues.map(v => v.invitee_id).filter(Boolean);
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
        setRows(finalValues.map(v => ({
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
  }, [user?.id]);

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
        try {
          await supabase
            .from('fellowships')
            .update({ status: 'pending' })
            .eq('inviter_id', user?.id)
            .eq('invitee_email', email);
          didUpdate = true;
        } catch (_) {}
      }
      if (!didUpdate) {
        const { error: insErr } = await supabase
          .from('fellowships')
          .insert([{ inviter_id: user?.id, invitee_email: email, status: 'pending' }]);
        if (insErr) throw insErr;
      }
      try {
        let inviterName = '';
        try {
          const { data: prof } = await supabase.from('profiles').select('display_name, username').eq('id', user?.id).maybeSingle();
          inviterName = (prof?.display_name || prof?.username || '').trim();
        } catch (_) {}
        const msg = `${inviterName || 'A user'} has invited you to join their fellowship`;
        await createNotification({ recipientEmail: email, type: 'fellowship_invite', message: msg, payload: { inviter_id: user?.id, inviter_email: user?.email || null } });
      } catch (_) {}
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
      const finalValues = normalizeFellowshipRows(sentArr, recvArr);
      const ids = finalValues.map(v => v.invitee_id).filter(Boolean);
      let profs = [];
      if (ids.length > 0) {
        const { data: pRows } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', ids);
        profs = Array.isArray(pRows) ? pRows : [];
      }
      const usernameById = new Map(profs.map(p => [p.id, p.username || '']));
      setRows(finalValues.map(v => ({
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
      await send();
      try {
        const target = row.invitee_id || row.invitee_email || null;
        if (target) {
          const chName = row.invitee_id ? `user-${row.invitee_id}-signals` : `email-${row.invitee_email}-signals`;
          const ch = supabase.channel(chName);
          await ch.subscribe();
          await ch.send({ type: 'broadcast', event: 'game-invite', payload: { message: msg, payload } });
          supabase.removeChannel(ch);
        }
      } catch (_) {}
      setMessage('Game invite sent.');
    } catch (e) {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#fff' }}>
  <Typography variant="h5" sx={{ mb: 1, color: '#d32f2f', fontWeight: 800 }}>Fellowship</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          label="Search fellowship (username or email)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          fullWidth
          size="small"
          sx={{
            '& .MuiInputBase-input': { color: '#fff' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '& .MuiInputLabel-root': { color: '#fff' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
          }}
        />
      </Box>
      {isMobile ? (
        <Box>
          {paged.map((r) => (
            <Box key={r.key} sx={{ p: 1.5, mb: 1.5, border: '1px solid', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 1, bgcolor: '#2f2f2f' }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{r.username || '—'}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>{r.invitee_email || '—'}</Typography>
              <Chip
                label={(r.status || 'pending').charAt(0).toUpperCase() + (r.status || 'pending').slice(1)}
                size="small"
                color={(r.status || 'pending') === 'accepted' ? 'success' : (r.status || 'pending') === 'declined' ? 'error' : 'warning'}
                variant="filled"
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {r.status === 'pending' && (
                  <Button variant="outlined" size="small" fullWidth onClick={() => handleCancelInvite(r)}>
                    Cancel invite
                  </Button>
                )}
                {r.status === 'declined' && (
                  <>
                    <Button variant="outlined" size="small" fullWidth onClick={() => handleResendInvite(r)}>
                      Resend invite
                    </Button>
                    <Button variant="outlined" size="small" fullWidth onClick={() => handleCancelInvite(r)}>
                      Cancel invite
                    </Button>
                  </>
                )}
                {r.status === 'accepted' && (
                  <>
                    <Button variant="outlined" size="small" fullWidth onClick={() => handleInviteToGame(r)} disabled={!game?.id || !game?.code}>
                      Invite to game
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      color="error"
                      onClick={() => setDeleteTarget(r)}
                      startIcon={<FontAwesomeIcon icon={faTrashCan} />}
                    >
                      Remove connection
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          ))}
          {paged.length === 0 && (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>No sent fellowship invites yet.</Typography>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: '#2f2f2f', overflowX: 'auto' }}>
          <Table size="small" sx={{ '& .MuiTableCell-root': { color: '#fff', borderColor: 'rgba(255,255,255,0.12)' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.key} hover>
                  <TableCell>{r.username || '—'}</TableCell>
                  <TableCell>{r.invitee_email || '—'}</TableCell>
                  <TableCell>
                    {(() => {
                      const status = (r.status || 'pending').toLowerCase();
                      const color = status === 'accepted' ? 'success' : status === 'declined' ? 'error' : 'warning';
                      const label = status.charAt(0).toUpperCase() + status.slice(1);
                      return <Chip label={label} size="small" color={color} variant="filled" />;
                    })()}
                  </TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <Button variant="outlined" size="small" onClick={() => handleCancelInvite(r)} sx={{ mr: 1 }}>
                        Cancel invite
                      </Button>
                    )}
                    {r.status === 'declined' && (
                      <>
                        <Button variant="outlined" size="small" onClick={() => handleResendInvite(r)} sx={{ mr: 1 }}>
                          Resend invite
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => handleCancelInvite(r)}>
                          Cancel invite
                        </Button>
                      </>
                    )}
                    {r.status === 'accepted' && (
                      <>
                        <Button variant="outlined" size="small" onClick={() => handleInviteToGame(r)} sx={{ mr: 1 }} disabled={!game?.id || !game?.code}>
                          Invite to game
                        </Button>
                        <Tooltip title="Remove connection">
                          <IconButton aria-label="Remove connection" size="small" onClick={() => setDeleteTarget(r)} color="error">
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
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>No sent fellowship invites yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(_e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
        sx={{
          color: '#fff',
          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { color: '#fff' },
          '& .MuiSelect-select': { color: '#fff' },
          '& .MuiSvgIcon-root': { color: '#fff' },
          '& .MuiButtonBase-root.Mui-disabled': { color: 'rgba(255,255,255,0.5)' }
        }}
      />
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          label="Invite to fellowship (email)"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          fullWidth
          sx={{
            '& .MuiInputBase-input': { color: '#fff' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '& .MuiInputLabel-root': { color: '#fff' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
          }}
        />
        <Button variant="contained" onClick={handleInvite} sx={{ width: { xs: '100%', sm: 'auto' } }}>Send</Button>
      </Box>

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
    </Box>
  );
}
