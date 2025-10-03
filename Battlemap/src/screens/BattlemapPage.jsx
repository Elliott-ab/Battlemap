import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, InputAdornment, Button, Typography, Alert } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-regular-svg-icons';
import App from '../App.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { hostGame, joinGameByCode } from '../Utils/gameService.js';
import { supabase } from '../supabaseClient';
import { useGameSession } from '../Utils/GameSessionContext.jsx';

export default function BattlemapPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hostResult, setHostResult] = useState(null);
  const [hostOpen, setHostOpen] = useState(false);
  const [error, setError] = useState('');
  const [gameId, setGameId] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const { setSession, clearSession, updateSession } = useGameSession();

  const copyCode = async () => {
    if (!hostResult?.code) return;
    try { await navigator.clipboard.writeText(hostResult.code); } catch {}
  };

  // Resolve game id for this code once on mount (so we can subscribe to participants)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!code) return;
      // Use RPC (avoids RLS recursion on games)
      const { data: rpcData } = await supabase.rpc('get_game_by_code', { v_code: code }).single();
      if (mounted) setGameId(rpcData?.id || null);
      if (mounted && rpcData) {
        const role = rpcData.host_id === user?.id ? 'host' : undefined;
        // Merge into existing session so flags like promptCharacter are preserved
        updateSession({ id: rpcData.id, code: rpcData.code, name: rpcData.name || null, host_id: rpcData.host_id, role });
      }
    })();
    return () => { mounted = false; };
  }, [code, user?.id]);

  // Subscribe to participants joining and add a player token if not present
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`participants-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `game_id=eq.${gameId}` }, async (payload) => {
        const newRow = payload.new;
        // Avoid adding a token for the current user joining—their token can be added manually if needed
        // Add a token for the joining user if not present
        window.dispatchEvent(new CustomEvent('participant-joined', { detail: newRow }));
        if (newRow?.user_id === user?.id && newRow?.role) updateSession({ role: newRow.role });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* The App component already renders the main Toolbar; pass menu actions */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <App
          gameId={gameId}
          user={user}
          onHostGame={async () => {
            if (!user) return;
            setError('');
            try {
              const game = await hostGame(user.id);
              setHostResult(game);
              setHostOpen(true);
              setSession({ id: game.id, code: game.code, name: game.name || null, role: 'host' });
            } catch (e) {
              setError(e.message);
            }
          }}
          onLeaveGame={() => { clearSession(); navigate('/home'); }}
          onJoinGame={() => setJoinOpen(true)}
        />
      </Box>
      <Dialog open={hostOpen} onClose={() => setHostOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Game Hosted</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
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
                      <IconButton onClick={copyCode}>
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
