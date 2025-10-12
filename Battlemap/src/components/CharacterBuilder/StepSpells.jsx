import React, { useEffect, useState } from 'react';
import { fetchApi } from './api.js';
import { Box, Button, Checkbox, FormControlLabel, Grid, Typography } from '@mui/material';

export default function StepSpells({ character, setCharacter, onNext, onBack }) {
	const selectedClass = character.class?.index;
	const [list, setList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selected, setSelected] = useState(character.spells_known || []);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		(async () => {
			if (!selectedClass) { if (mounted) setList([]); return; }
			try {
				const data = await fetchApi(`/api/classes/${selectedClass}/spells`);
				if (mounted) setList(data.results || []);
			} catch (_) {
				setError('Failed to fetch spells; showing small dummy list.');
				if (mounted) setList([
					{ index: 'magic-missile', name: 'Magic Missile' },
					{ index: 'cure-wounds', name: 'Cure Wounds' },
					{ index: 'shield', name: 'Shield' },
				]);
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, [selectedClass]);

	const toggle = (idx) => setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Select Spells</Typography>
			{!selectedClass ? (
				<Typography>Select a class first.</Typography>
			) : loading ? <Typography>Loading…</Typography> : (
				<>
					{error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
					<Grid container spacing={1}>
						{list.slice(0, 40).map((spell) => (
							<Grid key={spell.index} item xs={12} sm={6} md={4}>
								<FormControlLabel
									control={<Checkbox checked={selected.includes(spell.index)} onChange={() => toggle(spell.index)} />}
									label={spell.name}
								/>
							</Grid>
						))}
					</Grid>
					<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
						<Button onClick={onBack}>Back</Button>
						<Button
							variant="contained"
							onClick={() => {
								const details = list.filter((s) => selected.includes(s.index));
								setCharacter({ ...character, spells_known: selected, spells_detail: details });
								onNext();
							}}
						>Next</Button>
					</Box>
				</>
			)}
		</Box>
	);
}
