import React from 'react';
import { Box } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import FellowshipContent from '../components/Fellowship/FellowshipContent.jsx';
import UserSettingsModal from '../components/Modals/UserSettingsModal.jsx';

export default function Fellowship() {
  const [showSettings, setShowSettings] = React.useState(false);
  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" onSettingsClick={() => setShowSettings(true)} />
      <div className="main-content">
        <div className="page-container">
          <Box className="hide-scrollbar" sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            <FellowshipContent />
          </Box>
        </div>
      </div>
      <UserSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </Box>
  );
}
