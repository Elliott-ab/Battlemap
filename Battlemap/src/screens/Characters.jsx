import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography, Grid } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
// Sidebar removed on Characters page
import { useAuth } from '../auth/AuthContext.jsx';
import { listCharacters, getSignedCharacterIconUrl } from '../Utils/characterService.js';

export default function Characters() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedUrls, setResolvedUrls] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listCharacters(user.id);
        if (mounted) setCharacters(rows);
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Resolve signed URLs for private bucket icons
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const entries = await Promise.all((characters || []).map(async (c) => {
          if (!c.icon_url) return [c.id, ''];
          try {
            const signed = await getSignedCharacterIconUrl(c.icon_url);
            return [c.id, signed || c.icon_url];
          } catch (_) {
            return [c.id, ''];
          }
        }));
        if (active) setResolvedUrls(Object.fromEntries(entries));
      } catch (_) {
        // ignore
      }
    })();
    return () => { active = false; };
  }, [characters]);

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ color: '#d32f2f', fontWeight: 800 }}>Characters</Typography>
            <Button variant="contained" onClick={() => navigate('/characters/new')}>Build New Character</Button>
          </Box>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          {loading ? (
            <Typography>Loading…</Typography>
          ) : characters.length === 0 ? (
            <Paper sx={{ p: 3, bgcolor: '#2f2f2f' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>No characters yet.</Typography>
              <Button variant="outlined" onClick={() => navigate('/characters/new')}>Create your first character</Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {characters.map((c) => (
                <Grid key={c.id} item xs={12} sm={6} md={4} lg={3} xl={2}>
                  <Paper
                    elevation={3}
                    onClick={() => navigate(`/characters/${c.id}`)}
                    sx={{
                      p: 2,
                      height: '100%',
                      bgcolor: '#2f2f2f',
                      color: '#fff',
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      '&:hover': { boxShadow: 8 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2px solid rgba(255,255,255,0.25)',
                          bgcolor: '#3a3a3a',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {resolvedUrls[c.id] ? (
                          <img
                            src={resolvedUrls[c.id]}
                            alt=""
                            onError={() => setResolvedUrls((prev) => ({ ...prev, [c.id]: '' }))}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                          />
                        ) : (
                          <Typography variant="subtitle2" sx={{ color: '#fff' }}>
                            {(c.name || 'U').slice(0,1).toUpperCase()}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                          {c.name || 'Untitled Character'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#fff' }}>
                          {(c.race || 'Race')} {(c.class || 'Class')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#fff' }}>
                          Level {c.level || 1}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </div>
    </Box>
  );
}
