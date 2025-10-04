import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment, IconButton, Alert } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { listLibraryMaps, getLibraryMap } from '../Utils/mapService.js';
import { hostGame, joinGameByCode } from '../Utils/gameService.js';
import { useGameSession } from '../Utils/GameSessionContext.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-regular-svg-icons';

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setSession, clearSession } = useGameSession();
  const [maps, setMaps] = useState([]);
  const [error, setError] = useState('');
  // Toolbar actions
  const [hostOpen, setHostOpen] = useState(false);
  const [hostResult, setHostResult] = useState(null);
  const [hostError, setHostError] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

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
      <Toolbar
        variant="dashboard"
        onJoinGame={() => setJoinOpen(true)}
        onHostGame={async () => {
          if (!user) return;
          setHostError('');
          try {
            const game = await hostGame(user.id);
            setHostResult(game);
            setHostOpen(true);
            setSession({ id: game.id, code: game.code, name: game.name || null, role: 'host' });
          } catch (e) {
            setHostError(e.message || 'Failed to host game');
          }
        }}
        onLeaveGame={() => { clearSession(); navigate('/home'); }}
      />
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
      {/* Toolbar: Host Game dialog */}
      <Dialog open={hostOpen} onClose={() => setHostOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Game Hosted</DialogTitle>
        <DialogContent>
          {hostError && (
            <Alert severity="error" sx={{ mb: 2 }}>{hostError}</Alert>
          )}
          {hostResult && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Share this invite code with your players:
              </Typography>
              <TextField
                label="Invite Code"
                value={hostResult.code}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => navigator.clipboard.writeText(hostResult.code)}>
                        <FontAwesomeIcon icon={faCopy} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHostOpen(false)}>Close</Button>
          {hostResult && (
            <Button variant="contained" onClick={() => { setHostOpen(false); navigate(`/battlemap/${hostResult.code}`); }}>
              Go to Battlemap
            </Button>
          )}
        </DialogActions>
      </Dialog>
      {/* Toolbar: Join Game dialog */}
      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Join Game</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Enter an invite code to join a game.
          </Typography>
          <TextField label="Invite Code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            try {
              const codeTrim = joinCode.trim().toUpperCase();
              if (!codeTrim || !user) return;
              const game = await joinGameByCode(user.id, codeTrim);
              setJoinOpen(false);
              setSession({ id: game.id, code: game.code, name: game.name || null, role: 'player', host_id: game.host_id, promptCharacter: true });
              navigate(`/battlemap/${game.code}`);
            } catch (e) {
              setError(e.message);
            }
          }}>Join</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
