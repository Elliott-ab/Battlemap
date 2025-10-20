import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

async function fetchJSON(url, { signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default function MonsterDescriptionModal({ open, onClose, index }) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [detail, setDetail] = React.useState(null);

  React.useEffect(() => {
    if (!open || !index) { setDetail(null); setError(null); setLoading(false); return; }
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchJSON(`https://www.dnd5eapi.co/api/monsters/${index}`, { signal: controller.signal });
        if (cancelled) return;
        setDetail(d);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [open, index]);

  const largeImageUrl = React.useMemo(() => {
    if (!detail) return null;
    const constructed = detail?.index ? `https://www.dnd5eapi.co/api/images/monsters/${detail.index}.png` : undefined;
    return detail?.image ? `https://www.dnd5eapi.co${detail.image}` : constructed;
  }, [detail]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isSmall}
      maxWidth={isSmall ? 'md' : 'md'}
      PaperProps={{ sx: { bgcolor: '#2a2a2a', color: '#fff' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
        {detail?.name || 'Monster'}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} size="small" aria-label="Close" title="Close" sx={{ color: '#fff' }}>
          <span aria-hidden>×</span>
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ '&.MuiDialogContent-dividers': { borderColor: '#444' }, color: '#fff' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress color="inherit" />
          </Box>
        ) : error ? (
          <Typography sx={{ color: '#ff6b6b' }}>{error}</Typography>
        ) : detail ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Overview</Typography>
              <Typography variant="body2" sx={{ color: '#bbb' }}>
                {detail.size} {detail.type} • {detail.alignment}
              </Typography>
              <Typography variant="body2" sx={{ color: '#bbb' }}>
                AC: {Array.isArray(detail.armor_class) ? detail.armor_class.map(a => a.value).join(', ') : detail.armor_class} • HP: {detail.hit_points}
              </Typography>
              <Typography variant="body2" sx={{ color: '#bbb' }}>
                Speed: {typeof detail.speed === 'object' ? Object.entries(detail.speed).map(([k,v]) => `${k} ${v}`).join(', ') : detail.speed}
              </Typography>
              <Typography variant="body2" sx={{ color: '#bbb' }}>
                CR: {detail.challenge_rating} • Proficiency Bonus: {detail.proficiency_bonus}
              </Typography>
              <Typography variant="body2" sx={{ color: '#bbb' }}>
                Senses: {detail.senses ? Object.entries(detail.senses).map(([k,v]) => `${k} ${v}`).join(', ') : '—'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#bbb' }}>
                Languages: {detail.languages || '—'}
              </Typography>
              {largeImageUrl ? (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Box
                    component="img"
                    src={largeImageUrl}
                    alt={detail?.name}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: isSmall ? '40vh' : 320,
                      borderRadius: 1,
                      border: '1px solid #444',
                      backgroundColor: '#1f1f1f',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
              ) : null}
            </Box>
            <Box>
              {Array.isArray(detail.special_abilities) && detail.special_abilities.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Special Abilities</Typography>
                  {detail.special_abilities.map((a) => (
                    <Box key={a.name} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>{a.name}</Typography>
                      <Typography variant="body2" sx={{ color: '#bbb' }}>{a.desc}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {Array.isArray(detail.actions) && detail.actions.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Actions</Typography>
                  {detail.actions.map((a, i) => (
                    <Box key={`${a.name}-${i}`} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>{a.name}</Typography>
                      <Typography variant="body2" sx={{ color: '#bbb' }}>{a.desc}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {Array.isArray(detail.legendary_actions) && detail.legendary_actions.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Legendary Actions</Typography>
                  {detail.legendary_actions.map((a, i) => (
                    <Box key={`${a.name}-${i}`} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>{a.name}</Typography>
                      <Typography variant="body2" sx={{ color: '#bbb' }}>{a.desc}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: '#bbb' }}>No monster selected.</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #444' }}>
        <Button onClick={onClose} sx={{ color: '#fff' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
