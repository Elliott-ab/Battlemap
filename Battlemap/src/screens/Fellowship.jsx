import React from 'react';
import { Box } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import FellowshipContent from '../components/Fellowship/FellowshipContent.jsx';

export default function Fellowship() {
  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <div className="page-container">
          <Box className="hide-scrollbar" sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            <FellowshipContent />
          </Box>
        </div>
      </div>
    </Box>
  );
}
