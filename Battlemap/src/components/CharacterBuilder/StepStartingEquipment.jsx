import React, { useEffect, useState } from 'react';
import { Box, Button, Grid, Typography, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { getEquipment } from './api.js';

export default function StepStartingEquipment({ character, setCharacter, onNext, onBack }) {
  const [allEquip, setAllEquip] = useState([]);
  const [selected, setSelected] = useState(character.starting_equipment || []);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');

  // Basic fetch of equipment list (trim list for performance)
  useEffect(() => { (async () => { try { const items = await getEquipment(); setAllEquip(items.slice(0,150)); } catch (e) { setError('Failed to load equipment'); } })(); }, []);

  // Include class starting equipment if not already merged
  useEffect(() => {
    if (character.classDetail?.starting_equipment && !character._startingMerged) {
      const names = character.classDetail.starting_equipment.map(e => e.equipment?.name).filter(Boolean);
      setSelected(prev => Array.from(new Set([...prev, ...names])));
      setCharacter(c => ({ ...c, _startingMerged:true }));
    }
  }, [character.classDetail, character._startingMerged, setCharacter]);

  const toggle = (name) => setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  const addCustom = () => {
    if (!custom.trim()) return;
    setSelected(prev => [...prev, custom.trim()]);
    setCustom('');
  };

  const applyAndNext = () => {
    setCharacter(c => ({ ...c, starting_equipment: selected }));
    onNext();
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Starting Equipment</Typography>
      {error && <Typography color="error" sx={{ mb:2 }}>{error}</Typography>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} order={{ xs: 2, md: 1 }}>
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Select Items</Typography>
          <Box sx={{ maxHeight:320, overflow:'auto', pr:1 }}>
            {allEquip.map(e => (
              <FormControlLabel key={e.index}
                control={<Checkbox checked={selected.includes(e.name)} onChange={()=>toggle(e.name)} />}
                label={e.name}
                sx={{ display:'block', m:0 }}
              />
            ))}
          </Box>
        </Grid>
        <Grid item xs={12} md={6} order={{ xs: 1, md: 2 }}>
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Current Selection</Typography>
          <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mb:2 }}>
            {selected.map(s => <Box key={s} sx={{ px:1, py:0.5, fontSize:12, bgcolor:'rgba(255,255,255,0.1)', borderRadius:1 }}>{s}</Box>)}
          </Box>
          <Box sx={{ display:'flex', gap:1 }}>
            <TextField label="Add Custom Item" value={custom} onChange={(e)=>setCustom(e.target.value)} fullWidth />
            <Button variant="outlined" onClick={addCustom}>Add</Button>
          </Box>
        </Grid>
      </Grid>
      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={applyAndNext}>Next</Button>
      </Box>
    </Box>
  );
}