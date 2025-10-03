import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Paper, TextField, Typography, Alert, IconButton, InputAdornment } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-regular-svg-icons';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthContext.jsx';
import { hostGame, joinGameByCode } from '../Utils/gameService.js';
import Toolbar from '../components/Toolbar.jsx';
// Sidebar removed on Home page
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hostResult, setHostResult] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const doHost = async () => {
    setError('');
    try {
      const game = await hostGame(user.id);
      setHostResult(game);
    } catch (e) {
      setError(e.message);
    }
  };

  const copyCode = async () => {
    if (!hostResult?.code) return;
    try {
      await navigator.clipboard.writeText(hostResult.code);
      setMessage('Copied invite code');
      setTimeout(() => setMessage(''), 1200);
    } catch (_) {
      /* ignore */
    }
  };

  const doJoin = async () => {
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) return;
      const game = await joinGameByCode(user.id, code);
      navigate(`/battlemap/${game.code}`);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateEmail = async () => {
    setError('');
    setMessage('');
    const { error: err } = await supabase.auth.updateUser({ email });
    if (err) return setError(err.message);
    setMessage('Email update requested. Check your inbox to confirm.');
  };

  const updatePassword = async () => {
    setError('');
    setMessage('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) return setError(err.message);
    setMessage('Password updated.');
    setPassword('');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" onSettingsClick={() => setShowSettings(true)} />
      <div className="main-content">
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Home</Typography>
            <Button onClick={signOut}>Sign out</Button>
          </Box>
      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Host a Game
            </Typography>
            <Button variant="contained" onClick={doHost} sx={{ mb: 2 }}>
              Generate Invite Code
            </Button>
            {hostResult && (
              <TextField
                label="Invite Code"
                value={hostResult.code}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={copyCode}>
                        <FontAwesomeIcon icon={faCopy} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                fullWidth
              />
            )}
            {hostResult && (
              <Button sx={{ mt: 1 }} onClick={() => navigate(`/battlemap/${hostResult.code}`)}>
                Go to Battlemap
              </Button>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Join a Game
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} fullWidth />
              <Button variant="contained" onClick={doJoin}>
                Join
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} fullWidth maxWidth="sm">
        <DialogTitle>User Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Button onClick={updateEmail}>Update Email</Button>
            <TextField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            <Button onClick={updatePassword}>Update Password</Button>
            <Button variant="outlined" onClick={() => navigate('/reset-password')}>Reset Password via Email</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
        </Box>
      </div>
    </Box>
  );
}
