import React, { useMemo } from 'react';
import { Box, Button, Grid, Typography, TextField } from '@mui/material';
import { computeDerived, abilityMod } from './api.js';

export default function StepDerivedStats({ character, setCharacter, onNext, onBack }) {
  const derived = useMemo(() => computeDerived(character), [character]);

  const update = (field, value) => {
    // Allow empty string while typing; clamp numeric values to >= 0
    if (value === '') {
      setCharacter(c => ({ ...c, [field]: '' }));
      return;
    }
    const n = Number(value);
    const clamped = isNaN(n) ? 0 : Math.max(0, n);
    setCharacter(c => ({ ...c, [field]: clamped }));
  };
  const commitZeroIfEmpty = (field) => {
    setCharacter(c => {
      const v = c?.[field];
      if (v === '' || v == null || isNaN(Number(v)) || Number(v) < 0) {
        return { ...c, [field]: 0 };
      }
      return c;
    });
  };

  const abilityMods = derived.abilityMods || {};

  const saves = (character.saving_throw_proficiencies || []).reduce((acc, name) => {
    // map ability names back to ability keys heuristically
    const map = { Strength:'str', Dexterity:'dex', Constitution:'con', Intelligence:'int', Wisdom:'wis', Charisma:'cha' };
    const key = map[name];
    if (key) acc[name] = abilityMods[key] + derived.proficiencyBonus;
    return acc;
  }, {});

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Derived Statistics</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} md={2}>
          <TextField label="Prof Bonus" value={derived.proficiencyBonus} disabled fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField type="number" label="Max HP" value={character.max_hp ?? derived.hp ?? ''} onChange={(e)=>update('max_hp', e.target.value)} onBlur={()=>commitZeroIfEmpty('max_hp')} inputProps={{ min: 0 }} fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField type="number" label="Current HP" value={character.current_hp ?? ''} onChange={(e)=>update('current_hp', e.target.value)} onBlur={()=>commitZeroIfEmpty('current_hp')} inputProps={{ min: 0 }} fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField type="number" label="Temp HP" value={character.temp_hp ?? ''} onChange={(e)=>update('temp_hp', e.target.value)} onBlur={()=>commitZeroIfEmpty('temp_hp')} inputProps={{ min: 0 }} fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField type="number" label="AC" value={character.ac ?? derived.ac ?? ''} onChange={(e)=>update('ac', e.target.value)} onBlur={()=>commitZeroIfEmpty('ac')} inputProps={{ min: 0 }} fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField label="Initiative" value={derived.initiative >=0?`+${derived.initiative}`:derived.initiative} disabled fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField type="number" label="Speed" value={character.speed ?? ''} onChange={(e)=>update('speed', e.target.value)} onBlur={()=>commitZeroIfEmpty('speed')} inputProps={{ min: 0 }} fullWidth />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField label="Passive Perception" value={derived.passivePerception} disabled fullWidth />
        </Grid>
      </Grid>
      <Box sx={{ mt:3 }}>
        <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Saving Throws</Typography>
        <Grid container spacing={1}>
          {Object.entries(saves).map(([name,val]) => (
            <Grid key={name} item xs={6} md={2}>
              <Box sx={{ p:1, textAlign:'center', border:'1px solid rgba(255,255,255,0.15)', borderRadius:1 }}>
                <Typography variant="caption" sx={{ opacity:0.7 }}>{name}</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight:600 }}>{val>=0?`+${val}`:val}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={onNext}>Next</Button>
      </Box>
    </Box>
  );
}