import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock, LineChart, ListChecks, Sparkles, X } from 'lucide-react';
import { get } from '../lib/api.js';
import { num } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { DifficultyBadge } from '../components/ui.jsx';
import { UnitImage, toneOf } from '../components/learn.jsx';
import { useMascotContext } from '../mascot/Mascot.jsx';

const CAMPUS_IMG = { UNAIR: '/illustrations/kampus-unair', UGM: '/illustrations/kampus-ugm', UI: '/illustrations/kampus-ui' };

function SampleQuestion({ sample }) {
  const [picked, setPicked] = useState(null);
  if (!sample) return null;
  const revealed = picked != null;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span className="chip-info">{sample.subtopic_name}</span>
        <DifficultyBadge level={sample.difficulty} />
        <span className="ml-auto text-meta text-muted">Coba satu soal</span>
      </div>
      <div className="space-y-4 p-5">
        <Markdown className="q-scale">{sample.stem}</Markdown>
        <div className="grid gap-2" role="radiogroup" aria-label="Pilihan jawaban contoh">
          {Object.entries(sample.options).map(([k, v]) => {
            const correct = revealed && k === sample.answer;
            const wrong = revealed && k === picked && k !== sample.answer;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={picked === k}
                disabled={revealed}
                onClick={() => setPicked(k)}
                className={`flex min-h-[48px] items-center gap-3 rounded-xl2 border-2 px-3 py-2 text-left transition-colors ${
                  correct ? 'border-success bg-success-soft' : wrong ? 'border-danger bg-danger-soft' : 'border-line bg-surface hover:border-primary'
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-extrabold ${correct ? 'bg-success text-white' : wrong ? 'bg-danger text-white' : 'bg-sunken'}`}>
                  {correct ? <Check className="h-4 w-4" /> : wrong ? <X className="h-4 w-4" /> : k}
                </span>
                <Markdown inline>{v}</Markdown>
              </button>
            );
          })}
        </div>
        {revealed && (
          <div className="rounded-xl2 bg-sunken p-4">
            <p className="mb-1 font-extrabold">{picked === sample.answer ? 'Benar!' : `Jawaban yang benar: ${sample.answer}`}</p>
            <Markdown className="text-[0.95rem]">{sample.explanation}</Markdown>
            {sample.explanation_source === 'ai' && <p className="mt-2 text-meta text-muted">Pembahasan dibuat dengan bantuan AI.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [sample, setSample] = useState(null);
  useMascotContext('landingPage');

  useEffect(() => {
    get('/public/overview').then(setData).catch(() => {});
    get('/public/sample').then((r) => setSample(r.sample)).catch(() => {});
  }, []);

  const cta = user ? { to: '/beranda', label: 'Buka beranda' } : { to: '/daftar', label: 'Daftar gratis' };

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-20 top-40 h-64 w-64 rounded-full bg-primary/10" aria-hidden="true" />
        <div className="wrap relative grid items-center gap-10 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
          <div>
            <p className="eyebrow mb-4"><Sparkles className="h-4 w-4" /> Tes masuk kedokteran jalur IUP</p>
            <h1 className="font-display text-hero font-semibold">
              Latihan soal IUP yang <span className="relative whitespace-nowrap text-primary">ada pembahasannya<svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 7 Q 50 1 100 6 T 198 4" stroke="rgb(var(--accent))" strokeWidth="4" fill="none" strokeLinecap="round" /></svg></span>, di setiap soal.
            </h1>
            <p className="mt-5 max-w-xl text-intro text-muted">
              Pilih kampus targetmu, berlatih per subtopik bareng Oyen si kucing dokter, dan lihat bagian mana yang masih lemah sebelum hari tes.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Keunggulan">
              {[['Gratis', 'bg-success-soft text-success-ink'], [data ? `${num(data.question_count)} soal` : 'Ribuan soal', 'bg-primary-soft text-primary-ink'], ['Ada pembahasan', 'bg-warn-soft text-warn-ink'], ['UNAIR · UGM · UI', 'bg-logika-soft text-logika-ink']].map(([t, c]) => (
                <li key={t} className={`rounded-full px-3 py-1 font-display text-sm font-semibold ${c}`}>{t}</li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={cta.to} className="btn-primary btn-lg">{cta.label} <ArrowRight className="h-5 w-5" /></Link>
              <Link to="/panduan/UNAIR" className="btn-secondary btn-lg">Lihat format tes</Link>
            </div>
          </div>
          <div className="relative">
            <picture>
              <source srcSet="/illustrations/hero-800.webp 800w, /illustrations/hero.webp 1600w" sizes="(max-width: 768px) 100vw, 50vw" type="image/webp" />
              <img src="/illustrations/hero.jpg" alt="Maskot kucing dokter menyambut di depan kampus" width="1600" height="941"
                className="aspect-[16/9.4] w-full -rotate-1 rounded-[2rem] border-4 border-surface object-cover" style={{ boxShadow: '0 8px 0 rgb(var(--line-strong)), 0 20px 50px rgb(30 35 71 / 0.15)' }} fetchpriority="high" />
            </picture>
          </div>
        </div>
      </section>

      <section className="wrap py-6" aria-labelledby="cara">
        <h2 id="cara" className="font-display text-[1.8rem] font-semibold">Cara kerjanya</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ['1', 'Pilih kampus', 'Kurikulum menyesuaikan tes UNAIR, UGM, atau UI.', 'bg-primary', 'var(--primary-lip)'],
            ['2', 'Latihan 10 soal', 'Jawab, tekan Periksa, langsung baca pembahasannya.', 'bg-accent', 'var(--accent-lip)'],
            ['3', 'Kejar yang lemah', 'Beranda menunjukkan subtopik yang perlu dilatih lagi.', 'bg-success', 'var(--success-lip)'],
          ].map(([n, t, d, c, lip]) => (
            <li key={n} className="card flex gap-4 p-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-2xl font-semibold text-white ${c}`} style={{ boxShadow: `0 4px 0 rgb(${lip})` }}>{n}</span>
              <span><strong className="block font-display text-lg font-semibold">{t}</strong><span className="text-sm text-muted">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap py-8" aria-labelledby="kampus">
        <h2 id="kampus" className="font-display text-[1.8rem] font-semibold">Tiga kampus, tiga format tes</h2>
        <p className="mt-1 text-muted">Satu bank soal, dipetakan ke subtopik yang diuji tiap kampus.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {(data?.universities || [{ code: 'UNAIR' }, { code: 'UGM' }, { code: 'UI' }]).map((u) => (
            <Link key={u.code} to={`/panduan/${u.code}`} className="card group overflow-hidden transition-shadow hover:shadow-lift">
              <picture>
                <source srcSet={`${CAMPUS_IMG[u.code]}.webp`} type="image/webp" />
                <img src={`${CAMPUS_IMG[u.code]}.jpg`} alt="" loading="lazy" className="aspect-[16/7] w-full object-cover" />
              </picture>
              <div className="p-4">
                <p className="font-display text-xl font-bold">{u.code}</p>
                <p className="text-sm text-muted">{u.tagline || u.name}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary-ink">Panduan kampus <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap grid gap-8 py-10 md:grid-cols-2 md:items-start" aria-labelledby="cuplikan">
        <div>
          <h2 id="cuplikan" className="font-display text-[1.8rem] font-semibold">Bukan sekadar kunci jawaban</h2>
          <p className="mt-2 text-muted">
            Tes IUP penuh pola dan trik. Tanpa pembahasan, latihan cuma jadi tebak-tebakan. Di sini setiap soal punya penjelasan
            langkah demi langkah, label subtopik, dan tingkat kesulitan.
          </p>
          <ul className="mt-5 space-y-3">
            {[
              [ListChecks, 'Latihan per subtopik', 'Barisan, analogi, silogisme, reading, dan 18 subtopik lain.'],
              [Clock, 'Mode santai atau mode ujian', 'Pembahasan langsung setelah menjawab, atau setelah sesi selesai dengan timer.'],
              [LineChart, 'Tahu bagian yang lemah', 'Beranda menunjukkan tiga subtopik dengan akurasi terendah untuk dilatih hari ini.'],
            ].map(([Icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl2 bg-primary-soft text-primary-ink"><Icon className="h-5 w-5" /></span>
                <span><strong className="block">{t}</strong><span className="text-sm text-muted">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <SampleQuestion sample={sample} />
      </section>

      {data && (
        <section className="wrap py-8" aria-labelledby="unit">
          <h2 id="unit" className="font-display text-[1.8rem] font-semibold">Yang akan kamu latih</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {data.units.map((u) => {
              const t = toneOf(u.code);
              return (
                <div key={u.code} className={`unit-card rounded-card border-2 ${t.bg} p-3 text-center`} style={{ borderColor: `rgb(${t.lip})`, boxShadow: `0 5px 0 rgb(${t.lip})` }}>
                  <UnitImage unit={u.code} className="mx-auto aspect-square w-full max-w-[140px] object-contain" />
                  <p className={`mt-1 font-display text-lg font-bold ${t.ink}`}>{u.name}</p>
                  <p className="text-meta text-muted">{u.question_count ? `${num(u.question_count)} soal` : 'Segera hadir'}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="wrap py-12">
        <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-[2rem] bg-primary p-6 text-white sm:flex-row sm:items-center sm:justify-between md:p-8" style={{ boxShadow: '0 6px 0 rgb(var(--primary-lip))' }}>
          <div>
            <h2 className="font-display text-[1.8rem] font-semibold">Mulai dari 10 soal hari ini</h2>
            <p className="mt-1 text-white/85">Daftar dalam hitungan detik. Progresmu tersimpan di semua perangkat.</p>
          </div>
          <Link to={cta.to} className="btn-accent btn-lg">{cta.label} <ArrowRight className="h-5 w-5" /></Link>
        </div>
        <p className="mt-6 text-center text-meta text-muted">
          Informasi format tes berasal dari file soal dan cerita peserta, bukan dari kampus. Web ini tidak berafiliasi dengan UNAIR, UGM, atau UI.
        </p>
      </section>
    </>
  );
}
