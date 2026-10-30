import { defineConfig, loadEnv } from 'vite';

// Refuse to build with a Supabase SECRET / service_role key: anything in a
// VITE_ variable is published inside the app's JavaScript for anyone to read.
function isSecretKey(key) {
  if (/^sb_secret_/.test(key)) return true;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const key = (env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const url = (env.VITE_SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
  if (isSecretKey(key) || isSecretKey(url)) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is a Supabase SECRET key. Use the Publishable key (sb_publishable_...) ' +
        'or the legacy anon key instead, and revoke the secret key in Supabase -> Project Settings -> API Keys.',
    );
  }
  return {};
});
