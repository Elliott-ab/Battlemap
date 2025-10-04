import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faTrashCan, faRotateLeft, faDownload, faUpload, faBars, faUserGear, faCircle } from '@fortawesome/free-solid-svg-icons';
import IconButton from './common/IconButton.jsx';
import { useGameSession } from '../Utils/GameSessionContext.jsx';

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
}) => {
  const { game } = useGameSession();
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
  const handleMaybe = (fn) => {
    if (isDrawingCover) return;
    fn && fn();
    setMenuOpen(false);
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
      {variant === 'dashboard' ? (
        <div className="controls">
          <div className="toolbar-icons">
            <IconButton onClick={onSettingsClick} title="User Settings" size="large">
              <FontAwesomeIcon icon={faUserGear} style={{ color: 'white', fontSize: 18 }} />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className="controls">
          <div
            className="turn-box turn-box--small turn-box--danger"
            onClick={isDrawingCover ? undefined : openGlobalModifiers}
            style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer', minWidth: 0 }}
            title="Global Modifiers"
          >
            Global Modifiers
          </div>
          <div className="toolbar-divider-vert" aria-hidden="true" />
          <div className="toolbar-icons">
            {/* Clear/Undo removed from toolbar; available via burger for hosts only */}
            {isHost && game && game.id && game.code && (
              <>
                <div className="toolbar-divider-vert" aria-hidden="true" />
                <button
                  className="turn-box turn-box--small"
                  onClick={isDrawingCover ? undefined : onPushToPlayers}
                  disabled={isDrawingCover}
                  title="Push current draft to all players"
                  style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
                >
                  Push to Players
                </button>
                <div className="toolbar-divider-vert" aria-hidden="true" />
                <button
                  className="turn-box turn-box--small"
                  onClick={isDrawingCover ? undefined : onToggleChannel}
                  disabled={isDrawingCover}
                  title="Toggle edit/view channel"
                  style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
                >
                  {currentChannel === 'draft' ? 'Editing Draft' : 'Viewing Live'}
                </button>
              </>
            )}
          </div>
          <IconButton className="toolbar-burger" title="Menu" size="large" onClick={() => setMenuOpen(v => !v)}>
            <FontAwesomeIcon icon={faBars} style={{ color: 'white', fontSize: 18 }} />
          </IconButton>
          <span className="grid-info">Grid: {gridSize}ft per cell</span>
        </div>
      )}
      {/* Indicator moved up after nav */}
      {menuOpen && variant !== 'dashboard' && (
        <>
          <div className="toolbar-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="toolbar-menu" role="menu" aria-label="Toolbar menu">
            {isHost && (
              <button className="menu-item" onClick={() => handleMaybe(showGridModal)} disabled={isDrawingCover} role="menuitem">
                <FontAwesomeIcon icon={faGear} />
                <span>Grid Settings</span>
              </button>
            )}
            {isHost && (
              <>
                <button className="menu-item" onClick={() => handleMaybe(clearMap)} disabled={isDrawingCover} role="menuitem">
                  <FontAwesomeIcon icon={faTrashCan} />
                  <span>Clear Map</span>
                </button>
                <button className="menu-item" onClick={() => handleMaybe(undo)} disabled={isDrawingCover} role="menuitem">
                  <FontAwesomeIcon icon={faRotateLeft} />
                  <span>Undo</span>
                </button>
              </>
            )}
            {isHost && game && game.id && game.code && (
              <>
                <button className="menu-item" onClick={() => handleMaybe(onSaveMap)} disabled={isDrawingCover} role="menuitem">
                  <FontAwesomeIcon icon={faDownload} />
                  <span>Save Map</span>
                </button>
                <button className="menu-item" onClick={() => handleMaybe(onLoadMap)} disabled={isDrawingCover} role="menuitem">
                  <FontAwesomeIcon icon={faUpload} />
                  <span>Load Map</span>
                </button>
              </>
            )}
            {/* Library actions available to all users, even outside a game */}
            <button className="menu-item" onClick={() => handleMaybe(onSaveLibrary)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faDownload} />
              <span>Save to Library</span>
            </button>
            <button className="menu-item" onClick={() => handleMaybe(onLoadLibrary)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faUpload} />
              <span>Load from Library</span>
            </button>
            <hr className="toolbar-divider-horiz" />
            {onJoinGame && (
              <button className="menu-item" onClick={() => { onJoinGame(); setMenuOpen(false); }} role="menuitem">
                <span>Join Game</span>
              </button>
            )}
            {onHostGame && (
              <button className="menu-item" onClick={() => { onHostGame(); setMenuOpen(false); }} role="menuitem">
                <span>Host Game</span>
              </button>
            )}
            {onLeaveGame && (
              <button className="menu-item" onClick={() => { onLeaveGame(); setMenuOpen(false); }} role="menuitem">
                <span>Leave Game</span>
              </button>
            )}
            {isHost && game && game.id && game.code && (
              <>
                <hr className="toolbar-divider-horiz" />
                <button className="menu-item" onClick={() => handleMaybe(onPushToPlayers)} role="menuitem">
                  <span>Push to Players</span>
                </button>
                <button className="menu-item" onClick={() => handleMaybe(onToggleChannel)} role="menuitem">
                  <span>{currentChannel === 'draft' ? 'Switch to Live' : 'Switch to Draft'}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
};

export default Toolbar;