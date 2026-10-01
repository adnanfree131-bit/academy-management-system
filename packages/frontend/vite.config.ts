import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load environment variables from the workspace root as well as packages/frontend
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '../../'), '');
  const localEnv = loadEnv(mode, process.cwd(), '');
  const env = { ...rootEnv, ...localEnv, ...process.env };

  if (command === 'build') {
    // Assert that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present and not empty or placeholder
    const rawUrl = env.VITE_SUPABASE_URL !== undefined 
      ? env.VITE_SUPABASE_URL 
      : (env.SUPABASE_URL || '');
    const rawAnonKey = env.VITE_SUPABASE_ANON_KEY !== undefined 
      ? env.VITE_SUPABASE_ANON_KEY 
      : (env.SUPABASE_ANON_KEY || '');

    const supabaseUrl = rawUrl.trim();
    const supabaseAnonKey = rawAnonKey.trim();

    const isPlaceholder = (val: string) =>
      !val ||
      val.includes('placeholder.supabase.co') ||
      val === 'placeholder-anon-key' ||
      val === 'placeholder';

    if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
      throw new Error(
        `[Vite Build Error: Missing Supabase Environment Variables]\n` +
        `Build requires valid, non-placeholder VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n` +
        `  VITE_SUPABASE_URL: "${supabaseUrl || '<missing>'}"\n` +
        `  VITE_SUPABASE_ANON_KEY: "${supabaseAnonKey ? supabaseAnonKey.slice(0, 10) + '...' : '<missing>'}"\n` +
        `Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your environment or .env file.`
      );
    }
  }

  // Determine resolved URL and key to define for client runtime bundle
  const resolvedUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const resolvedAnonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(resolvedUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(resolvedAnonKey),
    },
    server: {
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});

