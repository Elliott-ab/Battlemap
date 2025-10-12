import React, { useEffect, useState } from 'react';
import { fetchList } from './api.js';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';

export default function StepBackgroundSelect({ character, setCharacter, onNext, onBack }) {
	const [backgrounds, setBackgrounds] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selected, setSelected] = useState(character.background?.index || '');

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		(async () => {
			try {
				const list = await fetchList('/api/backgrounds', [
					{ index: 'acolyte', name: 'Acolyte' },
					{ index: 'criminal', name: 'Criminal' },
					{ index: 'soldier', name: 'Soldier' },
				]);
				if (mounted) setBackgrounds(list);
			} catch (_) {
				setError('Failed to fetch backgrounds. Showing dummy data.');
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Select Background</Typography>
			{loading ? <Typography>Loading…</Typography> : (
				<>
					{error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
					<FormControl fullWidth sx={{ mb: 2 }}>
						<InputLabel id="background-label">Background</InputLabel>
						<Select labelId="background-label" label="Background" value={selected} onChange={(e) => setSelected(e.target.value)}>
							<MenuItem value=""><em>Choose a background…</em></MenuItem>
							{backgrounds.map(b => (<MenuItem key={b.index} value={b.index}>{b.name}</MenuItem>))}
						</Select>
					</FormControl>
					<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
						<Button onClick={onBack}>Back</Button>
						<Button
							variant="contained"
							disabled={!selected}
							onClick={() => {
								const obj = backgrounds.find(b => b.index === selected);
								setCharacter({ ...character, background: obj || { index: selected, name: selected } });
								onNext();
							}}
						>Next</Button>
					</Box>
				</>
			)}
		</Box>
	);
}
