import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { listCharacters } from '../utils/characterService.js';

export default function Characters() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <DashboardSidebar
          onOpenBattlemap={() => navigate('/battlemap/LOCAL')}
          onOpenCharacters={() => navigate('/characters')}
        />
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Characters</Typography>
            <Button variant="contained" onClick={() => navigate('/characters/new')}>Build New Character</Button>
          </Box>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Open Existing Character</Typography>
            {loading ? (
              <Typography>Loading…</Typography>
            ) : characters.length === 0 ? (
              <Typography color="text.secondary">No characters yet.</Typography>
            ) : (
              <List>
                {characters.map((c, idx) => (
                  <React.Fragment key={c.id}>
                    <ListItem button onClick={() => navigate(`/characters/${c.id}`)}>
                      <ListItemText primary={c.name || 'Untitled Character'} secondary={`${c.race || 'Race'} ${c.class || 'Class'} • Level ${c.level || 1}`} />
                    </ListItem>
                    {idx < characters.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Box>
      </div>
    </Box>
  );
}
