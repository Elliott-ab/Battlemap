import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Use sessionStorage so auth persists across reloads in the same tab,
// but is cleared when the browser/tab is closed (fresh sign-in next time).
// Guard for non-browser environments.
const authOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  storage: (typeof window !== 'undefined' && window.sessionStorage) ? window.sessionStorage : undefined,
};

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: authOptions,
});
