import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, TextField } from '@mui/material';
import ProgressStepper from './CharacterBuilder/ProgressStepper.jsx';
import StepBasics from './CharacterBuilder/StepBasics.jsx';
import StepRaceSubrace from './CharacterBuilder/StepRaceSubrace.jsx';
import StepClass from './CharacterBuilder/StepClass.jsx';
import StepAbilityScores from './CharacterBuilder/StepAbilityScores.jsx';
// Removed Derived Stats step; we'll show core stats persistently below the stepper
import StepProficienciesLanguages from './CharacterBuilder/StepProficienciesLanguages.jsx';
import StepStartingEquipment from './CharacterBuilder/StepStartingEquipment.jsx';
import StepSpellcasting from './CharacterBuilder/StepSpellcasting.jsx';
import StepSummary from './CharacterBuilder/StepSummary.jsx';
import CoreStatsInline from './CharacterBuilder/CoreStatsInline.jsx';
import { getFeatureDetailsUpToLevel, getTraitDetails, extractTraitsFromRaceDetail, extractTraitsFromSubraceDetail, getClassFeatures, getSubclassFeatures } from './CharacterBuilder/api.js';

const steps = [
	{ label: 'Basics', component: StepBasics },
	{ label: 'Race & Subrace', component: StepRaceSubrace },
	{ label: 'Class', component: StepClass },
	{ label: 'Ability Scores', component: StepAbilityScores },
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

		// Aggregate racial traits and (sub)class features up to current level whenever core selections change
		useEffect(() => {
			let cancelled = false;
			(async () => {
				const raceIdx = character.race?.index;
				const subraceIdx = character.subrace?.index;
				const classIdx = character.class?.index;
				const subclassIdx = character.subclass?.index;
				const level = Number(character.level || 1);
				if (!raceIdx && !classIdx) return; // nothing to do yet
				try {
					// Traits from race + subrace
					const traitRefs = [
						...extractTraitsFromRaceDetail(character.raceDetail || {}),
						...extractTraitsFromSubraceDetail(character.subraceDetail || {}),
					];
					const traits = await getTraitDetails(traitRefs);

					// Class features
					let classFeatureRefs = [];
					if (classIdx) {
						try { classFeatureRefs = await getClassFeatures(classIdx); } catch (_) { classFeatureRefs = []; }
					}
					const classFeatures = await getFeatureDetailsUpToLevel(classFeatureRefs, level);

					// Subclass features
					let subclassFeatures = [];
					if (subclassIdx) {
						try {
							const refs = await getSubclassFeatures(subclassIdx);
							subclassFeatures = await getFeatureDetailsUpToLevel(refs, level);
						} catch (_) { /* ignore */ }
					}

					if (cancelled) return;
					setCharacter((prev) => ({
						...prev,
						aggregated_traits: traits, // array of {index,name,desc}
						aggregated_class_features: classFeatures, // array of {index,name,level,desc}
						aggregated_subclass_features: subclassFeatures,
						// Also keep plain text for sheet compatibility
						racial_traits: traits.map(t => `• ${t.name}\n${t.desc}`).join('\n\n'),
						class_features: [
							...classFeatures.map(f => `• [Lv ${f.level}] ${f.name}\n${f.desc}`),
							...subclassFeatures.map(f => `• [Lv ${f.level}] ${f.name}\n${f.desc}`),
						].join('\n\n'),
					}));
				} catch (_) {
					// Non-fatal; keep existing values
				}
			})();
			return () => { cancelled = true; };
		}, [character.race?.index, character.subrace?.index, character.class?.index, character.subclass?.index, character.level, character.raceDetail, character.subraceDetail]);

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

			{/* Persistent Core Stats below the stepper on all steps except the Summary to avoid duplication */}
			{activeStep !== steps.length - 1 && (
				<Paper elevation={3} sx={{ ...cardSx, mb: 2 }}>
					<CoreStatsInline character={character} />
				</Paper>
			)}

			<Paper
				elevation={3}
				sx={{
					...cardSx,
					// Add extra bottom padding on mobile to avoid overlap with device UI/footer
					pb: { xs: 'calc(64px + env(safe-area-inset-bottom, 0px))', md: 2 },
				}}
			>
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
