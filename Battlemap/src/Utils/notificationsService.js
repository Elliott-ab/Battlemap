import { supabase } from '../supabaseClient';

// Notification shape suggestion (DB):
// id uuid pk, recipient_id uuid nullable, recipient_email text nullable,
// type text, message text, payload jsonb, created_at timestamptz default now(), read_at timestamptz nullable, status text

export async function createNotification({ recipientId = null, recipientEmail = null, type, message, payload = {} }) {
  const row = { recipient_id: recipientId, recipient_email: recipientEmail, type, message, payload };
  const { data, error } = await supabase.from('notifications').insert([row]).select('*').single();
  if (error) throw error;
  return data;
}

export async function listNotificationsForUser(user) {
  if (!user) return [];
  const email = user.email || null;
  const userId = user.id || null;
  // Try to fetch by recipient_id first; include recipient_email as fallback
  let query = supabase
    .from('notifications')
    .select('id, type, message, payload, created_at, read_at, status')
    .order('created_at', { ascending: false });
  if (userId && email) {
    query = query.or(`recipient_id.eq.${userId},recipient_email.eq.${email}`);
  } else if (userId) {
    query = query.eq('recipient_id', userId);
  } else if (email) {
    query = query.eq('recipient_email', email);
  } else {
    return [];
  }
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// Fellowship invite handlers: accept/decline
export async function respondToFellowshipInvite(notification, action, currentUser) {
  // action: 'accept' | 'decline'
  const payload = notification?.payload || {};
  const inviterId = payload.inviter_id || payload.inviterId || null;
  if (!currentUser?.id || !inviterId) {
    // Best effort: just mark as read
    await markNotificationRead(notification.id);
    return { ok: false };
  }
  // Upsert into fellowships table
  const status = action === 'accept' ? 'accepted' : 'declined';
  try {
    // First attempt to update a pending invite addressed by email or id
    const email = currentUser.email || null;
    const updates = { status, invitee_id: currentUser.id };
    // Try to update by email
    if (email) {
      await supabase
        .from('fellowships')
        .update(updates)
        .eq('inviter_id', inviterId)
        .eq('invitee_email', email);
    }
    // Also try update by invitee_id match
    await supabase
      .from('fellowships')
      .update(updates)
      .eq('inviter_id', inviterId)
      .eq('invitee_id', currentUser.id);
    // Finally, ensure a row exists (insert if nothing matched)
    await supabase
      .from('fellowships')
      .upsert({ inviter_id: inviterId, invitee_id: currentUser.id, invitee_email: email, status }, { onConflict: 'inviter_id,invitee_id' });
  } catch (_) {
    // Ignore DB errors; continue
  }
  await markNotificationRead(notification.id).catch(() => {});
  return { ok: true };
}
