import React, { useMemo, useState } from 'react';
import { Box, Button, Grid, Typography, Chip, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { upsertCharacter } from '../../Utils/characterService.js';
import { computeDerived } from './api.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function StepSummary({ character, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const derived = useMemo(() => computeDerived(character), [character]);

  const abilityKeys = ['str','dex','con','int','wis','cha'];

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      const payload = {
        user_id: user.id,
        name: character.name,
        level: character.level || 1,
        race: character.race?.name || '',
        class: character.class?.name || '',
        background: character.background?.name || '',
        str: character.str, dex: character.dex, con: character.con, int: character.int, wis: character.wis, cha: character.cha,
        max_hp: character.max_hp || derived.hp,
        current_hp: character.max_hp || derived.hp,
        ac: character.ac || derived.ac,
        speed: character.speed || 30,
        saving_throws: {},
        skills: {},
        equipment: (character.starting_equipment || []).join(', '),
        spellcasting: character.spellcasting || {},
        spells: {},
        icon_url: '',
        currency: { gp: 0, sp:0, cp:0 },
      };
      const saved = await upsertCharacter(payload);
      navigate(`/characters/${saved.id}`);
    } catch (e) { setError(e.message || String(e)); } finally { setSaving(false); }
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:2 }}>Summary</Typography>
      {error && <Typography color="error" sx={{ mb:2 }}>{error}</Typography>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" sx={{ opacity:0.8 }}>Basics</Typography>
          <Typography variant="h6" sx={{ mb:1 }}>{character.name}</Typography>
          <Typography variant="body2">Level {character.level || 1} {character.race?.name} {character.class?.name}</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" sx={{ color:'#d32f2f', fontWeight:700 }}>Core Stats</Typography>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>HP:</Box>{' '}
            <Box component="span">{character.max_hp || derived.hp}</Box>
          </Typography>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>AC:</Box>{' '}
            <Box component="span">{character.ac || derived.ac}</Box>
          </Typography>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>Speed:</Box>{' '}
            <Box component="span">{character.speed || 30}</Box>
          </Typography>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>Prof Bonus:</Box>{' '}
            <Box component="span">{derived.proficiencyBonus}</Box>
          </Typography>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>Initiative:</Box>{' '}
            <Box component="span">{derived.initiative>=0?`+${derived.initiative}`:derived.initiative}</Box>
          </Typography>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>Passive Perception:</Box>{' '}
            <Box component="span">{derived.passivePerception}</Box>
          </Typography>
        </Grid>
      </Grid>
      <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)' }} />
      <Grid container spacing={2}>
        {abilityKeys.map(k => (
          <Grid key={k} item xs={4} md={2}>
            <Box sx={{ p:1, border:'1px solid rgba(255,255,255,0.15)', borderRadius:1, textAlign:'center' }}>
              <Typography variant="caption" sx={{ opacity:0.7 }}>{k.toUpperCase()}</Typography>
              <Typography variant="h6">{character[k]}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)' }} />
      <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Equipment</Typography>
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:1 }}>
        {(character.starting_equipment || []).map(i => <Chip key={i} label={i} size="small" />)}
      </Box>
      {character.selected_cantrips && (
        <>
          <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)' }} />
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Spells</Typography>
          <Box sx={{ display:'flex', flexWrap:'wrap', gap:1 }}>
            {character.selected_cantrips.map(i => <Chip key={i} label={i} size="small" />)}
            {character.selected_level1_spells?.map(i => <Chip key={i} label={i} size="small" />)}
          </Box>
        </>
      )}
      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving? 'Saving…':'Save Character'}</Button>
      </Box>
    </Box>
  );
}