import React, { useEffect, useState } from 'react';
import { Box, Button, Grid, Typography, Checkbox, FormControlLabel, Divider } from '@mui/material';
import { getProficiencies, getLanguages } from './api.js';

export default function StepProficienciesLanguages({ character, setCharacter, onNext, onBack }) {
  const [allProfs, setAllProfs] = useState([]);
  const [allLangs, setAllLangs] = useState([]);
  const [selectedProfs, setSelectedProfs] = useState(character.extra_proficiencies || []);
  const [selectedLangs, setSelectedLangs] = useState(character.extra_languages || []);
  const [error, setError] = useState('');

  const baseProfs = [
    ...(character.racial_proficiencies || []),
    ...(character.class_proficiencies || []),
  ];

  const baseLangs = [
    ...(character.racial_languages || []),
  ];

  useEffect(() => { (async () => { try { setAllProfs(await getProficiencies()); } catch (e) { setError('Failed to load proficiencies'); } })(); }, []);
  useEffect(() => { (async () => { try { setAllLangs(await getLanguages()); } catch (e) { setError('Failed to load languages'); } })(); }, []);

  const toggle = (setter) => (idx) => setter(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);

  const applyAndNext = () => {
    setCharacter(c => ({
      ...c,
      extra_proficiencies: selectedProfs,
      extra_languages: selectedLangs,
      all_proficiencies: Array.from(new Set([...baseProfs, ...selectedProfs])),
      all_languages: Array.from(new Set([...baseLangs, ...selectedLangs])),
    }));
    onNext();
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Proficiencies & Languages</Typography>
      {error && <Typography color="error" sx={{ mb:2 }}>{error}</Typography>}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        columnGap: 2,
        rowGap: 1,
        alignItems: 'start',
      }}>
        {/* Row 1: Existing headers */}
        <Typography variant="body2" sx={{ opacity:0.8, minHeight:24, gridColumn: { xs:'1', md:'1' }, gridRow: 1 }}>Existing Proficiencies</Typography>
        <Typography variant="body2" sx={{ opacity:0.8, minHeight:24, display:{ xs:'none', md:'block' }, gridColumn: { md:'2' }, gridRow: { md: 1 } }}>Existing Languages</Typography>

        {/* Row 2: Existing chip lists */}
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mt:1, gridColumn: { xs:'1', md:'1' }, gridRow: 2 }}>
          {baseProfs.length ? baseProfs.map(p => <Box key={p} sx={{ px:1, py:0.5, fontSize:12, bgcolor:'rgba(255,255,255,0.1)', borderRadius:1 }}>{p}</Box>) : <Typography variant="caption" sx={{ opacity:0.6 }}>None</Typography>}
        </Box>
        <Box sx={{ display:{ xs:'none', md:'flex' }, flexWrap:'wrap', gap:1, mt:1, gridColumn: { md:'2' }, gridRow: { md: 2 } }}>
          {baseLangs.length ? baseLangs.map(l => <Box key={l} sx={{ px:1, py:0.5, fontSize:12, bgcolor:'rgba(255,255,255,0.1)', borderRadius:1 }}>{l}</Box>) : <Typography variant="caption" sx={{ opacity:0.6 }}>None</Typography>}
        </Box>

        {/* Row 3: Dividers */}
        <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)', gridColumn: { xs:'1', md:'1' }, gridRow: 3 }} />
        <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)', display:{ xs:'none', md:'block' }, gridColumn: { md:'2' }, gridRow: { md: 3 } }} />

        {/* Row 4: Add More headers (aligned) */}
        <Typography variant="body2" sx={{ opacity:0.8, mb:1, minHeight:24, gridColumn: { xs:'1', md:'1' }, gridRow: 4 }}>Add More</Typography>
        <Typography variant="body2" sx={{ opacity:0.8, mb:1, minHeight:24, display:{ xs:'none', md:'block' }, gridColumn: { md:'2' }, gridRow: { md: 4 } }}>Add More</Typography>

        {/* Row 5: Add More lists */}
        <Box sx={{ maxHeight:260, overflow:'auto', pr:1, gridColumn: { xs:'1', md:'1' }, gridRow: 5 }}>
          {allProfs.map(p => (
            <FormControlLabel key={p.index}
              control={<Checkbox checked={selectedProfs.includes(p.name)} onChange={()=>toggle(setSelectedProfs)(p.name)} />}
              label={p.name}
              sx={{ display:'block', m:0 }}
            />
          ))}
        </Box>
        <Box sx={{ maxHeight:260, overflow:'auto', pr:1, display:{ xs:'none', md:'block' }, gridColumn: { md:'2' }, gridRow: { md: 5 } }}>
          {allLangs.map(l => (
            <FormControlLabel key={l.index}
              control={<Checkbox checked={selectedLangs.includes(l.name)} onChange={()=>toggle(setSelectedLangs)(l.name)} />}
              label={l.name}
              sx={{ display:'block', m:0 }}
            />
          ))}
        </Box>

        {/* Mobile-only: Existing Languages + Add More stacked after profs */}
        <Typography variant="body2" sx={{ opacity:0.8, minHeight:24, display:{ xs:'block', md:'none' }, gridColumn: '1', gridRow: 6 }}>Existing Languages</Typography>
        <Box sx={{ display:{ xs:'flex', md:'none' }, flexWrap:'wrap', gap:1, mt:1, gridColumn: '1', gridRow: 7 }}>
          {baseLangs.length ? baseLangs.map(l => <Box key={l} sx={{ px:1, py:0.5, fontSize:12, bgcolor:'rgba(255,255,255,0.1)', borderRadius:1 }}>{l}</Box>) : <Typography variant="caption" sx={{ opacity:0.6 }}>None</Typography>}
        </Box>
        <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)', display:{ xs:'block', md:'none' }, gridColumn: '1', gridRow: 8 }} />
        <Typography variant="body2" sx={{ opacity:0.8, mb:1, minHeight:24, display:{ xs:'block', md:'none' }, gridColumn: '1', gridRow: 9 }}>Add More</Typography>
        <Box sx={{ maxHeight:260, overflow:'auto', pr:1, display:{ xs:'block', md:'none' }, gridColumn: '1', gridRow: 10 }}>
          {allLangs.map(l => (
            <FormControlLabel key={l.index}
              control={<Checkbox checked={selectedLangs.includes(l.name)} onChange={()=>toggle(setSelectedLangs)(l.name)} />}
              label={l.name}
              sx={{ display:'block', m:0 }}
            />
          ))}
        </Box>
      </Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={applyAndNext}>Next</Button>
      </Box>
    </Box>
  );
}