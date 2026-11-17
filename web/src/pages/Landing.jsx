import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock, LineChart, ListChecks, X } from 'lucide-react';
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
        <div className="wrap grid items-center gap-8 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
          <div>
            <p className="eyebrow mb-3">Tes masuk kedokteran jalur IUP</p>
            <h1 className="text-hero">
              Latihan soal IUP yang <span className="text-primary">ada pembahasannya</span>, di setiap soal.
            </h1>
            <p className="mt-4 max-w-xl text-intro text-muted">
              Pilih kampus targetmu, berlatih per subtopik, dan lihat bagian mana yang masih lemah sebelum hari tes. Gratis.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={cta.to} className="btn-primary !min-h-[52px] !px-6 text-lg">{cta.label} <ArrowRight className="h-5 w-5" /></Link>
              <Link to="/panduan/UNAIR" className="btn-secondary !min-h-[52px]">Lihat format tes</Link>
            </div>
            {data && (
              <p className="mt-5 text-sm text-muted">
                <strong className="text-ink">{num(data.question_count)} soal</strong> siap dilatih untuk UNAIR, UGM, dan UI.
              </p>
            )}
          </div>
          <div className="relative">
            <picture>
              <source srcSet="/illustrations/hero-800.webp 800w, /illustrations/hero.webp 1600w" sizes="(max-width: 768px) 100vw, 50vw" type="image/webp" />
              <img src="/illustrations/hero.jpg" alt="Maskot kucing dokter menyambut di depan kampus" width="1600" height="941"
                className="aspect-[16/9.4] w-full rounded-[1.75rem] border-2 border-ink/90 object-cover shadow-chunky" fetchpriority="high" />
            </picture>
          </div>
        </div>
      </section>

      <section className="wrap py-8" aria-labelledby="kampus">
        <h2 id="kampus" className="text-section">Tiga kampus, tiga format tes</h2>
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
          <h2 id="cuplikan" className="text-section">Bukan sekadar kunci jawaban</h2>
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
          <h2 id="unit" className="text-section">Yang akan kamu latih</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {data.units.map((u) => {
              const t = toneOf(u.code);
              return (
                <div key={u.code} className={`unit-card rounded-card border-2 border-ink/90 ${t.bg} p-3 text-center shadow-chunky`}>
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
        <div className="card-bold flex flex-col items-start gap-4 bg-primary-soft p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div>
            <h2 className="text-section">Mulai dari 10 soal hari ini</h2>
            <p className="mt-1 text-muted">Daftar dalam hitungan detik. Progresmu tersimpan di semua perangkat.</p>
          </div>
          <Link to={cta.to} className="btn-primary !min-h-[52px] !px-6">{cta.label} <ArrowRight className="h-5 w-5" /></Link>
        </div>
        <p className="mt-6 text-center text-meta text-muted">
          Informasi format tes berasal dari file soal dan cerita peserta, bukan dari kampus. Web ini tidak berafiliasi dengan UNAIR, UGM, atau UI.
        </p>
      </section>
    </>
  );
}
