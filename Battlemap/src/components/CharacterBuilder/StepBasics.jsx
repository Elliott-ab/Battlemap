import React, { useState, useEffect } from 'react';
import { Box, Button, Grid, MenuItem, Select, FormControl, InputLabel, TextField, Typography } from '@mui/material';

const METHODS = [
  { value: 'standard-array', label: 'Standard Array (15,14,13,12,10,8)' },
  { value: 'point-buy', label: 'Point Buy (27 points)' },
  { value: 'manual', label: 'Manual Entry' },
];

export default function StepBasics({ character, setCharacter, onNext }) {
  const [name, setName] = useState(character.name || '');
  const [level, setLevel] = useState(character.level || 1);
  const [method, setMethod] = useState(character.ability_method || 'standard-array');

  useEffect(() => {
    setCharacter(c => ({ ...c, name, level, ability_method: method }));
  }, [name, level, method, setCharacter]);

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 2 }}>Character Basics</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
        </Grid>
        <Grid item xs={6} md={3}>
          <FormControl fullWidth>
            <InputLabel id="level-label">Level</InputLabel>
            <Select labelId="level-label" label="Level" value={level} onChange={(e)=> setLevel(Math.max(0, Number(e.target.value)))}>
              {Array.from({ length:21 }, (_,i)=>i).map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="method-label">Ability Method</InputLabel>
            <Select labelId="method-label" label="Ability Method" value={method} onChange={(e)=>setMethod(e.target.value)}>
              {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      <Box sx={{ display:'flex', justifyContent:'flex-end', mt:3 }}>
        <Button variant="contained" onClick={onNext} disabled={!name}>Next</Button>
      </Box>
    </Box>
  );
}