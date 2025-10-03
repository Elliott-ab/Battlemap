import { supabase } from '../supabaseClient';

function randomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function hostGame(userId, campaignName, campaignDesc) {
  // Generate a unique code by attempting insert and retrying on unique violation
  let data = null;
  let lastErr = null;
  for (let i = 0; i < 6; i += 1) {
    const code = randomCode();
    // Try insert with optional name first; if column doesn't exist, retry without it
    let insertPayload = { code, host_id: userId };
    if (campaignName && campaignName.trim()) insertPayload.name = campaignName.trim();
    if (campaignDesc && campaignDesc.trim()) insertPayload.description = campaignDesc.trim();
    let { data: row, error } = await supabase
      .from('games')
      .insert([insertPayload])
      .select()
      .single();
    if (error && (error.message || '').toLowerCase().includes('column')) {
      // Retry with minimal payload
      const { data: row2, error: err2 } = await supabase
        .from('games')
        .insert([{ code, host_id: userId }])
        .select()
        .single();
      row = row2; error = err2;
    }
    if (!error && row) { data = row; break; }
    // 23505 is unique_violation in Postgres
    if (error && error.code === '23505') { lastErr = error; continue; }
    if (error) { lastErr = error; break; }
  }
  if (!data) throw lastErr || new Error('Failed to create game');
  // add host as participant
  await supabase.from('participants').insert([{ game_id: data.id, user_id: userId, role: 'host' }]);
  return data; // { id, code, host_id }
}

export async function joinGameByCode(userId, code) {
  let game = null;
  // Try RPC first (for stricter RLS setups); if missing, fall back to direct select
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_game_by_code', { v_code: code }).single();
  if (rpcErr || !rpcData) throw rpcErr || new Error('Game not found');
  game = rpcData;
  // upsert participant
  const { error: partErr } = await supabase
    .from('participants')
    .upsert({ game_id: game.id, user_id: userId, role: 'player' }, { onConflict: 'game_id,user_id' });
  if (partErr) throw partErr;
  return game;
}

// List campaigns (games) where the user is the host.
// Tries direct select; if blocked by RLS, falls back to selecting participants and then fetching games by code via RPC where possible.
export async function listCampaignsByHost(userId) {
  // Attempt direct read (select all columns to avoid missing-column errors)
  let { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('host_id', userId);
  if (!error && Array.isArray(data)) return data;
  // Fallback: derive via participants (host role) and try to resolve to game rows
  const { data: parts, error: pErr } = await supabase
    .from('participants')
    .select('game_id')
    .eq('user_id', userId)
    .eq('role', 'host');
  if (pErr || !Array.isArray(parts) || parts.length === 0) return [];
  const ids = parts.map(p => p.game_id);
  // Best-effort: fetch each by joining on code via an RPC if available; otherwise return minimal objects
  const out = [];
  for (const id of ids) {
    try {
      // If we cannot select games by id due to RLS, skip; the UI will simply show none
      const { data: g } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single();
      if (g) out.push(g);
    } catch (_) { /* ignore */ }
  }
  // Sort newest first by created_at if present
  return out.sort((a, b) => (new Date(b.created_at || 0)) - (new Date(a.created_at || 0)));
}
