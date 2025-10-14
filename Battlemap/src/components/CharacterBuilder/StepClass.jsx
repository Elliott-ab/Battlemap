import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Grid, FormControl, InputLabel, MenuItem, Select, Typography, Chip, Checkbox, FormGroup, FormControlLabel } from '@mui/material';
import { getClasses, getClass } from './api.js';

export default function StepClass({ character, setCharacter, onNext, onBack }) {
  const [classes, setClasses] = useState([]);
  const [classIndex, setClassIndex] = useState(character.class?.index || '');
  const [clsDetail, setClsDetail] = useState(character.classDetail || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState(character.class_skill_choices || []);

  useEffect(() => { (async () => { try { setClasses(await getClasses()); } catch (e) { setError('Failed to load classes'); } })(); }, []);

  useEffect(() => {
    if (!classIndex) return;
    let cancelled = false;
    (async () => {
      try { setLoading(true); setError(''); const detail = await getClass(classIndex); if (cancelled) return; setClsDetail(detail); setSelectedSkills([]); }
      catch (e) { if (!cancelled) setError('Could not fetch class detail'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [classIndex]);

  const skillChoice = useMemo(() => (clsDetail?.proficiency_choices || []).find(c => c.type === 'proficiencies'), [clsDetail]);
  const skillOptions = useMemo(() => (skillChoice?.from?.options || []).filter(o => o.item?.index?.startsWith('skill-')), [skillChoice]);
  const maxSkillChoices = skillChoice?.choose || 0;

  const toggleSkill = (idx) => {
    setSelectedSkills(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : (prev.length < maxSkillChoices ? [...prev, idx] : prev));
  };

  const profs = (clsDetail?.proficiencies || []).map(p => p.name);
  const savingThrows = (clsDetail?.saving_throws || []).map(s => s.name);
  const hitDie = clsDetail?.hit_die;

  const canContinue = classIndex && (maxSkillChoices === 0 || selectedSkills.length === maxSkillChoices);

  // Live-sync core class impact to character so Core Stats update in real time
  useEffect(() => {
    if (!clsDetail) return;
    setCharacter(c => ({
      ...c,
      class: { index: classIndex, name: clsDetail.name },
      classDetail: clsDetail,
      hit_die: hitDie,
      saving_throw_proficiencies: savingThrows,
      class_proficiencies: profs,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classIndex, clsDetail, hitDie]);

  const applyAndNext = () => {
    setCharacter(c => ({
      ...c,
      class_skill_choices: selectedSkills,
      skill_proficiencies: [...new Set([...(c.skill_proficiencies||[]), ...selectedSkills])],
    }));
    onNext();
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Class</Typography>
      {error && <Typography color="error" sx={{ mb:2 }}>{error}</Typography>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="class-label">Class</InputLabel>
            <Select labelId="class-label" label="Class" value={classIndex} onChange={(e)=>setClassIndex(e.target.value)} disabled={loading}>
              <MenuItem value=""><em>Select a class…</em></MenuItem>
              {classes.map(c => <MenuItem key={c.index} value={c.index}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        {clsDetail && (
          <Grid item xs={12} md={6}>
            <Box sx={{ display:'flex', gap:3 }}>
              <Box>
                <Typography variant="body2" sx={{ opacity:0.8 }}>Hit Die</Typography>
                <Typography variant="subtitle1">d{hitDie}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ opacity:0.8 }}>Saving Throws</Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mt:0.5, maxWidth:180 }}>
                  {savingThrows.map(st => <Chip key={st} label={st} size="small" />)}
                </Box>
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>
      {skillOptions.length > 0 && (
        <Box sx={{ mt:3 }}>
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Choose {maxSkillChoices} Skills</Typography>
          <FormGroup sx={{ display:'flex', flexDirection:'row', flexWrap:'wrap' }}>
            {skillOptions.map(o => {
              const idx = o.item.index;
              return (
                <FormControlLabel key={idx}
                  control={<Checkbox checked={selectedSkills.includes(idx)} onChange={()=>toggleSkill(idx)} disabled={!selectedSkills.includes(idx) && selectedSkills.length >= maxSkillChoices} />}
                  label={o.item.name}
                  sx={{ width:{ xs:'50%', md:'33%' } }}
                />
              );
            })}
          </FormGroup>
        </Box>
      )}
      {profs.length > 0 && (
        <Box sx={{ mt:3 }}>
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Proficiencies</Typography>
          <Box sx={{ display:'flex', flexWrap:'wrap', gap:1 }}>
            {profs.map(p => <Chip key={p} label={p} size="small" />)}
          </Box>
        </Box>
      )}
      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={applyAndNext} disabled={!canContinue}>Next</Button>
      </Box>
    </Box>
  );
}