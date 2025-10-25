import React from 'react';
import { Box, Typography } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import SlimToolbar from '../components/SlimToolbar.jsx';
import { ToolProvider } from '../context/ToolContext.jsx';

export default function ToolingDemo() {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar />
      <ToolProvider>
        <SlimToolbar />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box sx={{ maxWidth: 900, textAlign: 'center', color: '#ddd' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Tools Demo</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              The slim toolbar is active. Open the Battlemap to use the Ruler tool; it appears as an overlay that lets you measure distances across the grid and checks line of sight through cover.
            </Typography>
            <Typography variant="body2">
              Tip: When the Ruler is active, the map uses a crosshair cursor and token drag/pan is temporarily disabled.
            </Typography>
          </Box>
        </Box>
      </ToolProvider>
    </Box>
  );
}
