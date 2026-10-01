import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isPlaceholder = (val: string) =>
  !val ||
  val.includes('placeholder.supabase.co') ||
  val === 'placeholder-anon-key' ||
  val === 'placeholder';

// Runtime fail-closed guard in production mode
if (import.meta.env.PROD) {
  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
    throw new Error(
      '[Supabase Client Fatal] Missing or placeholder Supabase credentials in production. ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured.'
    );
  }
} else if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  if (import.meta.env.DEV) {
    console.warn(
      '[Supabase Browser Client] Missing or placeholder VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Please check your .env configuration.'
    );
  }
}

/**
 * Single authoritative Supabase browser client.
 * Strictly uses the publishable anon key. Never uses SUPABASE_SERVICE_ROLE_KEY.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'kampus.sb.auth.token',
    },
  }
);
