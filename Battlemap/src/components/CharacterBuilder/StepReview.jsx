import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Divider, Grid, Typography } from '@mui/material';
import { upsertCharacter } from '../../Utils/characterService.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function StepReview({ character, onBack }) {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const handleSave = async () => {
		try {
			setSaving(true);
			setError('');
			const payload = {
				user_id: user.id,
				name: character.name || 'New Character',
				race: character.race?.name || character.race?.index || '',
				class: character.class?.name || character.class?.index || '',
				background: character.background?.name || character.background?.index || '',
				level: Number(character.level || 1),
				alignment: character.alignment || '',
				xp: Number(character.xp || 0),
				str: Number(character.str || 10),
				dex: Number(character.dex || 10),
				con: Number(character.con || 10),
				int: Number(character.int || 10),
				wis: Number(character.wis || 10),
				cha: Number(character.cha || 10),
				ac: Number(character.ac || 10),
				speed: Number(character.speed || 30),
				max_hp: Number(character.max_hp || 10),
				current_hp: Number(character.current_hp || character.max_hp || 10),
				hp_temp: Number(character.hp_temp || 0),
				saving_throws: character.saving_throws || {},
				skills: character.skills || {},
				attacks: character.attacks || [],
				spellcasting: character.spellcasting || { ability: 'int', slots: {} },
				spells: {},
				currency: character.currency || { gp: 0, sp: 0, cp: 0 },
				equipment: (character.equipment_detail || character.equipment_items || []).map((e) => e.name || e).join(', '),
				class_features: character.class_features || '',
				racial_traits: character.racial_traits || '',
				feats: (character.proficiencies_detail || character.proficiencies || []).map((p) => p.name || p).join(', '),
				icon_url: '',
			};
			if (Array.isArray(character.spells_detail)) {
				const names = character.spells_detail.map((s) => s.name).join(', ');
				payload.class_features = [payload.class_features, names ? `Known Spells: ${names}` : ''].filter(Boolean).join('\n');
			}
			const saved = await upsertCharacter(payload);
			navigate(`/characters/${saved.id}`);
		} catch (e) {
			setError(e.message || String(e));
		} finally {
			setSaving(false);
		}
	};

	const profNames = (character.proficiencies_detail || character.proficiencies || []).map((p) => p.name || p);
	const equipNames = (character.equipment_detail || character.equipment_items || []).map((e) => e.name || e);
	const spellNames = (character.spells_detail || character.spells_known || []).map((s) => s.name || s);

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 2 }}>Review</Typography>
			{error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

			<Grid container spacing={2}>
				<Grid item xs={12} md={6}>
					<Typography variant="body2" sx={{ opacity: 0.8 }}>Name</Typography>
					<Typography variant="h6" sx={{ mb: 1 }}>{character.name || '—'}</Typography>
				</Grid>
				<Grid item xs={6} md={2}>
					<Typography variant="body2" sx={{ opacity: 0.8 }}>Race</Typography>
					<Typography variant="subtitle1">{character.race?.name || character.race?.index || '—'}</Typography>
				</Grid>
				<Grid item xs={6} md={2}>
					<Typography variant="body2" sx={{ opacity: 0.8 }}>Class</Typography>
					<Typography variant="subtitle1">{character.class?.name || character.class?.index || '—'}</Typography>
				</Grid>
				<Grid item xs={12} md={2}>
					<Typography variant="body2" sx={{ opacity: 0.8 }}>Background</Typography>
					<Typography variant="subtitle1">{character.background?.name || character.background?.index || '—'}</Typography>
				</Grid>
			</Grid>

			<Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.15)' }} />

			<Grid container spacing={2}>
				{['str','dex','con','int','wis','cha'].map((k) => (
					<Grid key={k} item xs={4} md={2}>
						<Typography variant="body2" sx={{ opacity: 0.8 }}>{k.toUpperCase()}</Typography>
						<Typography variant="h6">{character[k] ?? 10}</Typography>
					</Grid>
				))}
			</Grid>

			<Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.15)' }} />

			<Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>Proficiencies</Typography>
			<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
				{profNames.length ? profNames.map((n, i) => (
					<Chip key={i} label={n} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
				)) : <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>}
			</Box>

			<Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>Equipment</Typography>
			<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
				{equipNames.length ? equipNames.map((n, i) => (
					<Chip key={i} label={n} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
				)) : <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>}
			</Box>

			<Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>Spells</Typography>
			<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
				{spellNames.length ? spellNames.map((n, i) => (
					<Chip key={i} label={n} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
				)) : <Typography variant="body2" sx={{ opacity: 0.7 }}>—</Typography>}
			</Box>

			<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
				<Button onClick={onBack}>Back</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save & Open Sheet'}</Button>
			</Box>
		</Box>
	);
}
