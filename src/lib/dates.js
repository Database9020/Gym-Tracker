// All dates are handled as local calendar dates in 'YYYY-MM-DD' form,
// never via toISOString(), which would shift late-evening sessions into UTC.

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const pad = (n) => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

// 1 = Monday ... 7 = Sunday
export function weekdayOf(key) {
  return ((fromKey(key).getDay() + 6) % 7) + 1;
}

// The seven dates (Mon..Sun) of the current week.
export function currentWeek() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return DAY_NAMES.map((name, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { name, key: toKey(d), date: d };
  });
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export const fmtLong = (key) =>
  fromKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

export const fmtShort = (key) =>
  fromKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const fmtFull = (key) =>
  fromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
