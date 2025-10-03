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

// Named drafts (multiple per game) -----------------------------------------
// Suggested SQL (run in Supabase):
// create table public.map_drafts (
//   id uuid primary key default gen_random_uuid(),
//   game_id uuid not null references public.games(id) on delete cascade,
//   name text not null,
//   state jsonb not null default '{}'::jsonb,
//   updated_by uuid references auth.users(id),
//   updated_at timestamptz not null default now(),
//   unique (game_id, name)
// );
// alter table public.map_drafts enable row level security;
// create policy "host manages drafts" on public.map_drafts for all
//   using (exists (select 1 from public.games g where g.id = map_drafts.game_id and g.host_id = auth.uid()))
//   with check (exists (select 1 from public.games g where g.id = map_drafts.game_id and g.host_id = auth.uid()));

export async function listMapDrafts(gameId) {
  const { data, error } = await supabase
    .from('map_drafts')
    .select('id, name, updated_at')
    .eq('game_id', gameId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertMapDraft(gameId, name, state, userId) {
  const { data, error } = await supabase
    .from('map_drafts')
    .upsert({ game_id: gameId, name, state, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'game_id,name' })
    .select('id, name, updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getMapDraft(gameId, name) {
  const { data, error } = await supabase
    .from('map_drafts')
    .select('id, name, state, updated_at')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();
  if (error) throw error;
  return data;
}

// User Library (maps outside any game) --------------------------------------
// Suggested SQL (run in Supabase):
// create table public.map_library (
//   id uuid primary key default gen_random_uuid(),
//   owner_id uuid not null references auth.users(id) on delete cascade,
//   name text not null,
//   state jsonb not null default '{}'::jsonb,
//   updated_at timestamptz not null default now(),
//   unique (owner_id, name)
// );
// alter table public.map_library enable row level security;
// create policy "owners manage library" on public.map_library for all
//   using (owner_id = auth.uid())
//   with check (owner_id = auth.uid());

export async function listLibraryMaps(ownerId) {
  const { data, error } = await supabase
    .from('map_library')
    .select('id, name, updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertLibraryMap(ownerId, name, state) {
  const { data, error } = await supabase
    .from('map_library')
    .upsert({ owner_id: ownerId, name, state, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,name' })
    .select('id, name, updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getLibraryMap(ownerId, name) {
  const { data, error } = await supabase
    .from('map_library')
    .select('id, name, state, updated_at')
    .eq('owner_id', ownerId)
    .eq('name', name)
    .single();
  if (error) throw error;
  return data;
}
