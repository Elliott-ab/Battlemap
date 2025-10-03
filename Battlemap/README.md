# Battlemap

A lightweight battlemap built with React + Vite. Supports tokens, cover blocks, initiative, and movement highlighting on a square grid.

## Character icon uploads (Supabase Storage)

This project can upload circular character icons to Supabase Storage and display them across the app.

Setup steps:

1. In your Supabase project, go to Storage and create a bucket named `character-icons` (or any name you prefer).
	- If you use a different name, set an environment variable `VITE_SUPABASE_ICONS_BUCKET` to that bucket name.
	- Make the bucket Public so the app can read images without auth headers.
2. Ensure your environment contains:
	- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
	- Optional: `VITE_SUPABASE_ICONS_BUCKET` (defaults to `character-icons`)
3. Deploy: the app uses the bucket via Supabase Storage JS client and builds a public URL for display.

If you see "Bucket not found" when uploading, either create the bucket in Supabase or set `VITE_SUPABASE_ICONS_BUCKET` to an existing bucket.

### Storage bucket policies (for uploads)

By default, Supabase Storage requires policies to permit uploads. Create storage policies so authenticated users can insert into your icons bucket and everyone can read public files.

In the Supabase SQL editor:

```sql
-- Replace 'character-icons' with your bucket if different
-- Postgres doesn't support CREATE POLICY IF NOT EXISTS; use DROP IF EXISTS + CREATE

drop policy if exists "icons-insert" on storage.objects;
create policy "icons-insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'character-icons');

drop policy if exists "icons-update" on storage.objects;
create policy "icons-update"
on storage.objects for update
to authenticated
using (bucket_id = 'character-icons');

-- Allow public read access (if bucket is public, this aligns with the UI setting)
drop policy if exists "icons-read" on storage.objects;
create policy "icons-read"
on storage.objects for select
to public
using (bucket_id = 'character-icons');
```

Alternatively, in the Storage UI, mark the bucket as Public for reads, and ensure an authenticated policy exists for INSERT into that bucket.

## Characters table and RLS

Create the `characters` table and enable Row Level Security so users can only access their own characters.

SQL (run in Supabase SQL editor):

```sql
create table if not exists public.characters (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	name text,
	class text,
	race text,
	level int,
	background text,
	alignment text,
	xp int,
	str int, dex int, con int, int int, wis int, cha int,
	ac int, speed int,
	max_hp int, current_hp int, hp_temp int,
	saving_throws jsonb,
	skills jsonb,
	attacks jsonb,
	spellcasting jsonb,
	spells jsonb,
	currency jsonb,
	equipment text,
	class_features text,
	racial_traits text,
	feats text,
	icon_url text,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

alter table public.characters enable row level security;

-- Allow users to manage only their own rows
create policy if not exists "own-characters"
	on public.characters
	for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);
```

If you get an error like "new row violates row-level security policy", ensure:
- You're authenticated (the client has a valid user with `auth.uid()`), and
- You set the `user_id` column to the current user's id when inserting/upserting.

## Movement and terrain

- Grid size: configurable in ft-per-cell from the Gear icon.
- Normal movement cost: 1 cell costs gridSize feet (e.g., 5 ft).
- Difficult terrain: add cover with type "Difficult Terrain" in the editor. These cells are passable but cost double movement (2 cells of cost) when entered.
	- Example: with a 5 ft grid, entering a difficult cell costs 10 ft.
	- Normal cover types (Half/Three-Quarters/Full) are impassable to movement.
- Movement range: highlights use weighted reachability (Dijkstra). Difficult cells count as 2, normal as 1. Click any highlighted cell to move.

Notes:
- Diagonal movement is not currently supported; moves are orthogonal (up/down/left/right).
- Enemy facing can be set by clicking a destination cell during their turn; difficult terrain rules do not affect facing.
