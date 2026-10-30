import { EXERCISES, BODY_PARTS, SETS_PER_EXERCISE } from '../config/exercises.js';
import { weekdayOf, fmtFull, fmtShort, DAY_NAMES } from '../lib/dates.js';
import {
  loadDay, queueSet, sync, getStatus, bodyPartsOn,
  cachedDayPreference, getDayPreference, setDayPreference,
} from '../lib/data.js';
import { startTimer } from '../ui/timer.js';
import { icons, esc } from '../ui/icons.js';

const fmtNum = (n) => (n == null ? '' : String(Number(n)));

function parseWeight(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
function parseReps(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function renderDay(app, date) {
  const weekday = weekdayOf(date);
  let bodyPart = cachedDayPreference(weekday);
  let loadToken = 0;
  let userPicked = false;

  app.innerHTML = `
    <main class="page">
      <div class="topbar">
        <button class="back" aria-label="Back to week">${icons.back}</button>
        <div class="titles">
          <h1>${DAY_NAMES[weekday - 1]}</h1>
          <div class="sub">${fmtFull(date)}</div>
        </div>
      </div>
      <label class="field-label" for="bp">Body part</label>
      <div class="select-wrap">
        <select id="bp">
          <option value="" disabled>Choose a body part</option>
          ${BODY_PARTS.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}
        </select>
      </div>
      <section class="exercises"></section>
    </main>
    <div class="save-pill"><span class="dot"></span><span class="txt">Saved</span></div>`;

  const select = app.querySelector('#bp');
  const list = app.querySelector('.exercises');
  const pill = app.querySelector('.save-pill');
  app.querySelector('.back').addEventListener('click', () => (location.hash = '#/'));

  // ---- Saved indicator ----
  let pillTimer = null;
  const labels = { saving: 'Saving…', saved: 'Saved', offline: 'Offline · will sync', error: 'Retrying…' };
  const onStatus = (e) => {
    const s = e.detail;
    if (!labels[s]) return;
    pill.className = `save-pill show ${s}`;
    pill.querySelector('.txt').textContent = labels[s];
    clearTimeout(pillTimer);
    if (s === 'saved') pillTimer = setTimeout(() => pill.classList.remove('show'), 1600);
  };
  sync.addEventListener('status', onStatus);
  if (getStatus() === 'offline') onStatus({ detail: 'offline' });

  // ---- Exercise list ----
  async function showExercises() {
    const token = ++loadToken;
    if (!bodyPart) {
      list.innerHTML = `<div class="empty-state">Choose a body part to begin.</div>`;
      return;
    }
    const exercises = EXERCISES[bodyPart] ?? [];
    list.innerHTML = `<div class="loading">Loading…</div>`;
    let data;
    try {
      data = await loadDay(date, bodyPart, exercises);
    } catch (err) {
      console.error(err);
      if (token === loadToken) list.innerHTML = `<div class="empty-state">Couldn't load. Check your connection.</div>`;
      return;
    }
    if (token !== loadToken) return;

    list.innerHTML = exercises
      .map((ex) => {
        const cur = data.values[ex] ?? {};
        const last = data.last[ex];
        const rows = Array.from({ length: SETS_PER_EXERCISE }, (_, i) => {
          const n = i + 1;
          const v = cur[n] ?? {};
          const p = last?.sets[n] ?? {};
          const w = fmtNum(v.weight);
          const r = fmtNum(v.reps);
          return `
            <div class="set-row">
              <div class="set-no">${n}</div>
              <input class="num${w ? ' filled' : ''}" data-ex="${esc(ex)}" data-set="${n}" data-f="weight"
                type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next"
                aria-label="${esc(ex)} set ${n} weight in kg"
                placeholder="${p.weight != null ? fmtNum(p.weight) : 'kg'}" value="${w}" />
              <input class="num${r ? ' filled' : ''}" data-ex="${esc(ex)}" data-set="${n}" data-f="reps"
                type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next"
                aria-label="${esc(ex)} set ${n} reps"
                placeholder="${p.reps != null ? fmtNum(p.reps) : 'reps'}" value="${r}" />
            </div>`;
        }).join('');
        return `
          <article class="card">
            <h2>${esc(ex)}</h2>
            <div class="meta">${last ? `Last time <b>${fmtShort(last.date)}</b> — beat the faded numbers` : 'First session — no history yet'}</div>
            <div class="divider"></div>
            <div class="set-head"><span></span><span>Weight kg</span><span>Reps</span></div>
            ${rows}
          </article>`;
      })
      .join('');
  }

  // ---- Autosave ----
  const timers = new Map();
  function save(input) {
    const { ex, set } = input.dataset;
    const row = input.closest('.set-row');
    const weight = parseWeight(row.querySelector('[data-f="weight"]').value);
    const reps = parseReps(row.querySelector('[data-f="reps"]').value);
    queueSet({ date, bodyPart, exercise: ex, setNumber: Number(set), weight, reps });
  }
  list.addEventListener('input', (e) => {
    const input = e.target.closest('.num');
    if (!input) return;
    input.classList.toggle('filled', input.value.trim() !== '');
    const key = `${input.dataset.ex}|${input.dataset.set}`;
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      save(input);
    }, 600));
  });
  list.addEventListener('change', (e) => {
    const input = e.target.closest('.num');
    if (!input) return;
    const key = `${input.dataset.ex}|${input.dataset.set}`;
    clearTimeout(timers.get(key));
    timers.delete(key);
    save(input);
    if (input.dataset.f === 'reps' && parseReps(input.value) != null) startTimer();
  });
  // "Next" on the keyboard moves to the following box.
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inputs = [...list.querySelectorAll('.num')];
    const i = inputs.indexOf(e.target);
    if (i >= 0) {
      e.preventDefault();
      (inputs[i + 1] ?? e.target).focus();
      if (!inputs[i + 1]) e.target.blur();
    }
  });

  // Save any edits still waiting on the debounce (before switching body part or leaving).
  function flushPending() {
    list.querySelectorAll('.num').forEach((input) => {
      const key = `${input.dataset.ex}|${input.dataset.set}`;
      if (!timers.has(key)) return;
      clearTimeout(timers.get(key));
      timers.delete(key);
      save(input);
    });
  }

  select.addEventListener('change', () => {
    flushPending();
    userPicked = true;
    bodyPart = select.value;
    setDayPreference(weekday, bodyPart);
    showExercises();
  });

  // ---- Initial body part: cached → server preference → whatever was logged that day ----
  select.value = bodyPart ?? '';
  showExercises();
  (async () => {
    try {
      let bp = await getDayPreference(weekday);
      if (!bp) bp = (await bodyPartsOn(date))[0] ?? null;
      if (!userPicked && bp && bp !== bodyPart && BODY_PARTS.includes(bp)) {
        flushPending();
        bodyPart = bp;
        select.value = bp;
        showExercises();
      }
    } catch {
      /* offline: keep the cached choice */
    }
  })();

  return () => {
    sync.removeEventListener('status', onStatus);
    flushPending();
  };
}
