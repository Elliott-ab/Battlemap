import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Paper,
  TextField,
  Typography,
  MenuItem,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Toolbar from '../components/Toolbar.jsx';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getCharacter, upsertCharacter, deleteCharacter } from '../utils/characterService.js';

function AttackEditor({ attacks, onChange }) {
  const [name, setName] = useState('');
  const [attackBonus, setAttackBonus] = useState('');
  const [damage, setDamage] = useState('');

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const next = [...(attacks || []), { name: n, attack_bonus: attackBonus, damage }];
    onChange(next);
    setName(''); setAttackBonus(''); setDamage('');
  };

  const remove = (idx) => {
    const next = (attacks || []).filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <Box sx={{ border: '1px solid #fff', borderRadius: 1, p: 1, color: '#fff' }}>
      {(attacks || []).length === 0 ? (
        <Typography>No attacks yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(attacks || []).map((atk, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flex: 1 }}>{atk.name} • +{atk.attack_bonus || 0} • {atk.damage || ''}</Typography>
        <Button size="small" color="error" onClick={() => remove(idx)}>Remove</Button>
            </Box>
          ))}
        </Box>
      )}
      <Grid container spacing={1} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={5}>
          <TextField label="Name" value={name} onChange={(e)=>setName(e.target.value)} fullWidth size="small" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField label="Attack Bonus" value={attackBonus} onChange={(e)=>setAttackBonus(e.target.value)} fullWidth size="small" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField label="Damage" value={damage} onChange={(e)=>setDamage(e.target.value)} fullWidth size="small" />
        </Grid>
        <Grid item xs={12} sm={1} sx={{ display: 'flex', alignItems: 'stretch' }}>
          <Button variant="outlined" onClick={add} fullWidth>Add</Button>
        </Grid>
      </Grid>
    </Box>
  );
}

function SectionCard({ title, action, children, sx }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        backgroundColor: 'transparent',
        borderColor: '#fff',
        color: '#fff',
        // Make all typical child controls white by default
        '& .MuiTypography-root': { color: '#fff' },
        '& .MuiButton-root': { color: '#fff', borderColor: '#fff' },
        '& .MuiSvgIcon-root': { color: '#fff' },
        '& .MuiChip-root': { color: '#fff', borderColor: '#fff' },
        '& .MuiChip-outlined': { borderColor: '#fff' },
        '& .MuiTabs-indicator': { backgroundColor: '#d32f2f' },
        '& .MuiTab-root': { color: '#fff' },
        '& .MuiTab-root.Mui-selected': { color: '#d32f2f' },
        '& .MuiInputBase-input': { color: '#fff' },
  '& .MuiFormLabel-root': { color: '#fff' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
        ...sx,
      }}
    >
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          {title && <Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700 }}>{title}</Typography>}
          {action || null}
        </Box>
      )}
      {children}
    </Paper>
  );
}

