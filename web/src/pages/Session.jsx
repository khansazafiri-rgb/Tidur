import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AArrowUp, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Flag, Grid3x3, MessageSquareWarning, Send, Timer, X,
} from 'lucide-react';
import { ApiError, get, patch, post } from '../lib/api.js';
import { load, save } from '../lib/storage.js';
import { clock } from '../lib/format.js';
import { usePrefs, TEXT_SCALES } from '../lib/prefs.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Alert, Button, DifficultyBadge, ErrorState, Modal, PageSkeleton, ProgressBar } from '../components/ui.jsx';
import { Explanation, OptionList, PassagePanel, ReportModal } from '../components/question.jsx';
import { OfflineBanner } from '../components/Layout.jsx';
import { FloatingMascot, useMascot, useMascotContext } from '../mascot/Mascot.jsx';

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
          let cls = 'border-line bg-surface';
          if (mode === 'santai' && it.revealed) cls = it.is_correct ? 'border-success bg-success-soft text-success-ink' : 'border-danger bg-danger-soft text-danger-ink';
          else if (it.answer) cls = 'border-primary bg-primary-soft text-primary-ink';
          const label = `Soal ${i + 1}${it.answer ? ', sudah dijawab' : ', belum dijawab'}${it.flagged ? ', ditandai ragu' : ''}`;
          return (
            <button key={it.idx} type="button" onClick={() => onGo(i)} aria-label={label} aria-current={i === idx ? 'step' : undefined}
              className={`relative grid h-11 place-items-center rounded-xl border-2 text-sm font-extrabold ${cls} ${i === idx ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}>
              {i + 1}
              {it.flagged && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[0.6rem] text-[rgb(40_20_0)]" aria-hidden="true">?</span>}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 space-y-1 text-meta text-muted">
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-primary bg-primary-soft" /> Sudah dijawab</li>
        <li className="flex items-center gap-2"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-[0.55rem] font-bold text-[rgb(40_20_0)]">?</span> Ragu-ragu</li>
        {mode === 'santai' && <li className="flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-success bg-success-soft" /> Benar <span className="ml-2 h-3 w-3 rounded border-2 border-danger bg-danger-soft" /> Salah</li>}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ halaman

export default function Session() {
  const { id } = useParams();
  const nav = useNavigate();
  const mascot = useMascot();
  const { textScale, setTextScale } = usePrefs();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'submit' | 'exit'
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(null); // jawaban santai yang menunggu koneksi
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const itemStart = useRef(Date.now());
  const contentRef = useRef(null);

  const goResult = useCallback(() => nav(`/sesi/${id}/hasil`, { replace: true }), [nav, id]);
  const { push, flush, pending } = useSyncQueue(id, goResult);

  useMascotContext(s?.mode === 'ujian' ? 'focusedExam' : 'quizPage', { bottom: 92 });

  useEffect(() => {
    get(`/sessions/${id}`).then((data) => {
      if (data.status === 'submitted') { goResult(); return; }
      offset.current = Date.parse(data.server_now) - Date.now();
      setS(data);
      setIdx(Math.min(data.current_idx || 0, data.items.length - 1));
      itemStart.current = Date.now();
    }).catch(setError);
  }, [id, goResult]);

  const items = s?.items || [];
  const item = items[idx];
  const passage = item?.passage_id ? s.passages[item.passage_id] : null;
  const answered = items.filter((it) => it.answer).length;
  const flagged = items.filter((it) => it.flagged).length;

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
    contentRef.current?.scrollIntoView?.({ block: 'start' });
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

  const pick = useCallback(async (key) => {
    if (!s || !item) return;
    if (s.mode === 'ujian') {
      const next = item.answer === key ? null : key;
      updateItem(idx, { answer: next });
      push(idx, { answer: next });
      return;
    }
    if (item.revealed || waiting != null) return;
    updateItem(idx, { answer: key });
    mascot.emit('answer_submitted');
    const spent = (item.time_ms || 0) + (Date.now() - itemStart.current);
    itemStart.current = Date.now();
    const send = async () => {
      try {
        const r = await patch(`/sessions/${id}/items/${idx}`, { answer: key, time_ms: spent, current_idx: idx });
        setWaiting(null);
        updateItem(idx, { ...r.item, time_ms: spent });
        mascot.emit(r.item.is_correct ? 'answer_correct' : 'answer_wrong');
      } catch (e) {
        if (e instanceof ApiError && e.offline) {
          setWaiting({ idx, key, retry: send });
          return;
        }
        setWaiting(null);
        if (e.status === 410) { goResult(); return; }
        updateItem(idx, { answer: null });
        setNotice(e.message);
      }
    };
    await send();
  }, [s, item, idx, waiting, id, mascot, push, updateItem, goResult]);

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

  // Pintasan papan ketik: A–E pilih, N/P pindah, F ragu-ragu.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || confirm || report) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const k = e.key.toUpperCase();
      if (item && k.length === 1 && k in item.options) { e.preventDefault(); pick(k); }
      else if (k === 'N' || e.key === 'ArrowRight') go(idx + 1);
      else if (k === 'P' || e.key === 'ArrowLeft') go(idx - 1);
      else if (k === 'F') toggleFlag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, idx, pick, go, toggleFlag, confirm, report]);

  const scaleIdx = TEXT_SCALES.indexOf(textScale);
  const cycleScale = () => setTextScale(TEXT_SCALES[(scaleIdx + 1) % TEXT_SCALES.length]);
  const lowTime = remaining != null && totalMs && remaining <= totalMs * 0.1;

  const unansweredCount = items.length - answered;
  const submitSummary = useMemo(() => ({ unanswered: unansweredCount, flagged }), [unansweredCount, flagged]);

  if (error) return <div className="wrap py-10"><ErrorState error={error} onRetry={() => window.location.reload()} /></div>;
  if (!s || !item) return <PageSkeleton />;

  const isLast = idx === items.length - 1;
  const wide = !!passage;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className={`mx-auto flex h-14 w-full items-center gap-2 px-3 sm:px-5 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <button type="button" className="btn-ghost btn-sm !px-2" onClick={() => setConfirm('exit')} aria-label="Keluar dari sesi"><X className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-meta font-bold text-muted">{s.title} · mode {s.mode}</p>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm font-extrabold">Soal {idx + 1}/{items.length}</span>
              <ProgressBar value={answered} max={items.length} className="max-w-[220px]" label="Soal terjawab" />
            </div>
          </div>
          {remaining != null && (
            <span className={`chip !px-3 !py-1.5 text-sm tabular-nums ${lowTime ? 'bg-danger-soft text-danger-ink' : 'bg-sunken text-ink'}`} role="timer" aria-label={`Sisa waktu ${clock(remaining)}`}>
              <Timer className="h-4 w-4" aria-hidden="true" /> {clock(remaining)}
            </span>
          )}
          <button type="button" className="btn-ghost btn-sm !px-2" onClick={cycleScale} aria-label={`Ukuran teks ${Math.round(textScale * 100)} persen. Tekan untuk mengubah.`} title="Ukuran teks">
            <AArrowUp className="h-5 w-5" /><span className="hidden text-meta sm:inline">{Math.round(textScale * 100)}%</span>
          </button>
          <button type="button" className="btn-ghost btn-sm !px-2 lg:hidden" onClick={() => setSheet(true)} aria-label="Buka navigator soal"><Grid3x3 className="h-5 w-5" /></button>
        </div>
      </header>

      <div className={`mx-auto grid w-full flex-1 gap-5 px-3 pb-40 pt-4 sm:px-5 ${wide ? 'max-w-7xl lg:grid-cols-[1fr_1fr_220px]' : 'max-w-5xl lg:grid-cols-[1fr_220px]'}`}>
        {passage && (
          <>
            <div className="lg:hidden"><PassagePanel passage={passage} collapsible /></div>
            <div className="hidden lg:block"><div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto"><PassagePanel passage={passage} /></div></div>
          </>
        )}
        <main ref={contentRef} className="min-w-0 space-y-4" aria-live="off">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip-info">{item.subtopic_name}</span>
            <DifficultyBadge level={item.difficulty} />
            {item.flagged && <span className="chip-warn"><Flag className="h-3.5 w-3.5" /> Ragu-ragu</span>}
          </div>
          <h1 className="sr-only">Soal {idx + 1}</h1>
          <Markdown className="q-scale font-semibold">{item.stem}</Markdown>
          <OptionList item={item} onPick={pick} disabled={waiting != null} name={`soal-${idx}`} />
          {waiting && waiting.idx === idx && <Alert tone="warn">Jawabanmu tersimpan di perangkat. Pembahasan muncul begitu koneksi kembali.</Alert>}
          {notice && <Alert tone="danger" onClose={() => setNotice('')}>{notice}</Alert>}
          {s.mode === 'santai' && item.revealed && <Explanation item={item} onRated={(h) => updateItem(idx, { rating: h })} />}
          {s.mode === 'ujian' && <p className="text-meta text-muted">Mode ujian: jawaban bisa diganti, pembahasan dibuka setelah sesi dikumpulkan. Ketuk pilihan yang sama untuk mengosongkan.</p>}
          <p className="hidden text-meta text-muted lg:block">Pintasan: A–E memilih jawaban · N/P pindah soal · F tandai ragu-ragu</p>
        </main>
        <aside className="hidden lg:block" aria-label="Navigator soal">
          <div className="sticky top-20 card p-4">
            <p className="mb-3 font-bold">Navigator</p>
            <Navigator items={items} idx={idx} onGo={go} mode={s.mode} />
            <Button className="mt-4 w-full" variant="accent" onClick={() => setConfirm('submit')}><Send className="h-4 w-4" /> Kumpulkan</Button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className={`mx-auto flex w-full items-center gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-5 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <Button variant={item.flagged ? 'accent' : 'secondary'} size="sm" onClick={toggleFlag} aria-pressed={item.flagged} title="Tandai ragu-ragu (F)">
            <Flag className="h-4 w-4" /><span className="hidden sm:inline">Ragu-ragu</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={toggleBookmark} aria-pressed={item.bookmarked} aria-label={item.bookmarked ? 'Hapus tanda simpan' : 'Tandai soal untuk diulang'}>
            {item.bookmarked ? <BookmarkCheck className="h-4 w-4 text-primary-ink" /> : <Bookmark className="h-4 w-4" />}<span className="hidden sm:inline">{item.bookmarked ? 'Ditandai' : 'Tandai'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReport(true)} aria-label="Lapor soal"><MessageSquareWarning className="h-4 w-4" /><span className="hidden md:inline">Lapor</span></Button>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Button variant="secondary" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Soal sebelumnya"><ChevronLeft className="h-5 w-5" /><span className="hidden sm:inline">Sebelumnya</span></Button>
            {isLast ? (
              <Button variant="accent" onClick={() => setConfirm('submit')}><Send className="h-4 w-4" /> Kumpulkan</Button>
            ) : (
              <Button onClick={() => go(idx + 1)} aria-label="Soal berikutnya">Lanjut <ChevronRight className="h-5 w-5" /></Button>
            )}
          </div>
        </div>
        {pending > 0 && !navigator.onLine && <p className="pb-1 text-center text-meta text-muted">{pending} perubahan tersimpan di perangkat, menunggu koneksi…</p>}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigator soal">
          <button type="button" className="absolute inset-0 bg-[rgb(14_20_48/0.5)]" aria-label="Tutup navigator" onClick={() => setSheet(false)} />
          <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[1.5rem] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold">Navigator soal</p>
              <button type="button" className="btn-ghost btn-sm !px-2" onClick={() => setSheet(false)} aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>
            <Navigator items={items} idx={idx} onGo={go} mode={s.mode} />
            <Button className="mt-5 w-full" variant="accent" onClick={() => { setSheet(false); setConfirm('submit'); }}><Send className="h-4 w-4" /> Kumpulkan sesi</Button>
          </div>
        </div>
      )}

      <Modal open={confirm === 'submit'} onClose={() => setConfirm(null)} title="Kumpulkan sesi?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Periksa lagi</Button><Button variant="accent" busy={busy} onClick={() => submit(false)}>Kumpulkan</Button></>}>
        <p>Setelah dikumpulkan, jawaban tidak bisa diubah dan pembahasan semua soal terbuka.</p>
        {(submitSummary.unanswered > 0 || submitSummary.flagged > 0) && (
          <ul className="mt-3 space-y-1 text-sm">
            {submitSummary.unanswered > 0 && <li className="font-bold text-danger-ink">{submitSummary.unanswered} soal belum dijawab (dihitung salah).</li>}
            {submitSummary.flagged > 0 && <li className="font-bold text-warn-ink">{submitSummary.flagged} soal masih ditandai ragu-ragu.</li>}
          </ul>
        )}
      </Modal>
      <Modal open={confirm === 'exit'} onClose={() => setConfirm(null)} title="Keluar dulu?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Lanjut mengerjakan</Button><Button variant="secondary" onClick={() => { commitTime(idx, { current_idx: idx }); nav('/beranda'); }}>Keluar</Button></>}>
        <p>Jawabanmu sudah tersimpan. Sesi ini bisa dilanjutkan dari beranda{s.deadline_at ? ', tetapi timer tetap berjalan' : ''}.</p>
      </Modal>
      <ReportModal questionId={item.question_id} open={report} onClose={() => setReport(false)} />
      <FloatingMascot />
    </div>
  );
}
