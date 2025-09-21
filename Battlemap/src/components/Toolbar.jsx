import React from 'react';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import IconButton from '@mui/material/IconButton';

const Toolbar = ({ isDrawingCover, toggleDrawingMode, addPlayer, addEnemy, showGridModal, clearMap, undo, showSaveModal, showOverwriteModal, gridSize }) => {
  return (
    <header className="toolbar">
      <h1>B A T T L E M A P</h1>
      <div className="controls">
        <IconButton onClick={showGridModal} disabled={isDrawingCover} title="Grid Settings" size="large">
          <SettingsOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={clearMap} disabled={isDrawingCover} title="Clear Map" size="large">
          <DeleteOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={undo} disabled={isDrawingCover} title="Undo" size="large">
          <UndoOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={showSaveModal} disabled={isDrawingCover} title="Download Map" size="large">
          <DownloadOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={showOverwriteModal} disabled={isDrawingCover} title="Upload Map" size="large">
          <UploadOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <span className="grid-info">Grid: {gridSize}ft per cell</span>
      </div>
    </header>
  );
};

export default Toolbar;