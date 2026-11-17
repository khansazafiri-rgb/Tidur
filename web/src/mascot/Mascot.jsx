import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { usePrefs } from '../lib/prefs.jsx';
import { useAuth } from '../lib/auth.jsx';
import { get } from '../lib/api.js';
import { MascotPanel } from './MascotPanel.jsx';
import {
  config, assetUrls, stateDef, ensureKeyframes, eventPriority, ruleFor, preloadState, LIKELY_NEXT,
} from './engine.js';

// ------------------------------------------------------------------ pesan gelembung

export const TIPS = [
  'Baca pertanyaannya dulu, baru bacaannya. Lebih hemat waktu!',
  'Soal barisan: cek selisih, lalu selisih dari selisihnya.',
  'Ragu? Tandai dulu, lanjut, lalu kembali di akhir.',
  'Analogi: ucapkan hubungannya dalam satu kalimat.',
  'Silogisme: gambar diagram Venn kecil di kertas coretan.',
  '10 soal sehari lebih baik daripada 100 soal sekali seminggu.',
  'Baca pembahasan soal yang benar juga. Kadang benarnya kebetulan.',
];
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
const MESSAGES = {
  first_page_visit: () => pick(['Halo! Siap latihan hari ini?', 'Hai! Aku temani belajarmu ya.', 'Halo, calon dokter!']),
  mascot_click: () => null,
  answer_correct: () => pick(['Mantap, benar!', 'Tepat sekali!', 'Keren, lanjut!']),
  answer_wrong: () => pick(['Nggak apa-apa, baca pembahasannya ya.', 'Hampir! Cek lagi polanya.', 'Salah itu bagian dari belajar.']),
  lesson_completed: () => 'Sesi selesai! Bangga sama kamu.',
  connection_lost: () => 'Koneksi terputus. Jawabanmu tetap aman.',
  connection_restored: () => 'Sudah online lagi!',
};

// ------------------------------------------------------------------ konteks

const MascotCtx = createContext(null);
const cooldownMs = config.interactionRules?.interactionCooldownMs ?? 1500;

