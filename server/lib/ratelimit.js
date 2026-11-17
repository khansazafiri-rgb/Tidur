// Pembatas laju sederhana di memori (satu proses). Cukup untuk satu VPS.
const buckets = new Map();

export function rateLimit({ windowMs, max, key = 'ip', name }) {
  return (req, res, next) => {
    const id = key === 'user' && req.user ? `u:${req.user.id}` : `ip:${req.ip}`;
    const k = `${name}:${id}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || b.reset < now) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(k, b);
    }
    b.count++;
    if (b.count > max) {
      res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
      return res.status(429).json({ error: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.' });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();

export function resetRateLimits() {
  buckets.clear();
}
