import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, InputAdornment, Button, Typography, Alert } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CopyToClipboardButton from '../components/ui/buttons/CopyToClipboardButton.jsx';
import App from '../App.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { hostGame, joinGameByCode, endGame, leaveGame } from '../Utils/gameService.js';
import { getMapState, upsertMapState } from '../Utils/mapService.js';
import { supabase } from '../supabaseClient';
import { useGameSession } from '../Utils/GameSessionContext.jsx';

export default function BattlemapPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [hostResult, setHostResult] = useState(null);
  const [hostOpen, setHostOpen] = useState(false);
  const [error, setError] = useState('');
  const [gameId, setGameId] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const { setSession, clearSession, updateSession, game } = useGameSession();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [playersInGame, setPlayersInGame] = useState(0);
  const didEndOrLeaveRef = useRef(false);


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
    // Ensure we also listen for game-ended here for immediate navigation
    const sig = supabase
      .channel(`game-${gameId}-signals`)
      .on('broadcast', { event: 'game-ended' }, () => {
        clearSession();
        navigate('/home');
      })
      .subscribe();
    const channel = supabase
      .channel(`participants-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `game_id=eq.${gameId}` }, async (payload) => {
        const newRow = payload.new;
        // Avoid adding a token for the current user joining—their token can be added manually if needed
        // Add a token for the joining user if not present
        window.dispatchEvent(new CustomEvent('participant-joined', { detail: newRow }));
        if (newRow?.user_id === user?.id && newRow?.role) updateSession({ role: newRow.role });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'participants', filter: `game_id=eq.${gameId}` }, async (payload) => {
        const oldRow = payload.old;
        // Notify app to remove the player's token from local state
        try { window.dispatchEvent(new CustomEvent('participant-left', { detail: oldRow })); } catch {}
        // If the host participant was removed, end the session for everyone
        if (oldRow?.role === 'host') {
          clearSession();
          navigate('/home');
          return;
        }
        // If this client's participant row was removed by the host ending the game, exit
        if (oldRow?.user_id === user?.id) {
          clearSession();
          navigate('/home');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(sig); };
  }, [gameId]);

  // On tab/window close, remove participant or end game (host) similarly to explicit Leave Game
  useEffect(() => {
    if (!gameId || !user) return;
    const handler = async () => {
      if (didEndOrLeaveRef.current) return;
      didEndOrLeaveRef.current = true;
      try {
        const iAmHost = (user.id && game?.host_id && user.id === game.host_id) || game?.role === 'host';
        if (iAmHost) {
          // Best-effort: remove all players then remove host participant
          try { await endGame(gameId); } catch {}
          // Purge player tokens from LIVE
          try {
            const row = await getMapState(gameId, 'live').catch(() => null);
            const liveState = row?.state || {};
            const els = Array.isArray(liveState.elements) ? liveState.elements.filter(e => e?.type !== 'player') : [];
            const merged = { ...liveState, elements: els };
            await upsertMapState(gameId, 'live', merged, user.id);
            // Best-effort broadcast
            try {
              const ch = supabase.channel(`game-${gameId}-signals`);
              await ch.subscribe();
              await ch.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } });
              supabase.removeChannel(ch);
            } catch {}
          } catch {}
          try { await leaveGame(gameId, user.id); } catch {}
          // Try to broadcast game-ended; may be dropped on unload, but we attempt
          try {
            const ch = supabase.channel(`game-${gameId}-signals`);
            await ch.subscribe();
            await ch.send({ type: 'broadcast', event: 'game-ended', payload: { by: user.id, t: Date.now() } });
            supabase.removeChannel(ch);
          } catch {}
        } else {
          // Remove my token from LIVE before leaving
          try {
            const row = await getMapState(gameId, 'live').catch(() => null);
            const liveState = row?.state || {};
            const els = Array.isArray(liveState.elements)
              ? liveState.elements.filter(e => !(e?.type === 'player' && e.participantUserId === user.id))
              : [];
            const merged = { ...liveState, elements: els };
            await upsertMapState(gameId, 'live', merged, user.id);
            // Best-effort broadcast
            try {
              const ch = supabase.channel(`game-${gameId}-signals`);
              await ch.subscribe();
              await ch.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } });
              supabase.removeChannel(ch);
            } catch {}
          } catch {}
          try { await leaveGame(gameId, user.id); } catch {}
        }
        // Sign out locally when the tab is closing; sessionStorage will be cleared too
        try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      } catch {}
    };
    // pagehide fires for bfcache navigations and is more reliable on mobile; beforeunload as fallback
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, [gameId, user?.id, game?.host_id, game?.role]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* The App component already renders the main Toolbar; pass menu actions */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <App
          gameId={gameId}
          user={user}
          libraryLoadRequest={location.state && location.state.libraryMapName ? { name: location.state.libraryMapName } : null}
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
          onLeaveGame={async () => {
            try {
              if (!user || !gameId) { clearSession(); navigate('/home'); return; }
              const isHost = user.id && (user.id === (game?.host_id));
              // If role not yet in context, derive via RPC-loaded game in session
              const role = game?.role;
              const iAmHost = isHost || role === 'host';
              if (iAmHost) {
                // Count other participants (excluding host)
                const { count } = await supabase
                  .from('participants')
                  .select('user_id', { count: 'exact', head: true })
                  .eq('game_id', gameId)
                  .neq('user_id', user.id);
                const others = typeof count === 'number' ? count : 0;
                if (others > 0) {
                  setPlayersInGame(others);
                  setConfirmEndOpen(true);
                  return;
                }
                // No other players; end immediately
                try { await endGame(gameId); } catch {}
                // Purge all player tokens from LIVE so the game is clean for next session
                try {
                  const row = await getMapState(gameId, 'live').catch(() => null);
                  const liveState = row?.state || {};
                  const els = Array.isArray(liveState.elements) ? liveState.elements.filter(e => e?.type !== 'player') : [];
                  const merged = { ...liveState, elements: els };
                  await upsertMapState(gameId, 'live', merged, user.id);
                } catch {}
                // Broadcast end signal so any connected clients bail out
                try {
                  const ch = supabase.channel(`game-${gameId}-signals`);
                  await ch.subscribe();
                  await ch.send({ type: 'broadcast', event: 'game-ended', payload: { by: user.id, t: Date.now() } });
                  supabase.removeChannel(ch);
                } catch {}
                clearSession();
                navigate('/home');
              } else {
                // Non-host leaves: remove themselves from participants
                // Remove my token from LIVE first
                try {
                  const row = await getMapState(gameId, 'live').catch(() => null);
                  const liveState = row?.state || {};
                  const els = Array.isArray(liveState.elements)
                    ? liveState.elements.filter(e => !(e?.type === 'player' && e.participantUserId === user.id))
                    : [];
                  const merged = { ...liveState, elements: els };
                  await upsertMapState(gameId, 'live', merged, user.id);
                  // Broadcast change so others update promptly
                  try {
                    const ch = supabase.channel(`game-${gameId}-signals`);
                    await ch.subscribe();
                    await ch.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } });
                    supabase.removeChannel(ch);
                  } catch {}
                } catch {}
                try { await leaveGame(gameId, user.id); } catch {}
                clearSession();
                navigate('/home');
              }
            } catch (_) {
              clearSession();
              navigate('/home');
            }
          }}
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

      {/* Confirm end game (host only) */}
      <Dialog open={confirmEndOpen} onClose={() => setConfirmEndOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>End Game for Everyone?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {playersInGame > 0
              ? `There ${playersInGame === 1 ? 'is' : 'are'} ${playersInGame} player${playersInGame === 1 ? '' : 's'} in this game. Ending now will kick everyone and close the game.`
              : 'This will end the game.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEndOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => {
            try {
              await endGame(gameId);
              // Purge all player tokens from LIVE so the game is clean for next session
              try {
                const row = await getMapState(gameId, 'live').catch(() => null);
                const liveState = row?.state || {};
                const els = Array.isArray(liveState.elements) ? liveState.elements.filter(e => e?.type !== 'player') : [];
                const merged = { ...liveState, elements: els };
                await upsertMapState(gameId, 'live', merged, user?.id);
              } catch {}
              // Broadcast end signal; use a transient channel to send
              try {
                const ch = supabase.channel(`game-${gameId}-signals`);
                await ch.subscribe();
                await ch.send({ type: 'broadcast', event: 'game-ended', payload: { t: Date.now() } });
                supabase.removeChannel(ch);
              } catch {}
            } finally {
              setConfirmEndOpen(false);
              clearSession();
              navigate('/home');
            }
          }}>End Game</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