export function MascotProvider({ enabled = true, children }) {
  const location = useLocation();
  const [view, setView] = useState({ state: 'idle', seq: 0, bubble: null, timed: false });
  const [confettiKey, setConfettiKey] = useState(0);
  const [context, setContextState] = useState({ name: null, minimize: false, staticMotion: false, reactions: true, bottom: null });
  const [emptyStates, setEmptyStates] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [assist, setAssistState] = useState(null);   // bantuan khusus halaman (mis. petunjuk soal)
  const [daily, setDaily] = useState(null);           // misi harian & streak
  const [nudge, setNudge] = useState(null);           // pesan proaktif yang belum dibaca
  const { user } = useAuth();

  const ctxPathRef = useRef(null);      // path halaman yang terakhir memasang konteks
  const baseRef = useRef('idle');       // state persisten (bukan yang berdurasi)
  const timedRef = useRef(null);        // { event, until, timer }
  const lastClickRef = useRef(0);
  const visitedRef = useRef(new Set()); // untuk oncePerPageVisit
  const bubbleTimer = useRef(null);

  useEffect(() => { ensureKeyframes(); preloadState('idle'); }, []);

  const show = useCallback((state, bubble, bubbleMs, timed = false) => {
    setView((v) => ({ state, seq: v.seq + 1, bubble: bubble ?? null, timed }));
    clearTimeout(bubbleTimer.current);
    if (bubble) bubbleTimer.current = setTimeout(() => setView((v) => ({ ...v, bubble: null })), bubbleMs || 3600);
  }, []);

  const resolveReturn = (returnTo, previous) => {
    if (!returnTo) return baseRef.current;
    if (returnTo === 'previous') return previous;
    return returnTo;
  };

  /** Kirim event aplikasi ke maskot (aturan dari eventRules). */
  const emit = useCallback((event, opts = {}) => {
    const rule = ruleFor(event);
    if (!rule) return;
    const s = stateDef(rule.state);
    if (!s) return;
    if (event === 'mascot_click') {
      const now = Date.now();
      if (now - lastClickRef.current < cooldownMs) return;
      lastClickRef.current = now;
    }
    if (rule.oncePerPageVisit) {
      const key = `${event}:${opts.visitKey ?? ''}`;
      if (visitedRef.current.has(key)) return;
      visitedRef.current.add(key);
    }
    const message = opts.message !== undefined ? opts.message : MESSAGES[event]?.();

    // Hanya satu animasi state sekaligus. Event berprioritas lebih rendah tidak memotong state berdurasi.
    const playing = timedRef.current;
    if (playing && Date.now() < playing.until && eventPriority(event) > eventPriority(playing.event)) {
      if (!s.durationMs) baseRef.current = rule.state;
      return;
    }

    if (s.durationMs) {
      const previous = playing ? playing.previous : baseRef.current;
      clearTimeout(playing?.timer);
      const target = resolveReturn(rule.returnTo, previous);
      const timer = setTimeout(() => {
        timedRef.current = null;
        if (rule.returnTo && rule.returnTo !== 'previous') baseRef.current = target;
        show(target, null);
      }, s.durationMs);
      timedRef.current = { event, until: Date.now() + s.durationMs, timer, previous };
      if (s.confetti) setConfettiKey((k) => k + 1);
      show(rule.state, message, Math.max(s.durationMs + 800, 2600), true);
    } else {
      clearTimeout(playing?.timer);
      timedRef.current = null;
      baseRef.current = rule.state;
      show(rule.state, message);
    }
  }, [show]);

  /** Tampilkan gelembung tanpa event. Opsional: pose berdurasi singkat (prioritas terendah). */
  const say = useCallback((text, { state, ms = 4200 } = {}) => {
    const playing = timedRef.current;
    if (state && !(playing && Date.now() < playing.until)) {
      const back = baseRef.current;
      clearTimeout(playing?.timer);
      const timer = setTimeout(() => { timedRef.current = null; show(baseRef.current || back, null); }, ms);
      timedRef.current = { event: '__say', until: Date.now() + ms, timer, previous: back };
      show(state, text, ms + 400, true);
    } else {
      setView((v) => ({ ...v, bubble: text }));
      clearTimeout(bubbleTimer.current);
      bubbleTimer.current = setTimeout(() => setView((v) => ({ ...v, bubble: null })), ms);
    }
  }, [show]);

  /** Pose singkat tanpa gelembung (variasi idle). Tidak memotong reaksi yang sedang berjalan. */
  const playState = useCallback((state, ms) => {
    if (timedRef.current && Date.now() < timedRef.current.until) return;
    const back = baseRef.current;
    const timer = setTimeout(() => { timedRef.current = null; show(back, null); }, ms);
    timedRef.current = { event: '__idle', until: Date.now() + ms, timer, previous: back };
    show(state, null, 0, true);
  }, [show]);

  const refreshDaily = useCallback(() => {
    if (!user) { setDaily(null); return; }
    get('/me/daily').then(setDaily).catch(() => {});
  }, [user]);

  /** Halaman memberi tahu konteksnya (contextRules). */
  const setContext = useCallback((name, extra = {}) => {
    const rule = config.contextRules?.[name] || {};
    ctxPathRef.current = window.location.pathname;
    setContextState({
      name,
      minimize: !!rule.minimizeFloatingMascot,
      staticMotion: !!rule.disableDecorativeMotion,
      reactions: rule.allowAnswerReactions !== false,
      bottom: extra.bottom ?? null,
    });
    for (const st of LIKELY_NEXT[name] || []) preloadState(st);
    if (rule.state) {
      const s = stateDef(rule.state);
      if (s?.durationMs) {
        const ev = config.eventRules.find((r) => r.state === rule.state && r.oncePerPageVisit)?.event;
        if (ev) emit(ev, { visitKey: extra.visitKey });
      } else if (s) {
        clearTimeout(timedRef.current?.timer);
        timedRef.current = null;
        baseRef.current = rule.state;
        show(rule.state, null);
      }
    }
  }, [emit, show]);

  useEffect(() => { setPanelOpen(false); }, [location.pathname]);
  useEffect(() => { refreshDaily(); }, [refreshDaily, location.pathname]);

  // Sapaan proaktif sekali per sesi browser: sesi belum selesai, atau misi harian belum tercapai.
  useEffect(() => {
    if (!daily || !user?.onboarded || location.pathname.startsWith('/sesi') || location.pathname.startsWith('/tutorial')) return undefined;
    let key = null;
    let text = null;
    if (daily.active_session) { key = `sesi-${daily.active_session.id}`; text = 'Sesimu belum selesai. Ketuk aku untuk lanjut!'; }
    else if (daily.today_answered < daily.daily_goal) {
      key = `misi-${daily.week?.[6]?.day}`;
      const left = daily.daily_goal - daily.today_answered;
      text = daily.today_answered === 0 ? `Misi hari ini: ${daily.daily_goal} soal. Yuk mulai!` : `${left} soal lagi untuk misi hari ini!`;
    }
    if (!key) { setNudge(null); return undefined; }
    let seen = false;
    try { seen = sessionStorage.getItem(`iup-nudge-${key}`) === '1'; } catch { /* abaikan */ }
    setNudge(seen ? null : { key, text });
    if (seen) return undefined;
    const t = setTimeout(() => say(text, { ms: 5000 }), 2500);
    return () => clearTimeout(t);
  }, [daily, user, location.pathname, say]);

  const markNudgeSeen = useCallback(() => {
    if (!nudge) return;
    try { sessionStorage.setItem(`iup-nudge-${nudge.key}`, '1'); } catch { /* abaikan */ }
    setNudge(null);
  }, [nudge]);

  const setAssist = useCallback((a) => setAssistState(a), []);

  // Halaman tanpa konteks khusus kembali ke idle saat berpindah rute.
  // Efek halaman (anak) berjalan lebih dulu, jadi konteks yang baru dipasang tidak ikut dihapus.
  useEffect(() => {
    if (ctxPathRef.current === location.pathname) return;
    ctxPathRef.current = null;
    setContextState({ name: null, minimize: false, staticMotion: false, reactions: true, bottom: null });
    if (!timedRef.current) { baseRef.current = 'idle'; show('idle', null); }
  }, [location.pathname, show]);

  // Koneksi terputus/tersambung.
  useEffect(() => {
    const off = () => emit('connection_lost');
    const on = () => emit('connection_restored');
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    if (!navigator.onLine) off();
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, [emit]);

  const registerEmptyState = useCallback(() => {
    if (!config.contextRules?.emptyState?.disableFloatingDuplicate) return () => {};
    setEmptyStates((n) => n + 1);
    return () => setEmptyStates((n) => n - 1);
  }, []);

  const value = useMemo(() => ({
    enabled, view, emit, say, playState, setContext, context, confettiKey, emptyStates, registerEmptyState, visitKey: location.key,
    panelOpen, setPanelOpen, assist, setAssist, daily, refreshDaily, nudge, markNudgeSeen,
  }), [enabled, view, emit, say, playState, setContext, context, confettiKey, emptyStates, registerEmptyState, location.key,
    panelOpen, assist, setAssist, daily, refreshDaily, nudge, markNudgeSeen]);

  return <MascotCtx.Provider value={value}>{children}</MascotCtx.Provider>;
}

export function useMascot() {
  return useContext(MascotCtx) || {
    emit: () => {}, say: () => {}, playState: () => {}, setContext: () => {}, setAssist: () => {}, refreshDaily: () => {},
    setPanelOpen: () => {}, enabled: false, registerEmptyState: () => () => {},
  };
}

/** Pasang konteks halaman sekali saat halaman dibuka. */
export function useMascotContext(name, extra) {
  const m = useMascot();
  const bottom = extra?.bottom;
  useEffect(() => {
    m.setContext(name, { visitKey: m.visitKey, bottom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, m.visitKey, bottom]);
}

// ------------------------------------------------------------------ gambar dengan crossfade

/** Gambar pose dengan WebP + PNG cadangan; jatuh ke pose idle bila aset tidak tersedia. */
function PoseImage({ assetKey, visible, onLoad, alt = '', eager }) {
  const [failed, setFailed] = useState(false);
  const urls = assetUrls(failed ? 'idle' : assetKey) || assetUrls('idle');
  useEffect(() => { setFailed(false); }, [assetKey]);
  return (
    <picture>
      {urls.webp && <source srcSet={urls.webp} type="image/webp" />}
      <img
        src={urls.png}
        alt={alt}
        draggable="false"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ opacity: visible ? 1 : 0 }}
        onLoad={onLoad}
        onError={() => { if (!failed) setFailed(true); else onLoad?.(); }}
      />
    </picture>
  );
}

/** Dua lapisan gambar: pose baru dimuat di lapisan tersembunyi lalu di-crossfade. */
function CrossfadeStage({ assetKey, alt, eager }) {
  const [layers, setLayers] = useState([{ key: assetKey, id: 0 }, null]);
  const [front, setFront] = useState(0);
  const pending = useRef(null);

  useEffect(() => {
    const cur = layers[front];
    if (cur && cur.key === assetKey) return;
    const back = 1 - front;
    pending.current = back;
    setLayers((l) => { const n = [...l]; n[back] = { key: assetKey, id: (l[back]?.id ?? 0) + 2 }; return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey]);

  return layers.map((l, i) => l && (
    <PoseImage
      key={`${i}-${l.id}`}
      assetKey={l.key}
      alt={i === front ? alt : ''}
      eager={eager}
      visible={i === front}
      onLoad={() => { if (pending.current === i) { pending.current = null; setFront(i); } }}
    />
  ));
}

// ------------------------------------------------------------------ maskot melayang

function useIsMobile() {
  const q = '(max-width: 640px)';
  const [m, setM] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export function FloatingMascot({ bottomNav = false }) {
  const m = useMascot();
  const { mascotHidden, setMascotHidden, reducedMotion } = usePrefs();
  const isMobile = useIsMobile();
  const stageRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);

  // Jeda saat tab tersembunyi (pauseWhenPageHidden) dan saat di luar layar (stopAnimationWhenOffscreen).
  useEffect(() => {
    if (!config.interactionRules?.pauseWhenPageHidden) return undefined;
    const on = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => {
    if (!config.interactionRules?.stopAnimationWhenOffscreen || !stageRef.current || !window.IntersectionObserver) return undefined;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(stageRef.current);
    return () => io.disconnect();
  }, [m.enabled, mascotHidden, m.emptyStates]);

  // Di ponsel maskot "mengintip" dari tepi kanan saat pengguna menggulir dan di layar soal,
  // lalu keluar penuh saat bereaksi atau disentuh, supaya tidak menutupi konten (avoidBlockingContent).
  const [scrolling, setScrolling] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [squish, setSquish] = useState(0);
  const [hearts, setHearts] = useState([]);
  useEffect(() => {
    if (!isMobile) return undefined;
    let t;
    const on = () => { setScrolling(true); setPeekOpen(false); clearTimeout(t); t = setTimeout(() => setScrolling(false), 1200); };
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); clearTimeout(t); };
  }, [isMobile]);
  useEffect(() => { setPeekOpen(false); }, [m.context.name]);

  // Variasi idle: sesekali melambai atau mengangguk supaya terasa hidup (bukan di layar soal).
  const quiet = m.context.name === 'quizPage' || m.context.minimize || m.panelOpen || reducedMotion;
  useEffect(() => {
    if (quiet || !m.enabled || mascotHidden) return undefined;
    const t = setInterval(() => {
      if (document.hidden || Math.random() < 0.4) return;
      m.playState(pick(['greeting', 'thinking', 'greeting']), 1600);
    }, 28000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiet, m.enabled, mascotHidden, m.playState]);

  // Tutup panel dengan Esc.
  useEffect(() => {
    if (!m.panelOpen) return undefined;
    const on = (e) => { if (e.key === 'Escape') m.setPanelOpen(false); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.panelOpen]);

  if (!m.enabled || mascotHidden || m.emptyStates > 0) return null;

  const { state, seq, bubble, timed } = m.view;
  const s = stateDef(state) || stateDef('idle');
  const p = config.placement;
  const minimized = m.context.minimize && !m.panelOpen;
  const size = minimized ? 64 : isMobile ? p.mobileSizePx : p.desktopSizePx;
  const motionOff = reducedMotion || m.context.staticMotion || minimized || (config.accessibility?.respectReducedMotion && reducedMotion);
  const animClass = motionOff ? '' : `mascot-a-${s.animation}`;
  // Di ponsel, maskot naik di atas navigasi bawah supaya tidak menutupinya.
  const bottom = m.context.bottom ?? (bottomNav && isMobile ? 76 : p.bottomOffsetPx);
  const tucked = isMobile && !minimized && !timed && !peekOpen && !m.panelOpen && (scrolling || m.context.name === 'quizPage');
  const showBadge = !!m.nudge && !m.panelOpen && !minimized;

  const tap = () => {
    if (tucked) { setPeekOpen(true); }
    setSquish((k) => k + 1);
    m.emit('mascot_click', { message: null });
    m.markNudgeSeen?.();
    m.setPanelOpen(!m.panelOpen);
  };
  const pet = () => {
    setSquish((k) => k + 1);
    const burst = Array.from({ length: 5 }, (_, i) => ({ id: `${Date.now()}-${i}`, hx: `${(Math.random() - 0.5) * 80}px`, delay: i * 90 }));
    setHearts((h) => [...h, ...burst]);
    setTimeout(() => setHearts((h) => h.filter((x) => !burst.includes(x))), 1500);
    m.say(pick(['Purrr... makasih!', 'Hehe, geli!', 'Meong! Semangat belajarnya ya!', 'Aku jadi makin semangat!']), { state: 'correctAnswer', ms: 1600 });
  };

  return (
    <>
      <div
        className={`mascot-float ${paused || offscreen ? 'mascot-paused' : ''} ${config.interactionRules?.hoverEnabledOnDesktop && !minimized ? 'mascot-hoverable' : ''}`}
        style={{
          '--mascot-size': `${size}px`, '--mascot-right': `${isMobile ? 12 : p.rightOffsetPx}px`, '--mascot-bottom': `${bottom}px`,
          transform: tucked ? 'translateX(68%)' : 'none', opacity: tucked ? 0.92 : 1, transition: 'transform 260ms ease-out, opacity 260ms ease-out',
        }}
      >
        {m.panelOpen && <MascotPanel onClose={() => m.setPanelOpen(false)} onPet={pet} onHide={() => { m.setPanelOpen(false); setMascotHidden(true); }} />}
        {bubble && !minimized && !tucked && !m.panelOpen && (
          <button type="button" onClick={tap} className="mascot-bubble text-left" aria-live="polite">{bubble}</button>
        )}
        <div ref={stageRef} className="mascot-stage">
          <button
            type="button"
            className="block h-full w-full rounded-full focus-visible:outline-offset-4"
            aria-label={m.panelOpen ? 'Tutup panel Oyen' : 'Oyen, maskot belajar. Tekan untuk membuka misi harian, petunjuk, dan tips.'}
            aria-expanded={m.panelOpen}
            onClick={tap}
          >
            <div key={`sq-${squish}`} className={`h-full w-full ${squish ? 'mascot-squish' : ''}`}>
              <div key={seq} className={`mascot-anim ${animClass}`}>
                <CrossfadeStage assetKey={s.asset} alt="" eager />
              </div>
            </div>
          </button>
          {hearts.map((h) => (
            <Heart key={h.id} className="mascot-heart h-6 w-6 fill-current" style={{ '--hx': h.hx, animationDelay: `${h.delay}ms` }} aria-hidden="true" />
          ))}
          {showBadge && <span className="mascot-badge" aria-hidden="true">1</span>}
        </div>
      </div>
      {m.confettiKey > 0 && !reducedMotion && <Confetti key={m.confettiKey} />}
    </>
  );
}

/** Spacer supaya maskot melayang tidak menutupi konten terakhir di halaman (avoidBlockingContent). */
export function MascotSpacer() {
  const m = useMascot();
  const { mascotHidden } = usePrefs();
  if (!m.enabled || mascotHidden || !config.placement?.avoidBlockingContent) return null;
  return <div aria-hidden="true" className="h-28 sm:h-10" />;
}

// ------------------------------------------------------------------ ilustrasi kontekstual

/**
 * Pose statis/beranimasi untuk layar kosong dan halaman khusus (contextRules.emptyState).
 * Selama tampil, maskot melayang disembunyikan agar tidak dobel.
 */
export function MascotPose({ pose, size = 200, className = '', alt = '', register = true }) {
  const m = useMascot();
  const { reducedMotion } = usePrefs();
  const s = stateDef(pose) || { asset: pose, animation: 'idleFloat' };
  useEffect(() => { ensureKeyframes(); return register ? m.registerEmptyState() : undefined; }, [m.registerEmptyState, register]);
  const anim = reducedMotion ? '' : `mascot-a-${s.animation}`;
  const urls = assetUrls(s.asset) || assetUrls('idle');
  return (
    <div className={`relative ${className}`} style={{ width: size, maxWidth: '80vw' }}>
      <div className={`mascot-anim ${anim}`}>
        <picture>
          {urls.webp && <source srcSet={urls.webp} type="image/webp" />}
          <img src={urls.png} alt={alt} className="h-auto w-full" loading="lazy" decoding="async" />
        </picture>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ konfeti

const CONFETTI_COLORS = ['rgb(var(--primary))', 'rgb(var(--accent))', 'rgb(var(--success))', 'rgb(var(--logika))', 'rgb(var(--numerik))', 'rgb(var(--verbal))'];

/** Konfeti kecil satu kali (tidak berulang, tidak berkedip). */
export function Confetti({ count = 28, durationMs }) {
  const dur = durationMs || stateDef('completed')?.durationMs || 1800;
  const [alive, setAlive] = useState(true);
  const pieces = useMemo(() => Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    dx: `${(Math.random() - 0.5) * 220}px`,
    rot: `${(Math.random() - 0.5) * 900}deg`,
    delay: Math.random() * 250,
    dur: dur * (0.8 + Math.random() * 0.5),
    color: pick(CONFETTI_COLORS),
  })), [count, dur]);
  useEffect(() => { const t = setTimeout(() => setAlive(false), dur * 1.5 + 300); return () => clearTimeout(t); }, [dur]);
  if (!alive) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}ms`, '--dx': p.dx, '--rot': p.rot, '--dur': `${p.dur}ms` }} />
      ))}
    </div>
  );
}
