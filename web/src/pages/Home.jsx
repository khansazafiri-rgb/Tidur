import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Bookmark, CalendarDays, CheckCircle2, Crown, Flame, GraduationCap, Lock, PlayCircle, Settings2, Star, Target, Timer, X, Zap,
} from 'lucide-react';
import { get, post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { daysUntil, greeting, num, pct, dateId } from '../lib/format.js';
import { Alert, Button, ErrorState, PageSkeleton, ProgressBar, Ring } from '../components/ui.jsx';
import { SubtopicIcon, UnitImage, toneOf, MASCOT_NAME } from '../components/learn.jsx';
import { MascotPose, useMascot, useMascotContext } from '../mascot/Mascot.jsx';
import { assetUrls } from '../mascot/engine.js';

const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const ZIG = [0, 48, 72, 48, 0, -48, -72, -48];

function mastery(s) {
  if (!s.answered) return 0;
  if (s.answered >= 10 && s.accuracy >= 0.8) return 3;
  if (s.answered >= 10 && s.accuracy >= 0.6) return 2;
  return 1;
}

// ------------------------------------------------------------------ misi harian

function DailyCard({ daily }) {
  const done = daily.today_answered >= daily.daily_goal;
  const p = Math.min(1, daily.today_answered / daily.daily_goal);
  return (
    <section className="card p-4" aria-labelledby="misi">
      <div className="flex items-center justify-between">
        <h2 id="misi" className="flex items-center gap-2 font-display text-xl font-semibold"><Target className="h-5 w-5 text-accent" /> Misi hari ini</h2>
        <span className="flex items-center gap-1 rounded-xl bg-accent-soft px-2.5 py-1 font-display font-semibold text-accent-ink" title={`Streak: hari dengan minimal ${daily.streak_min} soal`}>
          <Flame className={`h-5 w-5 fill-current ${daily.streak ? 'flame' : 'opacity-50'}`} /> {daily.streak}<span className="sr-only"> hari berturut-turut</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Ring value={p} size={72} stroke={9} tone={done ? 'rgb(var(--success))' : 'rgb(var(--accent))'} label={`${daily.today_answered} dari ${daily.daily_goal} soal`}>
          <span className="font-display text-base">{done ? <CheckCircle2 className="h-7 w-7 text-success" /> : `${Math.round(p * 100)}%`}</span>
        </Ring>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-tight">{done ? 'Misi selesai!' : `Jawab ${daily.daily_goal} soal`}</p>
          <p className="text-sm text-muted">{done ? 'Mantap. Streak-mu aman hari ini.' : `${daily.today_answered} sudah, ${daily.daily_goal - daily.today_answered} lagi.`}</p>
        </div>
      </div>
      <ol className="mt-4 flex justify-between" aria-label="Tujuh hari terakhir">
        {daily.week.map((w, i) => {
          const d = new Date(`${w.day}T00:00:00`);
          const today = i === 6;
          return (
            <li key={w.day} className={`flex flex-col items-center gap-1 text-[0.72rem] font-bold ${today ? 'text-ink' : 'text-muted'}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-full border-2 ${w.done ? 'border-accent bg-accent text-white' : w.n ? 'border-accent/60 bg-accent-soft text-accent-ink' : 'border-line bg-surface'} ${today ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-surface' : ''}`}>
                {w.done ? <Flame className="h-4 w-4 fill-current" /> : w.n || ''}
              </span>
              {DAY[d.getDay()]}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-meta text-muted">Api menyala di hari kamu menjawab minimal {daily.streak_min} soal.</p>
    </section>
  );
}

// ------------------------------------------------------------------ jalur belajar

function NodePopover({ s, tone, onClose, onStart, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('pointerdown', on), 0);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', on); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <div className="absolute left-1/2 top-[124px] z-30 w-[min(300px,calc(100%-8px))] -translate-x-1/2">
    <div ref={ref} className={`pop-in rounded-3xl border-2 p-4 text-left ${tone.bg}`}
      style={{ borderColor: `rgb(${tone.lip})`, boxShadow: `0 5px 0 rgb(${tone.lip})` }} role="dialog" aria-label={s.name}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-display text-xl font-semibold ${tone.ink}`}>{s.name}</p>
          <p className="text-sm text-ink/80">{s.description}</p>
        </div>
        <button type="button" onClick={onClose} className="-m-1 rounded-lg p-1 text-ink/60 hover:text-ink" aria-label="Tutup"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-meta font-bold text-ink/70">{num(s.question_count)} soal · {s.answered ? `akurasi ${pct(s.accuracy)} dari ${s.answered} soal` : 'belum pernah dicoba'}</p>
      <Button className="mt-3 w-full" busy={busy} onClick={onStart}><Zap className="h-4 w-4 fill-current" /> Mulai 10 soal</Button>
      <Link to={`/latihan/baru?subtopik=${encodeURIComponent(s.code)}`} className="btn-ghost btn-sm mt-1 w-full"><Settings2 className="h-4 w-4" /> Atur jumlah, mode, timer</Link>
    </div>
    </div>
  );
}

function PathUnit({ unit, nextCode, openCode, setOpenCode, onStart, busy }) {
  const tone = toneOf(unit.code);
  const subs = unit.subtopics;
  const answered = subs.reduce((n, s) => n + s.answered, 0);
  const total = subs.reduce((n, s) => n + s.question_count, 0);
  return (
    <section aria-labelledby={`u-${unit.code}`} className="mb-10">
      <div className={`flex items-center gap-3 rounded-3xl border-2 px-4 py-3 ${tone.bg}`} style={{ borderColor: `rgb(${tone.lip})`, boxShadow: `0 5px 0 rgb(${tone.lip})` }}>
        <UnitImage unit={unit.code} className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
        <div className="min-w-0 flex-1">
          <h2 id={`u-${unit.code}`} className={`font-display text-2xl font-semibold ${tone.ink}`}>{unit.name}</h2>
          <p className="text-sm font-semibold text-ink/75">{unit.description}</p>
          <ProgressBar value={answered} max={total} tone={tone.fill} thin className="mt-1.5 max-w-[240px] !bg-white/60" label={`Progres ${unit.name}`} />
        </div>
        <Link to={`/latihan/baru?unit=${unit.code}`} className="btn-secondary btn-sm hidden shrink-0 sm:inline-flex">Latih unit</Link>
      </div>
      <ol className="relative mt-8 flex flex-col items-center gap-7">
        {subs.map((s, i) => {
          const soon = s.status !== 'active';
          const m = mastery(s);
          const isNext = s.code === nextCode;
          const x = ZIG[i % ZIG.length];
          return (
            <li key={s.code} className={`relative flex w-full flex-col items-center ${openCode === s.code ? 'z-30' : ''}`}>
              <div className="relative flex flex-col items-center" style={{ transform: `translateX(${x}px)` }}>
              {isNext && !soon && (
                <span className="absolute -top-11 left-1/2 z-10 -translate-x-1/2">
                  <span className="pop-in block whitespace-nowrap rounded-xl border-2 border-line bg-surface px-3 py-1 font-display text-sm font-semibold text-primary-ink shadow-[0_3px_0_rgb(var(--line-strong))]">
                    Mulai di sini!
                  </span>
                </span>
              )}
              <div className="relative">
                {!soon && s.answered > 0 && (
                  <svg className="pointer-events-none absolute -inset-[9px] -rotate-90" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
                    <circle cx="48" cy="48" r="44" fill="none" stroke="rgb(var(--line))" strokeWidth="6" />
                    <circle cx="48" cy="48" r="44" fill="none" stroke={`rgb(${tone.solid})`} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - Math.min(1, s.answered / Math.max(10, Math.min(30, s.question_count))))} />
                  </svg>
                )}
                <button
                  type="button"
                  disabled={soon}
                  onClick={() => setOpenCode(openCode === s.code ? null : s.code)}
                  aria-expanded={openCode === s.code}
                  aria-label={`${s.name}${soon ? ', segera hadir' : `, ${s.answered} soal dijawab`}`}
                  className={`path-node ${soon ? 'bg-sunken text-muted' : `${tone.fill} text-white`} ${isNext && openCode !== s.code ? 'path-next' : ''}`}
                  style={{ '--lip': soon ? 'var(--line-strong)' : tone.lip }}
                >
                  {soon ? <Lock className="h-7 w-7" /> : m === 3 ? <Crown className="h-8 w-8 fill-current" /> : <SubtopicIcon code={s.code} className="h-8 w-8" />}
                </button>
                {m >= 2 && !soon && (
                  <span className="absolute -bottom-1 -right-2 flex rounded-full border-2 border-surface bg-warn px-1 py-0.5" aria-hidden="true">
                    {Array.from({ length: m }, (_, k) => <Star key={k} className="h-3 w-3 fill-[rgb(120_80_0)] text-[rgb(120_80_0)]" />)}
                  </span>
                )}
              </div>
              <span className={`mt-3 max-w-[140px] text-center font-display font-semibold leading-tight ${soon ? 'text-muted' : ''}`}>{s.name}</span>
              {soon && <span className="chip-muted mt-1">Segera hadir</span>}
              </div>
              {openCode === s.code && !soon && (
                <NodePopover s={s} tone={tone} busy={busy === s.code} onClose={() => setOpenCode(null)} onStart={() => onStart(s.code)} />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ halaman

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { emit } = useMascot();
  const targets = user.target_universities?.length ? user.target_universities : ['UNAIR'];
  const [uni, setUni] = useState(targets[0]);
  const [data, setData] = useState(null);
  const [cur, setCur] = useState(null);
  const [error, setError] = useState(null);
  const [openCode, setOpenCode] = useState(null);
  const [busy, setBusy] = useState('');
  const [startError, setStartError] = useState('');
  useMascotContext('learningPage');

  const load = useCallback(() => {
    setError(null);
    Promise.all([get('/me/home'), get(`/curriculum?university=${uni}`)])
      .then(([h, c]) => { setData(h); setCur(c); })
      .catch(setError);
  }, [uni]);
  useEffect(load, [load]);

  const units = useMemo(() => (cur?.units || []).map((u) => ({ ...u, subtopics: u.subtopics.filter((s) => s.in_university) }))
    .filter((u) => u.subtopics.length), [cur]);
  const nextCode = useMemo(() => {
    for (const u of units) for (const s of u.subtopics) if (s.status === 'active' && mastery(s) < 3) return s.code;
    return null;
  }, [units]);

  async function quickStart(code) {
    setBusy(code); setStartError('');
    try {
      const s = await post('/sessions', { source: 'subtopic', subtopics: [code], count: 10, mode: 'santai', difficulty: 'mixed' });
      emit('study_started');
      nav(`/sesi/${s.id}`);
    } catch (e) {
      setStartError(e.message);
      setBusy('');
    }
  }

  if (error) return <div className="wrap py-8"><ErrorState error={error} onRetry={load} /></div>;
  if (!data || !cur) return <PageSkeleton />;
  const { active_session: active, totals, daily } = data;
  const d = daysUntil(user.exam_date);
  const accuracy = totals.attempts ? totals.correct / totals.attempts : null;
  const wave = assetUrls('wave');

  return (
    <div className="wrap py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Sapaan */}
          <section className="relative overflow-hidden rounded-[2rem] border-2 border-primary-lip/40 bg-primary px-5 py-6 text-white sm:px-7" style={{ boxShadow: '0 6px 0 rgb(var(--primary-lip))' }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-16 right-24 h-36 w-36 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative max-w-[62%] sm:max-w-[70%]">
              <p className="font-display text-lg font-medium text-white/85">{greeting()},</p>
              <h1 className="font-display text-[2rem] font-semibold leading-tight sm:text-[2.4rem]">{user.display_name}!</h1>
              <p className="mt-1 font-semibold text-white/90">
                {d != null && d >= 0 ? <><Timer className="mr-1 inline h-4 w-4" />{d === 0 ? 'Hari ini tesnya. Semangat!' : <><strong className="font-display text-xl">{d} hari</strong> lagi menuju tes {targets.join(', ')}</>}</>
                  : d != null ? `Tanggal tes (${dateId(user.exam_date)}) sudah lewat.` : <Link to="/profil" className="underline underline-offset-4"><CalendarDays className="mr-1 inline h-4 w-4" />Isi tanggal tes untuk hitung mundur</Link>}
              </p>
              {active ? (
                <Link to={`/sesi/${active.id}`} className="btn-accent mt-4"><PlayCircle className="h-5 w-5" /> Lanjutkan sesi ({active.answered}/{active.total})</Link>
              ) : nextCode ? (
                <Button variant="accent" className="mt-4" busy={busy === nextCode} onClick={() => quickStart(nextCode)}><Zap className="h-5 w-5 fill-current" /> {daily && daily.today_answered >= daily.daily_goal ? 'Tambah latihan' : 'Mulai misi hari ini'}</Button>
              ) : null}
            </div>
            <picture className="pointer-events-none absolute -bottom-2 right-0 w-40 sm:right-4 sm:w-52">
              <source srcSet={wave.webp} type="image/webp" />
              <img src={wave.png} alt="" className="h-auto w-full drop-shadow-xl" />
            </picture>
          </section>

          {daily && <div className="lg:hidden"><DailyCard daily={daily} /></div>}

          {!user.tutorial_status && (
            <section className="card flex flex-wrap items-center gap-4 border-accent/50 bg-accent-soft p-4" style={{ boxShadow: '0 4px 0 rgb(var(--accent) / 0.5)' }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white"><GraduationCap className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold">Baru di sini? Ikuti tutorial 1 menit</p>
                <p className="text-sm text-ink/80">{MASCOT_NAME} tunjukkan cara latihan, membaca pembahasan, dan memakai fitur penting.</p>
              </div>
              <Link to="/tutorial" className="btn-accent">Mulai tutorial</Link>
            </section>
          )}

          {startError && <Alert tone="warn" onClose={() => setStartError('')}>{startError}</Alert>}

          {/* Jalur belajar */}
          <section aria-labelledby="jalur">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="jalur" className="font-display text-[1.7rem] font-semibold">Jalur belajarmu</h2>
                <p className="text-muted">Ketuk bulatan untuk mulai. Mahkota artinya kamu sudah menguasainya.</p>
              </div>
              {targets.length > 1 && (
                <div className="flex gap-2" role="tablist" aria-label="Kampus">
                  {targets.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={uni === t} onClick={() => { setUni(t); setOpenCode(null); }}
                      className={`rounded-full border-2 px-4 py-1.5 font-display font-semibold ${uni === t ? 'border-primary bg-primary text-white' : 'border-line bg-surface'}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="card-flat px-3 pb-2 pt-6 sm:px-6">
              {units.map((u) => (
                <PathUnit key={u.code} unit={u} nextCode={nextCode} openCode={openCode} setOpenCode={setOpenCode} onStart={quickStart} busy={busy} />
              ))}
              <div className="flex flex-col items-center pb-6 text-center">
                <MascotPose pose="studying" size={140} register={false} />
                <p className="mt-2 font-display text-lg font-semibold">Ujung jalur… untuk sekarang!</p>
                <p className="text-sm text-muted">Subtopik bergambar dan try out menyusul.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Kolom samping */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Ringkasan">
          {daily && <div className="hidden lg:block"><DailyCard daily={daily} /></div>}
          <section className="card grid grid-cols-2 gap-3 p-4">
            {[
              [CheckCircle2, num(totals.answered), 'Soal dijawab', 'bg-success-soft text-success-ink'],
              [Target, pct(accuracy), 'Akurasi', 'bg-primary-soft text-primary-ink'],
              [Flame, num(totals.study_days), 'Hari belajar', 'bg-accent-soft text-accent-ink'],
              [Bookmark, num(totals.bookmarks), 'Ditandai', 'bg-logika-soft text-logika-ink'],
            ].map(([Icon, v, l, t]) => (
              <div key={l} className="rounded-2xl border-2 border-line p-3">
                <span className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${t}`}><Icon className="h-5 w-5" /></span>
                <p className="font-display text-2xl font-semibold leading-none">{v}</p>
                <p className="mt-1 text-meta font-bold text-muted">{l}</p>
              </div>
            ))}
          </section>
          <section className="card space-y-2 p-4">
            <Link to="/ditandai" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-sunken"><Bookmark className="h-5 w-5 text-logika-ink" /><span className="flex-1 font-display font-semibold">Soal ditandai</span><ArrowRight className="h-4 w-4 text-muted" /></Link>
            <Link to={`/panduan/${uni}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-sunken"><GraduationCap className="h-5 w-5 text-english-ink" /><span className="flex-1 font-display font-semibold">Panduan {uni}</span><ArrowRight className="h-4 w-4 text-muted" /></Link>
            <div className="flex items-center gap-3 rounded-2xl p-2 opacity-70"><Timer className="h-5 w-5 text-muted" /><span className="flex-1 font-display font-semibold">Try out per kampus</span><span className="chip-muted">Segera</span></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
