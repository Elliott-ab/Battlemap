import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Button, TextField, Typography, Alert, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useGameSession } from '../../Utils/GameSessionContext.jsx';
import { deleteUserAccountData, getUserProfile, setUsername } from '../../Utils/userService.js';

export default function UserSettingsModal({ open, onClose, hint = '' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clearSession } = useGameSession();

  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [username, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load profile when opened
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!open || !user?.id) return;
        setMessage(''); setError(''); setUsernameStatus('');
        const prof = await getUserProfile(user.id);
        if (active) {
          setUsernameInput(prof?.username || '');
          setEmail(user.email || '');
          setPassword('');
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [open, user?.id]);

  const updateEmail = async () => {
    setError(''); setMessage('');
    const { error: err } = await supabase.auth.updateUser({ email });
    if (err) return setError(err.message);
    setMessage('Email update requested. Check your inbox to confirm.');
  };

  const updatePassword = async () => {
    setError(''); setMessage('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) return setError(err.message);
    setMessage('Password updated.');
    setPassword('');
  };

  const saveUsername = async () => {
    setUsernameStatus('');
    try {
      const desired = (username || '').trim();
      if (!desired) { setUsernameStatus('Please enter a username.'); return; }
      await setUsername(user.id, desired);
      setUsernameStatus('Username updated.');
    } catch (e) {
      setUsernameStatus(e.message || 'Failed to update username.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteUserAccountData(user.id);
      await supabase.auth.signOut();
      clearSession();
      navigate('/login');
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>User Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hint ? (<Alert severity="info">{hint}</Alert>) : null}
            {message && (<Alert severity="success">{message}</Alert>)}
            {error && (<Alert severity="error">{error}</Alert>)}
            <Typography variant="subtitle1">Profile</Typography>
            <TextField label="Username" value={username} onChange={(e) => setUsernameInput(e.target.value)} fullWidth helperText="Your public display name (must be unique)." />
            <Button onClick={saveUsername}>Update Username</Button>
            {usernameStatus && <Alert severity={usernameStatus.includes('updated') ? 'success' : 'error'}>{usernameStatus}</Alert>}
            <Divider sx={{ my: 2 }} />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Button onClick={updateEmail}>Update Email</Button>
            <TextField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            <Button onClick={updatePassword}>Update Password</Button>
            <Button variant="outlined" onClick={() => navigate('/reset-password')}>Reset Password via Email</Button>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#d32f2f' }}>Danger zone</Typography>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Deleting your account will remove your characters, library maps, participation in games, and any campaigns you host. This cannot be undone.
            </Typography>
            <Box>
              <Button color="error" variant="contained" onClick={() => { setConfirmDeleteText(''); setConfirmDeleteOpen(true); }}>
                Delete Account
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Confirm Delete Account */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This action is permanent. Type DELETE to confirm.
          </Typography>
          <TextField autoFocus fullWidth label="Type DELETE to confirm" value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)} />
          {deleting && <Typography sx={{ mt: 1 }} variant="body2">Deleting your data…</Typography>}
          {deleteError && <Alert severity="error" sx={{ mt: 1 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" disabled={confirmDeleteText !== 'DELETE' || deleting} onClick={handleDeleteAccount}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
