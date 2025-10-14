import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Grid, Typography, Checkbox, FormControlLabel } from '@mui/material';
import { getClassSpells, getSpells, abilityMod, proficiencyBonus } from './api.js';

// Basic list of classes that have spellcasting at level 1 (SRD focus)
const SPELLCASTING_CLASSES = ['wizard','cleric','druid','sorcerer','bard','warlock','paladin','ranger'];

export default function StepSpellcasting({ character, setCharacter, onNext, onBack }) {
  const classIndex = character.class?.index;
  const isCaster = SPELLCASTING_CLASSES.includes(classIndex || '');
  const [classSpellList, setClassSpellList] = useState([]);
  const [allSpells, setAllSpells] = useState([]);
  const [selectedCantrips, setSelectedCantrips] = useState(character.selected_cantrips || []);
  const [selectedLevel1, setSelectedLevel1] = useState(character.selected_level1_spells || []);
  const [error, setError] = useState('');

  const level = character.level || 1;

  // Spellcasting ability heuristic
  const spellcastingAbility = useMemo(() => {
    const map = { wizard:'int', cleric:'wis', druid:'wis', bard:'cha', sorcerer:'cha', warlock:'cha', paladin:'cha', ranger:'wis' };
    return map[classIndex] || 'int';
  }, [classIndex]);

  const abilityScore = character[spellcastingAbility] || 10;
  const spellMod = abilityMod(abilityScore);
  const prof = proficiencyBonus(level);
  const spellSaveDC = 8 + prof + spellMod;
  const spellAttackMod = prof + spellMod;

  useEffect(() => {
    if (!isCaster) return;
    let cancelled = false;
    (async () => {
      try {
        setError('');
        const [cls, all] = await Promise.all([getClassSpells(classIndex), getSpells()]);
        if (cancelled) return;
        setClassSpellList(cls);
        setAllSpells(all);
      } catch (e) { if (!cancelled) setError('Failed to load spells'); }
    })();
    return () => { cancelled = true; };
  }, [classIndex, isCaster]);

  const spellsByIndex = useMemo(() => Object.fromEntries(allSpells.map(s => [s.index, s])), [allSpells]);

  // Filter out spells accessible to the class (classSpellList already filtered from API)
  const cantrips = classSpellList.filter(s => s.level === 0 || s.level === undefined).slice(0, 40); // API does not always include level, quick heuristic fallback
  const level1Spells = classSpellList.filter(s => s.level === 1).slice(0, 50);

  // Simple allowances (could be improved with proper class rules):
  const maxCantrips = 3;
  const maxLevel1 = 2;

  const toggle = (setter, max) => (idx) => setter(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : (prev.length < max ? [...prev, idx] : prev));

  const applyAndNext = () => {
    if (isCaster) {
      setCharacter(c => ({
        ...c,
        selected_cantrips: selectedCantrips,
        selected_level1_spells: selectedLevel1,
        spellcasting: {
          ability: spellcastingAbility,
          spellSaveDC,
          spellAttackMod,
        }
      }));
    }
    onNext();
  };

  if (!isCaster) {
    return (
      <Box>
        <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Spellcasting</Typography>
        <Typography variant="body2" sx={{ mb:2 }}>Your class does not provide spellcasting at level 1. Continue.</Typography>
        <Box sx={{ display:'flex', justifyContent:'space-between' }}>
          <Button onClick={onBack}>Back</Button>
          <Button variant="contained" onClick={applyAndNext}>Next</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Spellcasting</Typography>
      {error && <Typography color="error" sx={{ mb:2 }}>{error}</Typography>}
      <Typography variant="body2" sx={{ mb:2 }}>Spellcasting Ability: {spellcastingAbility.toUpperCase()} | Save DC {spellSaveDC} | Attack +{spellAttackMod}</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Cantrips (choose up to {maxCantrips})</Typography>
          <Box sx={{ maxHeight:300, overflow:'auto', pr:1 }}>
            {cantrips.map(s => (
              <FormControlLabel key={s.index}
                control={<Checkbox checked={selectedCantrips.includes(s.index)} onChange={()=>toggle(setSelectedCantrips, maxCantrips)(s.index)} />}
                label={s.name}
                sx={{ display:'block', m:0 }}
              />
            ))}
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Level 1 Spells (choose up to {maxLevel1})</Typography>
          <Box sx={{ maxHeight:300, overflow:'auto', pr:1 }}>
            {level1Spells.map(s => (
              <FormControlLabel key={s.index}
                control={<Checkbox checked={selectedLevel1.includes(s.index)} onChange={()=>toggle(setSelectedLevel1, maxLevel1)(s.index)} />}
                label={s.name}
                sx={{ display:'block', m:0 }}
              />
            ))}
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