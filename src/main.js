import './styles.css';
import { supabase, isConfigured, configError } from './lib/supabase.js';
import { clearUser, flush } from './lib/data.js';
import { renderHome } from './views/home.js';
import { renderDay } from './views/day.js';
import { renderProgress } from './views/progress.js';
import { renderLogin, renderNotConfigured, renderError } from './views/login.js';
import { hideTimer } from './ui/timer.js';

const app = document.getElementById('app');
let cleanup = null;
let showingLogin = false;

// Routes: #/  ·  #/day/YYYY-MM-DD  ·  #/progress
async function route() {
  try {
    await render();
  } catch (err) {
    console.error(err);
    renderError(app, err?.message || String(err));
  }
}

async function render() {
  if (cleanup) cleanup();
  cleanup = null;
  window.scrollTo(0, 0);

  if (!isConfigured) return renderNotConfigured(app);
  if (configError) return renderError(app, configError);

  const { data } = await supabase.auth.getSession();
  showingLogin = !data.session;
  if (showingLogin) {
    hideTimer();
    return renderLogin(app);
  }

  const hash = location.hash.replace(/^#/, '') || '/';
  const day = hash.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
  if (day) cleanup = await renderDay(app, day[1]);
  else if (hash === '/progress') {
    hideTimer();
    cleanup = await renderProgress(app);
  }
  else {
    hideTimer();
    cleanup = renderHome(app);
  }
}

window.addEventListener('hashchange', route);

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') clearUser();
    // SIGNED_IN also fires on tab refocus; only re-render when leaving the login screen.
    if ((event === 'SIGNED_IN' && showingLogin) || event === 'SIGNED_OUT') route();
  });
  flush();
}

// Never leave a blank screen: surface any startup crash.
window.addEventListener('error', (e) => {
  if (!app.childElementCount) renderError(app, e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (!app.childElementCount) renderError(app, e.reason?.message || String(e.reason));
});

route();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
