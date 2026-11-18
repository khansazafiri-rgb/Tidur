// TUTORIAL (/tutorial): kotak pasir terpandu bersama Oyen, meniru pola tutorial MEDCOEL.
// Urutannya sama dengan alur sungguhan: pilih subtopik -> atur sesi -> jawab & periksa -> ragu/tandai
// -> navigator & kumpulkan -> hasil -> kenalan dengan panel Oyen. Semua halaman di sini tiruan dengan
// data contoh, jadi tutorial tetap jalan walau bank soal kosong. Pengguna harus melakukan tiap langkah sendiri.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Bookmark, BookmarkCheck, Check, Coffee, Flag, Flame, Grid3x3, Lightbulb, ListOrdered, Link2, RotateCcw, Send,
  Sparkles, Target, Timer, Workflow, X, Zap, BookOpenCheck,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { usePrefs } from '../lib/prefs.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Button, ProgressBar } from '../components/ui.jsx';
import { MASCOT_NAME } from '../components/learn.jsx';
import { Confetti, MascotPose } from '../mascot/Mascot.jsx';

const SAMPLE = {
  stem: 'Berapakah suku berikutnya dari barisan $2, 5, 10, 17, 26, \\ldots$ ?',
  options: { A: '35', B: '36', C: '37', D: '38', E: '39' },
  answer: 'C',
  explanation: 'Selisih antarsukunya $3, 5, 7, 9$, naik 2 setiap langkah. Selisih berikutnya $11$, jadi $26 + 11 = 37$.\n\nCara lain: setiap suku adalah $n^2 + 1$, jadi suku ke-6 adalah $6^2 + 1 = 37$.',
};

const STEPS = [
  { key: 'hai', label: 'Kenalan', pose: 'greeting' },
  { key: 'jalur', label: 'Pilih subtopik', pose: 'studying' },
  { key: 'atur', label: 'Atur sesi', pose: 'thinking' },
  { key: 'soal', label: 'Jawab soal', pose: 'thinking' },
  { key: 'alat', label: 'Ragu & tandai', pose: 'studying' },
  { key: 'kumpul', label: 'Kumpulkan', pose: 'thinking' },
  { key: 'hasil', label: 'Hasil', pose: 'correctAnswer' },
  { key: 'oyen', label: MASCOT_NAME, pose: 'greeting' },
  { key: 'selesai', label: 'Selesai', pose: 'completed' },
];

