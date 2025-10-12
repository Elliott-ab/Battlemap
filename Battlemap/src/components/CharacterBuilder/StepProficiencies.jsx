import React, { useEffect, useState } from 'react';
import { fetchList } from './api.js';
import { Box, Button, Checkbox, FormControlLabel, Grid, Typography } from '@mui/material';

export default function StepProficiencies({ character, setCharacter, onNext, onBack }) {
	const [list, setList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selected, setSelected] = useState(character.proficiencies || []);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		(async () => {
			try {
				const results = await fetchList('/api/proficiencies', [
					{ index: 'skill-athletics', name: 'Skill: Athletics' },
					{ index: 'skill-perception', name: 'Skill: Perception' },
					{ index: 'armor-light', name: 'Armor: Light' },
				]);
				if (mounted) setList(results);
			} catch (_) {
				setError('Failed to fetch proficiencies. Showing dummy data.');
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	const toggle = (idx) => {
		setSelected((prev) => (
			prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
		));
	};

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Select Proficiencies</Typography>
			{loading ? <Typography>Loading…</Typography> : (
				<>
					{error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
					<Grid container spacing={1}>
						{list.map((item) => (
							<Grid key={item.index} item xs={12} sm={6} md={4}>
								<FormControlLabel
									control={<Checkbox checked={selected.includes(item.index)} onChange={() => toggle(item.index)} />}
									label={item.name}
								/>
							</Grid>
						))}
					</Grid>
					<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
						<Button onClick={onBack}>Back</Button>
						<Button
							variant="contained"
							onClick={() => {
								const details = list.filter((i) => selected.includes(i.index));
								setCharacter({ ...character, proficiencies: selected, proficiencies_detail: details });
								onNext();
							}}
						>Next</Button>
					</Box>
				</>
			)}
		</Box>
	);
}
