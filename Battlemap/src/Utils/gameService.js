import { supabase } from '../supabaseClient';

function randomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function hostGame(userId) {
  // try create unique code
  let code = randomCode();
  // naive retry few times
  for (let i = 0; i < 5; i += 1) {
    const { data: existing } = await supabase.from('games').select('id').eq('code', code).maybeSingle();
    if (!existing) break;
    code = randomCode();
  }
  const { data, error } = await supabase
    .from('games')
    .insert([{ code, host_id: userId }])
    .select()
    .single();
  if (error) throw error;
  // add host as participant
  await supabase.from('participants').insert([{ game_id: data.id, user_id: userId, role: 'host' }]);
  return data; // { id, code, host_id }
}

export async function joinGameByCode(userId, code) {
  let game = null;
  // Try RPC first (for stricter RLS setups); if missing, fall back to direct select
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_game_by_code', { v_code: code }).single();
  if (!rpcErr && rpcData) {
    game = rpcData;
  } else {
    const { data, error } = await supabase.from('games').select('*').eq('code', code).single();
    if (error) throw error;
    game = data;
  }
  // upsert participant
  const { error: partErr } = await supabase
    .from('participants')
    .upsert({ game_id: game.id, user_id: userId, role: 'player' }, { onConflict: 'game_id,user_id' });
  if (partErr) throw partErr;
  return game;
}
