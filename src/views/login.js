import { supabase } from '../lib/supabase.js';

const masthead = `
  <header class="masthead">
    <p class="eyebrow">Private Members</p>
    <h1>Gym Journal</h1>
    <div class="rule"></div>
  </header>`;

export function renderLogin(app) {
  app.innerHTML = `
    <main class="page login">
      ${masthead}
      <form novalidate>
        <input class="text-input" type="email" name="email" placeholder="Email" autocomplete="username" required />
        <input class="text-input" type="password" name="password" placeholder="Password" autocomplete="current-password" required />
        <button class="primary" type="submit">Enter</button>
        <div class="error-msg" role="alert"></div>
      </form>
    </main>`;
  const form = app.querySelector('form');
  const err = app.querySelector('.error-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    err.textContent = '';
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.password.value,
    });
    btn.disabled = false;
    if (error) err.textContent = error.message;
  });
}

export function renderNotConfigured(app) {
  app.innerHTML = `
    <main class="page login">
      ${masthead}
      <p class="notice">Supabase isn't connected yet.<br />
      Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
      in Netlify's environment variables, then redeploy.</p>
    </main>`;
}
