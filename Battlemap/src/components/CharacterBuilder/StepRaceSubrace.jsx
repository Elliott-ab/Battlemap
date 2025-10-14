import React, { useEffect, useState } from 'react';
import { Box, Button, Grid, FormControl, InputLabel, MenuItem, Select, Typography, Chip, Divider } from '@mui/material';
import { getRaces, getRace, getSubrace, aggregateRacialAbilityBonuses } from './api.js';

export default function StepRaceSubrace({ character, setCharacter, onNext, onBack }) {
  const [races, setRaces] = useState([]);
  const [raceIndex, setRaceIndex] = useState(character.race?.index || '');
  const [raceDetail, setRaceDetail] = useState(character.raceDetail || null);
  const [subraceIndex, setSubraceIndex] = useState(character.subrace?.index || '');
  const [subraceDetail, setSubraceDetail] = useState(character.subraceDetail || null);
  const [loadingRace, setLoadingRace] = useState(false);
  const [loadingSubrace, setLoadingSubrace] = useState(false);
  const [error, setError] = useState('');

  // initial races
  useEffect(() => { (async () => { try { setRaces(await getRaces()); } catch (e) { setError('Failed to load races'); } })(); }, []);

  // load race detail when selection changes
  useEffect(() => {
    if (!raceIndex) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingRace(true); setError('');
        const detail = await getRace(raceIndex);
        if (cancelled) return;
        setRaceDetail(detail);
        // if race changed, reset subrace
        setSubraceIndex('');
        setSubraceDetail(null);
      } catch (e) { if (!cancelled) setError('Could not fetch race detail'); }
      finally { if (!cancelled) setLoadingRace(false); }
    })();
    return () => { cancelled = true; };
  }, [raceIndex]);

  // load subrace detail
  useEffect(() => {
    if (!subraceIndex) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingSubrace(true); setError('');
        const detail = await getSubrace(subraceIndex);
        if (cancelled) return;
        setSubraceDetail(detail);
      } catch (e) { if (!cancelled) setError('Could not fetch subrace detail'); }
      finally { if (!cancelled) setLoadingSubrace(false); }
    })();
    return () => { cancelled = true; };
  }, [subraceIndex]);

  const bonuses = aggregateRacialAbilityBonuses(raceDetail, subraceDetail);
  const profChips = [];
  if (raceDetail?.starting_proficiencies) profChips.push(...raceDetail.starting_proficiencies.map(p => p.name));
  if (subraceDetail?.starting_proficiencies) profChips.push(...subraceDetail.starting_proficiencies.map(p => p.name));
  const languageChips = [];
  if (raceDetail?.languages) languageChips.push(...raceDetail.languages.map(l => l.name));
  if (subraceDetail?.languages) languageChips.push(...subraceDetail.languages.map(l => l.name));

  const canContinue = !!raceIndex; // subrace optional

  const applyAndNext = () => {
    setCharacter(c => ({
      ...c,
      race: raceDetail ? { index: raceIndex, name: raceDetail.name } : { index: raceIndex },
      raceDetail,
      subrace: subraceDetail ? { index: subraceIndex, name: subraceDetail.name } : (subraceIndex ? { index: subraceIndex } : null),
      subraceDetail,
      racialAbilityBonuses: bonuses,
      speed: subraceDetail?.speed || raceDetail?.speed || c.speed,
      size: subraceDetail?.size || raceDetail?.size || c.size,
      racial_proficiencies: profChips,
      racial_languages: languageChips,
    }));
    onNext();
  };

  const subraceOptions = raceDetail?.subraces || [];

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Race & Subrace</Typography>
      {error && <Typography color="error" sx={{ mb:2 }}>{error}</Typography>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="race-label">Race</InputLabel>
            <Select labelId="race-label" label="Race" value={raceIndex} onChange={(e)=>setRaceIndex(e.target.value)} disabled={loadingRace}>
              <MenuItem value=""><em>Select a race…</em></MenuItem>
              {races.map(r => <MenuItem key={r.index} value={r.index}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={!subraceOptions.length}>
            <InputLabel id="subrace-label">Subrace</InputLabel>
            <Select labelId="subrace-label" label="Subrace" value={subraceIndex} onChange={(e)=>setSubraceIndex(e.target.value)} disabled={!subraceOptions.length || loadingSubrace}>
              <MenuItem value=""><em>{subraceOptions.length ? 'No Subrace' : 'No Subrace available for selected race'}</em></MenuItem>
              {subraceOptions.map(sr => <MenuItem key={sr.index} value={sr.index}>{sr.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {(raceDetail || subraceDetail) && (
        <Box sx={{ mt:3 }}>
          <Divider sx={{ mb:2, borderColor:'rgba(255,255,255,0.15)' }} />
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ opacity:0.8 }}>Ability Bonuses</Typography>
              <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mt:1 }}>
                {Object.keys(bonuses).length ? Object.entries(bonuses).map(([k,v]) => <Chip key={k} label={`${k.toUpperCase()} +${v}`} size="small" />) : <Typography variant="caption" sx={{ opacity:0.6 }}>None</Typography>}
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="body2" sx={{ opacity:0.8 }}>Speed</Typography>
              <Typography variant="subtitle1">{subraceDetail?.speed || raceDetail?.speed || '—'}</Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="body2" sx={{ opacity:0.8 }}>Size</Typography>
              <Typography variant="subtitle1">{subraceDetail?.size || raceDetail?.size || '—'}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ opacity:0.8 }}>Languages</Typography>
              <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mt:1 }}>
                {languageChips.length ? languageChips.map(l => <Chip key={l} label={l} size="small" />) : <Typography variant="caption" sx={{ opacity:0.6 }}>—</Typography>}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ opacity:0.8 }}>Proficiencies</Typography>
              <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mt:1 }}>
                {profChips.length ? profChips.map(p => <Chip key={p} label={p} size="small" />) : <Typography variant="caption" sx={{ opacity:0.6 }}>—</Typography>}
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={applyAndNext} disabled={!canContinue}>Next</Button>
      </Box>
    </Box>
  );
}