import { supabase } from '../lib/supabase.js';
import { currentWeek, todayKey, fmtLong } from '../lib/dates.js';
import { cachedDayPreference, refreshDayPreferences } from '../lib/data.js';
import { icons, esc } from '../ui/icons.js';

export function renderHome(app) {
  const today = todayKey();
  const days = currentWeek()
    .map((d, i) => {
      const isToday = d.key === today;
      const pref = cachedDayPreference(i + 1);
      return `
        <button class="day-btn${isToday ? ' today' : ''}" data-date="${d.key}">
          <span>
            <div class="name">${d.name}</div>
            <div class="date">${isToday ? 'Today · ' : ''}${fmtLong(d.key)}</div>
          </span>
          <span class="right">
            ${pref ? `<span class="tag">${esc(pref)}</span>` : ''}
            <span class="chev">${icons.chevron}</span>
          </span>
        </button>`;
    })
    .join('');

  app.innerHTML = `
    <main class="page">
      <header class="masthead">
        <p class="eyebrow">This Week</p>
        <h1>Gym Journal</h1>
        <div class="rule"></div>
      </header>
      <nav class="days">${days}</nav>
      <button class="progress-btn">${icons.chart}<span>Progress</span></button>
      <button class="signout">Sign out</button>
    </main>`;

  app.querySelector('.days').addEventListener('click', (e) => {
    const btn = e.target.closest('.day-btn');
    if (btn) location.hash = `#/day/${btn.dataset.date}`;
  });
  app.querySelector('.progress-btn').addEventListener('click', () => (location.hash = '#/progress'));
  app.querySelector('.signout').addEventListener('click', () => supabase.auth.signOut());

  // Update the body-part tags with what's been chosen on other devices.
  refreshDayPreferences()
    .then((prefs) => {
      app.querySelectorAll('.day-btn').forEach((btn, i) => {
        const right = btn.querySelector('.right');
        right.querySelector('.tag')?.remove();
        if (prefs[i + 1]) right.insertAdjacentHTML('afterbegin', `<span class="tag">${esc(prefs[i + 1])}</span>`);
      });
    })
    .catch(() => {});
}
