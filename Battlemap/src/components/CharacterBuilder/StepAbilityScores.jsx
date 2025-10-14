import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Grid, TextField, Typography, ToggleButtonGroup, ToggleButton, Tooltip, MenuItem } from '@mui/material';
import { abilityMod } from './api.js';

const abilities = ['str','dex','con','int','wis','cha'];
const STANDARD_ARRAY = [15,14,13,12,10,8];
const POINT_BUY_COST = { 8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9 };

function remainingPointBuy(points, scores) {
	const spent = abilities.reduce((acc,k)=> acc + Object.entries(POINT_BUY_COST).find(([val])=>Number(val)===scores[k])?.[1] || 0, 0);
	return points - spent;
}

export default function StepAbilityScores({ character, setCharacter, onNext, onBack }) {
	const method = character.ability_method || 'standard-array';
	const racialBonuses = character.racialAbilityBonuses || {};
	const baseInit = abilities.reduce((acc,k)=>({ ...acc, [k]: character[k] || 10 }), {});
	const [scores, setScores] = useState(baseInit);
	const [arrayPool, setArrayPool] = useState([...STANDARD_ARRAY]);

	useEffect(() => {
		if (method === 'standard-array') {
			setArrayPool(prev => { // recompute pool if user had changed
				const used = abilities.filter(k => prev.indexOf(scores[k]) === -1); // naive but acceptable
				return STANDARD_ARRAY.filter(v => !abilities.some(a => scores[a] === v));
			});
		}
	}, [method]);

	const pointBuyRemaining = useMemo(() => method === 'point-buy' ? remainingPointBuy(27, scores) : 0, [method, scores]);

	const finalScores = useMemo(() => {
		const merged = { ...scores };
		Object.entries(racialBonuses).forEach(([k,v]) => { const map = { strength:'str', dexterity:'dex', constitution:'con', intelligence:'int', wisdom:'wisdom', charisma:'cha'}; const key = map[k] || k; if (merged[key] != null) merged[key]+=v; });
		// handle shorthand keys (already in form str,dex,...)
		Object.entries(racialBonuses).forEach(([k,v]) => { if (merged[k] != null) merged[k]+= v; });
		return merged;
	}, [scores, racialBonuses]);

	const mods = useMemo(() => Object.fromEntries(abilities.map(k=>[k, abilityMod(finalScores[k])])), [finalScores]);

	const updateManual = (k, value) => {
		const val = Math.max(1, Math.min(20, Number(value)||0));
		setScores(s => ({ ...s, [k]: val }));
	};

	const updatePointBuy = (k, value) => {
		const val = Number(value);
		if (!(val in POINT_BUY_COST)) return; // only allow legal values 8..15 (no 16+ pre-bonus)
		const hypothetical = { ...scores, [k]: val };
		const remaining = remainingPointBuy(27, hypothetical);
		if (remaining < 0) return; // overspent
		setScores(hypothetical);
	};

	const assignStandardValue = (k, value) => {
		setScores(s => ({ ...s, [k]: value }));
	};

	// Live-sync to shared character so Core Stats update in real time
	useEffect(() => {
		const updated = abilities.reduce((acc,k)=>({ ...acc, [k]: scores[k] }), {});
		setCharacter(c => ({
			...c,
			...updated,
			ability_method: method,
			finalAbilityScores: finalScores,
			ability_mods: mods,
		}));
	}, [scores, finalScores, mods, method, setCharacter]);

	const renderControls = () => {
		if (method === 'manual') {
			return abilities.map(k => (
				<Grid key={k} item xs={6} sm={4} md={2}>
					<TextField type="number" label={k.toUpperCase()} value={scores[k]} inputProps={{ min:1, max:20 }} onChange={(e)=>updateManual(k,e.target.value)} fullWidth />
				</Grid>
			));
		}
		if (method === 'point-buy') {
			return abilities.map(k => (
				<Grid key={k} item xs={6} sm={4} md={2}>
					<TextField
						select
						label={`${k.toUpperCase()}`}
						value={scores[k]}
						onChange={(e)=>updatePointBuy(k,e.target.value)}
						fullWidth
						helperText={<span style={{ color:'#d32f2f' }}>Mod {mods[k]>=0?'+':''}{mods[k]}</span>}
					>
						{Object.keys(POINT_BUY_COST).map(v => (
							<MenuItem key={v} value={Number(v)}>{v}</MenuItem>
						))}
					</TextField>
				</Grid>
			));
		}
		// standard array: provide toggle buttons for values selection per ability
		return abilities.map(k => (
			<Grid key={k} item xs={6} sm={4} md={2}>
				<ToggleButtonGroup exclusive fullWidth value={scores[k]} onChange={(_, val) => { if (val != null) assignStandardValue(k,val); }} size="small" orientation="vertical">
					{STANDARD_ARRAY.map(v => {
						const chosen = scores[k] === v;
						return (
							<ToggleButton key={v} value={v} disabled={abilities.some(a => a!==k && scores[a]===v)}
								sx={{ px:0.5, bgcolor: chosen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)', color:'#fff', borderColor:'rgba(255,255,255,0.15)', '&.Mui-disabled': { opacity:0.35 } }}
							>
								{v}
							</ToggleButton>
						);
					})}
				</ToggleButtonGroup>
				<Typography variant="caption" sx={{ display:'block', textAlign:'center', mt:0.5, color:'#d32f2f' }}>Mod {mods[k]>=0?'+':''}{mods[k]}</Typography>
			</Grid>
		));
	};

	const handleNext = () => {
		const updated = abilities.reduce((acc,k)=>({ ...acc, [k]: scores[k] }), {});
		setCharacter(c => ({ ...c, ...updated, finalAbilityScores: finalScores, ability_mods: mods }));
		onNext();
	};

	return (
		<Box>
			<Typography variant="subtitle1" sx={{ color:'#d32f2f', fontWeight:700, mb:1 }}>Ability Scores</Typography>
			{method === 'point-buy' && (
				<Typography variant="body2" sx={{ mb:1 }}>Point Buy Remaining: {pointBuyRemaining}</Typography>
			)}
			<Grid container spacing={2}>
				{renderControls()}
			</Grid>
			<Box sx={{ mt:3 }}>
				<Typography variant="body2" sx={{ opacity:0.8, mb:1 }}>Final Scores (after racial bonuses)</Typography>
				<Grid container spacing={1}>
					{abilities.map(k => (
						<Grid key={k} item xs={4} sm={2}>
							<Tooltip title={`Modifier ${mods[k]>=0?'+':''}${mods[k]}`} placement="top">
								<Box sx={{ textAlign:'center', p:1, border:'1px solid rgba(255,255,255,0.15)', borderRadius:1 }}>
									<Typography variant="caption" sx={{ opacity:0.7 }}>{k.toUpperCase()}</Typography>
									<Typography variant="subtitle1" sx={{ fontWeight:600 }}>{finalScores[k]}</Typography>
								</Box>
							</Tooltip>
						</Grid>
					))}
				</Grid>
			</Box>
			<Box sx={{ display:'flex', justifyContent:'space-between', mt:3 }}>
				<Button onClick={onBack}>Back</Button>
				<Button variant="contained" onClick={handleNext}>Next</Button>
			</Box>
		</Box>
	);
}
