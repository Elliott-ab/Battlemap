import { supabase } from '../supabaseClient';

// Notification shape suggestion (DB):
// id uuid pk, recipient_id uuid nullable, recipient_email text nullable,
// type text, message text, payload jsonb, created_at timestamptz default now(), read_at timestamptz nullable, status text

export async function createNotification({ recipientId = null, recipientEmail = null, type, message, payload = {} }, opts = {}) {
  const { bestEffort = true } = opts || {};
  const row = { recipient_id: recipientId, recipient_email: recipientEmail, type, message, payload };
  const { data, error } = await supabase.from('notifications').insert([row]).select('*').single();
  if (error) {
    // Swallow RLS/permission errors by default so calling UIs don't break
    const isRls = (error.status === 403) || /row-level security/i.test(String(error.message || ''));
    if (bestEffort && isRls) return null;
    if (bestEffort) return null;
    throw error;
  }
  return data;
}

export async function listNotificationsForUser(user) {
  if (!user) return [];
  const email = user.email || null;
  const userId = user.id || null;
  // Try to fetch by recipient_id first; include recipient_email as fallback
  let query = supabase
    .from('notifications')
    .select('id, type, message, payload, created_at, read_at')
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
  const base = Array.isArray(data) ? data : [];
  // Synthesize fellowship invite notifications from fellowships table so invites are visible without needing a notifications insert
  try {
    let fQuery = supabase
      .from('fellowships')
      .select('inviter_id, invitee_id, invitee_email, status, created_at, updated_at')
      .eq('status', 'pending');
    if (userId && email) {
      fQuery = fQuery.or(`invitee_id.eq.${userId},invitee_email.eq.${email}`);
    } else if (userId) {
      fQuery = fQuery.eq('invitee_id', userId);
    } else if (email) {
      fQuery = fQuery.eq('invitee_email', email);
    }
    const { data: frows, error: ferr } = await fQuery;
    if (!ferr && Array.isArray(frows) && frows.length > 0) {
      // Optional: fetch inviter profile names for nicer messages
      const inviterIds = Array.from(new Set(frows.map(r => r.inviter_id).filter(Boolean)));
      let names = new Map();
      if (inviterIds.length > 0) {
        try {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', inviterIds);
          if (Array.isArray(profs)) {
            names = new Map(profs.map(p => [p.id, (p.display_name || p.username || '').trim()]));
          }
        } catch (_) {}
      }
      const existingKeys = new Set(
        base
          .filter(n => n.type === 'fellowship_invite')
          .map(n => {
            const inviter = n?.payload?.inviter_id || n?.payload?.inviterId || '';
            return `fellowship:${inviter}`;
          })
      );
      const synthetic = frows
        .map(r => {
          const key = `fellowship:${r.inviter_id || ''}`;
          if (!r.inviter_id || existingKeys.has(key)) return null;
          const inviterName = names.get(r.inviter_id) || 'A user';
          return {
            id: key,
            type: 'fellowship_invite',
            message: `${inviterName} has invited you to join their fellowship`,
            payload: { inviter_id: r.inviter_id },
            created_at: r.updated_at || r.created_at || new Date().toISOString(),
            read_at: null,
          };
        })
        .filter(Boolean);
      // Merge and sort newest first
      const merged = [...base, ...synthetic].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return merged;
    }
  } catch (_) {
    // ignore fellowship synthesis errors; fall back to base
  }
  return base;
}

export async function markNotificationRead(id) {
  // Skip marking read for synthetic notifications (non-UUID IDs)
  const uuidLike = typeof id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);
  if (!uuidLike) return;
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
    // Attempt to update an existing pending invite addressed by email or id
    const email = currentUser.email || null;
    const updates = { status, invitee_id: currentUser.id };
    let didUpdate = false;
    // Try update by email
    if (email) {
      try {
        const { data: up1, error: err1 } = await supabase
          .from('fellowships')
          .update(updates)
          .eq('inviter_id', inviterId)
          .eq('invitee_email', email)
          .select('inviter_id');
        if (err1) throw err1;
        if (Array.isArray(up1) && up1.length > 0) didUpdate = true;
      } catch (_) {
        try {
          await supabase
            .from('fellowships')
            .update(updates)
            .eq('inviter_id', inviterId)
            .eq('invitee_email', email);
          didUpdate = true; // assume success if no error thrown
        } catch (_) {}
      }
    }
    // Try update by invitee_id
    if (!didUpdate) {
      try {
        const { data: up2, error: err2 } = await supabase
          .from('fellowships')
          .update(updates)
          .eq('inviter_id', inviterId)
          .eq('invitee_id', currentUser.id)
          .select('inviter_id');
        if (err2) throw err2;
        if (Array.isArray(up2) && up2.length > 0) didUpdate = true;
      } catch (_) {
        try {
          await supabase
            .from('fellowships')
            .update(updates)
            .eq('inviter_id', inviterId)
            .eq('invitee_id', currentUser.id);
          didUpdate = true;
        } catch (_) {}
      }
    }
    // If nothing was updated, attempt to insert
    if (!didUpdate) {
      try {
        await supabase
          .from('fellowships')
          .insert([{ inviter_id: inviterId, invitee_id: currentUser.id, invitee_email: email, status }]);
      } catch (_) {
        // ignore insert failure (RLS may block)
      }
    }
    // If accepted, ensure a reciprocal accepted row exists so both users see the connection
    if (status === 'accepted') {
      try {
        // Check for existing reciprocal row
        const { data: rec } = await supabase
          .from('fellowships')
          .select('inviter_id')
          .eq('inviter_id', currentUser.id)
          .eq('invitee_id', inviterId)
          .eq('status', 'accepted')
          .maybeSingle();
        if (!rec) {
          await supabase
            .from('fellowships')
            .insert([{ inviter_id: currentUser.id, invitee_id: inviterId, invitee_email: payload.inviter_email || null, status: 'accepted' }]);
        }
      } catch (_) {
        // best-effort only
      }
    }
  } catch (_) {
    // Ignore DB errors; continue
  }
  await markNotificationRead(notification.id).catch(() => {});
  return { ok: true };
}
