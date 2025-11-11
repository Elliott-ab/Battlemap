import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthContext.jsx';

const STORAGE_KEY = 'bm_current_game';

// game shape: { id, code, name?, role?: 'host'|'player' }
const GameSessionContext = createContext({
  game: null,
  setSession: (_game) => {},
  clearSession: () => {},
  updateSession: (_partial) => {},
});

export function GameSessionProvider({ children }) {
  const [game, setGame] = useState(null);
  const { user } = useAuth() || { user: null };

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setGame(JSON.parse(raw));
    } catch {}
  }, []);

  const setSession = (g) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(g || null)); } catch {}
    setGame(g || null);
  };
  const clearSession = () => setSession(null);
  const updateSession = (partial) => {
    setGame((prev) => {
      const next = { ...(prev || {}), ...(partial || {}) };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const value = useMemo(() => ({ game, setSession, clearSession, updateSession }), [game]);
  // Global host-availability responder: if this client is the host of the active game,
  // listen for host-check broadcasts and reply with host-ack regardless of which page we're on.
  useEffect(() => {
    const gameId = game?.id;
    const iAmHost = !!(gameId && ((game?.role === 'host') || (user?.id && game?.host_id && user.id === game.host_id)));
    if (!gameId || !iAmHost) return;
    const sig = supabase.channel(`game-${gameId}-signals`);
    sig
      .on('broadcast', { event: 'host-check' }, async () => {
        try {
          await sig.send({ type: 'broadcast', event: 'host-ack', payload: { t: Date.now(), host_id: user?.id } });
        } catch (_) { /* noop */ }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(sig); } catch {} };
  }, [game?.id, game?.role, game?.host_id, user?.id]);

  // Optional: lightweight presence tracking so others can see host online status across pages.
  // Not required for joining, but helpful for UI and future features.
  useEffect(() => {
    const gameId = game?.id;
    const userId = user?.id;
    if (!gameId || !userId) return;
    const presence = supabase.channel(`game-${gameId}-presence`, { config: { presence: { key: userId } } });
    presence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await presence.track({ role: game?.role || (userId === game?.host_id ? 'host' : 'player'), t: Date.now() });
        } catch (_) { /* noop */ }
      }
    });
    return () => { try { supabase.removeChannel(presence); } catch {} };
  }, [game?.id, game?.role, game?.host_id, user?.id]);

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export const useGameSession = () => useContext(GameSessionContext);
