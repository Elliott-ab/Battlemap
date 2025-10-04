import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import Toolbar from '../components/Toolbar.jsx';
// Sidebar removed on Character Builder page
import { useAuth } from '../auth/AuthContext.jsx';
import { getCharacter, upsertCharacter, deleteCharacter, uploadCharacterIcon, deleteCharacterIcon, getSignedCharacterIconUrl } from '../Utils/characterService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCirclePlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';

// Constants and helpers
const ALIGNMENTS = ['LG','NG','CG','LN','N','CN','LE','NE','CE'];
const SKILLS = [
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
  ['Survival', 'survival', 'wis'],
];
const SPELL_ABILITIES = [
  { label: 'Intelligence (INT)', value: 'int' },
  { label: 'Wisdom (WIS)', value: 'wis' },
  { label: 'Charisma (CHA)', value: 'cha' },
];
const withSign = (n) => {
  const v = Number(n || 0);
  return v >= 0 ? `+${v}` : `${v}`;
};
const abilityMod = (score) => Math.floor(((Number(score || 10)) - 10) / 2);
const profFromLevel = (level) => {
  const lv = Number(level || 1);
  if (lv >= 17) return 6;
  if (lv >= 13) return 5;
  if (lv >= 9) return 4;
  if (lv >= 5) return 3;
  return 2;
};

function SectionCard({ title, action, children, sx }) {
  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        backgroundColor: '#2f2f2f',
        borderRadius: 1.5,
        color: '#fff',
        '& .MuiButton-root': { color: '#fff' },
        '& .MuiChip-root': { color: '#fff' },
        '& .MuiInputBase-input': { color: '#fff' },
        '& .MuiFormLabel-root': { color: 'rgba(255,255,255,0.8)' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#d32f2f' },
        ...sx,
      }}
    >
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          {title && (
            <Typography
              variant="subtitle1"
              style={{ color: '#d32f2f' }}
              sx={{ fontWeight: 800, letterSpacing: 0.3 }}
            >
              {title}
            </Typography>
          )}
          {action || null}
        </Box>
      )}
      {children}
    </Paper>
  );
}

function AbilityBlock({ label, value, onChange }) {
  const mod = abilityMod(value);
  const upper = String(label || '').toUpperCase();
  return (
    <Paper elevation={1} sx={{ p: 1.5, textAlign: 'center', backgroundColor: '#3a3a3a', borderRadius: 1.5 }}>
      <Chip size="small" label={withSign(mod)} sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }} />
      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1, mb: 1 }}>{Number(value || 0)}</Typography>
      <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, mb: 1 }}>{upper}</Typography>
      <TextField type="number" size="small" label="Score" value={value} onChange={(e)=>onChange?.(parseInt(e.target.value || '0', 10))} fullWidth />
    </Paper>
  );
}

