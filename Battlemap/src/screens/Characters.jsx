import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment, IconButton, Alert } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
// Sidebar removed on Characters page
import { useAuth } from '../auth/AuthContext.jsx';
import { listCharacters, getSignedCharacterIconUrl } from '../Utils/characterService.js';
import { hostGame, joinGameByCode } from '../Utils/gameService.js';
import { useGameSession } from '../Utils/GameSessionContext.jsx';
import CopyToClipboardButton from '../components/ui/buttons/CopyToClipboardButton.jsx';
import FellowshipModal from '../components/Modals/FellowshipModal.jsx';

export default function Characters() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setSession, clearSession } = useGameSession();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedUrls, setResolvedUrls] = useState({});
  // Toolbar actions
  const [hostOpen, setHostOpen] = useState(false);
  const [hostResult, setHostResult] = useState(null);
  const [hostError, setHostError] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newCharacterOpen, setNewCharacterOpen] = useState(false);
  const [fellowshipOpen, setFellowshipOpen] = useState(false);

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
      <Toolbar
        variant="dashboard"
        onFellowshipClick={() => setFellowshipOpen(true)}
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
  <div className="page-container">
  <Box className="hide-scrollbar" sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ color: '#d32f2f', fontWeight: 800 }}>Characters</Typography>
              <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, mt: 0.25, letterSpacing: 0.2 }}>
                Character Slots Used: {(characters || []).length}/6
              </Typography>
            </Box>
            <Button variant="contained" onClick={() => setNewCharacterOpen(true)} disabled={(characters || []).length >= 6}>
              Build New Character
            </Button>
          </Box>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          {loading ? (
            <Typography>Loading…</Typography>
          ) : characters.length === 0 ? (
            <Paper sx={{ p: 3, bgcolor: '#2f2f2f' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>No characters yet.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {characters.map((c) => (
                <Grid key={c.id} item xs={12} sm={6} md={4} lg={4} xl={4}>
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
      </div>
      {/* Toolbar: Host Game dialog */}
      <FellowshipModal open={fellowshipOpen} onClose={() => setFellowshipOpen(false)} gameId={null} />
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
                      <CopyToClipboardButton value={hostResult.code} />
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

      {/* Create Character dialog */}
      <Dialog open={newCharacterOpen} onClose={() => setNewCharacterOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create Character</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            How would you like to create your character?
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              variant="contained"
              onClick={() => {
                setNewCharacterOpen(false);
                navigate('/characters/new');
              }}
            >
              Build from scratch
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setNewCharacterOpen(false);
                navigate('/characters/new/guided');
              }}
            >
              GUIDED CREATION
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCharacterOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
