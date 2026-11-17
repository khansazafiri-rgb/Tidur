import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpenCheck, ChevronRight, EyeOff, Flame, GraduationCap, Heart, Lightbulb, PlayCircle, Sparkles, Target, X, Zap } from 'lucide-react';
import { post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { MASCOT_NAME, hintFor } from '../components/learn.jsx';
import { useMascot, TIPS, pick } from './Mascot.jsx';
import { assetUrls } from './engine.js';

const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function Typed({ text }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) { setN(text.length); return undefined; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 2; setN(Math.min(i, text.length)); if (i >= text.length) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [text, reduced]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, n)}<span className={`caret ${n >= text.length ? 'done' : ''}`} /></span>
    </>
  );
}

function Action({ icon: Icon, tone, title, sub, onClick, to }) {
  const inner = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-display font-semibold leading-tight">{title}</span>
        {sub && <span className="block truncate text-meta text-muted">{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface px-3 py-2.5 shadow-[0_3px_0_rgb(var(--line-strong))] transition-transform hover:bg-sunken active:translate-y-[3px] active:shadow-none';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/** Panel asisten yang muncul saat Oyen diketuk. */
export function MascotPanel({ onClose, onPet, onHide }) {
  const m = useMascot();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [hintIdx, setHintIdx] = useState(-1);
  const [tip, setTip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const d = m.daily;
  const assist = m.assist;
  const onSession = loc.pathname.startsWith('/sesi/') && !loc.pathname.endsWith('/hasil');

  const greeting = useMemo(() => {
    if (!user) return `Halo! Aku ${MASCOT_NAME}, kucing dokter yang menemani latihan soal IUP. Mau lihat-lihat dulu?`;
    if (assist?.mode === 'ujian') return 'Mode ujian: aku diam dulu supaya kamu fokus. Semangat!';
    if (assist?.hintable) return 'Bingung dengan soal ini? Aku punya petunjuk cara berpikirnya, bukan jawabannya.';
    if (d?.active_session && !onSession) return 'Sesimu yang kemarin belum selesai. Mau lanjut sekarang?';
    if (d && d.today_answered >= d.daily_goal) return `Misi hari ini beres! Hebat, ${user.display_name}. Mau tambah sedikit lagi?`;
    if (d && d.today_answered > 0) return `${d.daily_goal - d.today_answered} soal lagi untuk misi hari ini. Kamu pasti bisa!`;
    return `Hai ${user.display_name}! Misi hari ini: ${d?.daily_goal || 10} soal. Yuk mulai dari yang paling perlu dilatih.`;
  }, [user, assist, d, onSession]);

  const hints = assist?.subtopic ? hintFor(assist.subtopic) : [];

  async function quickStart() {
    setBusy(true); setErr('');
    try {
      const body = d?.weakest ? { source: 'subtopic', subtopics: [d.weakest.code], count: 10, mode: 'santai', difficulty: 'mixed' } : null;
      if (!body) { nav('/kurikulum'); return; }
      const s = await post('/sessions', body);
      m.emit('study_started');
      onClose();
      nav(`/sesi/${s.id}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const avatar = assetUrls('idle');

  return (
    <section className="mascot-panel" role="dialog" aria-label={`Panel ${MASCOT_NAME}`}>
      <div className="flex items-start gap-3 bg-gradient-to-b from-accent-soft to-transparent px-4 pb-2 pt-4">
        <picture className="shrink-0">
          <source srcSet={avatar.webp} type="image/webp" />
          <img src={avatar.png} alt="" className="h-12 w-12 rounded-2xl border-2 border-accent/40 bg-surface object-contain p-0.5" />
        </picture>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-none">{MASCOT_NAME}</p>
          <p className="mt-1 text-sm font-semibold text-ink/85"><Typed text={greeting} /></p>
        </div>
        <button type="button" onClick={onClose} className="-m-1 rounded-xl p-1.5 text-muted hover:bg-sunken hover:text-ink" aria-label="Tutup panel">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-2">
        {user && d && assist?.mode !== 'ujian' && (
          <div className="rounded-2xl border-2 border-line bg-sunken/60 p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-xl bg-accent-soft px-2.5 py-1.5 text-accent-ink" title={`Streak: hari dengan minimal ${d.streak_min} soal`}>
                <Flame className={`h-5 w-5 fill-current ${d.streak > 0 ? 'flame' : 'opacity-50'}`} aria-hidden="true" />
                <span className="font-display text-lg font-semibold leading-none">{d.streak}</span>
                <span className="sr-only">hari berturut-turut</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-meta font-bold"><span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Misi hari ini</span><span>{Math.min(d.today_answered, d.daily_goal)}/{d.daily_goal}</span></div>
                <div className="bar mt-1 !h-3"><i className={d.today_answered >= d.daily_goal ? 'bg-success' : 'bg-accent'} style={{ width: `${Math.min(100, (d.today_answered / d.daily_goal) * 100) || 0}%` }} /></div>
              </div>
            </div>
            <ol className="mt-3 flex justify-between" aria-label="Tujuh hari terakhir">
              {d.week.map((w) => {
                const dt = new Date(`${w.day}T00:00:00`);
                return (
                  <li key={w.day} className="flex flex-col items-center gap-1 text-[0.7rem] font-bold text-muted">
                    <span className={`grid h-7 w-7 place-items-center rounded-full border-2 ${w.done ? 'border-accent bg-accent text-white' : w.n ? 'border-accent/50 bg-accent-soft text-accent-ink' : 'border-line bg-surface'}`}>
                      {w.done ? <Flame className="h-3.5 w-3.5 fill-current" /> : w.n || ''}
                    </span>
                    {DAY[dt.getDay()]}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {assist?.hintable && hints.length > 0 && (
          <div className="rounded-2xl border-2 border-warn/60 bg-warn-soft p-3">
            {hintIdx < 0 ? (
              <button type="button" className="btn-accent btn-sm w-full" onClick={() => setHintIdx(0)}><Lightbulb className="h-4 w-4" /> Minta petunjuk</button>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-display font-semibold text-warn-ink"><Lightbulb className="h-4 w-4" /> Petunjuk {hintIdx + 1} dari {hints.length}</p>
                <p className="mt-1 text-sm font-semibold"><Typed text={hints[hintIdx]} /></p>
                {hintIdx < hints.length - 1 && (
                  <button type="button" className="link mt-2 text-sm" onClick={() => setHintIdx(hintIdx + 1)}>Petunjuk berikutnya</button>
                )}
              </>
            )}
          </div>
        )}

        {tip && <p className="speech !py-2 text-sm font-semibold before:hidden"><Typed text={tip} /></p>}
        {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger-ink">{err}</p>}

        <div className="space-y-2">
          {!user && (
            <>
              <Action icon={Sparkles} tone="bg-primary-soft text-primary-ink" title="Daftar gratis" sub="Progresmu tersimpan di semua perangkat" to="/daftar" />
              <Action icon={GraduationCap} tone="bg-english-soft text-english-ink" title="Lihat format tes kampus" sub="UNAIR, UGM, dan UI" to="/panduan/UNAIR" />
            </>
          )}
          {user && d?.active_session && !onSession && (
            <Action icon={PlayCircle} tone="bg-accent-soft text-accent-ink" title="Lanjutkan sesi" sub={d.active_session.title} to={`/sesi/${d.active_session.id}`} />
          )}
          {user && !onSession && (
            <Action icon={Zap} tone="bg-success-soft text-success-ink" title={d?.weakest ? `Latih ${d.weakest.name}` : 'Pilih latihan'}
              sub={d?.weakest ? `Subtopik terlemahmu · 10 soal santai${busy ? ' · memulai…' : ''}` : 'Buka peta kurikulum'} onClick={quickStart} />
          )}
          <Action icon={BookOpenCheck} tone="bg-logika-soft text-logika-ink" title="Tips belajar" sub="Trik singkat dari Oyen" onClick={() => setTip(pick(TIPS.filter((t) => t !== tip)))} />
          <Action icon={Heart} tone="bg-verbal-soft text-verbal-ink" title={`Elus ${MASCOT_NAME}`} sub="Biar makin semangat" onClick={onPet} />
          {user && !onSession && <Action icon={GraduationCap} tone="bg-english-soft text-english-ink" title="Ulangi tutorial" sub="Cara memakai web ini" to="/tutorial" />}
        </div>
        <button type="button" onClick={onHide} className="flex w-full items-center justify-center gap-1.5 pt-1 text-meta font-bold text-muted hover:text-ink">
          <EyeOff className="h-3.5 w-3.5" /> Sembunyikan {MASCOT_NAME} (bisa dimunculkan lagi di Profil)
        </button>
      </div>
    </section>
  );
}
