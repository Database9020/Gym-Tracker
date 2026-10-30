import { supabase } from './supabase.js';
import { addDays } from './dates.js';

// ---------------------------------------------------------------------------
// Sync status — views listen for 'status' events to show Saved / Offline.
// ---------------------------------------------------------------------------
export const sync = new EventTarget();
let status = 'idle';
function setStatus(s) {
  status = s;
  sync.dispatchEvent(new CustomEvent('status', { detail: s }));
}
export const getStatus = () => status;

// ---------------------------------------------------------------------------
// Local storage helpers (never trusted to exist — private mode etc.)
// ---------------------------------------------------------------------------
function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

let userId = null;
export async function getUserId() {
  if (userId) return userId;
  const { data } = await supabase.auth.getSession();
  userId = data.session?.user?.id ?? null;
  return userId;
}
export function clearUser() {
  userId = null;
  workoutIds = {};
  writeLS(WID_KEY, {});
}

// Supabase returns at most 1000 rows per request, so page through everything.
async function fetchAll(build) {
  const size = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < size) return rows;
    from += size;
  }
}

// ---------------------------------------------------------------------------
// Outbox: every edit is written here first, then pushed to Supabase.
// If the gym has no signal, edits wait here and sync when back online.
// ---------------------------------------------------------------------------
const OUTBOX_KEY = 'gt.outbox';
const WID_KEY = 'gt.workoutIds';
let outbox = readLS(OUTBOX_KEY, {});
let workoutIds = readLS(WID_KEY, {});
let seq = 0;

const setKey = (date, bodyPart, exercise, setNumber) => `${date}|${bodyPart}|${exercise}|${setNumber}`;

export function queueSet({ date, bodyPart, exercise, setNumber, weight, reps }) {
  outbox[setKey(date, bodyPart, exercise, setNumber)] = {
    date, bodyPart, exercise, setNumber, weight, reps, v: `${Date.now()}-${++seq}`,
  };
  writeLS(OUTBOX_KEY, outbox);
  setStatus('saving');
  scheduleFlush(500);
}

let flushTimer = null;
let flushing = false;
let flushAgain = false;

function scheduleFlush(ms) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

async function ensureWorkout(date, bodyPart) {
  const k = `${date}|${bodyPart}`;
  if (workoutIds[k]) return workoutIds[k];
  const uid = await getUserId();
  const { data, error } = await supabase
    .from('workouts')
    .upsert({ user_id: uid, date, body_part: bodyPart }, { onConflict: 'user_id,date,body_part' })
    .select('id')
    .single();
  if (error) throw error;
  workoutIds[k] = data.id;
  writeLS(WID_KEY, workoutIds);
  return data.id;
}

export async function flush() {
  if (flushing) {
    flushAgain = true;
    return;
  }
  const entries = Object.entries(outbox);
  if (!entries.length) {
    if (status === 'saving' || status === 'offline') setStatus('saved');
    return;
  }
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  flushing = true;
  try {
    const uid = await getUserId();
    if (!uid) throw new Error('Not signed in');
    for (const [k, e] of entries) {
      const workoutId = await ensureWorkout(e.date, e.bodyPart);
      const empty = e.weight == null && e.reps == null;
      const q = empty
        ? supabase.from('sets').delete()
            .eq('workout_id', workoutId).eq('exercise', e.exercise).eq('set_number', e.setNumber)
        : supabase.from('sets').upsert(
            {
              user_id: uid, workout_id: workoutId, exercise: e.exercise, set_number: e.setNumber,
              weight_kg: e.weight, reps: e.reps, updated_at: new Date().toISOString(),
            },
            { onConflict: 'workout_id,exercise,set_number' },
          );
      const { error } = await q;
      if (error) {
        // A cached workout id may point at a deleted row; forget it and retry later.
        if (error.code === '23503') delete workoutIds[`${e.date}|${e.bodyPart}`];
        throw error;
      }
      // Only clear the entry if it wasn't edited again while we were saving.
      if (outbox[k]?.v === e.v) {
        delete outbox[k];
        writeLS(OUTBOX_KEY, outbox);
      }
    }
    setStatus(Object.keys(outbox).length ? 'saving' : 'saved');
  } catch (err) {
    console.warn('Sync failed, will retry', err);
    setStatus(navigator.onLine ? 'error' : 'offline');
    scheduleFlush(8000);
  } finally {
    flushing = false;
    if (flushAgain) {
      flushAgain = false;
      scheduleFlush(50);
    }
  }
}

