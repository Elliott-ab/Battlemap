import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, TextField } from '@mui/material';
import ProgressStepper from './CharacterBuilder/ProgressStepper.jsx';
import StepBasics from './CharacterBuilder/StepBasics.jsx';
import StepRaceSubrace from './CharacterBuilder/StepRaceSubrace.jsx';
import StepClass from './CharacterBuilder/StepClass.jsx';
import StepAbilityScores from './CharacterBuilder/StepAbilityScores.jsx';
import StepDerivedStats from './CharacterBuilder/StepDerivedStats.jsx';
import StepProficienciesLanguages from './CharacterBuilder/StepProficienciesLanguages.jsx';
import StepStartingEquipment from './CharacterBuilder/StepStartingEquipment.jsx';
import StepSpellcasting from './CharacterBuilder/StepSpellcasting.jsx';
import StepSummary from './CharacterBuilder/StepSummary.jsx';

const steps = [
	{ label: 'Basics', component: StepBasics },
	{ label: 'Race & Subrace', component: StepRaceSubrace },
	{ label: 'Class', component: StepClass },
	{ label: 'Ability Scores', component: StepAbilityScores },
	{ label: 'Derived Stats', component: StepDerivedStats },
	{ label: 'Proficiencies & Languages', component: StepProficienciesLanguages },
	{ label: 'Starting Equipment', component: StepStartingEquipment },
	{ label: 'Spellcasting', component: StepSpellcasting },
	{ label: 'Summary', component: StepSummary },
];

export default function CharacterBuilder() {
	const [activeStep, setActiveStep] = useState(0);
	const [character, setCharacter] = useState({ name: '', level:1 });

	// Prefill from any temporary wizard data (if present)
	useEffect(() => {
		try {
			const s = sessionStorage.getItem('wizard-character');
			if (s) {
				const obj = JSON.parse(s);
				setCharacter((prev) => ({ ...prev, ...obj }));
				sessionStorage.removeItem('wizard-character');
			}
		} catch (_) {}
	}, []);

	const CurrentStep = steps[activeStep].component;

	const cardSx = {
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
	};

	return (
		<Box sx={{ maxWidth: '1280px', mx: 'auto', p: { xs: 1.5, md: 3 } }}>
			<Typography variant="h5" sx={{ color: '#d32f2f', fontWeight: 800, mb: 1 }}>
				Character Builder
			</Typography>

			<ProgressStepper steps={steps} activeStep={activeStep} onStepClick={setActiveStep} cardSx={cardSx} />

			<Paper elevation={3} sx={cardSx}>
				<CurrentStep
					character={character}
					setCharacter={setCharacter}
					onNext={() => setActiveStep((s) => Math.min(s + 1, steps.length - 1))}
					onBack={() => setActiveStep((s) => Math.max(s - 1, 0))}
					isLast={activeStep === steps.length - 1}
				/>
			</Paper>
		</Box>
	);
}
