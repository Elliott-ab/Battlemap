import React, { useEffect, useState } from 'react';
import { fetchList } from './api.js';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';

export default function StepRaceSelect({ character, setCharacter, onNext, onBack }) {
	const [races, setRaces] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selectedRace, setSelectedRace] = useState(character.race?.index || '');

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		(async () => {
			try {
				const list = await fetchList('/api/races', [
					{ index: 'human', name: 'Human' },
					{ index: 'elf', name: 'Elf' },
					{ index: 'dwarf', name: 'Dwarf' },
				]);
				if (mounted) setRaces(list);
			} catch (_) {
				setError('Failed to fetch races. Showing dummy data.');
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Select Race</Typography>
			{loading ? <Typography>Loading…</Typography> : (
				<>
					{error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
					<FormControl fullWidth sx={{ mb: 2 }}>
						<InputLabel id="race-label">Race</InputLabel>
						<Select labelId="race-label" label="Race" value={selectedRace} onChange={(e) => setSelectedRace(e.target.value)}>
							<MenuItem value=""><em>Choose a race…</em></MenuItem>
							{races.map(r => (<MenuItem key={r.index} value={r.index}>{r.name}</MenuItem>))}
						</Select>
					</FormControl>
					<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
						<Button onClick={onBack}>Back</Button>
						<Button
							variant="contained"
							disabled={!selectedRace}
							onClick={() => {
								const obj = races.find(r => r.index === selectedRace);
								setCharacter({ ...character, race: obj || { index: selectedRace, name: selectedRace } });
								onNext();
							}}
						>Next</Button>
					</Box>
				</>
			)}
		</Box>
	);
}
