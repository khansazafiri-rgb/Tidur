export const UNI_NAMES = { UNAIR: 'Universitas Airlangga', UGM: 'Universitas Gadjah Mada', UI: 'Universitas Indonesia' };
export const UNIS = ['UNAIR', 'UGM', 'UI'];

export const DIFF_LABEL = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' };

export function pct(x, digits = 0) {
  if (x == null || Number.isNaN(x)) return '–';
  return `${(x * 100).toFixed(digits).replace('.', ',')}%`;
}

export function num(n) {
  return new Intl.NumberFormat('id-ID').format(n ?? 0);
}

export function duration(ms) {
  if (!ms && ms !== 0) return '–';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} j ${m} mnt`;
  if (m) return `${m} mnt ${sec} dtk`;
  return `${sec} dtk`;
}

export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export function dateId(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '–';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return new Intl.DateTimeFormat('id-ID', opts).format(d);
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 864e5);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export function scoreCategory(score) {
  if (score >= 85) return { label: 'Siap', tone: 'success' };
  if (score >= 70) return { label: 'Bagus', tone: 'info' };
  if (score >= 50) return { label: 'Cukup', tone: 'warn' };
  return { label: 'Perlu banyak latihan', tone: 'danger' };
}
