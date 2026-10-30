import { icons } from './icons.js';

// Non-blocking rest timer pinned to the bottom of the screen.
const DEFAULT_SECONDS = 60;

let el = null;
let endAt = 0;
let total = DEFAULT_SECONDS;
let tick = null;

function build() {
  el = document.createElement('div');
  el.className = 'timer';
  el.setAttribute('role', 'timer');
  el.innerHTML = `
    <div class="bar"></div>
    <div>
      <div class="label">Rest</div>
      <div class="clock">1:00</div>
    </div>
    <div class="presets">
      <button class="chip" data-s="60">60s</button>
      <button class="chip" data-s="90">90s</button>
      <button class="chip" data-s="120">2m</button>
    </div>
    <button class="close" aria-label="Dismiss timer">${icons.close}</button>`;
  // Keep taps on the timer from stealing focus from the input being typed in.
  el.addEventListener('mousedown', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) startTimer(Number(chip.dataset.s));
    if (e.target.closest('.close')) hideTimer();
  });
  document.getElementById('timer-root').appendChild(el);
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function render() {
  const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  el.querySelector('.clock').textContent = fmt(left);
  el.querySelector('.bar').style.width = `${(left / total) * 100}%`;
  if (left === 0) {
    clearInterval(tick);
    tick = null;
    el.classList.add('done');
    el.querySelector('.label').textContent = 'Go';
    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]);
  }
}

export function startTimer(seconds = DEFAULT_SECONDS) {
  if (!el) build();
  total = seconds;
  endAt = Date.now() + seconds * 1000;
  el.classList.remove('done');
  el.querySelector('.label').textContent = 'Rest';
  el.classList.add('open');
  document.body.classList.add('timer-open');
  clearInterval(tick);
  tick = setInterval(render, 250);
  render();
}

export function hideTimer() {
  if (!el) return;
  clearInterval(tick);
  tick = null;
  el.classList.remove('open', 'done');
  document.body.classList.remove('timer-open');
}
