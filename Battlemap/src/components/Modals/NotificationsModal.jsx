import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Box, Alert } from '@mui/material';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listNotificationsForUser, respondToFellowshipInvite, markNotificationRead } from '../../Utils/notificationsService.js';

export default function NotificationsModal({ open, onClose }) {
  const { user } = useAuth();
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setError('');
    try {
      const rows = await listNotificationsForUser(user);
      setItems(rows);
    } catch (e) {
      setError(e.message || 'Failed to load notifications');
    }
  }, [user?.id]);

  React.useEffect(() => { if (open) load(); }, [open, load]);

  const handleAction = async (n, action) => {
    try {
      if (n.type === 'fellowship_invite') {
        await respondToFellowshipInvite(n, action, user);
      } else if (action === 'read') {
        await markNotificationRead(n.id);
      }
      await load();
    } catch (e) {
      setError(e.message || 'Action failed');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ bgcolor: '#2f2f2f', color: '#fff' }}>Notifications</DialogTitle>
      <DialogContent sx={{ bgcolor: '#2f2f2f', color: '#fff' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <List dense>
          {items.map((n) => (
            <ListItem key={n.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}
              secondaryAction={
                n.type === 'fellowship_invite' ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" size="small" onClick={() => handleAction(n, 'accept')}>Accept</Button>
                    <Button color="error" variant="outlined" size="small" onClick={() => handleAction(n, 'decline')}>Decline</Button>
                  </Box>
                ) : (
                  <Button size="small" onClick={() => handleAction(n, 'read')}>Mark read</Button>
                )
              }
            >
              <ListItemText
                primary={n.message}
                secondary={new Date(n.created_at).toLocaleString()}
                primaryTypographyProps={{ sx: { color: '#fff' } }}
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
              />
            </ListItem>
          ))}
          {items.length === 0 && (
            <ListItem>
              <ListItemText primary="No notifications" primaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }} />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#2f2f2f' }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
