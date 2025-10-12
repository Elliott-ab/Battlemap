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
