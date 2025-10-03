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
//   icon_url text,              -- optional: public URL to character icon image
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
  // First attempt: include full row (may include icon_url)
  let { data, error } = await supabase
    .from('characters')
    .upsert(row)
    .select()
    .single();
  if (!error) return data;
  // If the error is due to unknown column (e.g., icon_url not yet added), retry without it
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('row level security') || msg.includes('row-level security') || msg.includes('rls')) {
    throw new Error('Insert/update blocked by Row Level Security. Ensure the characters table has an RLS policy like: using (auth.uid() = user_id) with check (auth.uid() = user_id).');
  }
  if (msg.includes('column') && msg.includes('icon_url')) {
    const { icon_url, ...rest } = row;
    const retry = await supabase
      .from('characters')
      .upsert(rest)
      .select()
      .single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
  throw error;
}

export async function deleteCharacter(id) {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Upload an image file to Supabase Storage and return its public URL.
// Requires a storage bucket named 'character-icons' with public read.
export async function uploadCharacterIcon(userId, file) {
  if (!file || !userId) throw new Error('Missing file or user');
  const bucketName = import.meta.env.VITE_SUPABASE_ICONS_BUCKET || 'character-icons';
  const bucket = supabase.storage.from(bucketName);
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase();
  const name = (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`) + `.${ext}`;
  const path = `${userId}/${name}`;
  const { error: upErr } = await bucket.upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type || undefined });
  if (upErr) {
    // Provide an actionable hint if the bucket is missing
    const msg = (upErr?.message || '').toLowerCase();
    if (msg.includes('bucket') && msg.includes('not found')) {
      throw new Error(`Supabase Storage bucket "${bucketName}" not found. Create it in Supabase Storage (public) or set VITE_SUPABASE_ICONS_BUCKET to an existing bucket name.`);
    }
    if (msg.includes('row') && msg.includes('security')) {
      throw new Error(`Upload blocked by Supabase Storage policies (RLS). Ensure Storage policies allow authenticated users to insert into the "${bucketName}" bucket, and enable public SELECT if you want public reads.`);
    }
    throw upErr;
  }
  const { data } = bucket.getPublicUrl(path);
  return data.publicUrl;
}

// Given a public URL returned by Supabase, derive the object path inside the bucket
function extractPathFromPublicUrl(publicUrl, bucketName) {
  try {
    const u = new URL(publicUrl);
    // Expected: /storage/v1/object/public/<bucket>/<path>
    const parts = u.pathname.split('/').filter(Boolean);
    // Support both 'public' and 'sign' URL forms
    const markerIdx = parts.findIndex((p) => p === 'public' || p === 'sign');
    if (markerIdx >= 0 && parts[markerIdx + 1]) {
      const bucketInUrl = parts[markerIdx + 1];
      return decodeURIComponent(parts.slice(markerIdx + 2).join('/'));
    }
  } catch (_) {
    // fallthrough
  }
  return null;
}

// Delete an uploaded icon by its public URL
export async function deleteCharacterIcon(publicUrl) {
  if (!publicUrl) return; // nothing to delete
  const bucketName = import.meta.env.VITE_SUPABASE_ICONS_BUCKET || 'character-icons';
  const bucket = supabase.storage.from(bucketName);
  const path = extractPathFromPublicUrl(publicUrl, bucketName);
  if (!path) return; // unable to parse; skip silently to avoid breaking UX
  const { error } = await bucket.remove([path]);
  if (error) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('not found')) return; // already gone, ignore
    // Surface other errors for visibility
    throw error;
  }
}

// Create a short-lived signed URL for a stored object; works when the bucket is private
export async function getSignedCharacterIconUrl(publicUrlOrPath) {
  const bucketName = import.meta.env.VITE_SUPABASE_ICONS_BUCKET || 'character-icons';
  const bucket = supabase.storage.from(bucketName);
  // If a full URL is provided, extract the path; otherwise assume it's already a path
  let path = publicUrlOrPath;
  if (/^https?:\/\//i.test(String(publicUrlOrPath || ''))) {
    path = extractPathFromPublicUrl(publicUrlOrPath, bucketName);
  }
  if (!path) return null;
  const { data, error } = await bucket.createSignedUrl(path, 60 * 60); // 1 hour
  if (error) throw error;
  return data?.signedUrl || null;
}
