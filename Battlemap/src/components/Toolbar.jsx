import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan, faRotateLeft, faDownload, faUpload, faBars, faUserGear, faCircle, faBell } from '@fortawesome/free-solid-svg-icons';
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
  const { game, setSession } = useGameSession();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Normalize Vite base URL to always end with a single '/'
  const rawBase = import.meta.env.BASE_URL || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  // Try user-provided name first, then common defaults
  const logoCandidates = [
    `${base}dicelogo.webp`,
    `${base}dicelogo.png`,
    `${base}logo.svg`,
    `${base}logo.png`,
    `${base}logo.webp`,
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]); // merged server + ephemeral
  const [ephemeralNotifs, setEphemeralNotifs] = useState([]); // realtime-only
  const [notifError, setNotifError] = useState('');
  const handleMaybe = (fn) => {
    if (isDrawingCover) return;
    fn && fn();
    setMenuOpen(false);
  };

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
    if (onNotificationsClick) return onNotificationsClick();
    // Toggle internal popover
    setMenuOpen(false);
    setNotifOpen(v => !v);
  };

  const handleNotifAction = async (n, action) => {
    try {
      if (n.type === 'fellowship_invite' && (action === 'accept' || action === 'decline')) {
        await respondToFellowshipInvite(n, action, user);
        if (action === 'accept') {
          // Automatically open Fellowship after accepting
          setNotifOpen(false);
          if (onFellowshipClick) onFellowshipClick();
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
      style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
    />
  );

  return (
    <header className={`toolbar ${variant === 'dashboard' ? 'toolbar--dashboard' : 'toolbar--battlemap'}`}>
      <a href={logoHref} className="toolbar-logo" title="Home" aria-label="Home">
        {Logo}
      </a>
      <div className="toolbar-icons">
        {/* Quick-access Clear/Undo removed; available via burger menu only */}
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
        {variant === 'battlemap' && (
          <>
            <div className="toolbar-icons" />
          </>
        )}
        <IconButton className="toolbar-burger" title="Menu" size="large" onClick={() => setMenuOpen(v => !v)}>
          <FontAwesomeIcon icon={faBars} style={{ color: 'white', fontSize: 18 }} />
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
      {/* Indicator moved up after nav */}
      {menuOpen && (
        <>
          <div className="toolbar-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="toolbar-menu" role="menu" aria-label="Toolbar menu">
            {/* Mobile-only primary navigation at the top of the menu (use NavLink for active styling) */}
            <NavLink
              to="/home"
              className={({ isActive }) => `menu-item menu-item--mobile-only ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              <span>Home</span>
            </NavLink>
            <NavLink
              to="/library"
              className={({ isActive }) => `menu-item menu-item--mobile-only ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              <span>Library</span>
            </NavLink>
            <NavLink
              to={game?.code ? `/battlemap/${game.code}` : '/battlemap/LOCAL'}
              className={({ isActive }) => `menu-item menu-item--mobile-only ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              <span>Battlemap</span>
            </NavLink>
            <NavLink
              to="/characters"
              className={({ isActive }) => `menu-item menu-item--mobile-only ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              <span>Characters</span>
            </NavLink>
            <hr className="toolbar-divider-horiz menu-item--mobile-only" />
            {/* Grid Settings moved to Slim Toolbar (gear icon) */}
            {/* Clear Map moved to Slim Toolbar > Settings > Map Settings; keep Undo here for quick access */}
            {variant === 'battlemap' && isHost && (
              <>
                <button className="menu-item" onClick={() => handleMaybe(undo)} disabled={isDrawingCover} role="menuitem">
                  <FontAwesomeIcon icon={faRotateLeft} />
                  <span>Undo</span>
                </button>
              </>
            )}
            {/* Save/Load Map moved to Slim Toolbar > Settings > Map Settings */}
            {/* Library actions only visible on Battlemap per request */}
            {/* Save/Load Library moved to Slim Toolbar > Settings > Map Settings */}
            <hr className="toolbar-divider-horiz" />
            {/* Join/Host/Leave moved to Slim Toolbar > Settings > Game Settings; Push/Toggle moved to Slim Toolbar */}
            {/* Fellowship section (always available when handler is provided), above User Settings */}
            <hr className="toolbar-divider-horiz" />
            {onFellowshipClick && (
              <button className="menu-item" onClick={() => { onFellowshipClick(); setMenuOpen(false); }} role="menuitem">
                <span>Fellowship</span>
              </button>
            )}
            <hr className="toolbar-divider-horiz" />
            <button className="menu-item" onClick={() => handleMaybe(onSettingsClick)} role="menuitem">
              <FontAwesomeIcon icon={faUserGear} />
              <span>User Settings</span>
            </button>
          </div>
        </>
      )}
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
    </header>
  );
};

export default Toolbar;