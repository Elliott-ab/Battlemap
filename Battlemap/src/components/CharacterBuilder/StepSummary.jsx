import React, { useMemo, useState } from 'react';
import { Box, Button, Grid, Typography, Chip, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { upsertCharacter } from '../../Utils/characterService.js';
import { computeDerived } from './api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons';

export default function StepSummary({ character, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const derived = useMemo(() => computeDerived(character), [character]);
  const [descOpen, setDescOpen] = useState(false);
  const [descContent, setDescContent] = useState({ title: '', body: '' });
  const parseBlocks = (text) => {
    const t = String(text || '').trim();
    if (!t) return [];
    const parts = t.includes('•') ? t.replace(/^\s*•\s+/,'').split(/\n\s*•\s+/) : [t];
    return parts.map((block) => {
      const [firstLine, ...rest] = String(block).split('\n');
      const title = (firstLine || '').trim();
      const body = rest.join('\n').trim();
      return { name: title || 'Feature', desc: body };
    }).filter(Boolean);
  };

  const abilityKeys = ['str','dex','con','int','wis','cha'];

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      // Build saving throw proficiencies map from class selections
      const stNames = (character.saving_throw_proficiencies || []).map((s) => String(s).toUpperCase());
      const savingThrows = {
        str: stNames.includes('STR'),
        dex: stNames.includes('DEX'),
        con: stNames.includes('CON'),
        int: stNames.includes('INT'),
        wis: stNames.includes('WIS'),
        cha: stNames.includes('CHA'),
      };
      // Build skills map from chosen skill indexes like 'skill-animal-handling'
      const skills = {};
      (character.skill_proficiencies || []).forEach((idx) => {
        const key = String(idx).replace(/^skill-/, '').replace(/-/g, '_');
        if (key) skills[key] = { prof: true };
      });
      // Build spells payload from selections
      const spellsPayload = {};
      if (character.selected_cantrips?.length) {
        spellsPayload['0'] = character.selected_cantrips.map(name => ({ name, prepared: true }));
      }
      if (character.selected_level1_spells?.length) {
        spellsPayload['1'] = character.selected_level1_spells.map(name => ({ name, prepared: true }));
      }

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
        saving_throws: savingThrows,
        skills,
        equipment: (character.starting_equipment || []).join(', '),
        class_features: character.class_features || '',
        racial_traits: character.racial_traits || '',
        spellcasting: character.spellcasting || {},
        spells: spellsPayload,
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
      {/* Spells under equipment */}
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

      {/* Features & Traits preview now last */}
      {(character.aggregated_class_features?.length || character.aggregated_subclass_features?.length || character.aggregated_traits?.length || character.class_features || character.racial_traits) && (
        <>
          <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.15)' }} />
          <Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Features & Traits</Typography>
          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', md:'1fr 1fr' }, gap:2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color:'#d32f2f', fontWeight:700, mb:1 }}>Class Features</Typography>
              {(() => {
                const list = [
                  ...(character.aggregated_class_features || []),
                  ...(character.aggregated_subclass_features || []),
                ];
                if (list.length > 0) {
                  return (
                    <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {list.map(f => (
                        <Box key={`${f.index}-${f.level || 0}`} sx={{ display:'flex', alignItems:'center', gap:0.5, flexWrap:'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight:700 }}>
                            {f.level ? `[Lv ${f.level}] ` : ''}{f.name}
                          </Typography>
                          <IconButton size="small" onClick={() => { setDescContent({ title: f.name, body: f.desc || '' }); setDescOpen(true); }} title="Show description" aria-label={`Show description for ${f.name}`} sx={{ p:0.25 }}>
                            <FontAwesomeIcon icon={faCircleQuestion} style={{ color:'#d32f2f', opacity:0.7 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                // Fallback: parse plain text into clickable items
                const parsed = parseBlocks(character.class_features);
                if (parsed.length > 0) {
                  return (
                    <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {parsed.map((f, idx) => (
                        <Box key={`cf-fallback-${idx}`} sx={{ display:'flex', alignItems:'center', gap:0.5, flexWrap:'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight:700 }}>{f.name}</Typography>
                          <IconButton size="small" onClick={() => { setDescContent({ title: f.name, body: f.desc || '' }); setDescOpen(true); }} title={`Show description for ${f.name}`} aria-label={`Show description for ${f.name}`} sx={{ p:0.25 }}>
                            <FontAwesomeIcon icon={faCircleQuestion} style={{ color:'#d32f2f', opacity:0.7 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                return <Typography variant="body2" sx={{ opacity:0.7 }}>None</Typography>;
              })()}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color:'#d32f2f', fontWeight:700, mb:1 }}>Racial Traits</Typography>
              {(() => {
                const list = character.aggregated_traits || [];
                if (list.length > 0) {
                  return (
                    <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {list.map(t => (
                        <Box key={t.index} sx={{ display:'flex', alignItems:'center', gap:0.5, flexWrap:'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight:700 }}>{t.name}</Typography>
                          <IconButton size="small" onClick={() => { setDescContent({ title: t.name, body: t.desc || '' }); setDescOpen(true); }} title={`Show description for ${t.name}`} aria-label={`Show description for ${t.name}`} sx={{ p:0.25 }}>
                            <FontAwesomeIcon icon={faCircleQuestion} style={{ color:'#d32f2f', opacity:0.7 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                const parsed = parseBlocks(character.racial_traits);
                if (parsed.length > 0) {
                  return (
                    <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {parsed.map((t, idx) => (
                        <Box key={`rt-fallback-${idx}`} sx={{ display:'flex', alignItems:'center', gap:0.5, flexWrap:'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight:700 }}>{t.name}</Typography>
                          <IconButton size="small" onClick={() => { setDescContent({ title: t.name, body: t.desc || '' }); setDescOpen(true); }} title={`Show description for ${t.name}`} aria-label={`Show description for ${t.name}`} sx={{ p:0.25 }}>
                            <FontAwesomeIcon icon={faCircleQuestion} style={{ color:'#d32f2f', opacity:0.7 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                return <Typography variant="body2" sx={{ opacity:0.7 }}>None</Typography>;
              })()}
            </Box>
          </Box>
          <Dialog open={descOpen} onClose={() => setDescOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>{descContent.title}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ whiteSpace:'pre-wrap' }}>
                {descContent.body || 'No description provided.'}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDescOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      {/* Spells block moved above; nothing to render here */}
      <Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving? 'Saving…':'Save Character'}</Button>
      </Box>
    </Box>
  );
}