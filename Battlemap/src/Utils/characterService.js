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
//   xp int,
//   str int, dex int, con int, int int, wis int, cha int,
//   ac int, speed int,
//   max_hp int, current_hp int, hp_temp int,
//   saving_throws jsonb,         -- { str: true/false, dex: ..., ... }
//   skills jsonb,               -- { acrobatics: { prof: bool }, perception: { prof: bool }, ... }
//   attacks jsonb,              -- [ { name, attack_bonus, damage } ]
//   spellcasting jsonb,         -- { ability: 'int'|'wis'|'cha', save_dc: int, attack_mod: int }
//   spells jsonb,               -- { "0": [ { name, prepared } ], "1": [ ... ] }
//   currency jsonb,             -- { gp: int, sp: int, cp: int, ep?: int, pp?: int }
//   equipment text,
//   class_features text,
//   racial_traits text,
//   feats text,
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
