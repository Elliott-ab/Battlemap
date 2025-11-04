import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, Alert, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import CopyToClipboardButton from '../components/ui/buttons/CopyToClipboardButton.jsx';
import IconButton from '../components/common/IconButton.jsx';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthContext.jsx';
import { hostGame, joinGameByCode, listCampaignsByHost } from '../Utils/gameService.js';
import Toolbar from '../components/Toolbar.jsx';
import { deleteUserAccountData } from '../Utils/userService.js';
import UserSettingsModal from '../components/Modals/UserSettingsModal.jsx';
import { useGameSession } from '../Utils/GameSessionContext.jsx';
// Sidebar removed on Home page
// Dialog imports consolidated above

export default function Dashboard() {
  const { user } = useAuth();
  const { clearSession, setSession, game: sessionGame } = useGameSession();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSetUsernameHint, setShowSetUsernameHint] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [editName, setEditName] = useState('');
  // Toolbar menu modals
  const [hostOpen, setHostOpen] = useState(false);
  const [hostResult, setHostResult] = useState(null);
  const [hostError, setHostError] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  

  // Creation happens via the Campaign modal (when selectedCampaign has no id)

  // Copy handled via CopyToClipboardButton; show a brief toast when copied.
  const handleCopied = () => { setMessage('Copied invite code'); setTimeout(() => setMessage(''), 1200); };

  const deleteCampaign = async (campaign) => {
    if (!campaign) return;
    const ok = window.confirm(`Delete campaign "${campaign.name || 'Untitled Campaign'}"? This cannot be undone.`);
    if (!ok) return;
    setError('');
    try {
      const { error } = await supabase.from('games').delete().eq('id', campaign.id);
      if (error) throw error;
      setCampaigns(prev => (prev || []).filter(c => c.id !== campaign.id));
      // If the deleted one is currently selected in the modal, close it
      setSelectedCampaign((sel) => (sel && sel.id === campaign.id ? null : sel));
      // If this was the active session game, end the session
      if (sessionGame?.id === campaign.id) clearSession();
    } catch (e) {
      setError(e.message || 'Failed to delete campaign');
    }
  };

  const doJoin = async () => {
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) return;
      const game = await joinGameByCode(user.id, code);
      // Ensure session is populated so App can prompt for character selection on join
      setSession({ id: game.id, code: game.code, name: game.name || null, role: 'player', host_id: game.host_id, promptCharacter: true });
      navigate(`/battlemap/${game.code}`);
    } catch (e) {
      setError(e.message);
    }
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listCampaignsByHost(user.id);
        if (mounted) setCampaigns(rows || []);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [user?.id]);


  // If navigated here via toolbar settings icon, auto-open settings
  React.useEffect(() => {
    try {
      const shouldOpen = sessionStorage.getItem('open-settings');
      if (shouldOpen) {
        sessionStorage.removeItem('open-settings');
        setShowSettings(true);
      }
    } catch (_) {}
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearSession();
    navigate('/login');
  };

  // Prompt to set a username after login if missing
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id) return;
        const mod = await import('../Utils/userService.js');
        const prof = await mod.getUserProfile(user.id);
        if (mounted && (!prof || !prof.username)) {
          setShowSetUsernameHint('Choose a unique username to use as your gamertag.');
          setShowSettings(true);
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Settings actions are now handled by the shared UserSettingsModal

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        variant="dashboard"
        onSettingsClick={() => setShowSettings(true)}
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
            <Typography variant="h5">Home</Typography>
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
      {/* Join a Game section at the top, styled like a campaign card */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 800, mb: 1.5 }}>Join a Game</Typography>
        <Paper sx={{ p: 2, bgcolor: '#2f2f2f', color: '#fff', borderRadius: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              fullWidth
              sx={{
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
              }}
            />
            <Button variant="contained" onClick={doJoin}>Join</Button>
          </Box>
        </Paper>
      </Box>
      {/* My Campaigns */}
      <Box sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', mb: 1.5 }}>
          <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 800 }}>My Campaigns</Typography>
          <IconButton title="Add campaign" onClick={() => { setSelectedCampaign({ id: null, name: '', description: '' }); setEditName(''); }} sx={{ ml: 1 }}>
            <FontAwesomeIcon icon={faCirclePlus} style={{ color: '#f44336' }} />
          </IconButton>
        </Box>
        {campaigns.length === 0 ? (
          <Paper sx={{ p: 3, bgcolor: '#2f2f2f' }}>
            <Typography color="text.secondary">No campaigns yet. Click the plus to create one.</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {campaigns.map((g) => (
              <Paper
                key={g.id}
                elevation={3}
                onClick={() => { setSelectedCampaign(g); setEditName(g.name || ''); }}
                sx={{
                  p: 2,
                  bgcolor: '#2f2f2f',
                  color: '#fff',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': { boxShadow: 8 },
                  height: { xs: 120, sm: 'auto' },
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: '#fff' }}
                    noWrap
                    title={g.name || 'Untitled Campaign'}
                  >
                    {g.name || 'Untitled Campaign'}
                  </Typography>
                  {(g.description || '').trim() && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#fff',
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: { xs: 2, sm: 3 },
                        overflow: 'hidden',
                      }}
                      title={g.description}
                    >
                      {g.description}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: '#ccc' }} noWrap title={`Code: ${g.code}`}>
                    Code: {g.code}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: 0.75 }}>
                  <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); setSession({ id: g.id, code: g.code, name: g.name || null, role: 'host', host_id: g.host_id || user.id }); navigate(`/battlemap/${g.code}`); }}>Start campaign</Button>
                  <CopyToClipboardButton title="Copy code" onClick={(e) => e.stopPropagation()} value={g.code} onCopied={handleCopied} />
                  <IconButton title="Delete campaign" onClick={(e) => { e.stopPropagation(); deleteCampaign(g); }}>
                    <FontAwesomeIcon icon={faTrashCan} style={{ color: '#f44336' }} />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
      {/* Campaign details modal */}
      <Dialog
        open={!!selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { bgcolor: '#2f2f2f', color: '#fff' } }}
      >
        <DialogTitle>Campaign</DialogTitle>
        <DialogContent>
          {selectedCampaign && (
            <>
              <TextField
                label="Campaign name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                fullWidth
                sx={{
                  mt: 1,
                  '& .MuiInputBase-input': { color: '#fff' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                }}
              />
              <TextField
                label="Description (optional)"
                value={selectedCampaign.description || ''}
                onChange={(e) => setSelectedCampaign(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
                sx={{
                  mt: 1.25,
                  mb: 2,
                  '& .MuiInputBase-input': { color: '#fff' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                }}
              />
              {selectedCampaign.id && (
                <TextField
                  label="Invite Code"
                  value={selectedCampaign.code}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <CopyToClipboardButton value={selectedCampaign.code} onCopied={handleCopied} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiInputBase-input': { color: '#fff' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    '& .MuiInputLabel-root': { color: '#fff' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
                  }}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCampaign(null)}>Close</Button>
          {selectedCampaign && (
            <>
              <Button onClick={async () => {
                try {
                  if (!selectedCampaign.id) {
                    // Create new campaign
                    const game = await hostGame(user.id, editName, selectedCampaign.description || '');
                    setCampaigns(prev => [{ ...game, name: editName, description: (selectedCampaign.description || null) }, ...(prev || [])]);
                    setSelectedCampaign(null);
                    return;
                  }
                  // Update existing
                  const payload = {};
                  if ((editName || '').trim()) payload.name = editName.trim();
                  const desc = (selectedCampaign.description || '').toString();
                  if (desc.trim()) payload.description = desc.trim(); else payload.description = null;
                  if (Object.keys(payload).length) {
                    await supabase.from('games').update(payload).eq('id', selectedCampaign.id);
                    setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, ...payload } : c));
                  }
                } catch (_) { /* ignore */ }
                setSelectedCampaign(null);
              }}>Save</Button>
              {selectedCampaign.id && (
                <Button variant="contained" onClick={() => { const code = selectedCampaign.code; setSelectedCampaign(null); navigate(`/battlemap/${code}`); }}>Open Battlemap</Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
      <UserSettingsModal open={showSettings} onClose={() => setShowSettings(false)} hint={showSetUsernameHint} />
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
                      <CopyToClipboardButton value={hostResult.code} onCopied={handleCopied} />
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
        </div>
      </div>
    </Box>
  );
}
