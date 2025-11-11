import React, { useEffect, useState } from 'react';
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

  // Supabase removes the recovery params from the URL after parsing.
  // So don't depend on window.location. Instead, listen for the
  // PASSWORD_RECOVERY event and also fall back to "session exists" check.
  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
      }
    });

    // Fallback: if a session is present (temporary recovery session or signed-in user),
    // allow updating password from this screen.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setMode('update');
        return;
      }
      // If Supabase didn't adopt the session (common with HashRouter double-hash), try to adopt manually
      await tryAdoptSessionFromUrl();
    });

    // Extra fallback for local testing: if URL still has recovery tokens, switch to update mode
    try {
      const href = typeof window !== 'undefined' ? window.location.href : '';
      if (href.includes('type=recovery') || href.includes('access_token=')) {
        setMode('update');
      }
    } catch (_) { /* ignore */ }

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Attempt to parse access_token/refresh_token from the URL (hash or query) and set a session.
  // This helps on localhost with HashRouter where the URL can become `#/reset-password#access_token=...`.
  async function tryAdoptSessionFromUrl() {
    try {
      if (typeof window === 'undefined') return false;
      const href = window.location.href || '';
      let tokenSegment = '';
      const hash = window.location.hash || '';

      // If there are multiple #, grab the last segment, which likely contains tokens
      const hashParts = href.split('#');
      if (hashParts.length > 2) {
        tokenSegment = hashParts[hashParts.length - 1];
      } else if (hash && (hash.includes('access_token=') || hash.includes('refresh_token='))) {
        tokenSegment = hash.startsWith('#') ? hash.slice(1) : hash;
      }

      // Fallback to querystring
      if (!tokenSegment && window.location.search) {
        const qs = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search;
        if (qs.includes('access_token=') || qs.includes('refresh_token=')) tokenSegment = qs;
      }

      if (!tokenSegment) return false;
      const params = new URLSearchParams(tokenSegment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return false;

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) return false;

      try {
        const cleanUrl = `${window.location.origin}/#/reset-password`;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (_) { /* ignore */ }
      setMode('update');
      return true;
    } catch (_) {
      return false;
    }
  }

  const sendResetEmail = async () => {
    setError('');
    setMessage('');
    // With HashRouter we must include the hash route in redirectTo
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
