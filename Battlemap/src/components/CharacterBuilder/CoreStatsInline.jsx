import React, { useMemo, useState } from 'react';
import { Box, Typography, Grid, Button, Chip } from '@mui/material';
import { computeDerived } from './api.js';

export default function CoreStatsInline({ character }) {
  const derived = useMemo(() => computeDerived(character), [character]);
  const [collapsed, setCollapsed] = useState(false);
  const fields = [
    { label: 'HP', value: character.max_hp || derived.hp },
    { label: 'AC', value: character.ac || derived.ac },
    { label: 'Speed', value: character.speed || 30 },
    { label: 'Prof Bonus', value: derived.proficiencyBonus },
    { label: 'Initiative', value: derived.initiative >= 0 ? `+${derived.initiative}` : derived.initiative },
    { label: 'Passive Perception', value: derived.passivePerception },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#d32f2f', fontWeight: 700 }}>Core Stats</Typography>
        <Button size="small" onClick={() => setCollapsed(v => !v)} color="inherit">
          {collapsed ? 'Show' : 'Hide'}
        </Button>
      </Box>
      {!collapsed && (
        <Grid container spacing={2}>
          {fields.map((f) => (
            <Grid key={f.label} item xs={6} sm={4} md={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {f.label}:
                </Typography>
                <Chip
                  label={String(f.value)}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    '& .MuiChip-label': {
                      px: 0,
                      width: 32,
                      display: 'inline-flex',
                      justifyContent: 'center',
                    },
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
