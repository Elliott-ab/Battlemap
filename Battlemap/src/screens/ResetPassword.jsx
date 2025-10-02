import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Box, Button, Container, Paper, TextField, Typography, Alert } from '@mui/material';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('request'); // 'request' | 'update'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hasRecoveryToken = useMemo(() => {
    const url = new URL(window.location.href);
    const type = url.searchParams.get('type');
    return type === 'recovery' || window.location.hash.includes('type=recovery');
  }, []);

  useEffect(() => {
    if (hasRecoveryToken) setMode('update');
  }, [hasRecoveryToken]);

  const sendResetEmail = async () => {
    setError('');
    setMessage('');
  const redirectTo = `${window.location.origin}/#/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (err) return setError(err.message);
    setMessage('Check your email for the reset link.');
  };

  const updatePassword = async () => {
    setError('');
    setMessage('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) return setError(err.message);
    setMessage('Password updated. Redirecting…');
  setTimeout(() => navigate('/home'), 1000);
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {mode === 'request' ? 'Reset password' : 'Set a new password'}
        </Typography>
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
        {mode === 'request' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Button variant="contained" onClick={sendResetEmail}>
              Send reset email
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={updatePassword}>
              Update password
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
