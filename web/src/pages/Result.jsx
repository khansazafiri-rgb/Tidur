import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CheckCircle2, ChevronDown, Clock, Home, MessageSquareWarning, MinusCircle, RotateCcw, Repeat, XCircle } from 'lucide-react';
import { get, post } from '../lib/api.js';
import { duration } from '../lib/format.js';
import { usePrefs } from '../lib/prefs.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Alert, Button, CountUp, DifficultyBadge, ErrorState, PageSkeleton, Tabs } from '../components/ui.jsx';
import { Explanation, OptionList, PassagePanel, ReportModal } from '../components/question.jsx';
import { useMascot, useMascotContext } from '../mascot/Mascot.jsx';

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
  const shown = s.items.filter((it) => (tab === 'all' ? true : tab === 'wrong' ? it.answer != null && !it.is_correct : tab === 'blank' ? it.answer == null : it.flagged));
  const needsRetry = result.wrong + result.blank > 0;
  const cfg = s.config || {};
  const again = cfg.source === 'unit' ? { source: 'unit', unit: cfg.unit } : cfg.source === 'bookmarks' ? { source: 'bookmarks' } : { source: 'subtopic', subtopics: cfg.subtopics };

  return (
    <div className="wrap max-w-4xl space-y-6 py-6 sm:py-8">
      <section className="card-bold overflow-hidden">
        <div className="grid gap-4 bg-primary-soft p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div>
            <p className="eyebrow">Sesi selesai{result.auto ? ' · waktu habis' : ''}</p>
            <h1 className="mt-1 text-page">{s.title}</h1>
            <p className="mt-1 text-sm text-muted">Mode {s.mode}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-6xl font-bold leading-none text-primary-ink">
              <CountUp value={result.score} reduced={reducedMotion} format={(v) => Math.round(v)} /><span className="text-3xl">%</span>
            </p>
            <p className="text-meta font-bold text-muted">jawaban benar</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 divide-line border-t border-line sm:grid-cols-4 sm:divide-x">
          {[
            [CheckCircle2, 'Benar', result.correct, 'text-success-ink'],
            [XCircle, 'Salah', result.wrong, 'text-danger-ink'],
            [MinusCircle, 'Kosong', result.blank, 'text-muted'],
            [Clock, 'Waktu total', duration(result.total_ms), 'text-ink'],
          ].map(([Icon, label, value, cls]) => (
            <div key={label} className="flex items-center gap-3 p-4">
              <Icon className={`h-6 w-6 ${cls}`} aria-hidden="true" />
              <div><dt className="text-meta text-muted">{label}</dt><dd className="font-display text-2xl font-bold">{value}</dd></div>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        {needsRetry && (
          <Button variant="accent" busy={busy === 'retry'} onClick={() => startSession({ source: 'retry', retryOf: s.id, mode: s.mode }, 'retry')}>
            <RotateCcw className="h-4 w-4" /> Ulangi yang salah ({result.wrong + result.blank})
          </Button>
        )}
        {cfg.source !== 'retry' && (
          <Button variant="secondary" busy={busy === 'again'} onClick={() => startSession({ ...again, count: cfg.count, difficulty: cfg.difficulty, mode: s.mode, timerMinutes: cfg.timerMinutes }, 'again')}>
            <Repeat className="h-4 w-4" /> Latihan lagi
          </Button>
        )}
        <Link to="/beranda" className="btn-ghost"><Home className="h-4 w-4" /> Ke beranda</Link>
      </div>
      {startError && <Alert tone="warn">{startError}</Alert>}

      <section aria-labelledby="tinjau">
        <h2 id="tinjau" className="text-section">Tinjau jawaban</h2>
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
