import React from 'react';
import { Box, Paper, Typography, Grid, Chip, IconButton, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Minimal read-only pane to view a character sheet while in a game
// Expects a Supabase character row shape
const CharacterSheetPane = ({ character, onClose }) => {
  if (!character) return null;
  const ability = (k) => Number(character?.[k] ?? 10);
  const mod = (n) => Math.floor(((Number(n || 10)) - 10) / 2);
  const withSign = (v) => v >= 0 ? `+${v}` : `${v}`;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2, color: '#fff' }} className="sheet">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{character.name || 'Character'}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close sheet" title="Close" sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
        {character.race || 'Race'} {character.class || 'Class'} • Level {character.level || 1}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 2, background: '#2f2f2f' }}>
            <Typography variant="subtitle2" sx={{ color: '#d32f2f', fontWeight: 800, mb: 1 }}>Abilities</Typography>
            <Grid container spacing={1}>
              {['str','dex','con','int','wis','cha'].map((k) => (
                <Grid item xs={4} sm={2} key={k}>
                  <Paper elevation={0} sx={{ p: 1, textAlign: 'center', background: '#3a3a3a' }}>
                    <Chip size="small" label={withSign(mod(ability(k)))} sx={{ mb: 0.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{ability(k)}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>{k.toUpperCase()}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
          <Paper elevation={2} sx={{ p: 2, background: '#2f2f2f', mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#d32f2f', fontWeight: 800, mb: 1 }}>Attacks</Typography>
            {(character.attacks || []).length === 0 ? (
              <Typography color="text.secondary">No attacks recorded.</Typography>
            ) : (
              (character.attacks || []).map((a, i) => (
                <Typography key={i} sx={{ mb: 0.5 }}>{a.name} • {withSign(Number(a.attack_bonus || 0))} • {a.damage || ''}</Typography>
              ))
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, background: '#2f2f2f' }}>
            <Typography variant="subtitle2" sx={{ color: '#d32f2f', fontWeight: 800, mb: 1 }}>Vitals</Typography>
            <Grid container spacing={1}>
              <Grid item xs={4}><Paper elevation={0} sx={{ p: 1, background: '#3a3a3a', textAlign: 'center' }}><Typography variant="caption">AC</Typography><Typography variant="h6">{character.ac ?? 10}</Typography></Paper></Grid>
              <Grid item xs={4}><Paper elevation={0} sx={{ p: 1, background: '#3a3a3a', textAlign: 'center' }}><Typography variant="caption">Speed</Typography><Typography variant="h6">{character.speed ?? 30}</Typography></Paper></Grid>
              <Grid item xs={4}><Paper elevation={0} sx={{ p: 1, background: '#3a3a3a', textAlign: 'center' }}><Typography variant="caption">HP</Typography><Typography variant="h6">{(character.current_hp ?? character.max_hp ?? 10)}/{character.max_hp ?? 10}</Typography></Paper></Grid>
            </Grid>
            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
            <Typography variant="subtitle2" sx={{ color: '#d32f2f', fontWeight: 800, mb: 1 }}>Spellcasting</Typography>
            <Typography variant="body2">Save DC: {8 + (character.level ? Math.floor((character.level + 7)/4)+2 : 2) + mod(character?.spellcasting?.ability ? character[character.spellcasting.ability] : ability('int'))}</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CharacterSheetPane;
