import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listCharacters, getSignedCharacterIconUrl } from '../../Utils/characterService.js';

const CharacterSelectModal = ({ open, onClose, onSelect, onBuildNew }) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState([]);
  const [iconUrls, setIconUrls] = useState({}); // id -> resolved URL (signed/public)

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

  // Resolve icon URLs (generate signed URL when needed) so images display reliably
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open || !characters || characters.length === 0) {
        if (!cancelled) setIconUrls({});
        return;
      }
      const entries = await Promise.all(
        characters.map(async (c) => {
          const raw = c.icon_url;
          if (!raw) return [c.id, undefined];
          try {
            const signed = await getSignedCharacterIconUrl(raw);
            return [c.id, signed || raw];
          } catch (_) {
            // Fall back to raw URL if signing fails (e.g., public bucket)
            return [c.id, raw];
          }
        })
      );
      if (!cancelled) setIconUrls(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [open, characters]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={isSmall ? 'md' : 'sm'}
      fullScreen={isSmall}
      PaperProps={{ sx: { bgcolor: '#2a2a2a', color: '#fff' } }}
    >
      <DialogTitle sx={{ color: '#fff' }}>Select a Character</DialogTitle>
      <DialogContent dividers sx={{ '&.MuiDialogContent-dividers': { borderColor: '#444' }, color: '#fff' }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress color="inherit" size={24} />
          </Box>
        ) : error ? (
          <Typography sx={{ color: '#ff6b6b' }}>{error}</Typography>
        ) : characters.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <Typography sx={{ mb: 2, color: '#fff' }}>You don’t have any characters yet.</Typography>
            <Button variant="outlined" onClick={onBuildNew} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa', backgroundColor: 'rgba(255,255,255,0.06)' } }}>
              CREATE NEW CHARACTER
            </Button>
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ bgcolor: '#262626', color: '#fff', borderColor: '#444' }}>
            <TableContainer sx={{ maxHeight: isSmall ? '60vh' : 420 }}>
              <Table stickyHeader size={isSmall ? 'medium' : 'small'} sx={{
                '& .MuiTableCell-root': { borderColor: '#444', color: '#fff' },
                '& .MuiTableRow-hover:hover': { backgroundColor: '#3f3f3f', outline: '1px solid #555' },
                transition: 'background-color 120ms ease',
              }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#353535' }}>
                    <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }} width={isSmall ? 48 : 56}>Icon</TableCell>
                    <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }}>Name</TableCell>
                    <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }} width={120}>Level</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {characters.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onSelect?.(c)}
                    >
                      <TableCell>
                        <CharacterAvatar name={c.name} url={iconUrls[c.id] ?? c.icon_url} size={isSmall ? 32 : 28} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ color: '#fff' }}>
                          {c.name || 'Untitled Character'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#bbb' }}>
                          {(c.race || 'Race')} {(c.class || 'Class')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {c.level ?? (
                          <Typography variant="caption" sx={{ color: '#999' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #444' }}>
        <Button onClick={onClose} sx={{ color: '#fff' }}>Close</Button>
        {characters.length > 0 && (
          <Button variant="outlined" onClick={onBuildNew} sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa', backgroundColor: 'rgba(255,255,255,0.06)' } }}>
            CREATE NEW CHARACTER
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CharacterSelectModal;

function CharacterAvatar({ name, url, size = 28 }) {
  const initial = (name?.[0] || '?').toUpperCase();
  const [src, setSrc] = useState(url || undefined);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setSrc(url || undefined); setLoaded(false); }, [url]);
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      {!loaded && (
        <Box
          sx={{
            position: 'absolute', inset: 0, bgcolor: '#444', borderRadius: '50%',
            animation: 'pulse 1.2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%': { opacity: 0.6 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.6 },
            },
          }}
        />
      )}
      <Avatar
        src={src}
        alt={name}
        sx={{ width: size, height: size, bgcolor: '#555', color: '#fff' }}
        imgProps={{
          referrerPolicy: 'no-referrer',
          loading: 'lazy',
          decoding: 'async',
          onLoad: () => setLoaded(true),
          onError: () => { setSrc(undefined); setLoaded(true); },
        }}
      >
        {initial}
      </Avatar>
    </Box>
  );
}
