import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faTrashCan, faRotateLeft, faDownload, faUpload, faBars, faUserGear } from '@fortawesome/free-solid-svg-icons';
import IconButton from './common/IconButton.jsx';

// variant: 'battlemap' | 'dashboard'
const Toolbar = ({
  isDrawingCover,
  showGridModal,
  clearMap,
  undo,
  showSaveModal,
  showOverwriteModal,
  gridSize,
  openGlobalModifiers,
  variant = 'battlemap',
  onSettingsClick,
  logoHref = '#/dashboard',
  onHostGame,
  onLeaveGame,
}) => {
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
      <div className="toolbar-logo">
        {logoHref ? (
          <a href={logoHref} style={{ display: 'inline-block' }} title="Back to Dashboard">
            {Logo}
          </a>
        ) : (
          Logo
        )}
      </div>
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
            {/* Keep quick access for Clear/Undo; move Grid/Download/Upload into burger menu */}
            <IconButton onClick={clearMap} disabled={isDrawingCover} title="Clear Map" size="large">
              <FontAwesomeIcon icon={faTrashCan} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
            </IconButton>
            <IconButton onClick={undo} disabled={isDrawingCover} title="Undo" size="large">
              <FontAwesomeIcon icon={faRotateLeft} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
            </IconButton>
          </div>
          <IconButton className="toolbar-burger" title="Menu" size="large" onClick={() => setMenuOpen(v => !v)}>
            <FontAwesomeIcon icon={faBars} style={{ color: 'white', fontSize: 18 }} />
          </IconButton>
          <span className="grid-info">Grid: {gridSize}ft per cell</span>
        </div>
      )}
      {menuOpen && variant !== 'dashboard' && (
        <>
          <div className="toolbar-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="toolbar-menu" role="menu" aria-label="Toolbar menu">
            <button className="menu-item" onClick={() => handleMaybe(showGridModal)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faGear} />
              <span>Grid Settings</span>
            </button>
            <button className="menu-item" onClick={() => handleMaybe(clearMap)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faTrashCan} />
              <span>Clear Map</span>
            </button>
            <button className="menu-item" onClick={() => handleMaybe(undo)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faRotateLeft} />
              <span>Undo</span>
            </button>
            <button className="menu-item" onClick={() => handleMaybe(showSaveModal)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faDownload} />
              <span>Download Map</span>
            </button>
            <button className="menu-item" onClick={() => handleMaybe(showOverwriteModal)} disabled={isDrawingCover} role="menuitem">
              <FontAwesomeIcon icon={faUpload} />
              <span>Upload Map</span>
            </button>
            <hr className="toolbar-divider-horiz" />
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
          </div>
        </>
      )}
    </header>
  );
};

export default Toolbar;