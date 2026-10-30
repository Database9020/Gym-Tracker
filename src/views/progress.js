import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js';
import { EXERCISES, BODY_PARTS } from '../config/exercises.js';
import { loadProgress } from '../lib/data.js';
import { addDays, todayKey, fmtShort, fmtFull } from '../lib/dates.js';
import { icons, esc } from '../ui/icons.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

const C = {
  crimson: '#A3142A',
  gold: '#C8A96A',
  text: '#F2ECE6',
  text2: '#A39A94',
  text3: '#6F6763',
  grid: 'rgba(200, 169, 106, 0.08)',
  surface: '#171112',
};

const RANGES = [
  { id: '4w', label: '4 weeks', days: 28 },
  { id: '3m', label: '3 months', days: 91 },
  { id: '6m', label: '6 months', days: 182 },
  { id: 'all', label: 'All', days: null },
];

const LS = { bp: 'gt.progress.bp', range: 'gt.progress.range', metric: 'gt.progress.metric' };
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const kg = (n) => `${Math.round(n * 10) / 10}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const valid = (s) => s.weight != null && s.reps != null && s.reps > 0;
const epley = (w, r) => w * (1 + r / 30);

// ---- Aggregation (empty / half-filled sets are ignored everywhere) ----
function volumeSeries(sessions) {
  return sessions
    .map((s) => {
      const sets = s.sets.filter(valid);
      return {
        date: s.date,
        value: sets.reduce((sum, x) => sum + x.weight * x.reps, 0),
        sets: sets.length,
        exercises: new Set(sets.map((x) => x.exercise)).size,
      };
    })
    .filter((p) => p.sets > 0);
}

function exerciseSeries(sessions, exercise, metric) {
  const out = [];
  for (const s of sessions) {
    const sets = s.sets.filter((x) => x.exercise === exercise && valid(x));
    if (!sets.length) continue;
    let best;
    if (metric === 'e1rm') {
      best = sets.reduce((a, b) => (epley(b.weight, b.reps) > epley(a.weight, a.reps) ? b : a));
      out.push({ date: s.date, value: epley(best.weight, best.reps), weight: best.weight, reps: best.reps });
    } else {
      best = sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
      out.push({ date: s.date, value: best.weight, weight: best.weight, reps: best.reps });
    }
  }
  return out;
}

// ---- Chart factory ----
function lineChart(canvas, points, { fill, detail, tooltipLines }) {
  const ctx = canvas.getContext('2d');
  let background = 'transparent';
  if (fill) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight);
    g.addColorStop(0, 'rgba(163, 20, 42, 0.35)');
    g.addColorStop(1, 'rgba(163, 20, 42, 0)');
    background = g;
  }
  const showDetail = (i) => {
    detail.innerHTML = tooltipLines(points[i]).html;
  };
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => fmtShort(p.date)),
      datasets: [{
        data: points.map((p) => Math.round(p.value * 10) / 10),
        borderColor: C.crimson,
        borderWidth: 2,
        backgroundColor: background,
        fill: Boolean(fill),
        tension: 0.25,
        cubicInterpolationMode: 'monotone',
        pointBackgroundColor: C.gold,
        pointBorderColor: C.surface,
        pointBorderWidth: 2,
        pointRadius: points.length > 40 ? 3 : 5,
        pointHoverRadius: 8,
        pointHitRadius: 18,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      layout: { padding: { top: 8, right: 6 } },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      events: ['click', 'touchstart', 'mousemove', 'mouseout'],
      onClick: (_, els) => els.length && showDetail(els[0].index),
      scales: {
        x: {
          grid: { color: C.grid, drawTicks: false },
          border: { color: 'rgba(200, 169, 106, 0.18)' },
          ticks: { color: C.text3, font: { family: 'Inter', size: 11 }, maxRotation: 0, autoSkipPadding: 14, padding: 8 },
        },
        y: {
          beginAtZero: false,
          grace: '8%',
          grid: { color: C.grid, drawTicks: false },
          border: { display: false },
          ticks: { color: C.text3, font: { family: 'Inter', size: 11 }, padding: 8, maxTicksLimit: 5, callback: (v) => kg(v) },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14, 11, 11, 0.95)',
          borderColor: 'rgba(200, 169, 106, 0.4)',
          borderWidth: 1,
          titleColor: C.gold,
          bodyColor: C.text,
          titleFont: { family: 'Inter', weight: '600', size: 12 },
          bodyFont: { family: 'Inter', size: 13 },
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: (items) => fmtFull(points[items[0].dataIndex].date),
            label: (item) => tooltipLines(points[item.dataIndex]).lines,
          },
        },
      },
    },
  });
  // Show the most recent session by default.
  if (points.length) showDetail(points.length - 1);
  return chart;
}

export async function renderProgress(app) {
  let bodyPart = lsGet(LS.bp, '');
  if (!BODY_PARTS.includes(bodyPart)) bodyPart = '';
  let range = lsGet(LS.range, '3m');
  let metric = lsGet(LS.metric, 'heaviest');
  let sessions = null;
  let charts = [];
  let token = 0;

  app.innerHTML = `
    <main class="page">
      <div class="topbar">
        <button class="back" aria-label="Back to week">${icons.back}</button>
        <div class="titles"><h1>Progress</h1><div class="sub">Your history, session by session</div></div>
      </div>
      <div class="controls">
        <div>
          <label class="field-label" for="pbp">Body part</label>
          <div class="select-wrap">
            <select id="pbp">
              <option value="" disabled>Choose a body part</option>
              ${BODY_PARTS.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="seg" data-group="range">
          ${RANGES.map((r) => `<button data-v="${r.id}">${r.label}</button>`).join('')}
        </div>
      </div>
      <section class="charts"></section>
    </main>`;

  const select = app.querySelector('#pbp');
  const out = app.querySelector('.charts');
  select.value = bodyPart;
  app.querySelector('.back').addEventListener('click', () => (location.hash = '#/'));

  const markSeg = () => {
    app.querySelectorAll('.seg').forEach((seg) => {
      const val = seg.dataset.group === 'range' ? range : metric;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val));
    });
  };

  function destroyCharts() {
    charts.forEach((c) => c.destroy());
    charts = [];
  }

  function draw() {
    destroyCharts();
    if (!bodyPart) {
      out.innerHTML = `<div class="empty-state">Choose a body part to see your progress.</div>`;
      return;
    }
    if (!sessions) {
      out.innerHTML = `<div class="loading">Loading…</div>`;
      return;
    }
    const days = RANGES.find((r) => r.id === range)?.days;
    const from = days ? addDays(todayKey(), -days) : null;
    const inRange = from ? sessions.filter((s) => s.date >= from) : sessions;

    const exercises = EXERCISES[bodyPart] ?? [];
    const vol = volumeSeries(inRange);
    const metricLabel = metric === 'e1rm' ? 'Estimated 1 rep max' : 'Heaviest weight';

    out.innerHTML = `
      <article class="card chart-card">
        <h2>Total volume</h2>
        <div class="kicker">Weight × reps, all ${esc(bodyPart.toLowerCase())} sets per session (kg)</div>
        ${vol.length
          ? `<div class="chart-box"><canvas id="vol"></canvas></div><div class="point-detail" id="vol-d"></div>`
          : `<div class="no-data">No sessions logged yet</div>`}
      </article>
      <div class="section-title">Exercises</div>
      <div class="seg" data-group="metric" style="margin-top:12px">
        <button data-v="heaviest">Heaviest weight</button>
        <button data-v="e1rm">Est. 1 rep max</button>
      </div>
      ${exercises.map((ex, i) => `
        <article class="card chart-card">
          <h2>${esc(ex)}</h2>
          <div class="kicker">${metricLabel} per session (kg)</div>
          <div data-ex-slot="${i}"></div>
        </article>`).join('')}`;

    markSeg();

    if (vol.length) {
      charts.push(lineChart(out.querySelector('#vol'), vol, {
        fill: true,
        detail: out.querySelector('#vol-d'),
        tooltipLines: (p) => ({
          lines: [`${kg(p.value)} kg total`, `${p.sets} sets · ${p.exercises} exercises`],
          html: `${fmtFull(p.date)} · <b>${kg(p.value)} kg</b> · ${p.sets} sets`,
        }),
      }));
    }

    exercises.forEach((ex, i) => {
      const slot = out.querySelector(`[data-ex-slot="${i}"]`);
      const pts = exerciseSeries(inRange, ex, metric);
      if (!pts.length) {
        slot.innerHTML = `<div class="no-data">No sessions logged yet</div>`;
        return;
      }
      slot.innerHTML = `<div class="chart-box small"><canvas></canvas></div><div class="point-detail"></div>`;
      charts.push(lineChart(slot.querySelector('canvas'), pts, {
        detail: slot.querySelector('.point-detail'),
        tooltipLines: (p) => metric === 'e1rm'
          ? {
              lines: [`Est. 1RM ${kg(p.value)} kg`, `Best set ${kg(p.weight)} kg × ${p.reps}`],
              html: `${fmtFull(p.date)} · <b>${kg(p.value)} kg</b> e1RM · from ${kg(p.weight)} × ${p.reps}`,
            }
          : {
              lines: [`${kg(p.weight)} kg × ${p.reps} reps`],
              html: `${fmtFull(p.date)} · <b>${kg(p.weight)} kg</b> × ${p.reps}`,
            },
      }));
    });
  }

  async function load() {
    const t = ++token;
    sessions = null;
    draw();
    if (!bodyPart) return;
    try {
      const data = await loadProgress(bodyPart);
      if (t !== token) return;
      sessions = data;
      draw();
    } catch (err) {
      console.error(err);
      if (t === token) out.innerHTML = `<div class="empty-state">Couldn't load. Check your connection.</div>`;
    }
  }

  select.addEventListener('change', () => {
    bodyPart = select.value;
    lsSet(LS.bp, bodyPart);
    load();
  });
  app.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg button');
    if (!btn) return;
    const group = btn.closest('.seg').dataset.group;
    if (group === 'range') {
      range = btn.dataset.v;
      lsSet(LS.range, range);
    } else {
      metric = btn.dataset.v;
      lsSet(LS.metric, metric);
    }
    draw();
  });

  markSeg();
  load();

  return destroyCharts;
}