function SpellsEditor({ spells, onChange }) {
  const levels = Array.from({ length: 10 }, (_, i) => i); // 0-9
  const [newNames, setNewNames] = useState({});

  const addSpell = (lvl) => {
    const name = (newNames[lvl] || '').trim();
    if (!name) return;
    const list = Array.isArray(spells?.[lvl]) ? spells[lvl] : [];
    const next = { ...(spells || {}), [lvl]: [...list, { name, prepared: false }] };
    onChange(next);
    setNewNames((s)=>({ ...s, [lvl]: '' }));
  };

  const removeSpell = (lvl, idx) => {
    const list = Array.isArray(spells?.[lvl]) ? spells[lvl] : [];
    const next = { ...(spells || {}), [lvl]: list.filter((_, i) => i !== idx) };
    onChange(next);
  };

  const togglePrepared = (lvl, idx) => {
    const list = Array.isArray(spells?.[lvl]) ? spells[lvl] : [];
    const nextList = list.map((s, i) => i === idx ? { ...s, prepared: !s.prepared } : s);
    const next = { ...(spells || {}), [lvl]: nextList };
    onChange(next);
  };

  return (
    <Box sx={{ color: '#fff' }}>
      {levels.map((lvl) => (
        <Paper key={lvl} variant="outlined" sx={{ p: 1.5, mb: 2, backgroundColor: 'transparent', borderColor: '#fff', color: '#fff' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#d32f2f', fontWeight: 700 }}>{lvl === 0 ? 'Cantrips (0)' : `Level ${lvl}`}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(Array.isArray(spells?.[lvl]) ? spells[lvl] : []).map((s, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input type="checkbox" checked={!!s.prepared} onChange={()=>togglePrepared(lvl, idx)} />
                <Typography sx={{ flex: 1 }}>{s.name}</Typography>
                <Button size="small" color="error" onClick={()=>removeSpell(lvl, idx)}>Remove</Button>
              </Box>
            ))}
          </Box>
          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid item xs={9} sm={10}>
              <TextField label="Add spell" value={newNames[lvl] || ''} onChange={(e)=>setNewNames(n=>({ ...n, [lvl]: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={3} sm={2}>
              <Button variant="outlined" onClick={()=>addSpell(lvl)} fullWidth>Add</Button>
            </Grid>
          </Grid>
        </Paper>
      ))}
    </Box>
  );
}

const alignments = [
  'Lawful Good','Neutral Good','Chaotic Good',
  'Lawful Neutral','True Neutral','Chaotic Neutral',
  'Lawful Evil','Neutral Evil','Chaotic Evil'
];

const SKILLS = [
  // [label, key, ability]
  ['Acrobatics', 'acrobatics', 'dex'],
  ['Animal Handling', 'animal_handling', 'wis'],
  ['Arcana', 'arcana', 'int'],
  ['Athletics', 'athletics', 'str'],
  ['Deception', 'deception', 'cha'],
  ['History', 'history', 'int'],
  ['Insight', 'insight', 'wis'],
  ['Intimidation', 'intimidation', 'cha'],
  ['Investigation', 'investigation', 'int'],
  ['Medicine', 'medicine', 'wis'],
  ['Nature', 'nature', 'int'],
  ['Perception', 'perception', 'wis'],
  ['Performance', 'performance', 'cha'],
  ['Persuasion', 'persuasion', 'cha'],
  ['Religion', 'religion', 'int'],
  ['Sleight of Hand', 'sleight_of_hand', 'dex'],
  ['Stealth', 'stealth', 'dex'],
  ['Survival', 'survival', 'wis']
];

const SPELL_ABILITIES = [
  { label: 'Intelligence (INT)', value: 'int' },
  { label: 'Wisdom (WIS)', value: 'wis' },
  { label: 'Charisma (CHA)', value: 'cha' },
];

// Helpers
const abilityMod = (score) => Math.floor((Number(score || 10) - 10) / 2);
const withSign = (n) => (n >= 0 ? `+${n}` : `${n}`);

export default function CharacterBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  const { user } = useAuth();

  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({
    name: '',
    class: '',
    race: '',
    level: 1,
    background: '',
    alignment: '',
    xp: 0,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    ac: 10,
    speed: 30,
    max_hp: 10,
    current_hp: 10,
    hp_temp: 0,
    saving_throws: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skills: {},
    attacks: [],
    spellcasting: { ability: '', save_dc: null, attack_mod: null, slots: {} },
    spells: {},
    currency: { gp: 0, sp: 0, cp: 0 },
    equipment: '',
    class_features: '',
    racial_traits: '',
    feats: '',
  });

  // Extra UI state
  const [hitDice, setHitDice] = useState('1d8');
  const [inspiration, setInspiration] = useState('');
  const [deathSuccesses, setDeathSuccesses] = useState(0);
  const [deathFailures, setDeathFailures] = useState(0);

  // Derived numbers
  const profBonus = useMemo(() => 2 + Math.floor((Number(form.level || 1) - 1) / 4), [form.level]);
  const initiative = useMemo(() => abilityMod(form.dex), [form.dex]);
  const passivePerception = useMemo(() => 10 + abilityMod(form.wis) + (form?.skills?.perception?.prof ? profBonus : 0), [form.wis, form.skills, profBonus]);
  const spellAbilityMod = useMemo(() => abilityMod(form[form?.spellcasting?.ability] || 0), [form]);
  const spellSaveDC = useMemo(() => 8 + profBonus + (isNaN(spellAbilityMod) ? 0 : spellAbilityMod), [profBonus, spellAbilityMod]);
  const spellAttackMod = useMemo(() => profBonus + (isNaN(spellAbilityMod) ? 0 : spellAbilityMod), [profBonus, spellAbilityMod]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const skillBonus = (abilityKey, prof) => abilityMod(form[abilityKey]) + (prof ? profBonus : 0);

  // Load existing character
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isNew) {
        try {
          const row = await getCharacter(id);
          if (mounted && row) setForm({
            name: '', class: '', race: '', level: 1, background: '', alignment: '', xp: 0,
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
            ac: 10, speed: 30,
            max_hp: 10, current_hp: 10, hp_temp: 0,
            saving_throws: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
            skills: {}, attacks: [], spellcasting: { ability: '', save_dc: null, attack_mod: null, slots: {} },
            spells: {}, currency: { gp: 0, sp: 0, cp: 0 }, equipment: '', class_features: '', racial_traits: '', feats: '',
            ...row,
          });
        } catch (e) {
          console.error(e);
        }
      }
    })();
    return () => { mounted = false; };
  }, [id, isNew]);

  const handleSave = async () => {
    const payload = { ...form, user_id: user.id, id: isNew ? undefined : id };
    const saved = await upsertCharacter(payload);
    if (isNew) navigate(`/characters/${saved.id}`);
  };

  const handleDelete = async () => {
    if (isNew) return navigate('/characters');
    if (!window.confirm('Delete this character?')) return;
    await deleteCharacter(id);
    navigate('/characters');
  };

  return (
    <Box className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <DashboardSidebar
          onOpenBattlemap={() => navigate('/battlemap/LOCAL')}
          onOpenCharacters={() => navigate('/characters')}
        />
  <Box sx={{ flex: 1, p: 2, overflow: 'auto', color: '#fff' }}>
          {/* Header strip */}
          <SectionCard
            action={(
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isNew && <Button color="error" variant="outlined" onClick={handleDelete}>Delete</Button>}
                <Button variant="contained" onClick={handleSave}>Save</Button>
              </Box>
            )}
          >
            <Grid container spacing={1}>
              <Grid item xs={12} md={4}>
                <TextField label="Character Name" value={form.name} onChange={update('name')} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Class" value={form.class} onChange={update('class')} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Level" type="number" value={form.level} onChange={(e)=>update('level')({ target: { value: parseInt(e.target.value||'1', 10) } })} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Race" value={form.race} onChange={update('race')} fullWidth />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField label="Background" value={form.background} onChange={update('background')} fullWidth />
              </Grid>
            </Grid>
          </SectionCard>

          <Box sx={{ borderBottom: 1, borderColor: '#fff', mt: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} TabIndicatorProps={{ style: { backgroundColor: '#d32f2f' } }} sx={{ '& .MuiTab-root': { color: '#fff' }, '& .MuiTab-root.Mui-selected': { color: '#d32f2f' } }}>
              <Tab label="Core" />
              <Tab label="Details" />
              <Tab label="Spells" />
            </Tabs>
          </Box>

          {/* Core Tab */}
          {tab === 0 && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                {/* Row 1 */}
                <Grid item xs={12} md={8}>
                  <SectionCard title="Basics">
                    <Grid container spacing={1}>
                      <Grid item xs={6} md={3}><TextField label="Alignment" value={form.alignment} onChange={update('alignment')} select fullWidth>{alignments.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}</TextField></Grid>
                      <Grid item xs={6} md={3}><TextField label="XP" type="number" value={form.xp} onChange={(e)=>update('xp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth /></Grid>
                      <Grid item xs={6} md={3}><TextField label="Proficiency Bonus" value={withSign(profBonus)} InputProps={{ readOnly: true }} fullWidth /></Grid>
                      <Grid item xs={6} md={3}><TextField label="Initiative" value={withSign(initiative)} InputProps={{ readOnly: true }} fullWidth /></Grid>
                    </Grid>
                  </SectionCard>

                  {/* Ability Scores now directly under Basics */}
                  <SectionCard title="Ability Scores" sx={{ mt: 2 }}>
                    <Grid container spacing={1}>
                      {(['str','dex','con','int','wis','cha']).map((stat) => (
                        <Grid item xs={12} sm={6} md={4} key={stat}>
                          <Box sx={{ display: 'flex', alignItems: 'center', p: 1, border: '1px solid', borderColor: '#fff', borderRadius: 1 }}>
                            <Box sx={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, mr: 1.5 }}>
                              {withSign(abilityMod(form[stat]))}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption">{stat.toUpperCase()}</Typography>
                              <TextField size="small" type="number" value={form[stat]} onChange={(e)=>update(stat)({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SectionCard title="Hit Points & Death Saves">
                    <Grid container spacing={1}>
                      <Grid item xs={4}><TextField label="Max" type="number" value={form.max_hp} onChange={(e)=>update('max_hp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth size="small" /></Grid>
                      <Grid item xs={4}><TextField label="Current" type="number" value={form.current_hp} onChange={(e)=>update('current_hp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth size="small" /></Grid>
                      <Grid item xs={4}><TextField label="Temp" type="number" value={form.hp_temp} onChange={(e)=>update('hp_temp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth size="small" /></Grid>
                    </Grid>
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption">Successes</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          {[0,1,2].map(i => (
                            <Checkbox key={i} size="small" checked={deathSuccesses > i} onChange={()=> setDeathSuccesses(deathSuccesses > i ? i : i+1)} />
                          ))}
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption">Failures</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          {[0,1,2].map(i => (
                            <Checkbox key={i} size="small" checked={deathFailures > i} onChange={()=> setDeathFailures(deathFailures > i ? i : i+1)} />
                          ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </SectionCard>
                </Grid>

                {/* Row 2: AC & Speed full width */}
                <Grid item xs={12}>
                  <SectionCard title="AC & Speed">
                    <Grid container spacing={1}>
                      <Grid item xs={6} md={3}><TextField label="Armor Class" type="number" value={form.ac} onChange={(e)=>update('ac')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth size="small" /></Grid>
                      <Grid item xs={6} md={3}><TextField label="Speed" type="number" value={form.speed} onChange={(e)=>update('speed')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth size="small" /></Grid>
                      <Grid item xs={12} md={6}><TextField label="Passive Perception" value={passivePerception} InputProps={{ readOnly: true }} fullWidth size="small" /></Grid>
                    </Grid>
                  </SectionCard>
                </Grid>

                {/* Row 3: Saving Throws + Skills same width */}
                <Grid item xs={12} md={6}>
                  <SectionCard title="Saving Throws">
                    {['str','dex','con','int','wis','cha'].map((key) => (
                      <Box key={key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
                        <FormControlLabel control={<Checkbox size="small" checked={!!form.saving_throws?.[key]} onChange={(e)=> setForm(f=>({ ...f, saving_throws: { ...(f.saving_throws||{}), [key]: e.target.checked } }))} />} label={key.toUpperCase()} />
                        <Typography sx={{ ml: 1 }}>{withSign(skillBonus(key, !!form.saving_throws?.[key]))}</Typography>
                      </Box>
                    ))}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard title="Skills">
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', rowGap: 0.5, columnGap: 1 }}>
                      {SKILLS.map(([label, sk, key]) => (
                        <React.Fragment key={sk}>
                          <Checkbox size="small" sx={{ alignSelf: 'center' }} checked={!!form.skills?.[sk]?.prof} onChange={(e)=> setForm(f=>({ ...f, skills: { ...(f.skills||{}), [sk]: { prof: e.target.checked } } })) } />
                          <Typography>{label}</Typography>
                          <Typography sx={{ textAlign: 'right' }}>{withSign(skillBonus(key, !!form.skills?.[sk]?.prof))}</Typography>
                        </React.Fragment>
                      ))}
                    </Box>
                  </SectionCard>
                </Grid>

                {/* Row 4 */}
                <Grid item xs={12}>
                  <SectionCard title="Attacks & Spellcasting">
                    <AttackEditor attacks={form.attacks} onChange={(attacks)=>setForm(f=>({ ...f, attacks }))} />
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      <Grid item xs={12} md={6}>
                        <TextField select label="Spellcasting Ability" value={form.spellcasting?.ability||''} onChange={(e)=>setForm(f=>({ ...f, spellcasting: { ...(f.spellcasting||{}), ability: e.target.value } }))} fullWidth>
                          {SPELL_ABILITIES.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={6} md={3}><TextField label="Spell Save DC" value={spellSaveDC} InputProps={{ readOnly: true }} fullWidth /></Grid>
                      <Grid item xs={6} md={3}><TextField label="Spell Attack Mod" value={withSign(spellAttackMod)} InputProps={{ readOnly: true }} fullWidth /></Grid>
                    </Grid>
                  </SectionCard>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Details Tab */}
          {tab === 1 && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Accordion disableGutters elevation={0} sx={{ backgroundColor: 'transparent', border: '1px solid', borderColor: '#fff', borderRadius: 1, color: '#fff' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700 }}>Equipment & Currency</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TextField label="Equipment" value={form.equipment} onChange={update('equipment')} fullWidth multiline minRows={8} />
                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid item xs={4}><TextField label="GP" type="number" value={form.currency.gp} onChange={(e)=>setForm(f=>({ ...f, currency: { ...f.currency, gp: parseInt(e.target.value||'0',10) } }))} fullWidth /></Grid>
                        <Grid item xs={4}><TextField label="SP" type="number" value={form.currency.sp} onChange={(e)=>setForm(f=>({ ...f, currency: { ...f.currency, sp: parseInt(e.target.value||'0',10) } }))} fullWidth /></Grid>
                        <Grid item xs={4}><TextField label="CP" type="number" value={form.currency.cp} onChange={(e)=>setForm(f=>({ ...f, currency: { ...f.currency, cp: parseInt(e.target.value||'0',10) } }))} fullWidth /></Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters elevation={0} sx={{ backgroundColor: 'transparent', border: '1px solid', borderColor: '#fff', borderRadius: 1, mt: 2, color: '#fff' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700 }}>Rest & Misc</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={1}>
                        <Grid item xs={6}><TextField label="Hit Dice" value={hitDice} onChange={(e)=>setHitDice(e.target.value)} fullWidth /></Grid>
                        <Grid item xs={6}><TextField label="Inspiration" value={inspiration} onChange={(e)=>setInspiration(e.target.value)} fullWidth /></Grid>
                        <Grid item xs={6}><TextField label="Death Saves (S)" type="number" value={deathSuccesses} onChange={(e)=>setDeathSuccesses(parseInt(e.target.value||'0',10))} fullWidth /></Grid>
                        <Grid item xs={6}><TextField label="Death Saves (F)" type="number" value={deathFailures} onChange={(e)=>setDeathFailures(parseInt(e.target.value||'0',10))} fullWidth /></Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Accordion disableGutters elevation={0} sx={{ backgroundColor: 'transparent', border: '1px solid', borderColor: '#fff', borderRadius: 1, color: '#fff' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700 }}>Features & Traits</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TextField label="Class Features" value={form.class_features} onChange={update('class_features')} fullWidth multiline minRows={6} />
                      <Box sx={{ height: 12 }} />
                      <TextField label="Racial Traits" value={form.racial_traits} onChange={update('racial_traits')} fullWidth multiline minRows={6} />
                      <Box sx={{ height: 12 }} />
                      <TextField label="Feats" value={form.feats} onChange={update('feats')} fullWidth multiline minRows={6} />
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Spells Tab */}
          {tab === 2 && (
            <Box sx={{ mt: 2 }}>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, backgroundColor: 'transparent', borderColor: '#fff', color: '#fff' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#d32f2f', fontWeight: 700 }}>Spell Slots</Typography>
                <Grid container spacing={1}>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((lvl) => {
                    const slots = form.spellcasting?.slots || {};
                    const total = Number(slots?.[lvl]?.total || 0);
                    const used = Math.min(Number(slots?.[lvl]?.used || 0), total);
                    return (
                      <Grid key={lvl} item xs={12} md={6} lg={4}>
                        <Paper variant="outlined" sx={{ p: 1, backgroundColor: 'transparent', borderColor: '#fff', color: '#fff' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography>Level {lvl}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                label="Total"
                                size="small"
                                type="number"
                                value={total}
                                onChange={(e)=>{
                                  const t = Math.max(0, parseInt(e.target.value||'0',10));
                                  setForm(f=>({
                                    ...f,
                                    spellcasting: {
                                      ...(f.spellcasting||{}),
                                      slots: { ...(f.spellcasting?.slots||{}), [lvl]: { total: t, used: Math.min(used, t) } }
                                    }
                                  }));
                                }}
                                sx={{ width: 88 }}
                              />
                              <TextField
                                label="Used"
                                size="small"
                                type="number"
                                value={used}
                                onChange={(e)=>{
                                  const u = Math.max(0, parseInt(e.target.value||'0',10));
                                  setForm(f=>({
                                    ...f,
                                    spellcasting: {
                                      ...(f.spellcasting||{}),
                                      slots: { ...(f.spellcasting?.slots||{}), [lvl]: { total, used: Math.min(u, total) } }
                                    }
                                  }));
                                }}
                                sx={{ width: 88 }}
                              />
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Array.from({ length: total }).map((_, idx) => (
                              <Chip
                                key={idx}
                                size="small"
                                label={idx < used ? '●' : '○'}
                                color={idx < used ? 'primary' : 'default'}
                                variant={idx < used ? 'filled' : 'outlined'}
                                onClick={()=>{
                                  const nextUsed = idx < used ? idx : idx + 1;
                                  setForm(f=>({
                                    ...f,
                                    spellcasting: {
                                      ...(f.spellcasting||{}),
                                      slots: { ...(f.spellcasting?.slots||{}), [lvl]: { total, used: Math.min(Math.max(nextUsed, 0), total) } }
                                    }
                                  }));
                                }}
                              />
                            ))}
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Paper>

              <SpellsEditor spells={form.spells} onChange={(spells)=>setForm(f=>({ ...f, spells }))} />
            </Box>
          )}
        </Box>
      </div>
    </Box>
  );
}
