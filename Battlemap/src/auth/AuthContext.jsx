import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, user: session?.user ?? null }), [session]);

  // On first authenticated session, try to apply a pending username
  useEffect(() => {
    (async () => {
      try {
        const userId = session?.user?.id;
        if (!userId) return;
        const pending = localStorage.getItem('bm_pending_username');
        if (!pending) return;
        const { getUserProfile, setUsername } = await import('../Utils/userService.js');
        const profile = await getUserProfile(userId).catch(() => null);
        if (!profile || !profile.username) {
          try {
            await setUsername(userId, pending);
            localStorage.removeItem('bm_pending_username');
          } catch (_) {
            // leave pending for later manual set if it fails
          }
        } else {
          // Already has a username
          localStorage.removeItem('bm_pending_username');
        }
      } catch (_) { /* ignore */ }
    })();
  }, [session?.user?.id]);

  if (loading) return null; // simple splash

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return null; // Router outlet wrapper controls redirect
  return children;
}
