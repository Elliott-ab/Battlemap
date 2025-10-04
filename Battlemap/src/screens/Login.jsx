import React, { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Box,
  Container,
  Tab,
  Tabs,
  TextField,
  Typography,
  Button,
  Alert,
  Link,
  Paper,
} from '@mui/material';

export default function Login() {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/home';
  // Enable sign-up only when explicitly opted-in via URL flag
  // Works with both HashRouter (#/login?testMode=true) and standard routing (?testMode=true)
  const searchStr = (location && location.search) ? location.search : (typeof window !== 'undefined' ? window.location.search : '');
  const qp = new URLSearchParams(searchStr || '');
  const testModeRaw = (qp.get('testMode') || '').toLowerCase();
  const testModeEnabled = testModeRaw === 'true' || testModeRaw === '1' || testModeRaw === 'yes';

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) return setError(err.message);
    navigate(from, { replace: true });
  };

  const handleSignup = async () => {
    setError('');
    setLoading(true);
    if (!testModeEnabled) {
      setLoading(false);
      setError('Sign up is disabled. Append ?testMode=true to enable test sign-up.');
      return;
    }
    // Ensure the email confirmation link redirects to the correct deployed path.
    // In production, import.meta.env.BASE_URL should be '/Battlemap/' (from vite.config base).
    // In dev, it's usually '/'.
    const redirectBase = new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectBase },
    });
    setLoading(false);
    if (err) return setError(err.message);
  navigate('/home');
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Battlemap Account
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Login" />
          <Tab label="Sign Up" disabled={!testModeEnabled} />
        </Tabs>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          {tab === 0 || !testModeEnabled ? (
            <Button variant="contained" onClick={handleLogin} disabled={loading}>
              {loading ? 'Logging in…' : 'Login'}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSignup} disabled={loading || !testModeEnabled}>
              {loading ? 'Creating…' : 'Create Account'}
            </Button>
          )}
          <Link component={RouterLink} to="/reset-password" underline="hover" sx={{ alignSelf: 'flex-start' }}>
            Forgot password?
          </Link>
        </Box>
      </Paper>
    </Container>
  );
}
