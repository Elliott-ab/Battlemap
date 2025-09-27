import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import App from '../App.jsx';
import { supabase } from '../supabaseClient';

export default function BattlemapPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const leave = async () => {
    // optional: sign out? For now just navigate back
    navigate('/dashboard');
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1">Game Code: {code}</Typography>
        <Button onClick={leave}>Leave</Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <App />
      </Box>
    </Box>
  );
}
