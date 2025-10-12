import React, { useEffect, useState } from 'react';
import { Box, Button, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { fetchList } from './api.js';

export default function StepOrigins({ character, setCharacter, onNext, onBack }) {
  const [races, setRaces] = useState([]);
  const [classes, setClasses] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [race, setRace] = useState(character.race?.index || '');
  const [klass, setKlass] = useState(character.class?.index || '');
  const [background, setBackground] = useState(character.background?.index || '');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [r, c, b] = await Promise.all([
          fetchList('/api/races', [ { index: 'human', name: 'Human' }, { index: 'elf', name: 'Elf' }, { index: 'dwarf', name: 'Dwarf' } ]),
          fetchList('/api/classes', [ { index: 'fighter', name: 'Fighter' }, { index: 'wizard', name: 'Wizard' }, { index: 'cleric', name: 'Cleric' } ]),
          fetchList('/api/backgrounds', [ { index: 'acolyte', name: 'Acolyte' }, { index: 'criminal', name: 'Criminal' }, { index: 'soldier', name: 'Soldier' } ]),
        ]);
        if (!mounted) return;
        setRaces(r); setClasses(c); setBackgrounds(b);
      } catch (e) {
        setError('Some data failed to load, showing limited options.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const canContinue = race && klass && background;

  const applyAndNext = () => {
    const raceObj = races.find(x => x.index === race) || { index: race, name: race };
    const classObj = classes.find(x => x.index === klass) || { index: klass, name: klass };
    const bgObj = backgrounds.find(x => x.index === background) || { index: background, name: background };
    setCharacter({ ...character, race: raceObj, class: classObj, background: bgObj });
    onNext();
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Origins</Typography>
      {loading ? <Typography>Loading…</Typography> : (
        <>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="race-label">Race</InputLabel>
                <Select labelId="race-label" label="Race" value={race} onChange={(e) => setRace(e.target.value)}>
                  <MenuItem value=""><em>Choose a race…</em></MenuItem>
                  {races.map(r => (<MenuItem key={r.index} value={r.index}>{r.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="class-label">Class</InputLabel>
                <Select labelId="class-label" label="Class" value={klass} onChange={(e) => setKlass(e.target.value)}>
                  <MenuItem value=""><em>Choose a class…</em></MenuItem>
                  {classes.map(c => (<MenuItem key={c.index} value={c.index}>{c.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="background-label">Background</InputLabel>
                <Select labelId="background-label" label="Background" value={background} onChange={(e) => setBackground(e.target.value)}>
                  <MenuItem value=""><em>Choose a background…</em></MenuItem>
                  {backgrounds.map(b => (<MenuItem key={b.index} value={b.index}>{b.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button onClick={onBack}>Back</Button>
            <Button variant="contained" disabled={!canContinue} onClick={applyAndNext}>Next</Button>
          </Box>
        </>
      )}
    </Box>
  );
}