window.addEventListener('online', () => scheduleFlush(200));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleFlush(200);
});

export const hasPending = () => Object.keys(outbox).length > 0;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
const num = (v) => (v == null ? null : Number(v));

/**
 * Everything the day screen needs for one date + body part:
 *  values: { [exercise]: { [setNumber]: { weight, reps } } }   — this session
 *  last:   { [exercise]: { date, sets: { [setNumber]: { weight, reps } } } } — previous session
 */
export async function loadDay(date, bodyPart, exercises) {
  const values = {};
  const last = {};

  const { data: workout, error } = await supabase
    .from('workouts')
    .select('id, sets(exercise, set_number, weight_kg, reps)')
    .eq('date', date)
    .eq('body_part', bodyPart)
    .maybeSingle();
  if (error) throw error;
  if (workout) {
    workoutIds[`${date}|${bodyPart}`] = workout.id;
    writeLS(WID_KEY, workoutIds);
    for (const s of workout.sets) {
      (values[s.exercise] ??= {})[s.set_number] = { weight: num(s.weight_kg), reps: num(s.reps) };
    }
  }

  // Previous sessions for these exercises (last 12 months is plenty for "what to beat").
  const history = await fetchAll(() =>
    supabase
      .from('sets')
      .select('exercise, set_number, weight_kg, reps, workouts!inner(date)')
      .in('exercise', exercises)
      .lt('workouts.date', date)
      .gte('workouts.date', addDays(date, -365)),
  );
  for (const s of history) {
    const d = s.workouts.date;
    const cur = last[s.exercise];
    if (!cur || d > cur.date) last[s.exercise] = { date: d, sets: {} };
    if (last[s.exercise].date === d) {
      last[s.exercise].sets[s.set_number] = { weight: num(s.weight_kg), reps: num(s.reps) };
    }
  }

  // Unsynced local edits win over what the server has.
  for (const e of Object.values(outbox)) {
    if (e.date === date && e.bodyPart === bodyPart) {
      (values[e.exercise] ??= {})[e.setNumber] = { weight: e.weight, reps: e.reps };
    }
  }
  return { values, last };
}

/** Body parts that already have a workout on this date. */
export async function bodyPartsOn(date) {
  const { data, error } = await supabase.from('workouts').select('body_part').eq('date', date);
  if (error) throw error;
  return data.map((r) => r.body_part);
}

/** All sessions for a body part, oldest first: [{ date, sets: [{exercise, setNumber, weight, reps}] }] */
export async function loadProgress(bodyPart) {
  const rows = await fetchAll(() =>
    supabase
      .from('workouts')
      .select('date, sets(exercise, set_number, weight_kg, reps)')
      .eq('body_part', bodyPart)
      .order('date', { ascending: true }),
  );
  return rows.map((w) => ({
    date: w.date,
    sets: w.sets.map((s) => ({
      exercise: s.exercise, setNumber: s.set_number, weight: num(s.weight_kg), reps: num(s.reps),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Day preferences (which body part each weekday is set to)
// ---------------------------------------------------------------------------
const PREF_KEY = 'gt.dayPrefs';

export function cachedDayPreference(weekday) {
  return readLS(PREF_KEY, {})[weekday] ?? null;
}

export async function getDayPreference(weekday) {
  const { data, error } = await supabase
    .from('day_preferences').select('body_part').eq('weekday', weekday).maybeSingle();
  if (error) throw error;
  const bp = data?.body_part ?? null;
  const prefs = readLS(PREF_KEY, {});
  if (bp) prefs[weekday] = bp;
  writeLS(PREF_KEY, prefs);
  return bp;
}

export async function setDayPreference(weekday, bodyPart) {
  const prefs = readLS(PREF_KEY, {});
  prefs[weekday] = bodyPart;
  writeLS(PREF_KEY, prefs);
  const uid = await getUserId();
  const { error } = await supabase
    .from('day_preferences')
    .upsert({ user_id: uid, weekday, body_part: bodyPart }, { onConflict: 'user_id,weekday' });
  if (error) console.warn('Could not save day preference', error);
}

/** Fetch every weekday's preference at once (for the home screen tags). */
export async function refreshDayPreferences() {
  const { data, error } = await supabase.from('day_preferences').select('weekday, body_part');
  if (error) throw error;
  const prefs = {};
  for (const r of data) prefs[r.weekday] = r.body_part;
  writeLS(PREF_KEY, prefs);
  return prefs;
}
