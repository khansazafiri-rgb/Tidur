import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AArrowUp, ArrowDown, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Flag, Grid3x3, MessageSquareWarning, Send, Timer, X, Zap,
} from 'lucide-react';
import { ApiError, get, patch, post } from '../lib/api.js';
import { load, save } from '../lib/storage.js';
import { clock } from '../lib/format.js';
import { usePrefs, TEXT_SCALES } from '../lib/prefs.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Alert, Button, DifficultyBadge, ErrorState, Modal, PageSkeleton, ProgressBar } from '../components/ui.jsx';
import { Explanation, OptionList, PassagePanel, ReportModal } from '../components/question.jsx';
import { OfflineBanner } from '../components/Layout.jsx';
import { SubtopicIcon, toneOf, MASCOT_NAME } from '../components/learn.jsx';
import { FloatingMascot, useMascot, useMascotContext, pick as pickOne } from '../mascot/Mascot.jsx';
import { assetUrls } from '../mascot/engine.js';

// ------------------------------------------------------------------ antrean simpan (offline)

const qKey = (id) => `iup-queue-${id}`;

/** Simpan perubahan per soal. Bila offline, perubahan ditahan di perangkat lalu dikirim ulang. */
function useSyncQueue(sessionId, onExpired) {
  const queue = useRef(load(qKey(sessionId), {}));
  const flushing = useRef(false);
  const [pending, setPending] = useState(Object.keys(queue.current).length);

  const persist = () => { save(qKey(sessionId), Object.keys(queue.current).length ? queue.current : undefined); setPending(Object.keys(queue.current).length); };

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const idx of Object.keys(queue.current)) {
        const body = queue.current[idx];
        try {
          await patch(`/sessions/${sessionId}/items/${idx}`, body);
          if (queue.current[idx] === body) delete queue.current[idx];
          persist();
        } catch (e) {
          if (e instanceof ApiError && e.offline) break;
          delete queue.current[idx];
          persist();
          if (e.status === 410 || e.status === 409) { onExpired?.(); break; }
        }
      }
    } finally {
      flushing.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, onExpired]);

  const push = useCallback((idx, body) => {
    queue.current[idx] = { ...(queue.current[idx] || {}), ...body };
    persist();
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush]);

  useEffect(() => {
    window.addEventListener('online', flush);
    flush();
    return () => window.removeEventListener('online', flush);
  }, [flush]);

  return { push, flush, pending };
}

// ------------------------------------------------------------------ navigator

