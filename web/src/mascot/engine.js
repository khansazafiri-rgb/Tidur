// Mesin maskot: membaca mascot-animation.json dan menurunkan keyframes CSS, aset, dan aturan event.
// Semua angka (durasi, easing, prioritas, cooldown) berasal dari file konfigurasi, tidak ditulis keras.
import config from './mascot-animation.json';

export { config };

/** URL aset pose. Format WebP transparan diutamakan, PNG disimpan sebagai cadangan. */
export function assetUrls(assetKey) {
  const file = config.assets[assetKey];
  if (!file) return null;
  const base = config.assets.basePath || '/mascot/';
  const png = base + file;
  return { webp: config.performance?.preferTransparentWebP ? png.replace(/\.png$/i, '.webp') : null, png };
}

export function stateDef(name) {
  return config.states[name] || null;
}

/** Bangun CSS @keyframes dan kelas animasi dari definisi frame. */
export function buildKeyframesCss() {
  let css = '';
  for (const [name, a] of Object.entries(config.animations)) {
    const frames = a.frames.map((f) => `${Math.round(f.at * 1000) / 10}%{transform:${f.transform}}`).join('');
    const iter = a.iterations === 'infinite' ? 'infinite' : Number(a.iterations) || 1;
    css += `@keyframes mascot-${name}{${frames}}`;
    css += `.mascot-a-${name}{animation:mascot-${name} ${a.durationMs}ms ${a.easing} ${iter} both}`;
  }
  return css;
}

let injected = false;
export function ensureKeyframes() {
  if (injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.id = 'mascot-keyframes';
  el.textContent = buildKeyframesCss();
  document.head.appendChild(el);
  injected = true;
}

const priorityList = config.interactionRules?.eventPriority || [];
/** Angka kecil = prioritas lebih tinggi. Event di luar daftar mendapat prioritas terendah. */
export function eventPriority(event) {
  const i = priorityList.indexOf(event);
  return i === -1 ? priorityList.length : i;
}

export function ruleFor(event) {
  return config.eventRules.find((r) => r.event === event) || null;
}

const preloaded = new Set();
export function preloadState(stateName) {
  const s = stateDef(stateName);
  if (!s) return;
  const u = assetUrls(s.asset);
  if (!u || preloaded.has(u.webp || u.png)) return;
  preloaded.add(u.webp || u.png);
  const img = new Image();
  img.decoding = 'async';
  img.src = u.webp || u.png;
}

// Pose yang paling mungkin muncul berikutnya untuk tiap konteks halaman.
export const LIKELY_NEXT = {
  landingPage: ['greeting'],
  learningPage: ['studying', 'greeting'],
  quizPage: ['thinking', 'correctAnswer', 'wrongAnswer', 'studying'],
  resultPage: ['completed'],
};
