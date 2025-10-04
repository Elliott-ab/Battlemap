import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography, Grid } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { listLibraryMaps, getLibraryMap } from '../Utils/mapService.js';

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [maps, setMaps] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user) return;
        const data = await listLibraryMaps(user.id);
        if (active) setMaps(data);
      } catch (e) {
        if (active) setError(e.message || 'Failed to load library maps');
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ color: '#d32f2f', fontWeight: 800 }}>Your Library</Typography>
            <Button variant="contained" onClick={() => navigate('/battlemap/LOCAL')}>Create Map</Button>
          </Box>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          {maps.length === 0 ? (
            <Paper sx={{ p: 3, bgcolor: '#2f2f2f' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>No saved maps yet.</Typography>
              <Button variant="outlined" onClick={() => navigate('/battlemap/LOCAL')}>Create your first map</Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {maps.map((m) => (
                <Grid key={m.id} item xs={12} sm={6} md={4} lg={3} xl={2}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      height: '100%',
                      bgcolor: '#2f2f2f',
                      color: '#fff',
                      borderRadius: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      '&:hover': { boxShadow: 8 },
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>{m.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#fff', opacity: 0.7 }}>
                      {new Date(m.updated_at).toLocaleString()}
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => {
                        navigate('/battlemap/LOCAL', { state: { libraryMapName: m.name } });
                      }}>Open In Battlemap</Button>
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
