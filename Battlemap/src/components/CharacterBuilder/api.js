// Simple in-memory cache + helper
export const apiCache = new Map();

export async function fetchApi(path) {
	const url = `https://www.dnd5eapi.co${path}`;
	const key = url;
	if (apiCache.has(key)) return apiCache.get(key);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
	const data = await res.json();
	apiCache.set(key, data);
	return data;
}

export async function fetchList(path, fallback = []) {
	try {
		const data = await fetchApi(path);
		return data?.results || fallback;
	} catch (_) {
		return fallback;
	}
}

// Convenience typed getters --------------------------------------------------
export const getRaces = () => fetchList('/api/races');
export const getRace = (index) => fetchApi(`/api/races/${index}`);
export const getSubrace = (index) => fetchApi(`/api/subraces/${index}`);
export const getClasses = () => fetchList('/api/classes');
export const getClass = (index) => fetchApi(`/api/classes/${index}`);
export const getProficiencies = () => fetchList('/api/proficiencies');
export const getLanguages = () => fetchList('/api/languages');
export const getEquipment = () => fetchList('/api/equipment');
export const getSpells = () => fetchList('/api/spells');
export const getClassSpells = (cls) => fetchList(`/api/classes/${cls}/spells`);
// New: features and traits endpoints
export const getClassFeatures = (cls) => fetchList(`/api/classes/${cls}/features`);
export const getSubclassFeatures = (sub) => fetchList(`/api/subclasses/${sub}/features`);
export const getFeature = (index) => fetchApi(`/api/features/${index}`);
export const getTrait = (index) => fetchApi(`/api/traits/${index}`);
// Race and subrace traits come via race/subrace detail; provide tiny projector
export function extractTraitsFromRaceDetail(raceDetail) {
	return (raceDetail?.traits || []).map(t => ({ index: t.index, name: t.name }));
}
export function extractTraitsFromSubraceDetail(subraceDetail) {
	return (subraceDetail?.racial_traits || []).map(t => ({ index: t.index, name: t.name }));
}

// Fetch full feature details for a list of {index} entries and filter by level
export async function getFeatureDetailsUpToLevel(list = [], maxLevel = 1) {
	const results = [];
	for (const item of list) {
		if (!item?.index) continue;
		try {
			const detail = await getFeature(item.index);
			// Some feature detail includes level; keep if <= maxLevel (default to 1 if missing)
			const lvl = Number(detail.level || detail.prerequisites?.find(p=>p.type==='level')?.level || 1);
			if (lvl <= (Number(maxLevel)||1)) {
				results.push({
					index: detail.index,
					name: detail.name,
					level: lvl,
					desc: Array.isArray(detail.desc) ? detail.desc.join('\n') : (detail.desc || ''),
				});
			}
		} catch (_) { /* ignore individual feature failures */ }
	}
	// sort by level then name for stable output
	results.sort((a,b)=> (a.level-b.level) || a.name.localeCompare(b.name));
	return results;
}

// Fetch full trait details for a list of {index} entries
export async function getTraitDetails(list = []) {
	const results = [];
	for (const item of list) {
		if (!item?.index) continue;
		try {
			const detail = await getTrait(item.index);
			results.push({
				index: detail.index,
				name: detail.name,
				desc: Array.isArray(detail.desc) ? detail.desc.join('\n') : (detail.desc || ''),
			});
		} catch (_) { /* ignore individual trait failures */ }
	}
	// stable sort
	results.sort((a,b)=> a.name.localeCompare(b.name));
	return results;
}

// Ability score & derived stats helpers --------------------------------------
export function abilityMod(score) {
	return Math.floor((Number(score || 10) - 10) / 2);
}

export function proficiencyBonus(level = 1) {
	const lvl = Number(level) || 1;
	return 2 + Math.floor((lvl - 1) / 4); // 1-4:2,5-8:3,9-12:4,13-16:5,17-20:6
}

export function aggregateRacialAbilityBonuses(raceDetail, subraceDetail) {
	const bonuses = {};
	const push = (arr) => (arr || []).forEach(b => { if (!b?.ability_score?.index) return; bonuses[b.ability_score.index] = (bonuses[b.ability_score.index] || 0) + (b.bonus || 0); });
	if (raceDetail?.ability_bonuses) push(raceDetail.ability_bonuses);
	if (subraceDetail?.ability_bonuses) push(subraceDetail.ability_bonuses);
	return bonuses; // keys like 'str','dex' etc
}

export function computeDerived(character) {
	const lvl = character.level || 1;
	const prof = proficiencyBonus(lvl);
	const scores = ['str','dex','con','int','wis','cha'].reduce((acc,k)=>{acc[k]=Number(character[k]||10);return acc;},{});
	const mods = Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,abilityMod(v)]));
	const hp = (character.hit_die || 8) + mods.con; // level 1 HP rule: max hit die + CON mod
	const acBase = 10 + mods.dex; // basic, armor handled later
	const init = mods.dex;
	const passivePerception = 10 + mods.wis + (character.skill_proficiencies?.includes('skill-perception') ? prof : 0);
	return { proficiencyBonus: prof, abilityMods: mods, hp, ac: acBase, initiative: init, passivePerception };
}

// Simple memoization wrapper for detail fetches (race+subrace) ---------------
export async function getRaceWithSubrace(raceIndex, subraceIndex) {
	if (!raceIndex) return {};
	const raceDetail = await getRace(raceIndex);
	let subraceDetail = null;
	if (subraceIndex) {
		try { subraceDetail = await getSubrace(subraceIndex); } catch (_) { /* ignore */ }
	}
	return { raceDetail, subraceDetail };
}
