import { supabase } from '../supabaseClient';

// Delete all files in a storage bucket under a given prefix (folder-like path)
async function deleteAllInBucketPrefix(bucketName, prefix) {
  try {
    const bucket = supabase.storage.from(bucketName);
    const pageSize = 100;
    let offset = 0;
    let any = false;
    // list files directly under prefix; if you used nested folders, you may need to recurse
    // Our usage stores icons as `${userId}/<filename>` so a flat list is enough
    // Paginate until fewer than pageSize items returned
    // Note: Storage list will return both files and subfolders; we only remove files (have id or last_modified)
    // For simplicity, attempt remove on all returned names and ignore not found errors
    for (;;) {
      const { data, error } = await bucket.list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) break;
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) break;
      const paths = items.map((it) => `${prefix}/${it.name}`);
      if (paths.length) {
        any = true;
        const { error: rmErr } = await bucket.remove(paths);
        if (rmErr) {
          // if some fail (e.g., not found), continue best-effort
          // console.warn('bucket.remove error', rmErr);
        }
      }
      if (items.length < pageSize) break;
      offset += pageSize;
    }
    return any;
  } catch (_) {
    return false;
  }
}

// Best-effort deletion of all user data we control in the app database + storage.
// IMPORTANT: Deleting the auth user (auth.users row) requires a server-side admin key (service role).
// From the client we can only delete app data and sign the user out.
export async function deleteUserAccountData(userId) {
  if (!userId) throw new Error('Missing user ID');

  const results = { storage: null, characters: null, library: null, participants: null, gamesHosted: null };

  // 1) Storage: character icons folder `${userId}/` in the configured bucket
  try {
    const bucketName = import.meta.env.VITE_SUPABASE_ICONS_BUCKET || 'character-icons';
    await deleteAllInBucketPrefix(bucketName, userId);
    results.storage = 'ok';
  } catch (e) {
    results.storage = e.message || String(e);
  }

  // 2) Characters owned by user (their icons already handled above)
  try {
    const { error } = await supabase.from('characters').delete().eq('user_id', userId);
    if (error) throw error;
    results.characters = 'ok';
  } catch (e) {
    results.characters = e.message || String(e);
  }

  // 3) Library maps owned by user
  try {
    const { error } = await supabase.from('map_library').delete().eq('owner_id', userId);
    if (error) throw error;
    results.library = 'ok';
  } catch (e) {
    results.library = e.message || String(e);
  }

  // 4) Participants rows for this user
  try {
    const { error } = await supabase.from('participants').delete().eq('user_id', userId);
    if (error) throw error;
    results.participants = 'ok';
  } catch (e) {
    results.participants = e.message || String(e);
  }

  // 5) Games hosted by user (cascades to map_states/map_drafts via FKs)
  try {
    const { error } = await supabase.from('games').delete().eq('host_id', userId);
    if (error) throw error;
    results.gamesHosted = 'ok';
  } catch (e) {
    results.gamesHosted = e.message || String(e);
  }

  return results;
}

// Optional: if you deploy an Edge Function 'delete-account' using service role, you could call it here.
// export async function requestAccountDeletion() {
//   const { data, error } = await supabase.functions.invoke('delete-account', {});
//   if (error) throw error;
//   return data;
// }
