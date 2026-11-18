import { useEffect, useState } from 'react';
import { Check, ChevronDown, Flag, Lightbulb, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { get, post } from '../lib/api.js';
import { Markdown } from './Markdown.jsx';
import { Alert, Button, Modal } from './ui.jsx';

/** Kartu pilihan jawaban A–E. Benar/salah selalu ditandai ikon + teks, bukan hanya warna. */
export function OptionList({ item, onPick, disabled = false, name = 'jawaban' }) {
  const revealed = item.revealed;
  return (
    <div role="radiogroup" aria-label="Pilihan jawaban" className="grid gap-3">
      {Object.entries(item.options).map(([key, text]) => {
        const chosen = item.answer === key;
        const isCorrect = revealed && key === item.correct_answer;
        const isWrong = revealed && chosen && key !== item.correct_answer;
        let cls = 'border-line bg-surface hover:border-primary/60 hover:bg-primary-soft/40';
        let lip = 'var(--line-strong)';
        if (chosen && !revealed) { cls = 'border-primary bg-primary-soft'; lip = 'var(--primary-lip)'; }
        if (isCorrect) { cls = 'border-success bg-success-soft'; lip = 'var(--success-lip)'; }
        if (isWrong) { cls = 'border-danger bg-danger-soft'; lip = 'var(--danger-lip)'; }
        if (revealed && !isCorrect && !isWrong) cls = 'border-line bg-surface opacity-60';
        let badge = 'border-2 border-line bg-surface text-muted';
        if (chosen && !revealed) badge = 'bg-primary text-white';
        if (isCorrect) badge = 'bg-success text-white';
        if (isWrong) badge = 'bg-danger text-white';
        return (
          <button
            key={key}
            type="button"
            role="radio"
            name={name}
            aria-checked={chosen}
            aria-label={`Pilihan ${key}${isCorrect ? ', jawaban benar' : ''}${isWrong ? ', jawabanmu, salah' : ''}`}
            disabled={disabled || revealed}
            onClick={() => onPick?.(key)}
            style={{ '--lip': lip }}
            className={`group flex min-h-[56px] w-full items-start gap-3 rounded-2xl border-2 px-3.5 py-3 text-left font-semibold shadow-[0_4px_0_rgb(var(--lip))] transition-[transform,box-shadow,background-color] enabled:active:translate-y-[4px] enabled:active:shadow-none disabled:cursor-default ${cls}`}
          >
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-[1.05rem] font-semibold ${badge} ${isCorrect || isWrong ? 'pop-in' : ''}`} aria-hidden="true">
              {isCorrect ? <Check className="h-5 w-5" strokeWidth={3} /> : isWrong ? <X className="h-5 w-5" strokeWidth={3} /> : key}
            </span>
            <span className="min-w-0 flex-1 pt-1">
              <Markdown inline>{text}</Markdown>
              {(isCorrect || isWrong) && (
                <span className={`mt-1 block text-meta font-extrabold ${isCorrect ? 'text-success-ink' : 'text-danger-ink'}`}>
                  {isCorrect ? (chosen ? 'Jawabanmu benar' : 'Jawaban benar') : 'Jawabanmu'}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Explanation({ item, onRated }) {
  const [rating, setRating] = useState(item.rating ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRating(item.rating ?? null); }, [item.question_id, item.rating]);
  async function rate(helpful) {
    setBusy(true);
    try { await post(`/questions/${item.question_id}/rate`, { helpful }); setRating(helpful); onRated?.(helpful); } catch { /* abaikan */ } finally { setBusy(false); }
  }
  const status = item.answer == null ? { cls: 'text-muted', text: `Tidak dijawab. Jawaban benar: ${item.correct_answer}` }
    : item.is_correct ? { cls: 'text-success-ink', text: `Benar! Jawabannya ${item.correct_answer}.` }
      : { cls: 'text-danger-ink', text: `Jawabanmu ${item.answer}, jawaban benar ${item.correct_answer}.` };
  return (
    <section id="pembahasan" className="scroll-mt-24 rounded-card border-2 border-warn/50 bg-warn-soft/50 p-4 sm:p-5" aria-label="Pembahasan">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-warn text-[rgb(80_50_0)]"><Lightbulb className="h-5 w-5" /></span>
        <h3 className="font-display text-xl font-semibold">Pembahasan</h3>
        {item.explanation_source === 'ai' && (
          <span className="chip-muted" title="Pembahasan ini disusun dengan bantuan AI lalu diperiksa">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> dibuat dengan bantuan AI
          </span>
        )}
      </div>
      <p className={`mb-2 font-extrabold ${status.cls}`}>{status.text}</p>
      <Markdown className="q-scale">{item.explanation || 'Pembahasan belum tersedia.'}</Markdown>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-warn/30 pt-3">
        <span className="text-sm font-bold text-muted">Pembahasan ini…</span>
        <Button variant={rating === true ? 'primary' : 'secondary'} size="sm" disabled={busy} onClick={() => rate(true)} aria-pressed={rating === true}>
          <ThumbsUp className="h-4 w-4" /> Membantu
        </Button>
        <Button variant={rating === false ? 'primary' : 'secondary'} size="sm" disabled={busy} onClick={() => rate(false)} aria-pressed={rating === false}>
          <ThumbsDown className="h-4 w-4" /> Kurang membantu
        </Button>
      </div>
    </section>
  );
}

let cachedCategories = null;

export function ReportModal({ questionId, open, onClose }) {
  const [cats, setCats] = useState(cachedCategories);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open && !cats) get('/report-categories').then((r) => { cachedCategories = r.categories; setCats(r.categories); }).catch(() => {});
    if (open) { setDone(false); setError(''); setCategory(''); setNote(''); }
  }, [open, cats]);
  async function submit() {
    setBusy(true); setError('');
    try { await post(`/questions/${questionId}/report`, { category, note }); setDone(true); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Lapor soal"
      footer={done ? <Button onClick={onClose}>Tutup</Button> : (
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={submit} busy={busy} disabled={!category}><Flag className="h-4 w-4" /> Kirim laporan</Button>
        </>
      )}>
      {done ? (
        <Alert tone="success" title="Terima kasih!">Laporanmu masuk ke antrean admin. Statusnya bisa kamu lihat di halaman Profil.</Alert>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="label">Apa masalahnya?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(cats || {}).map(([k, label]) => (
                <label key={k} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 ${category === k ? 'border-primary bg-primary-soft' : 'border-line'}`}>
                  <input type="radio" name="kategori" value={k} checked={category === k} onChange={() => setCategory(k)} className="accent-[rgb(var(--primary))]" />
                  <span className="text-sm font-bold">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="catatan" className="label">Catatan (opsional)</label>
            <textarea id="catatan" className="input min-h-[96px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Misalnya: menurutku jawabannya C karena…" />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}

/** Bacaan: di layar lebar tampil di samping; di ponsel bisa dilipat. */
export function PassagePanel({ passage, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [passage?.id, defaultOpen]);
  if (!passage) return null;
  if (!collapsible) {
    return (
      <article className="card p-4 sm:p-5" aria-label="Bacaan">
        <span className="chip-info mb-2">Bacaan</span>
        {passage.title && <h2 className="mb-2 font-display text-lg font-semibold">{passage.title}</h2>}
        <Markdown className="q-scale">{passage.text}</Markdown>
      </article>
    );
  }
  return (
    <article className="card overflow-hidden" aria-label="Bacaan">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-bold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>Bacaan{passage.title ? `: ${passage.title}` : ''}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="max-h-[45dvh] overflow-y-auto border-t border-line px-4 py-3"><Markdown className="q-scale">{passage.text}</Markdown></div>}
    </article>
  );
}
