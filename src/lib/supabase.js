import { createClient } from '@supabase/supabase-js';

// Tolerate common copy/paste slips in the Netlify env vars:
// surrounding quotes or spaces, a missing https://, or a trailing /rest/v1/.
const clean = (v) => (v ?? '').trim().replace(/^['"]|['"]$/g, '').trim();

function cleanUrl(v) {
  let u = clean(v);
  if (!u) return '';
  // A Postgres connection string (postgresql://...@db.<ref>.supabase.co:5432/postgres).
  const db = u.match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (db) return `https://${db[1]}.supabase.co`;
  // A dashboard link (supabase.com/dashboard/project/<ref>) instead of the API URL.
  const ref = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (ref) return `https://${ref[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
}

let rawUrl = clean(import.meta.env.VITE_SUPABASE_URL);
let rawKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);
// The two values pasted into each other's boxes.
const looksLikeKey = (v) => /^(eyJ|sb_)/.test(v);
if (looksLikeKey(rawUrl) && !looksLikeKey(rawKey)) [rawUrl, rawKey] = [rawKey, rawUrl];

const url = cleanUrl(rawUrl);
const key = rawKey;

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
export const supabaseUrl = url;