function Navigator({ items, idx, onGo, mode }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
        {items.map((it, i) => {
          let cls = 'border-line bg-surface text-ink';
          let lip = 'var(--line-strong)';
          if (mode === 'santai' && it.revealed) {
            if (it.is_correct) { cls = 'border-success bg-success text-white'; lip = 'var(--success-lip)'; } else { cls = 'border-danger bg-danger text-white'; lip = 'var(--danger-lip)'; }
          } else if (it.answer && (mode === 'ujian' || it.revealed)) { cls = 'border-primary bg-primary-soft text-primary-ink'; lip = 'var(--primary-lip)'; }
          const label = `Soal ${i + 1}${it.answer ? ', sudah dijawab' : ', belum dijawab'}${it.flagged ? ', ditandai ragu' : ''}`;
          return (
            <button key={it.idx} type="button" onClick={() => onGo(i)} aria-label={label} aria-current={i === idx ? 'step' : undefined}
              style={{ '--lip': lip }}
              className={`relative grid h-11 place-items-center rounded-xl border-2 font-display font-semibold shadow-[0_3px_0_rgb(var(--lip))] active:translate-y-[3px] active:shadow-none ${cls} ${i === idx ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-surface' : ''}`}>
              {i + 1}
              {it.flagged && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-surface bg-accent text-[0.65rem] font-extrabold text-white" aria-hidden="true">?</span>}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 space-y-1.5 text-meta font-semibold text-muted">
        {mode === 'santai' ? (
          <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-success" /> Benar <span className="ml-3 h-3.5 w-3.5 rounded bg-danger" /> Salah</li>
        ) : <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border-2 border-primary bg-primary-soft" /> Sudah dijawab</li>}
        <li className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-[0.55rem] font-bold text-white">?</span> Ragu-ragu</li>
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ lembar umpan balik (mode santai)

const PRAISE = ['Mantap, benar!', 'Tepat sekali!', 'Keren banget!', 'Jenius!', 'Pas!'];
const COMFORT = ['Belum tepat, nggak apa-apa.', 'Hampir! Yuk cek pembahasannya.', 'Salah itu bagian dari belajar.'];

function FeedbackSheet({ item, combo, isLast, onNext, onExplain }) {
  const ok = item.is_correct;
  const [msg] = useState(() => pickOne(ok ? PRAISE : COMFORT));
  const pose = assetUrls(ok ? 'excited' : 'headTilt');
  return (
    <div className={`sheet-up border-t-2 ${ok ? 'border-success/40 bg-success-soft' : 'border-danger/40 bg-danger-soft'}`} role="status" aria-live="polite">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
        <picture className="hidden shrink-0 sm:block">
          <source srcSet={pose.webp} type="image/webp" />
          <img src={pose.png} alt="" className="pop-in h-16 w-16 object-contain" />
        </picture>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-xl font-semibold sm:text-2xl ${ok ? 'text-success-ink' : 'text-danger-ink'}`}>
            {msg}{ok && combo >= 2 && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 align-middle text-sm text-white"><Zap className="h-3.5 w-3.5 fill-current" />{combo}x beruntun</span>}
          </p>
          <p className={`text-sm font-bold ${ok ? 'text-success-ink/80' : 'text-danger-ink/90'}`}>{ok ? 'Tetap baca pembahasannya ya.' : `Jawaban benar: ${item.correct_answer}`}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="secondary" onClick={onExplain} className="flex-1 sm:flex-none"><ArrowDown className="h-4 w-4" /> Pembahasan</Button>
          <Button variant={ok ? 'success' : 'dangerSolid'} onClick={onNext} className="flex-1 sm:flex-none">
            {isLast ? 'Selesai' : 'Lanjut'} <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ halaman

export default function Session() {
  const { id } = useParams();
  const nav = useNavigate();
  const mascot = useMascot();
  const { emit, say, setAssist } = mascot;
  const { textScale, setTextScale } = usePrefs();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'submit' | 'exit'
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [waiting, setWaiting] = useState(null); // jawaban santai yang menunggu koneksi
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [combo, setCombo] = useState(0);
  const [missStreak, setMissStreak] = useState(0);
  const offset = useRef(0);
  const itemStart = useRef(Date.now());
  const topRef = useRef(null);

  const goResult = useCallback(() => nav(`/sesi/${id}/hasil`, { replace: true }), [nav, id]);
  const { push, flush, pending } = useSyncQueue(id, goResult);

  useMascotContext(s?.mode === 'ujian' ? 'focusedExam' : 'quizPage', { bottom: 104 });

  useEffect(() => {
    get(`/sessions/${id}`).then((data) => {
      if (data.status === 'submitted') { goResult(); return; }
      offset.current = Date.parse(data.server_now) - Date.now();
      // Pilihan santai yang belum diperiksa tidak disimpan server, jadi mulai kosong.
      setS(data);
      setIdx(Math.min(data.current_idx || 0, data.items.length - 1));
      itemStart.current = Date.now();
    }).catch(setError);
  }, [id, goResult]);

  const items = s?.items || [];
  const item = items[idx];
  const passage = item?.passage_id ? s.passages[item.passage_id] : null;
  const santai = s?.mode === 'santai';
  const answered = items.filter((it) => (santai ? it.revealed : it.answer)).length;
  const flagged = items.filter((it) => it.flagged).length;

  // Bantuan Oyen untuk soal ini: petunjuk cara berpikir hanya di mode santai sebelum diperiksa.
  useEffect(() => {
    if (!item) return undefined;
    setAssist({ subtopic: item.subtopic, hintable: santai && !item.revealed, mode: s.mode });
    return undefined;
  }, [item?.subtopic, item?.revealed, santai, s?.mode, setAssist, item]);
  useEffect(() => () => setAssist(null), [setAssist]);

  // Kalau lama diam di satu soal (mode santai), Oyen menawarkan petunjuk sekali.
  useEffect(() => {
    if (!santai || !item || item.revealed) return undefined;
    const t = setTimeout(() => say(`Butuh petunjuk? Ketuk aku ya!`, { state: 'thinking', ms: 4500 }), 75_000);
    return () => clearTimeout(t);
  }, [santai, idx, item?.revealed, say, item]);

  // Ajakan istirahat setelah 25 menit fokus.
  useEffect(() => {
    const t = setTimeout(() => say('Sudah 25 menit fokus. Istirahat 5 menit yuk, minum air dulu!', { state: 'resting', ms: 8000 }), 25 * 60_000);
    return () => clearTimeout(t);
  }, [say]);

  const updateItem = useCallback((i, changes) => {
    setS((cur) => ({ ...cur, items: cur.items.map((it, k) => (k === i ? { ...it, ...changes } : it)) }));
  }, []);

  /** Catat waktu yang dihabiskan di soal saat ini. */
  const commitTime = useCallback((i, extra = {}) => {
    if (!s || s.items[i] == null) return;
    const spent = Date.now() - itemStart.current;
    itemStart.current = Date.now();
    const total = (s.items[i].time_ms || 0) + spent;
    updateItem(i, { time_ms: total });
    push(i, { time_ms: total, ...extra });
  }, [s, push, updateItem]);

  const go = useCallback((next) => {
    if (!s || next < 0 || next >= s.items.length || next === idx) return;
    commitTime(idx, { current_idx: next });
    setIdx(next);
    setSheet(false);
    window.scrollTo({ top: 0 });
  }, [s, idx, commitTime]);

  // Timer berbasis batas waktu dari server.
  useEffect(() => {
    if (!s?.deadline_at) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [s?.deadline_at]);
  const remaining = s?.deadline_at ? Date.parse(s.deadline_at) - (now + offset.current) : null;
  const totalMs = s?.config?.timerMinutes ? s.config.timerMinutes * 60_000 : null;

  const submit = useCallback(async (auto = false) => {
    setBusy(true);
    try {
      commitTime(idx);
      await flush();
      await post(`/sessions/${id}/submit`);
      save(qKey(id), undefined);
      goResult();
    } catch (e) {
      if (!auto) setNotice(e.message);
      setBusy(false);
      setConfirm(null);
    }
  }, [commitTime, flush, goResult, id, idx]);

  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining != null && remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(true);
    }
  }, [remaining, submit]);

  // Simpan waktu saat tab disembunyikan.
  useEffect(() => {
    const on = () => { if (document.hidden) commitTime(idx); else itemStart.current = Date.now(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [commitTime, idx]);

  /** Pilih jawaban. Ujian: langsung tersimpan. Santai: hanya memilih, diperiksa dengan tombol Periksa. */
  const pick = useCallback((key) => {
    if (!s || !item) return;
    if (s.mode === 'ujian') {
      const next = item.answer === key ? null : key;
      updateItem(idx, { answer: next });
      push(idx, { answer: next });
      return;
    }
    if (item.revealed || waiting != null || checking) return;
    updateItem(idx, { answer: key });
  }, [s, item, idx, waiting, checking, push, updateItem]);

  /** Periksa jawaban mode santai: server membuka kunci dan pembahasan untuk soal ini saja. */
  const check = useCallback(async () => {
    if (!s || !item || !santai || item.revealed || !item.answer || checking) return;
    const key = item.answer;
    setChecking(true);
    emit('answer_submitted', { message: null });
    const spent = (item.time_ms || 0) + (Date.now() - itemStart.current);
    itemStart.current = Date.now();
    const send = async () => {
      try {
        const r = await patch(`/sessions/${id}/items/${idx}`, { answer: key, time_ms: spent, current_idx: idx });
        setWaiting(null);
        updateItem(idx, { ...r.item, time_ms: spent });
        if (r.item.is_correct) {
          const c = combo + 1;
          setCombo(c);
          setMissStreak(0);
          emit('answer_correct', { message: c >= 3 ? `${c}x beruntun! Lagi panas nih!` : undefined });
        } else {
          setCombo(0);
          const m = missStreak + 1;
          setMissStreak(m);
          emit('answer_wrong', { message: m >= 3 ? 'Tiga kali meleset. Baca pembahasannya pelan-pelan, atau ketuk aku untuk petunjuk.' : undefined });
        }
      } catch (e) {
        if (e instanceof ApiError && e.offline) {
          setWaiting({ idx, key, retry: send });
          return;
        }
        setWaiting(null);
        if (e.status === 410) { goResult(); return; }
        setNotice(e.message);
      } finally {
        setChecking(false);
      }
    };
    await send();
  }, [s, item, santai, checking, emit, id, idx, updateItem, combo, missStreak, goResult]);

  useEffect(() => {
    if (!waiting) return undefined;
    const on = () => waiting.retry();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [waiting]);

  const toggleFlag = useCallback(() => {
    if (!item) return;
    updateItem(idx, { flagged: !item.flagged });
    push(idx, { flagged: !item.flagged });
  }, [item, idx, push, updateItem]);

  const toggleBookmark = useCallback(async () => {
    if (!item) return;
    const on = !item.bookmarked;
    updateItem(idx, { bookmarked: on });
    try { await post(`/questions/${item.question_id}/bookmark`, { on }); } catch { updateItem(idx, { bookmarked: !on }); }
  }, [item, idx, updateItem]);

  const isLast = idx === items.length - 1;
  const advance = useCallback(() => {
    if (isLast) setConfirm('submit');
    else go(idx + 1);
  }, [isLast, go, idx]);

  // Pintasan papan ketik: A–E pilih, Enter periksa/lanjut, N/P pindah, F ragu-ragu.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || confirm || report || mascot.panelOpen) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const k = e.key.toUpperCase();
      if (e.key === 'Enter' && santai && item) {
        if (tag === 'BUTTON') return;
        e.preventDefault();
        if (item.revealed) advance(); else check();
        return;
      }
      if (item && k.length === 1 && k in item.options) { e.preventDefault(); pick(k); }
      else if (k === 'N' || e.key === 'ArrowRight') go(idx + 1);
      else if (k === 'P' || e.key === 'ArrowLeft') go(idx - 1);
      else if (k === 'F') toggleFlag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, idx, pick, go, toggleFlag, confirm, report, santai, check, advance, mascot.panelOpen]);

  const scaleIdx = TEXT_SCALES.indexOf(textScale);
  const cycleScale = () => setTextScale(TEXT_SCALES[(scaleIdx + 1) % TEXT_SCALES.length]);
  const lowTime = remaining != null && totalMs && remaining <= totalMs * 0.1;

  // Di mode santai, pilihan yang belum diperiksa belum tersimpan, jadi dihitung kosong.
  const unansweredCount = items.filter((it) => (santai ? !it.revealed : !it.answer)).length;
  const submitSummary = useMemo(() => ({ unanswered: unansweredCount, flagged }), [unansweredCount, flagged]);

  if (error) return <div className="wrap py-10"><ErrorState error={error} onRetry={() => window.location.reload()} /></div>;
  if (!s || !item) return <PageSkeleton />;

  const wide = !!passage;
  const tone = toneOf(item.unit);
  const showFeedback = santai && item.revealed && item.answer;

  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header ref={topRef} className="sticky top-0 z-30 bg-bg/90 backdrop-blur">
        <div className={`mx-auto flex h-16 w-full items-center gap-2 px-3 sm:gap-3 sm:px-5 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-sunken hover:text-ink" onClick={() => setConfirm('exit')} aria-label="Keluar dari sesi"><X className="h-6 w-6" strokeWidth={2.5} /></button>
          <ProgressBar value={answered} max={items.length} tone={santai ? 'success' : 'primary'} className="flex-1" label={`${answered} dari ${items.length} soal`} />
          {santai && (
            <span className={`chip !px-2.5 !py-1 text-sm ${combo >= 2 ? 'bg-accent text-white' : 'bg-sunken text-muted'}`} title="Jawaban benar beruntun" aria-label={`${combo} benar beruntun`}>
              <Zap className={`h-4 w-4 ${combo >= 2 ? 'flame fill-current' : ''}`} /> {combo}
            </span>
          )}
          {remaining != null && (
            <span className={`chip !px-2.5 !py-1 text-sm tabular-nums ${lowTime ? 'bg-danger text-white' : 'bg-sunken text-ink'}`} role="timer" aria-label={`Sisa waktu ${clock(remaining)}`}>
              <Timer className="h-4 w-4" aria-hidden="true" /> {clock(remaining)}
            </span>
          )}
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-sunken hover:text-ink" onClick={cycleScale} aria-label={`Ukuran teks ${Math.round(textScale * 100)} persen. Tekan untuk mengubah.`} title="Ukuran teks">
            <AArrowUp className="h-5 w-5" />
          </button>
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-sunken hover:text-ink lg:hidden" onClick={() => setSheet(true)} aria-label="Buka navigator soal"><Grid3x3 className="h-5 w-5" /></button>
        </div>
      </header>

      <div className={`mx-auto grid w-full flex-1 gap-5 px-3 pb-48 pt-2 sm:px-5 ${wide ? 'max-w-7xl lg:grid-cols-[1fr_1fr_220px]' : 'max-w-5xl lg:grid-cols-[1fr_220px]'}`}>
        {passage && (
          <>
            <div className="lg:hidden"><PassagePanel passage={passage} collapsible /></div>
            <div className="hidden lg:block"><div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto"><PassagePanel passage={passage} /></div></div>
          </>
        )}
        <main className="min-w-0 space-y-4" aria-live="off">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-semibold">Soal {idx + 1}<span className="text-lg text-muted">/{items.length}</span></span>
            <span className={`chip ${tone.bg} ${tone.ink} !py-1`}><SubtopicIcon code={item.subtopic} className="h-3.5 w-3.5" /> {item.subtopic_name}</span>
            <DifficultyBadge level={item.difficulty} />
            {item.flagged && <span className="chip-warn !py-1"><Flag className="h-3.5 w-3.5" /> Ragu-ragu</span>}
          </div>
          <div className="card p-4 sm:p-5">
            <h1 className="sr-only">Soal {idx + 1}</h1>
            <Markdown className="q-scale font-semibold">{item.stem}</Markdown>
          </div>
          <OptionList item={item} onPick={pick} disabled={waiting != null || checking} name={`soal-${idx}`} />
          {waiting && waiting.idx === idx && <Alert tone="warn">Jawabanmu tersimpan di perangkat. Hasilnya muncul begitu koneksi kembali.</Alert>}
          {notice && <Alert tone="danger" onClose={() => setNotice('')}>{notice}</Alert>}
          {showFeedback && <Explanation item={item} onRated={(h) => updateItem(idx, { rating: h })} />}
          {s.mode === 'ujian' && <p className="text-meta font-semibold text-muted">Mode ujian: jawaban bisa diganti, pembahasan dibuka setelah sesi dikumpulkan. Ketuk pilihan yang sama untuk mengosongkan.</p>}
          <p className="hidden text-meta font-semibold text-muted lg:block">Pintasan: A–E pilih jawaban · Enter {santai ? 'periksa/lanjut' : ''} · N/P pindah soal · F ragu-ragu</p>
        </main>
        <aside className="hidden lg:block" aria-label="Navigator soal">
          <div className="card sticky top-20 p-4">
            <p className="mb-3 font-display text-lg font-semibold">Navigator</p>
            <Navigator items={items} idx={idx} onGo={go} mode={s.mode} />
            <Button className="mt-4 w-full" variant="accent" onClick={() => setConfirm('submit')}><Send className="h-4 w-4" /> Kumpulkan</Button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
        {showFeedback ? (
          <FeedbackSheet key={`${idx}-fb`} item={item} combo={combo} isLast={isLast} onNext={advance}
            onExplain={() => document.getElementById('pembahasan')?.scrollIntoView({ behavior: 'smooth' })} />
        ) : (
          <div className="border-t-2 border-line bg-surface/95 backdrop-blur">
            <div className={`mx-auto flex w-full items-center gap-1.5 px-3 py-3 sm:gap-2 sm:px-5 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
              <Button variant={item.flagged ? 'accent' : 'secondary'} size="sm" onClick={toggleFlag} aria-pressed={item.flagged} title="Tandai ragu-ragu (F)" className="!px-3">
                <Flag className="h-4 w-4" /><span className="hidden sm:inline">Ragu-ragu</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={toggleBookmark} aria-pressed={item.bookmarked} className="!px-3" aria-label={item.bookmarked ? 'Hapus tanda simpan' : 'Tandai soal untuk diulang'}>
                {item.bookmarked ? <BookmarkCheck className="h-4 w-4 text-primary-ink" /> : <Bookmark className="h-4 w-4" />}<span className="hidden sm:inline">{item.bookmarked ? 'Ditandai' : 'Tandai'}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setReport(true)} aria-label="Lapor soal" className="!px-2.5"><MessageSquareWarning className="h-4 w-4" /><span className="hidden md:inline">Lapor</span></Button>
              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                <Button variant="secondary" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Soal sebelumnya" className="!px-3"><ChevronLeft className="h-5 w-5" /></Button>
                {santai && !item.revealed ? (
                  <Button variant="success" onClick={check} busy={checking} disabled={!item.answer || waiting != null} className="min-w-[120px]">Periksa</Button>
                ) : isLast ? (
                  <Button variant="accent" onClick={() => setConfirm('submit')}><Send className="h-4 w-4" /> Kumpulkan</Button>
                ) : (
                  <Button onClick={() => go(idx + 1)} aria-label="Soal berikutnya">Lanjut <ChevronRight className="h-5 w-5" /></Button>
                )}
              </div>
            </div>
            {pending > 0 && !navigator.onLine && <p className="pb-1 text-center text-meta text-muted">{pending} perubahan tersimpan di perangkat, menunggu koneksi…</p>}
          </div>
        )}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigator soal">
          <button type="button" className="absolute inset-0 bg-[rgb(30_35_71/0.45)]" aria-label="Tutup navigator" onClick={() => setSheet(false)} />
          <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[1.75rem] border-t-2 border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-xl font-semibold">Navigator soal</p>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-sunken" onClick={() => setSheet(false)} aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>
            <Navigator items={items} idx={idx} onGo={go} mode={s.mode} />
            <Button className="mt-5 w-full" variant="accent" onClick={() => { setSheet(false); setConfirm('submit'); }}><Send className="h-4 w-4" /> Kumpulkan sesi</Button>
          </div>
        </div>
      )}

      <Modal open={confirm === 'submit'} onClose={() => setConfirm(null)} title="Kumpulkan sesi?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Periksa lagi</Button><Button variant="accent" busy={busy} onClick={() => submit(false)}>Kumpulkan</Button></>}>
        <p>Setelah dikumpulkan, jawaban tidak bisa diubah dan pembahasan semua soal terbuka.</p>
        {(submitSummary.unanswered > 0 || submitSummary.flagged > 0) && (
          <ul className="mt-3 space-y-1 text-sm">
            {submitSummary.unanswered > 0 && <li className="font-bold text-danger-ink">{submitSummary.unanswered} soal belum dijawab (dihitung salah).</li>}
            {submitSummary.flagged > 0 && <li className="font-bold text-warn-ink">{submitSummary.flagged} soal masih ditandai ragu-ragu.</li>}
          </ul>
        )}
      </Modal>
      <Modal open={confirm === 'exit'} onClose={() => setConfirm(null)} title="Keluar dulu?" size="sm"
        footer={<><Button onClick={() => setConfirm(null)}>Lanjut mengerjakan</Button><Button variant="secondary" onClick={() => { commitTime(idx, { current_idx: idx }); nav('/beranda'); }}>Keluar</Button></>}>
        <p>{MASCOT_NAME} sedih kalau kamu pergi sekarang… Tapi tenang, jawabanmu sudah tersimpan dan sesi ini bisa dilanjutkan dari beranda{s.deadline_at ? ' (timer tetap berjalan)' : ''}.</p>
      </Modal>
      <ReportModal questionId={item.question_id} open={report} onClose={() => setReport(false)} />
      <FloatingMascot />
    </div>
  );
}