function useTyped(text) {
  const { reducedMotion } = usePrefs();
  const [n, setN] = useState(reducedMotion ? text.length : 0);
  useEffect(() => {
    if (reducedMotion) { setN(text.length); return undefined; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 2; setN(Math.min(i, text.length)); if (i >= text.length) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, [text, reducedMotion]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

function Speech({ pose, title, text, children }) {
  const { shown, done } = useTyped(text);
  return (
    <div className="flex items-end gap-3 sm:gap-5">
      <div className="w-24 shrink-0 sm:w-36"><MascotPose pose={pose} size={144} /></div>
      <div className="speech mb-4 min-w-0 flex-1">
        {title && <p className="font-display text-lg font-semibold sm:text-xl">{title}</p>}
        <p className="sr-only" aria-live="polite">{text}</p>
        <p className="mt-0.5 font-semibold text-ink/90" aria-hidden="true">{shown}<span className={`caret ${done ? 'done' : ''}`} /></p>
        {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

function Mock({ label, children }) {
  return (
    <div className="tut-mock pop-in">
      <div className="tut-mock-bar" aria-hidden="true"><i /><i /><i /><span className="ml-1">Contoh tampilan · {label}</span></div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

const PATH = [
  { code: 'barisan', name: 'Barisan', icon: ListOrdered, tone: 'bg-numerik', lip: 'var(--numerik-lip)' },
  { code: 'analogi', name: 'Analogi', icon: Link2, tone: 'bg-verbal', lip: 'var(--verbal-lip)' },
  { code: 'silogisme', name: 'Silogisme', icon: Workflow, tone: 'bg-logika', lip: 'var(--logika-lip)' },
];

export default function Tutorial() {
  const { user, updateProfile } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(null);
  const [pickA, setPickA] = useState(null);
  const [checked, setChecked] = useState(false);
  const [flag, setFlag] = useState(false);
  const [mark, setMark] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = STEPS[step];
  const correct = checked && pickA === SAMPLE.answer;
  const name = user?.display_name || 'kamu';

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  async function finish(status) {
    setBusy(true);
    try { await updateProfile({ tutorial_status: status }); } catch { /* tetap lanjut */ }
    nav('/beranda', { replace: true });
  }

  const text = useMemo(() => ({
    hai: `Halo ${name}! Aku ${MASCOT_NAME}, kucing dokter yang bakal menemanimu latihan. Aku tunjukkan cara pakainya dalam semenit. Kamu yang mencoba, aku yang memandu.`,
    jalur: 'Di beranda ada jalur belajar sesuai kampus targetmu. Setiap bulatan adalah satu subtopik. Coba ketuk "Barisan".',
    atur: mode == null
      ? 'Sebelum mulai, pilih cara mengerjakan. Mode Santai: pembahasan langsung muncul setiap selesai menjawab. Mode Ujian: pembahasan dibuka setelah semua dikumpulkan, cocok untuk simulasi. Pilih Santai dulu ya.'
      : mode === 'ujian' ? 'Mode Ujian cocok untuk simulasi nanti. Untuk belajar pertama kali, pilih Santai dulu ya.' : 'Pas! Sekarang tekan "Mulai latihan".',
    soal: !pickA ? 'Ini contoh soal. Ketuk satu pilihan jawaban dulu.' : !checked ? 'Sudah yakin? Tekan tombol "Periksa" di bawah.' : correct ? 'Benar! Pembahasannya muncul di bawah. Baca juga walau benar, kadang benarnya kebetulan.' : 'Belum tepat, nggak apa-apa. Baca pembahasannya, di situ letak belajarnya.',
    alat: !flag || !mark ? 'Dua tombol penting: "Ragu-ragu" untuk menandai soal yang mau dicek lagi, dan "Tandai" untuk menyimpan soal agar bisa diulang dari menu Ditandai. Coba ketuk keduanya.' : 'Mantap! Tombol "Lapor" dipakai kalau kunci atau pembahasannya keliru. Laporanmu bikin bank soal makin bagus.',
    kumpul: !navOpen ? 'Mau lompat ke soal lain? Ketuk ikon kotak-kotak untuk membuka navigator.' : 'Nomor oranye bertanda tanya itu soal yang ditandai ragu-ragu. Kalau sudah selesai, tekan "Kumpulkan".',
    hasil: 'Ini halaman hasil. Ada skor, waktu, dan tombol "Ulangi yang salah" untuk mengulang soal yang keliru sampai paham. Ketuk tombol itu.',
    oyen: !panel ? `Satu lagi: aku bukan pajangan! Ketuk aku di pojok kanan bawah kapan saja.` : 'Di panelku ada misi harian, streak, petunjuk cara berpikir saat mengerjakan soal, tips belajar, dan jalan pintas latihan subtopik terlemahmu.',
    selesai: `Selesai! Kamu siap. Misi pertamamu: 10 soal hari ini. Aku tunggu di beranda ya, ${name}!`,
  }), [name, mode, pickA, checked, correct, flag, mark, navOpen, panel]);

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-30 border-b-2 border-line bg-surface/95 backdrop-blur">
        <div className="wrap flex h-16 max-w-4xl items-center gap-3">
          <p className="hidden font-display text-lg font-semibold sm:block">Tutorial</p>
          <ProgressBar value={step + 1} max={STEPS.length} tone="accent" className="flex-1" label="Kemajuan tutorial" />
          <span className="text-meta font-bold text-muted">{step + 1}/{STEPS.length}</span>
          {step < STEPS.length - 1 && (
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => finish('skipped')}>Lewati</button>
          )}
        </div>
      </header>

      <main className="wrap max-w-4xl space-y-6 pt-6">
        <ol className="hidden flex-wrap gap-1.5 md:flex" aria-label="Langkah tutorial">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`chip ${i === step ? 'bg-accent text-white' : i < step ? 'bg-success-soft text-success-ink' : 'bg-sunken text-muted'}`}>
              {i < step && <Check className="h-3 w-3" />}{s.label}
            </li>
          ))}
        </ol>

        <Speech pose={cur.pose} title={step === 0 ? `Hai, aku ${MASCOT_NAME}!` : null} text={text[cur.key]}>
          {step === 0 && <Button onClick={next}>Ayo mulai <ArrowRight className="h-4 w-4" /></Button>}
          {cur.key === 'alat' && flag && mark && <Button onClick={next}>Lanjut <ArrowRight className="h-4 w-4" /></Button>}
          {cur.key === 'soal' && checked && <Button onClick={next}>Lanjut <ArrowRight className="h-4 w-4" /></Button>}
          {cur.key === 'oyen' && panel && <Button onClick={next}>Oke, paham! <ArrowRight className="h-4 w-4" /></Button>}
        </Speech>

        {cur.key === 'jalur' && (
          <Mock label="Beranda">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-numerik-soft px-4 py-3">
              <p className="font-display text-lg font-semibold text-numerik-ink">Unit Numerik</p>
              <span className="chip bg-surface text-numerik-ink"><Flame className="h-3.5 w-3.5" /> 0 hari</span>
            </div>
            <div className="flex flex-col items-center gap-6 py-2">
              {PATH.map((p, i) => {
                const Icon = p.icon;
                const target = p.code === 'barisan';
                return (
                  <div key={p.code} className="flex flex-col items-center gap-1.5" style={{ transform: `translateX(${[0, 60, -50][i]}px)` }}>
                    <button type="button" onClick={() => target && next()} disabled={!target}
                      className={`path-node ${p.tone} text-white ${target ? 'tut-spot path-next' : 'opacity-60'}`} style={{ '--lip': p.lip }}
                      aria-label={`Subtopik ${p.name}`}>
                      <Icon className="h-8 w-8" />
                    </button>
                    <span className="font-display font-semibold">{p.name}</span>
                  </div>
                );
              })}
            </div>
          </Mock>
        )}

        {cur.key === 'atur' && (
          <Mock label="Atur sesi latihan">
            <p className="label">Jumlah soal</p>
            <div className="mb-5 flex gap-2">{[10, 20, 30].map((n) => <span key={n} className={`rounded-xl2 border-2 px-4 py-2 font-display font-semibold ${n === 10 ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line'}`}>{n} soal</span>)}</div>
            <p className="label">Mode</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[['santai', Coffee, 'Santai', 'Pembahasan langsung setiap selesai menjawab.'], ['ujian', BookOpenCheck, 'Ujian', 'Pembahasan dibuka setelah dikumpulkan.']].map(([v, Icon, t, d]) => (
                <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v}
                  className={`flex gap-3 rounded-2xl border-2 p-4 text-left ${mode === v ? 'border-primary bg-primary-soft' : 'border-line bg-surface'} ${mode == null && v === 'santai' ? 'tut-spot' : ''}`}>
                  <Icon className="h-6 w-6 shrink-0 text-primary-ink" /><span><strong className="block font-display text-lg font-semibold">{t}</strong><span className="text-sm text-muted">{d}</span></span>
                </button>
              ))}
            </div>
            <Button className={`mt-5 w-full ${mode === 'santai' ? 'tut-spot' : ''}`} size="lg" disabled={mode !== 'santai'} onClick={next}>Mulai latihan</Button>
          </Mock>
        )}

        {cur.key === 'soal' && (
          <Mock label="Layar soal · mode santai">
            <div className="mb-4 flex items-center gap-3"><X className="h-5 w-5 text-muted" /><ProgressBar value={1} max={10} className="flex-1" label="Kemajuan" /><span className="chip bg-accent-soft text-accent-ink"><Zap className="h-3.5 w-3.5" /> 0</span></div>
            <span className="chip-info mb-2">Barisan</span>
            <Markdown className="q-scale mb-4 font-semibold">{SAMPLE.stem}</Markdown>
            <div className="grid gap-2.5">
              {Object.entries(SAMPLE.options).map(([k, v]) => {
                const isAns = checked && k === SAMPLE.answer;
                const isWrong = checked && k === pickA && k !== SAMPLE.answer;
                return (
                  <button key={k} type="button" disabled={checked} onClick={() => setPickA(k)}
                    className={`flex min-h-[52px] items-center gap-3 rounded-2xl border-2 px-3 text-left font-semibold shadow-[0_3px_0_rgb(var(--line-strong))] ${isAns ? 'border-success bg-success-soft' : isWrong ? 'border-danger bg-danger-soft' : pickA === k ? 'border-primary bg-primary-soft' : 'border-line bg-surface'} ${!pickA && k === 'A' ? 'tut-spot' : ''}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-lg font-display font-semibold ${isAns ? 'bg-success text-white' : isWrong ? 'bg-danger text-white' : pickA === k ? 'bg-primary text-white' : 'bg-sunken'}`}>{isAns ? <Check className="h-4 w-4" /> : isWrong ? <X className="h-4 w-4" /> : k}</span>{v}
                  </button>
                );
              })}
            </div>
            {!checked ? (
              <Button className={`mt-5 w-full ${pickA ? 'tut-spot' : ''}`} variant="success" size="lg" disabled={!pickA} onClick={() => setChecked(true)}>Periksa</Button>
            ) : (
              <>
                <div className={`mt-5 rounded-2xl p-4 ${correct ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'}`}>
                  <p className="font-display text-xl font-semibold">{correct ? 'Mantap, benar!' : `Jawaban benar: ${SAMPLE.answer}`}</p>
                </div>
                <div className="mt-3 rounded-2xl border-2 border-line bg-sunken/60 p-4"><p className="mb-1 font-display font-semibold">Pembahasan</p><Markdown>{SAMPLE.explanation}</Markdown></div>
              </>
            )}
          </Mock>
        )}

        {cur.key === 'alat' && (
          <Mock label="Layar soal · tombol bawah">
            <p className="mb-4 text-sm text-muted">Tombol-tombol ini ada di bagian bawah layar soal.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFlag((f) => !f)} aria-pressed={flag} className={`${flag ? 'btn-accent' : 'btn-secondary'} ${!flag ? 'tut-spot' : ''}`}><Flag className="h-4 w-4" /> Ragu-ragu</button>
              <button type="button" onClick={() => setMark((f) => !f)} aria-pressed={mark} className={`btn-secondary ${!mark ? 'tut-spot' : ''}`}>{mark ? <BookmarkCheck className="h-4 w-4 text-primary-ink" /> : <Bookmark className="h-4 w-4" />} {mark ? 'Ditandai' : 'Tandai'}</button>
              <span className="btn-ghost opacity-70"><Flag className="h-4 w-4" /> Lapor</span>
            </div>
            <p className="mt-4 text-meta text-muted">Di laptop ada pintasan: A–E memilih jawaban, N/P pindah soal, F untuk ragu-ragu, Enter untuk periksa.</p>
          </Mock>
        )}

        {cur.key === 'kumpul' && (
          <Mock label="Navigator soal">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display font-semibold">Soal 3/10</span>
              <button type="button" onClick={() => setNavOpen(true)} className={`btn-secondary btn-sm !px-2.5 ${!navOpen ? 'tut-spot' : ''}`} aria-label="Buka navigator"><Grid3x3 className="h-5 w-5" /></button>
            </div>
            {navOpen && (
              <div className="pop-in">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={`relative grid h-11 place-items-center rounded-xl border-2 font-display font-semibold ${i < 2 ? 'border-success bg-success-soft text-success-ink' : i === 2 ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line bg-surface'}`}>
                      {i + 1}{i === 2 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[0.6rem] text-white">?</span>}
                    </span>
                  ))}
                </div>
                <Button className="tut-spot mt-5 w-full" variant="accent" onClick={next}><Send className="h-4 w-4" /> Kumpulkan</Button>
              </div>
            )}
          </Mock>
        )}

        {cur.key === 'hasil' && (
          <Mock label="Hasil sesi">
            <div className="rounded-2xl bg-primary-soft p-5 text-center">
              <div className="flex justify-center gap-1 text-warn">{[0, 1, 2].map((i) => <Sparkles key={i} className={`h-8 w-8 ${i < 2 ? 'fill-current' : 'opacity-30'}`} />)}</div>
              <p className="mt-2 font-display text-5xl font-semibold text-primary-ink">80%</p>
              <p className="text-sm font-bold text-muted">8 benar · 2 salah · 6 menit</p>
            </div>
            <Button className="tut-spot mt-5 w-full" variant="accent" onClick={next}><RotateCcw className="h-4 w-4" /> Ulangi yang salah (2)</Button>
          </Mock>
        )}

        {cur.key === 'oyen' && (
          <Mock label="Pojok kanan bawah">
            <div className="relative flex min-h-[260px] items-end justify-end">
              {panel && (
                <div className="mascot-panel !static mb-2 mr-2 !w-full max-w-[320px] p-4">
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-sunken/60 p-3">
                    <span className="flex items-center gap-1 rounded-xl bg-accent-soft px-2 py-1 text-accent-ink"><Flame className="h-4 w-4 fill-current" /> 1</span>
                    <div className="flex-1"><p className="flex items-center gap-1 text-meta font-bold"><Target className="h-3.5 w-3.5" /> Misi hari ini 3/10</p><div className="bar mt-1 !h-3"><i className="bg-accent" style={{ width: '30%' }} /></div></div>
                  </div>
                  <p className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-warn/60 bg-warn-soft p-3 text-sm font-semibold"><Lightbulb className="h-4 w-4 shrink-0 text-warn-ink" /> Petunjuk: cek selisih antarsuku dulu.</p>
                </div>
              )}
              <button type="button" onClick={() => setPanel(true)} className={`w-28 shrink-0 ${!panel ? 'tut-spot rounded-full' : ''}`} aria-label={`Ketuk ${MASCOT_NAME}`}>
                <MascotPose pose="idle" size={112} />
              </button>
            </div>
          </Mock>
        )}

        {cur.key === 'selesai' && (
          <div className="card flex flex-col items-center gap-4 p-6 text-center">
            <Confetti />
            <p className="font-display text-3xl font-semibold">Tutorial selesai!</p>
            <p className="max-w-md text-muted">Tutorial ini bisa diulang kapan saja dari panel {MASCOT_NAME} atau halaman Profil.</p>
            <Button size="lg" busy={busy} onClick={() => finish('done')}>Ke beranda <ArrowRight className="h-5 w-5" /></Button>
          </div>
        )}

        {step > 0 && step < STEPS.length - 1 && (
          <p className="text-center text-meta text-muted"><Timer className="mr-1 inline h-3.5 w-3.5" />Lakukan langkah yang disorot garis oranye untuk lanjut.</p>
        )}
      </main>
    </div>
  );
}