function SpellsEditor({ spells = {}, onChange }) {
  const ensureLevel = (lvl) => {
    const key = String(lvl);
    const next = { ...(spells || {}) };
    next[key] = Array.isArray(next[key]) ? next[key] : [];
    return next;
  };
  const addSpell = (lvl) => {
    const key = String(lvl);
    const next = ensureLevel(lvl);
    next[key] = [...next[key], { name: '', prepared: false }];
    onChange?.(next);
  };
  const updateSpell = (lvl, idx, patch) => {
    const key = String(lvl);
    const next = ensureLevel(lvl);
    next[key] = next[key].map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange?.(next);
  };
  const removeSpell = (lvl, idx) => {
    const key = String(lvl);
    const next = ensureLevel(lvl);
    next[key] = next[key].filter((_, i) => i !== idx);
    onChange?.(next);
  };
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 10 }, (_, i) => i).map((lvl) => (
        <Grid key={lvl} item xs={12} md={6} lg={4}>
          <SectionCard title={`Level ${lvl} Spells`}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(spells?.[lvl] || []).map((s, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox size="small" checked={!!s.prepared} onChange={(e)=>updateSpell(lvl, idx, { prepared: e.target.checked })} />
                  <TextField size="small" label="Spell Name" value={s.name || ''} onChange={(e)=>updateSpell(lvl, idx, { name: e.target.value })} sx={{ flex: 1 }} />
                  <Button size="small" color="error" onClick={()=>removeSpell(lvl, idx)}>Remove</Button>
                </Box>
              ))}
              <Button variant="outlined" onClick={()=>addSpell(lvl)}>Add Spell</Button>
            </Box>
          </SectionCard>
        </Grid>
      ))}
    </Grid>
  );
}

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
    <Box sx={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1, p: 1 }}>
      {(attacks || []).length === 0 ? (
        <Typography color="text.secondary">No attacks yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(attacks || []).map((atk, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flex: 1 }}>{atk.name} • {withSign(atk.attack_bonus || 0)} • {atk.damage || ''}</Typography>
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

export default function CharacterBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const isNew = !id || id === 'new';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bottomTab, setBottomTab] = useState(0);

  const defaultForm = {
    id: undefined,
    user_id: user?.id,
    name: '',
    class: '',
    race: '',
    level: 1,
    background: '',
    alignment: '',
    xp: 0,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    ac: 10, speed: 30,
    max_hp: 10, current_hp: 10, hp_temp: 0,
    saving_throws: {},
    skills: {},
    attacks: [],
    spellcasting: { ability: 'int', slots: {} },
    spells: {},
    currency: { gp: 0, sp: 0, cp: 0 },
    equipment: '',
    class_features: '',
    racial_traits: '',
    feats: '',
    inspiration: 0,
    hit_dice: '1d8',
    icon_url: '',
  };

  const [form, setForm] = useState(defaultForm);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef(null);
  const [hitDice, setHitDice] = useState(defaultForm.hit_dice);
  const [deathSuccesses, setDeathSuccesses] = useState(0);
  const [deathFailures, setDeathFailures] = useState(0);
  const [iconLoadError, setIconLoadError] = useState(false);
  const [resolvedIconUrl, setResolvedIconUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isNew) {
        setLoading(true);
        setError('');
        try {
          const row = await getCharacter(id);
          if (!mounted) return;
          const merged = {
            ...defaultForm,
            ...row,
            saving_throws: row?.saving_throws || {},
            skills: row?.skills || {},
            attacks: row?.attacks || [],
            spellcasting: row?.spellcasting || { ability: 'int', slots: {} },
            spells: row?.spells || {},
            currency: row?.currency || { gp: 0, sp: 0, cp: 0 },
          };
          setForm(merged);
          setHitDice(row?.hit_dice || defaultForm.hit_dice);
        } catch (e) {
          if (mounted) setError(e.message || String(e));
        } finally {
          if (mounted) setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  // Resolve a signed URL for private buckets when icon_url changes
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIconLoadError(false);
        if (!form.icon_url) {
          if (active) setResolvedIconUrl('');
          return;
        }
        // Try to produce a signed URL (works for both public and private buckets)
        const signed = await getSignedCharacterIconUrl(form.icon_url);
        if (active) setResolvedIconUrl(signed || form.icon_url);
      } catch (_) {
        if (active) setResolvedIconUrl(form.icon_url);
      }
    })();
    return () => { active = false; };
  }, [form.icon_url]);

  const mod = (k) => abilityMod(form[k]);
  const profBonus = useMemo(() => profFromLevel(form.level), [form.level]);
  const initiative = mod('dex');
  const passivePerception = 10 + mod('wis') + (form.skills?.perception?.prof ? profBonus : 0);
  const skillBonus = (abilityKey, proficient) => mod(abilityKey) + (proficient ? profBonus : 0);
  const spellAbility = form.spellcasting?.ability || 'int';
  const spellSaveDC = 8 + profBonus + mod(spellAbility);
  const spellAttackMod = profBonus + mod(spellAbility);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = { ...form, user_id: user.id, hit_dice: hitDice };
      const saved = await upsertCharacter(payload);
      setForm((f) => ({ ...f, id: saved.id }));
      if (isNew) navigate(`/characters/${saved.id}`);
      // If this builder was opened from a battlemap double-click, return back after save
      try {
        const returnPath = sessionStorage.getItem('bm-return-path');
        const refreshId = sessionStorage.getItem('bm-refresh-character-id');
        const shouldReturn = !!returnPath && !!refreshId && String(saved.id || form.id) === String(refreshId);
        if (shouldReturn) {
          // Clear flags before navigating back
          sessionStorage.removeItem('bm-return-path');
          // Keep bm-refresh-character-id until App reads it (so it can update the token), it'll clear it there
          navigate(returnPath);
          return;
        }
      } catch (_) {}
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Resize/crop the uploaded image to a centered square (cover) before uploading
  const onIconSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingIcon(true);
      const objectUrl = URL.createObjectURL(file);
      const processed = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            // First draw the original to a temp canvas to detect and trim uniform margins
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.naturalWidth || img.width;
            srcCanvas.height = img.naturalHeight || img.height;
            const sctx = srcCanvas.getContext('2d');
            sctx.drawImage(img, 0, 0);
            const w = srcCanvas.width;
            const h = srcCanvas.height;
            let imgData;
            try { imgData = sctx.getImageData(0, 0, w, h); } catch (_) { imgData = null; }

            let left = 0, right = w - 1, top = 0, bottom = h - 1;
            if (imgData) {
              const data = imgData.data;
              // Use corner average as background color reference
              const samplePts = [0, 0, w - 1, 0, 0, h - 1, w - 1, h - 1];
              let br = 0, bg = 0, bb = 0, ba = 0, cnt = 0;
              for (let i = 0; i < samplePts.length; i += 2) {
                const x = samplePts[i], y = samplePts[i + 1];
                const idx = (y * w + x) * 4;
                br += data[idx]; bg += data[idx + 1]; bb += data[idx + 2]; ba += data[idx + 3]; cnt++;
              }
              br = br / cnt; bg = bg / cnt; bb = bb / cnt; ba = ba / cnt;
              const diff = (r, g, b, a) => Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) + Math.abs(a - ba);
              const isBg = (x, y) => {
                const idx = (y * w + x) * 4;
                const a = data[idx + 3];
                if (a < 8) return true; // near-transparent
                return diff(data[idx], data[idx + 1], data[idx + 2], a) < 40; // close to corner color
              };
              // Scan from each side until content encountered
              // Left
              while (left < right) {
                let allBg = true;
                for (let y = 0; y < h; y += 2) { if (!isBg(left, y)) { allBg = false; break; } }
                if (!allBg) break; left++;
              }
              // Right
              while (right > left) {
                let allBg = true;
                for (let y = 0; y < h; y += 2) { if (!isBg(right, y)) { allBg = false; break; } }
                if (!allBg) break; right--;
              }
              // Top
              while (top < bottom) {
                let allBg = true;
                for (let x = left; x <= right; x += 2) { if (!isBg(x, top)) { allBg = false; break; } }
                if (!allBg) break; top++;
              }
              // Bottom
              while (bottom > top) {
                let allBg = true;
                for (let x = left; x <= right; x += 2) { if (!isBg(x, bottom)) { allBg = false; break; } }
                if (!allBg) break; bottom--;
              }
              // Safety: if trimming is tiny or invalid, fallback to full image
              const trimmedW = right - left + 1;
              const trimmedH = bottom - top + 1;
              if (trimmedW < w * 0.95 || trimmedH < h * 0.95) {
                // Use trimmed region
              } else {
                left = 0; right = w - 1; top = 0; bottom = h - 1;
              }
            }

            // Compute a centered square from the (possibly trimmed) rectangle
            const rectW = right - left + 1;
            const rectH = bottom - top + 1;
            const side = Math.min(rectW, rectH);
            const sx = Math.max(left + Math.floor((rectW - side) / 2), 0);
            const sy = Math.max(top + Math.floor((rectH - side) / 2), 0);

            // Render to the final square canvas
            const canvas = document.createElement('canvas');
            const outSize = 256;
            canvas.width = outSize;
            canvas.height = outSize;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, side, side, 0, 0, outSize, outSize);
            canvas.toBlob((blob) => {
              if (!blob) return reject(new Error('Failed to process image'));
              // Always use PNG for consistency
              const processedFile = new File([blob], 'avatar.png', { type: 'image/png' });
              resolve(processedFile);
            }, 'image/png', 0.92);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);

      const url = await uploadCharacterIcon(user.id, processed);
      setIconLoadError(false);
      setForm((f) => ({ ...f, icon_url: url }));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    const ok = window.confirm('Delete this character?');
    if (!ok) return;
    try {
      setLoading(true);
      await deleteCharacter(form.id || id);
      navigate('/characters');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="app-container sheet" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar variant="dashboard" />
      <div className="main-content">
        <Box sx={{ flex: 1, p: 2, overflow: 'auto', color: '#fff' }}>
          {/* Top: Character Info */}
          <SectionCard
            title="Character Info"
            action={(
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isNew && <Button color="error" variant="outlined" onClick={handleDelete}>Delete</Button>}
                <Button variant="contained" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
              </Box>
            )}
          >
            {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
            <Grid container spacing={2}>
              {/* Left: Icon + below badges */}
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                  {/* Row: Icon (left) + vertical badges (right) */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.25)',
                        bgcolor: '#3a3a3a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        cursor: uploadingIcon ? 'progress' : 'pointer',
                      }}
                      onClick={() => { if (!uploadingIcon) iconInputRef.current?.click(); }}
                      title={form.icon_url ? 'Change icon' : 'Add icon'}
                    >
                      {resolvedIconUrl && !iconLoadError ? (
                        <>
                          <img
                            src={resolvedIconUrl}
                            alt=""
                            onError={() => setIconLoadError(true)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                          />
                          {/* Delete bin icon fixed at bottom center of the circle */}
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const currentUrl = form.icon_url;
                              setForm(f => ({ ...f, icon_url: '' }));
                              try { await deleteCharacterIcon(currentUrl); } catch (_) {/* ignore */}
                            }}
                            title="Remove icon"
                            style={{
                              position: 'absolute',
                              left: '50%',
                              bottom: 6,
                              transform: 'translateX(-50%)',
                              width: 24,
                              height: 24,
                              border: 'none',
                              background: 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#d32f2f',
                              cursor: 'pointer',
                            }}
                          >
                            <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: 16 }} />
                          </button>
                        </>
                      ) : (
                        // Fallback UI: plus icon if no image; if error, show a simple placeholder
                        iconLoadError ? (
                          <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            {String(form.name || '?').slice(0,1).toUpperCase()}
                          </span>
                        ) : (
                          <FontAwesomeIcon icon={faCirclePlus} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 36 }} />
                        )
                      )}
                      <input ref={iconInputRef} type="file" accept="image/*" hidden onChange={onIconSelected} />
                    </Box>
                    <Stack direction="column" spacing={1} sx={{ minWidth: 0 }}>
                      <Chip label={`PROF ${withSign(profBonus)}`} sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }} />
                      <Button variant="contained" color="error" sx={{ fontWeight: 800, alignSelf: 'flex-start' }}>
                        Initiative {withSign(initiative)}
                      </Button>
                      <Chip label={`Inspiration ${form.inspiration || 0}`} sx={{ fontWeight: 700, bgcolor: 'rgba(255,215,0,0.2)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.5)' }} />
                    </Stack>
                  </Box>
                  {/* Optional: could render uploading state below if desired */}
                </Box>
              </Grid>

              {/* Right: Character fields */}
              <Grid item xs={12} md={9}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField variant="outlined" size="small" label="Character Name" value={form.name} onChange={update('name')} fullWidth />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField variant="outlined" size="small" label="Class" value={form.class} onChange={update('class')} fullWidth />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField variant="outlined" size="small" label="Level" type="number" value={form.level} onChange={(e)=>update('level')({ target: { value: parseInt(e.target.value||'1', 10) } })} fullWidth />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField variant="outlined" size="small" label="Race" value={form.race} onChange={update('race')} fullWidth />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField variant="outlined" size="small" label="Background" value={form.background} onChange={update('background')} fullWidth />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      label="Alignment"
                      size="small"
                      variant="outlined"
                      value={form.alignment}
                      onChange={update('alignment')}
                      fullWidth
                    >
                      {ALIGNMENTS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField label="XP" type="number" size="small" variant="outlined" value={form.xp} onChange={(e)=>update('xp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField label="Hit Dice" size="small" variant="outlined" value={hitDice} onChange={(e)=>setHitDice(e.target.value)} fullWidth />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </SectionCard>

          {/* Middle: Abilities (center) + Vitals (side) */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={8}>
              <SectionCard title="Abilities">
                <Grid container spacing={2}>
                  {(['str','dex','con','int','wis','cha']).map((stat) => (
                    <Grid item xs={12} sm={6} md={4} key={stat}>
                      <AbilityBlock label={stat} value={form[stat]} onChange={(val)=>setForm(f=>({ ...f, [stat]: val }))} />
                    </Grid>
                  ))}
                </Grid>
              </SectionCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <SectionCard title="Vitals">
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <TextField label="Max" type="number" size="small" value={form.max_hp} onChange={(e)=>update('max_hp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth color="error" variant="outlined" sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(244,67,54,0.6)' } }} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Current" type="number" size="small" value={form.current_hp} onChange={(e)=>update('current_hp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth color="error" variant="outlined" sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(244,67,54,0.6)' } }} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Temp" type="number" size="small" value={form.hp_temp} onChange={(e)=>update('hp_temp')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth color="error" variant="outlined" sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(244,67,54,0.6)' } }} />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField label="AC" type="number" size="small" value={form.ac} onChange={(e)=>update('ac')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Speed" type="number" size="small" value={form.speed} onChange={(e)=>update('speed')({ target: { value: parseInt(e.target.value||'0',10) }})} fullWidth />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Passive Perception" size="small" value={passivePerception} InputProps={{ readOnly: true }} fullWidth />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Typography variant="caption" sx={{ opacity: 0.9, color: '#d32f2f', fontWeight: 700 }}>Death Saves</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                  <Stack>
                    <Typography variant="caption" sx={{ opacity: 0.9, color: '#d32f2f' }}>Success</Typography>
                    <Stack direction="row">
                      {[0,1,2].map(i => (
                        <Checkbox key={i} size="small" checked={deathSuccesses > i} onChange={()=> setDeathSuccesses(deathSuccesses > i ? i : i+1)} />
                      ))}
                    </Stack>
                  </Stack>
                  <Stack>
                    <Typography variant="caption" sx={{ opacity: 0.9, color: '#d32f2f' }}>Failure</Typography>
                    <Stack direction="row">
                      {[0,1,2].map(i => (
                        <Checkbox key={i} size="small" checked={deathFailures > i} onChange={()=> setDeathFailures(deathFailures > i ? i : i+1)} />
                      ))}
                    </Stack>
                  </Stack>
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>

          {/* Saving Throws & Skills */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
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
                      <Typography sx={{ opacity: 0.9 }}>{label}</Typography>
                      <Typography sx={{ textAlign: 'right' }}>{withSign(skillBonus(key, !!form.skills?.[sk]?.prof))}</Typography>
                    </React.Fragment>
                  ))}
                </Box>
              </SectionCard>
            </Grid>
          </Grid>

          {/* Bottom Tabs: Combat, Spells, Features, Inventory, Notes */}
          <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.15)', mt: 2 }}>
            <Tabs value={bottomTab} onChange={(_, v) => setBottomTab(v)} TabIndicatorProps={{ style: { backgroundColor: '#d32f2f' } }} sx={{ '& .MuiTab-root': { color: '#fff', textTransform: 'none' }, '& .MuiTab-root.Mui-selected': { color: '#d32f2f' } }}>
              <Tab label="Combat" />
              <Tab label="Spells" />
              <Tab label="Features" />
              <Tab label="Inventory" />
              <Tab label="Notes" />
            </Tabs>
          </Box>

          {bottomTab === 0 && (
            <Box sx={{ mt: 2 }}>
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
            </Box>
          )}

          {bottomTab === 1 && (
            <Box sx={{ mt: 2 }}>
              <SectionCard title="Spell Slots">
                <Grid container spacing={1}>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((lvl) => {
                    const slots = form.spellcasting?.slots || {};
                    const total = Number(slots?.[lvl]?.total || 0);
                    const used = Math.min(Number(slots?.[lvl]?.used || 0), total);
                    return (
                      <Grid key={lvl} item xs={12} md={6} lg={4}>
                        <Paper elevation={1} sx={{ p: 1, backgroundColor: '#333', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography sx={{ color: '#d32f2f', fontWeight: 700 }}>Level {lvl}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField label="Total" size="small" type="number" value={total} onChange={(e)=>{
                                const t = Math.max(0, parseInt(e.target.value||'0',10));
                                setForm(f => ({
                                  ...f,
                                  spellcasting: {
                                    ...(f.spellcasting||{}),
                                    slots: { ...(f.spellcasting?.slots||{}), [lvl]: { total: t, used: Math.min(used, t) } }
                                  }
                                }));
                              }} sx={{ width: 88 }} />
                              <TextField label="Used" size="small" type="number" value={used} onChange={(e)=>{
                                const u = Math.max(0, parseInt(e.target.value||'0',10));
                                setForm(f => ({
                                  ...f,
                                  spellcasting: {
                                    ...(f.spellcasting||{}),
                                    slots: { ...(f.spellcasting?.slots||{}), [lvl]: { total, used: Math.min(u, total) } }
                                  }
                                }));
                              }} sx={{ width: 88 }} />
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
                                  setForm(f => ({
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
              </SectionCard>
              <Box sx={{ mt: 2 }}>
                <SpellsEditor spells={form.spells} onChange={(spells)=>setForm(f=>({ ...f, spells }))} />
              </Box>
            </Box>
          )}

          {bottomTab === 2 && (
            <Box sx={{ mt: 2 }}>
              <SectionCard title="Features & Traits">
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField label="Class Features" value={form.class_features} onChange={update('class_features')} fullWidth multiline minRows={6} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Racial Traits" value={form.racial_traits} onChange={update('racial_traits')} fullWidth multiline minRows={6} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Feats" value={form.feats} onChange={update('feats')} fullWidth multiline minRows={6} />
                  </Grid>
                </Grid>
              </SectionCard>
            </Box>
          )}

          {bottomTab === 3 && (
            <Box sx={{ mt: 2 }}>
              <SectionCard title="Inventory">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <TextField label="Equipment" value={form.equipment} onChange={update('equipment')} fullWidth multiline minRows={8} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <SectionCard title="Currency" sx={{ p: 1.5 }}>
                       <Grid container spacing={1}>
                         <Grid item xs={4}><TextField label="GP" type="number" size="small" value={form.currency.gp} onChange={(e)=>setForm(f=>({ ...f, currency: { ...f.currency, gp: parseInt(e.target.value||'0',10) } }))} fullWidth /></Grid>
                         <Grid item xs={4}><TextField label="SP" type="number" size="small" value={form.currency.sp} onChange={(e)=>setForm(f=>({ ...f, currency: { ...f.currency, sp: parseInt(e.target.value||'0',10) } }))} fullWidth /></Grid>
                         <Grid item xs={4}><TextField label="CP" type="number" size="small" value={form.currency.cp} onChange={(e)=>setForm(f=>({ ...f, currency: { ...f.currency, cp: parseInt(e.target.value||'0',10) } }))} fullWidth /></Grid>
                       </Grid>
                     </SectionCard>
                  </Grid>
                </Grid>
              </SectionCard>
            </Box>
          )}

          {bottomTab === 4 && (
            <Box sx={{ mt: 2 }}>
              <SectionCard title="Notes">
                <TextField label="Notes" placeholder="Session notes, reminders, etc." multiline minRows={10} fullWidth />
              </SectionCard>
            </Box>
          )}
        </Box>
      </div>
    </Box>
  );
}

