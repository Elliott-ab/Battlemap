import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGear, faCircle, faBell, faBars } from '@fortawesome/free-solid-svg-icons';
import IconButton from './common/IconButton.jsx';
import { useGameSession } from '../Utils/GameSessionContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { listNotificationsForUser, respondToFellowshipInvite, markNotificationRead } from '../Utils/notificationsService.js';
import { joinGameByCode } from '../Utils/gameService.js';
import { supabase } from '../supabaseClient';

// variant: 'battlemap' | 'dashboard'
const Toolbar = ({
  isDrawingCover,
  showGridModal,
  clearMap,
  undo,
  onSaveMap,
  onLoadMap,
  onSaveLibrary,
  onLoadLibrary,
  gridSize,
  openGlobalModifiers,
  variant = 'battlemap',
  onSettingsClick,
  logoHref = '#/home',
  onHostGame,
  onLeaveGame,
  onJoinGame,
  isHost,
  onPushToPlayers,
  onToggleChannel,
  currentChannel,
  onFellowshipClick,
  onNotificationsClick,
}) => {
  const { game, setSession, clearSession } = useGameSession();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Normalize Vite base URL to always end with a single '/'
  const rawBase = import.meta.env.BASE_URL || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  // Try user-provided name first, then common defaults
  // Prefer known-present PNG first to avoid a 404 flicker on initial mount
  // If you add a matching WebP later, you can swap order.
  const logoCandidates = [
    `${base}dicelogo.png`,
    `${base}dicelogo.webp`,
    `${base}logo.svg`,
    `${base}logo.png`,
    `${base}logo.webp`,
  ];
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]); // merged server + ephemeral
  const [ephemeralNotifs, setEphemeralNotifs] = useState([]); // realtime-only
  const [notifError, setNotifError] = useState('');
  const [burgerOpen, setBurgerOpen] = useState(false);
  

  const mergeNotifications = useCallback((serverRows, ephemeralRows) => {
    const server = Array.isArray(serverRows) ? serverRows : [];
    const ep = Array.isArray(ephemeralRows) ? ephemeralRows : [];
    const out = [...server];
    const isGameInvite = (n) => n?.type === 'game_invite' && (n?.payload?.game_code || n?.payload?.code);
    const serverCodes = new Set(server.filter(isGameInvite).map(n => String(n.payload.game_code || n.payload.code)));
    const serverIds = new Set(server.map(n => n.id));
    for (const e of ep) {
      if (e?.id && serverIds.has(e.id)) continue;
      if (isGameInvite(e)) {
        const code = String(e.payload.game_code || e.payload.code);
        if (serverCodes.has(code)) continue;
      }
      out.unshift(e);
    }
    return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, []);

  const loadNotifs = useCallback(async () => {
    try {
      setNotifError('');
      const rows = await listNotificationsForUser(user);
      setNotifs(mergeNotifications(rows || [], ephemeralNotifs));
    } catch (e) {
      setNotifError(e.message || 'Failed to load notifications');
    }
  }, [user?.id, mergeNotifications, ephemeralNotifs]);

  useEffect(() => {
    if (notifOpen) loadNotifs();
  }, [notifOpen, loadNotifs]);

  // Realtime: receive ephemeral game invites when notifications insert is blocked by RLS
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-${user.id}-signals`)
      .on('broadcast', { event: 'game-invite' }, (payload) => {
        try {
          const p = payload?.payload || {};
          const message = p?.message || 'You have been invited to a game';
          const n = {
            id: `rt:game:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
            type: 'game_invite',
            message,
            payload: p?.payload || {},
            created_at: new Date().toISOString(),
            read_at: null,
          };
          setEphemeralNotifs((prev) => [n, ...(prev || [])]);
          setNotifs((prev) => mergeNotifications(prev || [], [n]));
        } catch (_) {}
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user?.id, mergeNotifications]);

  // Also listen on an email-based channel in case an invite is broadcasted by email
  useEffect(() => {
    const email = user?.email || null;
    if (!email) return;
    const channel = supabase
      .channel(`email-${email}-signals`)
      .on('broadcast', { event: 'game-invite' }, (payload) => {
        try {
          const p = payload?.payload || {};
          const message = p?.message || 'You have been invited to a game';
          const n = {
            id: `rt:game:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
            type: 'game_invite',
            message,
            payload: p?.payload || {},
            created_at: new Date().toISOString(),
            read_at: null,
          };
          setEphemeralNotifs((prev) => [n, ...(prev || [])]);
          setNotifs((prev) => mergeNotifications(prev || [], [n]));
        } catch (_) {}
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user?.email, mergeNotifications]);

  const handleBellClick = () => {
    setBurgerOpen(false);
    if (onNotificationsClick) return onNotificationsClick();
    // Toggle internal popover
    setNotifOpen(v => !v);
  };

  const handleSettingsClick = () => {
    if (onSettingsClick) return onSettingsClick();
    try {
      // Hint Dashboard to open settings dialog when we arrive
      sessionStorage.setItem('open-settings', '1');
    } catch (_) {}
    navigate('/home');
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    try { clearSession(); } catch (_) {}
    try { navigate('/login'); } catch (_) {}
  };

  const handleBurgerClick = () => {
    setNotifOpen(false);
    setBurgerOpen(v => !v);
  };

  const navigateAndCloseBurger = (to) => {
    try { setBurgerOpen(false); } catch {}
    if (typeof to === 'string') navigate(to);
  };

  const handleNotifAction = async (n, action) => {
    try {
      if (n.type === 'fellowship_invite' && (action === 'accept' || action === 'decline')) {
        await respondToFellowshipInvite(n, action, user);
        if (action === 'accept') {
          // Automatically open Fellowship page after accepting
          setNotifOpen(false);
          navigate('/fellowship');
        }
      } else if (n.type === 'game_invite' && (action === 'accept' || action === 'decline')) {
        if (action === 'accept') {
          // Join the game like the Join Game flow using the provided code
          const code = n?.payload?.game_code || n?.payload?.code || null;
          if (!code) throw new Error('This invite is missing a game code.');
          const g = await joinGameByCode(user.id, String(code).toUpperCase());
          // Mirror Dashboard join behavior
          setSession({ id: g.id, code: g.code, name: g.name || null, role: 'player', host_id: g.host_id, promptCharacter: true });
          await markNotificationRead(n.id).catch(() => {});
          // Remove any matching ephemeral invites (by code)
          setEphemeralNotifs((prev) => (prev || []).filter(e => String(e?.payload?.game_code || e?.payload?.code || '') !== String(code)));
          setNotifOpen(false);
          navigate(`/battlemap/${g.code}`);
        } else {
          await markNotificationRead(n.id);
          // Remove from ephemeral list by id/code
          setEphemeralNotifs((prev) => (prev || []).filter(e => e.id !== n.id));
        }
      } else if (action === 'read') {
        await markNotificationRead(n.id);
      }
      await loadNotifs();
    } catch (e) {
      setNotifError(e.message || 'Action failed');
    }
  };

  const Logo = (
    <img
      src={logoCandidates[0]}
      data-fallback-idx="0"
      onError={(e) => {
        const current = parseInt(e.currentTarget.getAttribute('data-fallback-idx') || '0', 10);
        const next = current + 1;
        if (next < logoCandidates.length) {
          e.currentTarget.setAttribute('data-fallback-idx', String(next));
          e.currentTarget.src = logoCandidates[next];
        } else {
          e.currentTarget.onerror = null;
        }
      }}
      alt="Battlemap Logo"
      decoding="async"
      style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain', display: 'block', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
    />
  );

  return (
    <header className={`toolbar ${variant === 'dashboard' ? 'toolbar--dashboard' : 'toolbar--battlemap'}`}>
      <a href={logoHref} className="toolbar-logo" title="Home" aria-label="Home">
        {Logo}
      </a>
      <div className="toolbar-icons">
        {/* Quick-access Clear/Undo removed */}
      </div>
      {/* Red navigation links */}
      <nav className="toolbar-nav" aria-label="Primary">
        <NavLink
          to="/home"
          className={({ isActive }) => `toolbar-link ${isActive ? 'active' : ''}`}
          title="Home"
        >
          Home
        </NavLink>
        <NavLink
          to="/library"
          className={({ isActive }) => `toolbar-link ${isActive ? 'active' : ''}`}
          title="Library"
        >
          Library
        </NavLink>
        <NavLink
          to={game?.code ? `/battlemap/${game.code}` : '/battlemap/LOCAL'}
          className={({ isActive }) => `toolbar-link ${isActive ? 'active' : ''}`}
          title="Battlemap"
        >
          Battlemap
        </NavLink>
        <NavLink
          to="/characters"
          className={({ isActive }) => `toolbar-link ${isActive ? 'active' : ''}`}
          title="Characters"
        >
          Characters
        </NavLink>
        <NavLink
          to="/fellowship"
          className={({ isActive }) => `toolbar-link ${isActive ? 'active' : ''}`}
          title="Fellowship"
        >
          Fellowship
        </NavLink>
      </nav>
      {/* In-game indicator right after nav links; only when in an active game */}
      {game && game.id && game.code && (
        <div className="ingame-indicator" title={game.name || 'In Game'} style={{ marginLeft: 12 }}>
          <FontAwesomeIcon icon={faCircle} style={{ color: '#4caf50', fontSize: 10, marginRight: 6 }} />
          <span>In Game</span>
        </div>
      )}
      <div className="toolbar-spacer" />
      <div className="controls">
        <IconButton className="toolbar-burger" title="Menu" size="large" onClick={handleBurgerClick}>
          <FontAwesomeIcon icon={faBars} style={{ color: 'white', fontSize: 18 }} />
        </IconButton>
        {variant === 'battlemap' && (
          <>
            <div className="toolbar-icons" />
          </>
        )}
        <button
          type="button"
          className="toolbar-signout"
          title="Sign out"
          onClick={handleSignOut}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 10px',
            marginRight: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Sign out
        </button>
        <IconButton className="toolbar-settings" title="User Settings" size="large" onClick={handleSettingsClick}>
          <FontAwesomeIcon icon={faUserGear} style={{ color: 'white', fontSize: 18 }} />
        </IconButton>
        <IconButton className="toolbar-bell" title="Notifications" size="large" onClick={handleBellClick} style={{ position: 'relative' }}>
          <FontAwesomeIcon icon={faBell} style={{ color: 'white', fontSize: 18 }} />
          {Array.isArray(notifs) && notifs.some(n => !n.read_at) && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#f44336',
              }}
            />
          )}
        </IconButton>
      </div>
      {notifOpen && (
        <>
          <div className="toolbar-menu-backdrop" onClick={() => setNotifOpen(false)} />
          <div className="toolbar-menu" role="menu" aria-label="Notifications" style={{ maxWidth: 360 }}>
            {notifError && (
              <div className="menu-item" role="menuitem" style={{ color: '#ffb3b3' }}>{notifError}</div>
            )}
            {notifs.length === 0 && (
              <div className="menu-item" role="menuitem">
                <span>No notifications</span>
              </div>
            )}
            {notifs.map((n) => (
              <div key={n.id} className="menu-item" role="menuitem" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <span style={{ marginBottom: 4 }}>{n.message}</span>
                <span style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>{new Date(n.created_at).toLocaleString()}</span>
                {n.type === 'fellowship_invite' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => handleNotifAction(n, 'accept')}>Accept</button>
                    <button className="btn" onClick={() => handleNotifAction(n, 'decline')}>Decline</button>
                  </div>
                ) : n.type === 'game_invite' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => handleNotifAction(n, 'accept')}>Accept</button>
                    <button className="btn" onClick={() => handleNotifAction(n, 'decline')}>Decline</button>
                  </div>
                ) : (
                  !n.read_at && <button className="btn" onClick={() => handleNotifAction(n, 'read')}>Mark read</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {burgerOpen && (
        <>
          <div className="toolbar-menu-backdrop" onClick={() => setBurgerOpen(false)} />
          <div className="toolbar-menu" role="menu" aria-label="Main menu">
            <NavLink to="/home" className="menu-item" onClick={() => navigateAndCloseBurger('/home')}>Home</NavLink>
            <NavLink to="/library" className="menu-item" onClick={() => navigateAndCloseBurger('/library')}>Library</NavLink>
            <NavLink to={game?.code ? `/battlemap/${game.code}` : '/battlemap/LOCAL'} className="menu-item" onClick={() => navigateAndCloseBurger(game?.code ? `/battlemap/${game.code}` : '/battlemap/LOCAL')}>Battlemap</NavLink>
            <NavLink to="/characters" className="menu-item" onClick={() => navigateAndCloseBurger('/characters')}>Characters</NavLink>
            <NavLink to="/fellowship" className="menu-item" onClick={() => navigateAndCloseBurger('/fellowship')}>Fellowship</NavLink>
            <hr className="menu-item--mobile-only" />
            <button className="menu-item" onClick={() => { setBurgerOpen(false); handleSettingsClick(); }}>User Settings</button>
            <button className="menu-item" onClick={() => { setBurgerOpen(false); handleSignOut(); }}>Sign out</button>
          </div>
        </>
      )}
    </header>
  );
};

export default Toolbar;