import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export const useGameSession = () => useContext(GameSessionContext);
