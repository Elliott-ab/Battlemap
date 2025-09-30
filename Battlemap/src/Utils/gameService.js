import { supabase } from '../supabaseClient';

function randomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function hostGame(userId) {
  // Generate a unique code by attempting insert and retrying on unique violation
  let data = null;
  let lastErr = null;
  for (let i = 0; i < 6; i += 1) {
    const code = randomCode();
    const { data: row, error } = await supabase
      .from('games')
      .insert([{ code, host_id: userId }])
      .select()
      .single();
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
