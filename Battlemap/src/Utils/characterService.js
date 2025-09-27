import { supabase } from '../supabaseClient';

// Expected table schema (run in Supabase SQL editor):
// create table public.characters (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid not null references auth.users(id) on delete cascade,
//   name text,
//   class text,
//   race text,
//   level int,
//   background text,
//   alignment text,
//   str int, dex int, con int, int int, wis int, cha int,
//   max_hp int, current_hp int, ac int, speed int,
//   features text, equipment text,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
// alter table public.characters enable row level security;
// create policy "own-characters"
//   on public.characters
//   for all
//   using (auth.uid() = user_id)
//   with check (auth.uid() = user_id);

export async function listCharacters(userId) {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCharacter(id) {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function upsertCharacter(payload) {
  const now = new Date().toISOString();
  const row = { ...payload, updated_at: now };
  const { data, error } = await supabase
    .from('characters')
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCharacter(id) {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
