import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRulerCombined, faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import { useTool, ToolIds } from '../context/ToolContext.jsx';

export default function SlimToolbar() {
  const { tool, setTool } = useTool();

  const btnSx = (active) => ({
    color: active ? '#4CAF50' : '#fff',
    border: active ? '1px solid rgba(76,175,80,0.7)' : '1px solid rgba(255,255,255,0.15)',
    backgroundColor: active ? 'rgba(76,175,80,0.15)' : 'transparent',
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
    width: 28,
    height: 28,
    p: 0,
  });

  return (
    <Box
      className="slim-toolbar"
      sx={{
        height: 32,
        borderBottom: '1px solid #444',
        backgroundColor: '#242424',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
      }}
      role="toolbar"
      aria-label="Tools"
    >
      <Tooltip title="Pointer" placement="bottom">
        <IconButton aria-label="Pointer tool" size="small" sx={btnSx(tool === ToolIds.POINTER)} onClick={() => setTool(ToolIds.POINTER)}>
          <FontAwesomeIcon icon={faArrowPointer} style={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Ruler (measure)" placement="bottom">
        <IconButton aria-label="Ruler tool" size="small" sx={btnSx(tool === ToolIds.RULER)} onClick={() => setTool(ToolIds.RULER)}>
          <FontAwesomeIcon icon={faRulerCombined} style={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
