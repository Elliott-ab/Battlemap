import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItemButton, ListItemText, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listCharacters } from '../../Utils/characterService.js';

const CharacterSelectModal = ({ open, onClose, onSelect, onBuildNew }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!open) return;
      setLoading(true);
      setError('');
      try {
        const rows = await listCharacters(user.id);
        if (active) setCharacters(rows || []);
      } catch (e) {
        if (active) setError(e.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, user?.id]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Select a Character</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : characters.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <Typography sx={{ mb: 2 }}>You don’t have any characters yet.</Typography>
            <Button variant="contained" onClick={onBuildNew}>Build a Character</Button>
          </Box>
        ) : (
          <List>
            {characters.map((c) => (
              <ListItemButton key={c.id} onClick={() => onSelect?.(c)}>
                <ListItemText
                  primary={c.name || 'Untitled Character'}
                  secondary={`${c.race || 'Race'} ${c.class || 'Class'} • Level ${c.level || 1}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {characters.length > 0 && (
          <Button variant="outlined" onClick={onBuildNew}>Build New</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CharacterSelectModal;
