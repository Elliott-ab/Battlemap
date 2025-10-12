import React, { useState, useEffect } from 'react';
import { Box, Button, Grid, TextField, Typography } from '@mui/material';

const abilities = ['str','dex','con','int','wis','cha'];

export default function StepAbilityScores({ character, setCharacter, onNext, onBack }) {
	const [scores, setScores] = useState({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

	useEffect(() => {
		const init = { ...scores };
		abilities.forEach(k => { if (character[k]) init[k] = character[k]; });
		setScores(init);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const update = (k, v) => setScores(s => ({ ...s, [k]: Math.max(1, Math.min(20, Number(v) || 0)) }));

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color: '#d32f2f', fontWeight: 700, mb: 1 }}>Assign Ability Scores</Typography>
			<Typography variant="body2" sx={{ mb: 2 }}>Enter values 1–20 for each ability.</Typography>
			<Grid container spacing={2}>
				{abilities.map((k) => (
					<Grid key={k} item xs={6} sm={4} md={2}>
						<TextField
							type="number"
							inputProps={{ min: 1, max: 20 }}
							label={k.toUpperCase()}
							value={scores[k]}
							onChange={(e) => update(k, e.target.value)}
							fullWidth
						/>
					</Grid>
				))}
			</Grid>
			<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
				<Button onClick={onBack}>Back</Button>
				<Button variant="contained" onClick={() => { setCharacter({ ...character, ...scores }); onNext(); }}>Next</Button>
			</Box>
		</Box>
	);
}
