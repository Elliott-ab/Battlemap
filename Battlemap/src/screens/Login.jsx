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
  const from = location.state?.from?.pathname || '/dashboard';

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
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) return setError(err.message);
    navigate('/dashboard');
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Battlemap Account
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Login" />
          <Tab label="Sign Up" />
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
          {tab === 0 ? (
            <Button variant="contained" onClick={handleLogin} disabled={loading}>
              {loading ? 'Logging in…' : 'Login'}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSignup} disabled={loading}>
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
