import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Grid, Paper, TextField, Typography, MenuItem, Divider } from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getCharacter, upsertCharacter, deleteCharacter } from '../utils/characterService.js';

const alignments = [
  'Lawful Good','Neutral Good','Chaotic Good',
  'Lawful Neutral','True Neutral','Chaotic Neutral',
  'Lawful Evil','Neutral Evil','Chaotic Evil'
];

export default function CharacterBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', class: '', race: '', level: 1, background: '', alignment: '',
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    max_hp: 10, current_hp: 10, ac: 10, speed: 30,
    features: '', equipment: ''
  });
  // Additional sheet-like fields (temporarily stored inside features on save until DB schema extends)
  const [playerName, setPlayerName] = useState('');
  const [xp, setXp] = useState('');
  const [inspiration, setInspiration] = useState('');
  const [tempHp, setTempHp] = useState('');
  const [hitDice, setHitDice] = useState('');
  const [deathSuccesses, setDeathSuccesses] = useState(0);
  const [deathFailures, setDeathFailures] = useState(0);
  const [attacks, setAttacks] = useState('');
  const [proficiencies, setProficiencies] = useState('');
  const [traits, setTraits] = useState('');
  const [ideals, setIdeals] = useState('');
  const [bonds, setBonds] = useState('');
  const [flaws, setFlaws] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (isNew) return;
      try {
        const row = await getCharacter(id);
        if (mounted && row) setForm({
          name: row.name || '', class: row.class || '', race: row.race || '', level: row.level || 1, background: row.background || '', alignment: row.alignment || '',
          str: row.str ?? 10, dex: row.dex ?? 10, con: row.con ?? 10, int: row.int ?? 10, wis: row.wis ?? 10, cha: row.cha ?? 10,
          max_hp: row.max_hp ?? 10, current_hp: row.current_hp ?? row.max_hp ?? 10, ac: row.ac ?? 10, speed: row.speed ?? 30,
          features: row.features || '', equipment: row.equipment || ''
        });
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, isNew]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: typeof e === 'number' ? e : e.target.value }));

  const abilityMod = (score) => Math.floor((Number(score || 0) - 10) / 2);
  const withSign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const profBonus = useMemo(() => {
    const lvl = Number(form.level || 1);
    if (lvl >= 17) return 6; if (lvl >= 13) return 5; if (lvl >= 9) return 4; if (lvl >= 5) return 3; return 2;
  }, [form.level]);
  const initiative = abilityMod(form.dex);
  const passivePerception = 10 + abilityMod(form.wis);

  const save = async () => {
    setError('');
    try {
      // Merge extra sheet sections into features text for persistence (until DB schema adds dedicated columns)
      const mergedFeatures = [
        form.features?.trim() ? `Features & Traits\n${form.features.trim()}` : '',
        traits?.trim() ? `\n\nPersonality Traits\n${traits.trim()}` : '',
        ideals?.trim() ? `\n\nIdeals\n${ideals.trim()}` : '',
        bonds?.trim() ? `\n\nBonds\n${bonds.trim()}` : '',
        flaws?.trim() ? `\n\nFlaws\n${flaws.trim()}` : '',
        proficiencies?.trim() ? `\n\nProficiencies & Languages\n${proficiencies.trim()}` : '',
        attacks?.trim() ? `\n\nAttacks & Spellcasting\n${attacks.trim()}` : '',
        (hitDice?.trim() || tempHp || deathSuccesses || deathFailures || inspiration)
          ? `\n\nOther\n` +
            `${inspiration ? `Inspiration: ${inspiration}\n` : ''}` +
            `${hitDice ? `Hit Dice: ${hitDice}\n` : ''}` +
            `${tempHp ? `Temp HP: ${tempHp}\n` : ''}` +
            `${deathSuccesses || deathFailures ? `Death Saves (S/F): ${deathSuccesses}/${deathFailures}\n` : ''}`
          : ''
      ].filter(Boolean).join('');

      const payload = { id: isNew ? undefined : id, user_id: user.id, ...form, features: mergedFeatures };
      const saved = await upsertCharacter(payload);
      navigate(`/characters/${saved.id}`);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async () => {
    if (isNew) return navigate('/characters');
    if (!confirm('Delete this character?')) return;
    try {
      await deleteCharacter(id);
      navigate('/characters');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <DashboardSidebar
          onOpenBattlemap={() => navigate('/battlemap/LOCAL')}
          onOpenCharacters={() => navigate('/characters')}
        />
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">{isNew ? 'Build New Character' : 'Edit Character'}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button className="print-hide" onClick={() => window.print()}>Print</Button>
              {!isNew && <Button className="print-hide" color="error" onClick={remove}>Delete</Button>}
              <Button className="print-hide" variant="contained" onClick={save}>Save</Button>
            </Box>
          </Box>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          <Paper className="sheet" sx={{ p: 2 }}>
            {/* Header row */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <TextField label="Character Name" value={form.name} onChange={update('name')} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Class" value={form.class} onChange={update('class')} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Level" type="number" value={form.level} onChange={(e)=>update('level')({ target: { value: parseInt(e.target.value||'1',10) }})} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Background" value={form.background} onChange={update('background')} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Player Name" value={playerName} onChange={(e)=>setPlayerName(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Race" value={form.race} onChange={update('race')} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField select label="Alignment" value={form.alignment} onChange={update('alignment')} fullWidth>
                  {alignments.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="XP" type="number" value={xp} onChange={(e)=>setXp(e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              {/* Left Column */}
              <Grid item xs={12} md={3}>
                {/* Ability scores stack */}
                {(['str','dex','con','int','wis','cha']).map((stat) => (
                  <Box key={stat} className="sheet-box" sx={{ display: 'flex', alignItems: 'center', mb: 1.5, p: 1, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 1 }}>
                    <Box className="sheet-ring" sx={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, mr: 1.5 }}>
                      {withSign(abilityMod(form[stat]))}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption">{stat.toUpperCase()}</Typography>
                      <TextField size="small" type="number" value={form[stat]} onChange={(e)=>update(stat)({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                    </Box>
                  </Box>
                ))}

                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <TextField label="Inspiration" size="small" value={inspiration} onChange={(e)=>setInspiration(e.target.value)} fullWidth />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Prof. Bonus" size="small" value={withSign(profBonus)} InputProps={{ readOnly: true }} fullWidth />
                  </Grid>
                </Grid>

                <Box className="sheet-box" sx={{ mt: 2, p: 1, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 1 }}>
                  <Typography variant="subtitle2">Saving Throws</Typography>
                  {['STR','DEX','CON','INT','WIS','CHA'].map((abbr, idx) => {
                    const key = ['str','dex','con','int','wis','cha'][idx];
                    return (
                      <Box key={abbr} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span>{abbr}</span>
                        <span>{withSign(abilityMod(form[key]))}</span>
                      </Box>
                    );
                  })}
                </Box>

                <Box className="sheet-box" sx={{ mt: 2, p: 1, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 1 }}>
                  <Typography variant="subtitle2">Skills</Typography>
                  {[
                    ['Acrobatics (DEX)', 'dex'],
                    ['Stealth (DEX)', 'dex'],
                    ['Perception (WIS)', 'wis'],
                    ['Investigation (INT)', 'int'],
                    ['Athletics (STR)', 'str'],
                    ['Persuasion (CHA)', 'cha']
                  ].map(([label, key]) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{label}</span>
                      <span>{withSign(abilityMod(form[key]))}</span>
                    </Box>
                  ))}
                </Box>

                <Box className="sheet-box" sx={{ mt: 2, p: 1, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 1 }}>
                  <Typography variant="subtitle2">Passive Perception</Typography>
                  <Typography>{passivePerception}</Typography>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <TextField label="Proficiencies & Languages" value={proficiencies} onChange={(e)=>setProficiencies(e.target.value)} fullWidth multiline minRows={4} />
                </Box>
              </Grid>

              {/* Middle Column */}
              <Grid item xs={12} md={5}>
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <TextField label="AC" type="number" value={form.ac} onChange={(e)=>update('ac')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Initiative" value={withSign(initiative)} InputProps={{ readOnly: true }} fullWidth />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Speed" type="number" value={form.speed} onChange={(e)=>update('speed')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                </Grid>

                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <TextField label="Max HP" type="number" value={form.max_hp} onChange={(e)=>update('max_hp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Current HP" type="number" value={form.current_hp} onChange={(e)=>update('current_hp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Temp HP" type="number" value={tempHp} onChange={(e)=>setTempHp(e.target.value)} fullWidth />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Hit Dice" value={hitDice} onChange={(e)=>setHitDice(e.target.value)} fullWidth />
                  </Grid>
                </Grid>

                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <TextField label="Death Saves (Successes)" type="number" value={deathSuccesses} onChange={(e)=>setDeathSuccesses(parseInt(e.target.value||'0',10))} fullWidth />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Death Saves (Failures)" type="number" value={deathFailures} onChange={(e)=>setDeathFailures(parseInt(e.target.value||'0',10))} fullWidth />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  <TextField label="Attacks & Spellcasting" value={attacks} onChange={(e)=>setAttacks(e.target.value)} fullWidth multiline minRows={4} />
                </Box>

                <Box sx={{ mt: 2 }}>
                  <TextField label="Equipment" value={form.equipment} onChange={update('equipment')} fullWidth multiline minRows={6} />
                </Box>
              </Grid>

              {/* Right Column */}
              <Grid item xs={12} md={4}>
                <TextField label="Personality Traits" value={traits} onChange={(e)=>setTraits(e.target.value)} fullWidth multiline minRows={4} />
                <Box sx={{ height: 12 }} />
                <TextField label="Ideals" value={ideals} onChange={(e)=>setIdeals(e.target.value)} fullWidth multiline minRows={4} />
                <Box sx={{ height: 12 }} />
                <TextField label="Bonds" value={bonds} onChange={(e)=>setBonds(e.target.value)} fullWidth multiline minRows={4} />
                <Box sx={{ height: 12 }} />
                <TextField label="Flaws" value={flaws} onChange={(e)=>setFlaws(e.target.value)} fullWidth multiline minRows={4} />
                <Box sx={{ height: 12 }} />
                <TextField label="Features & Traits" value={form.features} onChange={update('features')} fullWidth multiline minRows={6} />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </div>
    </Box>
  );
}
