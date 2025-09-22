import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faTrashCan, faRotateLeft, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@mui/material/IconButton';

const Toolbar = ({ isDrawingCover, showGridModal, clearMap, undo, showSaveModal, showOverwriteModal, gridSize }) => {
  const base = ((import.meta.env.BASE_URL || '/').endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL || '/'}\/`).replace(/\\/g, '/');
  // Try user-provided name first, then common defaults
  const logoCandidates = [
    `${base}dicelogo.webp`,
    `${base}dicelogo.png`,
    `${base}logo.svg`,
    `${base}logo.png`,
    `${base}logo.webp`,
  ];
  return (
    <header className="toolbar">
      <div className="toolbar-logo">
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
      </div>
      <div className="toolbar-spacer" />
      <div className="controls">
        <IconButton onClick={showGridModal} disabled={isDrawingCover} title="Grid Settings" size="large">
          <FontAwesomeIcon icon={faGear} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
        </IconButton>
        <IconButton onClick={clearMap} disabled={isDrawingCover} title="Clear Map" size="large">
          <FontAwesomeIcon icon={faTrashCan} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
        </IconButton>
        <IconButton onClick={undo} disabled={isDrawingCover} title="Undo" size="large">
          <FontAwesomeIcon icon={faRotateLeft} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
        </IconButton>
        <IconButton onClick={showSaveModal} disabled={isDrawingCover} title="Download Map" size="large">
          <FontAwesomeIcon icon={faDownload} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
        </IconButton>
        <IconButton onClick={showOverwriteModal} disabled={isDrawingCover} title="Upload Map" size="large">
          <FontAwesomeIcon icon={faUpload} style={{ color: isDrawingCover ? 'grey' : 'white', fontSize: 16 }} />
        </IconButton>
        <span className="grid-info">Grid: {gridSize}ft per cell</span>
      </div>
    </header>
  );
};

export default Toolbar;