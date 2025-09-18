import React from 'react';

const Toolbar = ({ isDrawingCover, toggleDrawingMode, addPlayer, addEnemy, showGridModal, clearMap, undo, showSaveModal, showOverwriteModal, gridSize }) => {
  return (
    <header className="toolbar">
      <h1>D&D Battle Map</h1>
      <div className="controls">
        <button className="btn btn-primary" onClick={addPlayer} disabled={isDrawingCover}>Add Player</button>
        <button className="btn btn-secondary" onClick={addEnemy} disabled={isDrawingCover}>Add Enemy</button>
        <button className={`btn ${isDrawingCover ? 'btn-primary' : 'btn-cover'}`} onClick={toggleDrawingMode} id="drawCoverBtn">
          {isDrawingCover ? 'Finish Drawing' : 'Draw Cover'}
        </button>
        <button className="btn btn-tertiary" onClick={showGridModal} disabled={isDrawingCover}>Grid Settings</button>
        <button className="btn btn-danger" onClick={clearMap} disabled={isDrawingCover}>Clear Map</button>
        <button className="btn btn-tertiary" onClick={undo} disabled={isDrawingCover}>Undo</button>
        <button className="btn btn-primary" onClick={showSaveModal} disabled={isDrawingCover}>Download Map</button>
        <button className="btn btn-secondary" onClick={showOverwriteModal} disabled={isDrawingCover}>Upload Map</button>
        <span className="grid-info">Grid: {gridSize}ft per cell</span>
      </div>
    </header>
  );
};

export default Toolbar;