import { createClient } from '@supabase/supabase-js';

// Tolerate common copy/paste slips in the Netlify env vars:
// surrounding quotes or spaces, a missing https://, or a trailing /rest/v1/.
const clean = (v) => (v ?? '').trim().replace(/^['"]|['"]$/g, '').trim();

function cleanUrl(v) {
  let u = clean(v);
  if (!u) return '';
  // A dashboard link (supabase.com/dashboard/project/<ref>) instead of the API URL.
  const ref = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (ref) return `https://${ref[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
}

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL);
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isConfigured = Boolean(url && key);
export let configError = null;

export let supabase = null;
if (isConfigured) {
  try {
    supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  } catch (err) {
    configError = `${err.message} (VITE_SUPABASE_URL is "${url}")`;
  }
}
