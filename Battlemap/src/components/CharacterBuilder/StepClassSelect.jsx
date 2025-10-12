import React, { useEffect, useState } from 'react';
import { fetchList } from './api.js';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';

export default function StepClassSelect({ character, setCharacter, onNext, onBack }) {
	const [classes, setClasses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selectedClass, setSelectedClass] = useState(character.class?.index || '');

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		(async () => {
			try {
				const list = await fetchList('/api/classes', [
					{ index: 'fighter', name: 'Fighter' },
					{ index: 'wizard', name: 'Wizard' },
					{ index: 'cleric', name: 'Cleric' },
				]);
				if (mounted) setClasses(list);
			} catch (_) {
				setError('Failed to fetch classes. Showing dummy data.');
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Select Class</Typography>
			{loading ? <Typography>Loading…</Typography> : (
				<>
					{error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
					<FormControl fullWidth sx={{ mb: 2 }}>
						<InputLabel id="class-label">Class</InputLabel>
						<Select labelId="class-label" label="Class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
							<MenuItem value=""><em>Choose a class…</em></MenuItem>
							{classes.map(c => (<MenuItem key={c.index} value={c.index}>{c.name}</MenuItem>))}
						</Select>
					</FormControl>
					<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
						<Button onClick={onBack}>Back</Button>
						<Button
							variant="contained"
							disabled={!selectedClass}
							onClick={() => {
								const obj = classes.find(c => c.index === selectedClass);
								setCharacter({ ...character, class: obj || { index: selectedClass, name: selectedClass } });
								onNext();
							}}
						>Next</Button>
					</Box>
				</>
			)}
		</Box>
	);
}
