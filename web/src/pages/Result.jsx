import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CheckCircle2, ChevronDown, Clock, Flame, Home, MessageSquareWarning, MinusCircle, RotateCcw, Repeat, Star, XCircle } from 'lucide-react';
import { get, post } from '../lib/api.js';
import { duration } from '../lib/format.js';
import { usePrefs } from '../lib/prefs.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Alert, Button, CountUp, DifficultyBadge, ErrorState, PageSkeleton, ProgressBar, Tabs } from '../components/ui.jsx';
import { Explanation, OptionList, PassagePanel, ReportModal } from '../components/question.jsx';
import { Confetti, MascotPose, useMascot, useMascotContext } from '../mascot/Mascot.jsx';

function ReviewItem({ item, n, passage, onChange, onReport }) {
  const [open, setOpen] = useState(item.answer == null || !item.is_correct);
  const status = item.answer == null ? { icon: MinusCircle, cls: 'text-muted', label: 'Kosong' }
    : item.is_correct ? { icon: CheckCircle2, cls: 'text-success-ink', label: 'Benar' } : { icon: XCircle, cls: 'text-danger-ink', label: 'Salah' };
  const Icon = status.icon;
  const toggleBookmark = async () => {
    const on = !item.bookmarked;
    onChange({ bookmarked: on });
    try { await post(`/questions/${item.question_id}/bookmark`, { on }); } catch { onChange({ bookmarked: !on }); }
  };
  return (
    <li className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/50">
        <Icon className={`h-6 w-6 shrink-0 ${status.cls}`} aria-hidden="true" />
        <span className="w-14 shrink-0 font-extrabold">No. {n}</span>
        <span className={`w-14 shrink-0 text-sm font-bold ${status.cls}`}>{status.label}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{item.subtopic_name}</span>
        {item.flagged && <span className="chip-warn hidden sm:inline-flex">Ragu</span>}
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          {passage && <PassagePanel passage={passage} collapsible defaultOpen={false} />}
          <div className="flex flex-wrap items-center gap-2"><DifficultyBadge level={item.difficulty} /></div>
          <Markdown className="q-scale font-semibold">{item.stem}</Markdown>
          <OptionList item={item} disabled name={`tinjau-${n}`} />
          <Explanation item={item} onRated={(h) => onChange({ rating: h })} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={toggleBookmark} aria-pressed={item.bookmarked}>
              {item.bookmarked ? <BookmarkCheck className="h-4 w-4 text-primary-ink" /> : <Bookmark className="h-4 w-4" />} {item.bookmarked ? 'Ditandai' : 'Tandai untuk diulang'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onReport}><MessageSquareWarning className="h-4 w-4" /> Lapor soal</Button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Result() {
  const { id } = useParams();
  const nav = useNavigate();
  const mascot = useMascot();
  const { emit } = mascot;
  const { reducedMotion } = usePrefs();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [reportQ, setReportQ] = useState(null);
  const [busy, setBusy] = useState('');
  const [startError, setStartError] = useState('');
  const celebrated = useRef(false);
  useMascotContext('resultPage');

  const load = useCallback(() => {
    get(`/sessions/${id}`).then((d) => {
      if (d.status !== 'submitted') { nav(`/sesi/${id}`, { replace: true }); return; }
      setS(d);
    }).catch(setError);
  }, [id, nav]);
  useEffect(load, [load]);

  useEffect(() => {
    if (s && !celebrated.current) {
      celebrated.current = true;
      const score = s.result.score;
      mascot.refreshDaily();
      emit('lesson_completed', score < 50 ? { message: 'Sesi selesai! Baca pembahasannya, lalu coba lagi ya.' } : undefined);
    }
  }, [s, emit]);

  const counts = useMemo(() => {
    if (!s) return {};
    return {
      all: s.items.length,
      wrong: s.items.filter((i) => i.answer != null && !i.is_correct).length,
      blank: s.items.filter((i) => i.answer == null).length,
      flagged: s.items.filter((i) => i.flagged).length,
    };
  }, [s]);

  async function startSession(body, key) {
    setBusy(key); setStartError('');
    try {
      const r = await post('/sessions', body);
      mascot.emit('study_started');
      nav(`/sesi/${r.id}`);
    } catch (e) {
      setStartError(e.message);
      setBusy('');
    }
  }

  if (error) return <div className="wrap py-8"><ErrorState error={error} onRetry={load} /></div>;
  if (!s) return <PageSkeleton />;

  const { result } = s;
  const stars = result.score >= 85 ? 3 : result.score >= 70 ? 2 : result.score >= 50 ? 1 : 0;
  const verdict = result.score >= 85 ? { title: 'Luar biasa!', text: 'Kamu siap untuk subtopik ini. Coba tingkat yang lebih sulit, yuk.', pose: 'completed' }
    : result.score >= 70 ? { title: 'Bagus sekali!', text: 'Sedikit lagi menuju sempurna. Ulangi yang salah supaya makin mantap.', pose: 'correctAnswer' }
      : result.score >= 50 ? { title: 'Lumayan!', text: 'Polanya mulai kebaca. Baca pembahasan yang salah, lalu ulangi.', pose: 'studying' }
        : { title: 'Tetap semangat!', text: 'Ini justru bagian terpenting: baca pembahasannya pelan-pelan, lalu ulangi yang salah.', pose: 'wrongAnswer' };
  const daily = mascot.daily;
  const shown = s.items.filter((it) => (tab === 'all' ? true : tab === 'wrong' ? it.answer != null && !it.is_correct : tab === 'blank' ? it.answer == null : it.flagged));
  const needsRetry = result.wrong + result.blank > 0;
  const cfg = s.config || {};
  const again = cfg.source === 'unit' ? { source: 'unit', unit: cfg.unit } : cfg.source === 'bookmarks' ? { source: 'bookmarks' } : { source: 'subtopic', subtopics: cfg.subtopics };

  return (
    <div className="wrap max-w-4xl space-y-6 py-6 sm:py-8">
      {stars > 0 && !reducedMotion && <Confetti count={stars * 14} />}
      <section className="relative overflow-hidden rounded-[2rem] border-2 border-primary-lip/40 bg-primary px-5 pb-5 pt-6 text-white sm:px-8" style={{ boxShadow: '0 6px 0 rgb(var(--primary-lip))' }}>
        <div className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 right-1/3 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative grid items-center gap-2 sm:grid-cols-[1fr_220px]">
          <div>
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 font-display text-sm font-semibold">Sesi selesai{result.auto ? ' · waktu habis' : ''} · mode {s.mode}</span>
            <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight sm:text-[2.3rem]">{verdict.title}</h1>
            <p className="font-semibold text-white/85">{s.title}</p>
            <div className="mt-3 flex items-end gap-3">
              <p className="font-display text-7xl font-semibold leading-none">
                <CountUp value={result.score} reduced={reducedMotion} format={(v) => Math.round(v)} /><span className="text-4xl">%</span>
              </p>
              <div className="mb-2 flex gap-1" role="img" aria-label={`${stars} dari 3 bintang`}>
                {[0, 1, 2].map((i) => (
                  <Star key={i} className={`h-9 w-9 ${i < stars ? 'pop-in fill-warn text-warn' : 'text-white/35'}`} style={{ animationDelay: `${300 + i * 180}ms` }} />
                ))}
              </div>
            </div>
            <p className="mt-2 max-w-md text-sm font-semibold text-white/90">{verdict.text}</p>
          </div>
          <div className="mx-auto w-44 sm:w-full"><MascotPose pose={verdict.pose} size={220} /></div>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [CheckCircle2, 'Benar', result.correct, 'bg-success text-white', 'var(--success-lip)'],
          [XCircle, 'Salah', result.wrong, 'bg-danger text-white', 'var(--danger-lip)'],
          [MinusCircle, 'Kosong', result.blank, 'bg-surface text-ink border-2 border-line', 'var(--line-strong)'],
          [Clock, 'Waktu', duration(result.total_ms), 'bg-english text-white', 'var(--english-lip)'],
        ].map(([Icon, label, value, cls, lip]) => (
          <div key={label} className={`flex flex-col rounded-3xl p-4 ${cls}`} style={{ boxShadow: `0 5px 0 rgb(${lip})` }}>
            <Icon className="h-6 w-6 opacity-90" aria-hidden="true" />
            <dt className="order-last mt-1 text-meta font-bold opacity-90">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold leading-none">{value}</dd>
          </div>
        ))}
      </dl>

      {daily && (
        <div className="card flex items-center gap-4 p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink"><Flame className={`h-7 w-7 fill-current ${daily.streak ? 'flame' : ''}`} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">{daily.today_answered >= daily.daily_goal ? `Misi hari ini selesai! Streak ${daily.streak} hari` : `Misi hari ini: ${daily.today_answered}/${daily.daily_goal} soal`}</p>
            <ProgressBar value={daily.today_answered} max={daily.daily_goal} tone={daily.today_answered >= daily.daily_goal ? 'success' : 'accent'} className="mt-1.5" label="Misi hari ini" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {needsRetry && (
          <Button variant="accent" size="lg" busy={busy === 'retry'} onClick={() => startSession({ source: 'retry', retryOf: s.id, mode: s.mode }, 'retry')}>
            <RotateCcw className="h-4 w-4" /> Ulangi yang salah ({result.wrong + result.blank})
          </Button>
        )}
        {cfg.source !== 'retry' && (
          <Button variant="secondary" size="lg" busy={busy === 'again'} onClick={() => startSession({ ...again, count: cfg.count, difficulty: cfg.difficulty, mode: s.mode, timerMinutes: cfg.timerMinutes }, 'again')}>
            <Repeat className="h-4 w-4" /> Latihan lagi
          </Button>
        )}
        <Link to="/beranda" className="btn-ghost btn-lg"><Home className="h-4 w-4" /> Ke beranda</Link>
      </div>
      {startError && <Alert tone="warn">{startError}</Alert>}

      <section aria-labelledby="tinjau">
        <h2 id="tinjau" className="font-display text-2xl font-semibold">Tinjau jawaban</h2>
        <Tabs className="mt-3" value={tab} onChange={setTab} tabs={[
          { value: 'all', label: 'Semua', count: counts.all },
          { value: 'wrong', label: 'Salah', count: counts.wrong },
          { value: 'blank', label: 'Kosong', count: counts.blank },
          { value: 'flagged', label: 'Ragu', count: counts.flagged },
        ]} />
        {shown.length === 0 ? (
          <p className="py-8 text-center text-muted">{tab === 'wrong' ? 'Tidak ada jawaban salah. Mantap!' : 'Tidak ada soal di sini.'}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {shown.map((it) => (
              <ReviewItem key={it.idx} item={it} n={it.idx + 1} passage={it.passage_id ? s.passages[it.passage_id] : null}
                onReport={() => setReportQ(it.question_id)}
                onChange={(changes) => setS((cur) => ({ ...cur, items: cur.items.map((x) => (x.idx === it.idx ? { ...x, ...changes } : x)) }))} />
            ))}
          </ol>
        )}
      </section>
      <ReportModal questionId={reportQ} open={!!reportQ} onClose={() => setReportQ(null)} />
    </div>
  );
}
