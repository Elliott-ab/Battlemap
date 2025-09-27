import { supabase } from '../supabaseClient';

// Suggested SQL (run in Supabase):
// create table public.map_states (
//   game_id uuid not null references public.games(id) on delete cascade,
//   channel text not null check (channel in ('live','draft')),
//   state jsonb not null default '{}'::jsonb,
//   updated_by uuid references auth.users(id),
//   updated_at timestamptz not null default now(),
//   primary key (game_id, channel)
// );
// alter table public.map_states enable row level security;
// create policy "participants can read live"
//   on public.map_states for select
//   using (
//     exists (select 1 from public.participants p where p.game_id = map_states.game_id and p.user_id = auth.uid())
//     or exists (select 1 from public.games g where g.id = map_states.game_id and g.host_id = auth.uid())
//   );
// create policy "participants write live"
//   on public.map_states for insert
//   with check (
//     channel = 'live' and (
//       exists (select 1 from public.participants p where p.game_id = map_states.game_id and p.user_id = auth.uid())
//       or exists (select 1 from public.games g where g.id = map_states.game_id and g.host_id = auth.uid())
//     )
//   );
// create policy "participants update live"
//   on public.map_states for update
//   using (channel = 'live')
//   with check (
//     channel = 'live' and (
//       exists (select 1 from public.participants p where p.game_id = map_states.game_id and p.user_id = auth.uid())
//       or exists (select 1 from public.games g where g.id = map_states.game_id and g.host_id = auth.uid())
//     )
//   );
// create policy "host manages draft"
//   on public.map_states for all
//   using (
//     exists (select 1 from public.games g where g.id = map_states.game_id and g.host_id = auth.uid())
//   ) with check (
//     exists (select 1 from public.games g where g.id = map_states.game_id and g.host_id = auth.uid())
//   );

export async function getMapState(gameId, channel = 'live') {
  const { data, error } = await supabase
    .from('map_states')
    .select('state, updated_at, updated_by, channel')
    .eq('game_id', gameId)
    .eq('channel', channel)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // not found is fine
  return data || null;
}

export async function upsertMapState(gameId, channel, state, userId) {
  const row = {
    game_id: gameId,
    channel,
    state,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('map_states')
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function pushDraftToLive(gameId, userId) {
  const draft = await getMapState(gameId, 'draft');
  const state = draft?.state || {};
  return upsertMapState(gameId, 'live', state, userId);
}
