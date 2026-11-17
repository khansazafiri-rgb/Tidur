import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, CalendarDays, CheckCircle2, Flame, Map, PlayCircle, Target, Timer } from 'lucide-react';
import { get } from '../lib/api.js';
import { daysUntil, greeting, num, pct, dateId } from '../lib/format.js';
import { Card, ErrorState, PageSkeleton, ProgressBar, Ring, Stat } from '../components/ui.jsx';
import { SubtopicIcon, UnitImage, toneOf } from '../components/learn.jsx';
import { useMascotContext } from '../mascot/Mascot.jsx';

function Countdown({ date, unis }) {
  const d = daysUntil(date);
  if (d == null) {
    return (
      <Link to="/profil" className="inline-flex items-center gap-2 text-sm font-bold text-primary-ink underline-offset-4 hover:underline">
        <CalendarDays className="h-4 w-4" /> Isi tanggal tes untuk melihat hitung mundur
      </Link>
    );
  }
  if (d < 0) return <p className="text-sm text-muted">Tanggal tes ({dateId(date)}) sudah lewat. Perbarui di profil kalau ada jadwal baru.</p>;
  return (
    <div className="inline-flex items-center gap-3 rounded-xl2 bg-accent-soft px-4 py-2 text-accent-ink">
      <Timer className="h-5 w-5" aria-hidden="true" />
      <span>
        <strong className="font-display text-2xl">{d === 0 ? 'Hari ini' : `${d} hari`}</strong>
        <span className="ml-1 text-sm font-bold">{d === 0 ? 'tes kamu. Semangat!' : `lagi menuju tes ${unis.join(', ') || 'kamu'}`}</span>
      </span>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useMascotContext('learningPage');

  const load = useCallback(() => {
    setError(null);
    get('/me/home').then(setData).catch(setError);
  }, []);
  useEffect(load, [load]);

  if (error) return <div className="wrap py-8"><ErrorState error={error} onRetry={load} /></div>;
  if (!data) return <PageSkeleton />;
  const { user, active_session: active, today, units, totals } = data;
  const accuracy = totals.attempts ? totals.correct / totals.attempts : null;
  const isNew = totals.answered === 0;

  return (
    <div className="wrap space-y-8 py-6 sm:py-8">
      <section className="card-bold relative overflow-hidden bg-primary-soft p-5 sm:p-7">
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow">{greeting()}</p>
          <h1 className="mt-1 text-page">Halo, {user.display_name}!</h1>
          <p className="mt-2 text-muted">{isNew ? 'Yuk mulai dengan 10 soal pertamamu. Pembahasannya langsung muncul setelah kamu menjawab.' : 'Ini yang perlu kamu kerjakan hari ini.'}</p>
          <div className="mt-4"><Countdown date={user.exam_date} unis={user.target_universities} /></div>
        </div>
        <UnitImage unit="KHUSUS" className="pointer-events-none absolute -bottom-4 right-0 hidden w-72 opacity-95 md:block" eager />
      </section>

      {active && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl2 bg-accent-soft text-accent-ink"><PlayCircle className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-meta font-bold uppercase tracking-wide text-muted">Sesi belum selesai</p>
            <p className="truncate font-bold">{active.title}</p>
            <ProgressBar value={active.answered} max={active.total} className="mt-2 max-w-sm" label="Soal terjawab" />
            <p className="mt-1 text-meta text-muted">{active.answered} dari {active.total} soal dijawab · mode {active.mode}</p>
          </div>
          <Link to={`/sesi/${active.id}`} className="btn-accent">Lanjutkan <ArrowRight className="h-4 w-4" /></Link>
        </Card>
      )}

      <section aria-labelledby="hari-ini">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="hari-ini" className="text-section">Latih hari ini</h2>
            <p className="text-sm text-muted">{today.some((t) => t.reason === 'weak') ? 'Subtopik dengan akurasi terendah dulu.' : 'Mulai dari subtopik pertama kampus targetmu.'}</p>
          </div>
          <Link to="/kurikulum" className="link hidden text-sm sm:inline">Semua subtopik</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {today.map((s) => {
            const t = toneOf(s.unit);
            return (
              <Link key={s.code} to={`/latihan/baru?subtopik=${encodeURIComponent(s.code)}`}
                className="unit-card card-bold group flex flex-col gap-3 p-4 hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl2 ${t.bg} ${t.ink}`}><SubtopicIcon code={s.code} /></span>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold leading-tight">{s.name}</p>
                    <p className="text-meta text-muted">{num(s.question_count)} soal</p>
                  </div>
                  {s.accuracy != null && <span className="ml-auto"><Ring value={s.accuracy} size={44} stroke={5} tone={t.ring} label={`Akurasi ${pct(s.accuracy)}`}>{Math.round(s.accuracy * 100)}</Ring></span>}
                </div>
                <p className="text-sm text-muted">{s.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-primary-ink">
                  {s.reason === 'weak' ? 'Perkuat lagi' : 'Mulai 10 soal'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="progres" className="card p-5">
          <h2 id="progres" className="text-section">Progres per unit</h2>
          <ul className="mt-4 space-y-4">
            {units.map((u) => {
              const t = toneOf(u.code);
              return (
                <li key={u.code}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-bold">{u.name}</span>
                    <span className="text-meta text-muted">{num(u.answered)} / {num(u.total)} soal · akurasi {pct(u.accuracy)}</span>
                  </div>
                  <ProgressBar value={u.answered} max={u.total} tone={t.fill} label={`Progres ${u.name}`} />
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-label="Ringkasan" className="card grid grid-cols-2 gap-5 p-5">
          <Stat icon={<CheckCircle2 className="h-5 w-5" />} value={num(totals.answered)} label="Soal dijawab" />
          <Stat icon={<Target className="h-5 w-5" />} value={pct(accuracy)} label="Akurasi" />
          <Stat icon={<Flame className="h-5 w-5" />} value={num(totals.study_days)} label="Hari belajar" />
          <Stat icon={<Bookmark className="h-5 w-5" />} value={num(totals.bookmarks)} label="Ditandai" />
        </section>
      </div>

      <section aria-label="Pintasan" className="grid gap-3 sm:grid-cols-3">
        <Link to="/kurikulum" className="card flex items-center gap-3 p-4 hover:shadow-lift"><Map className="h-6 w-6 text-primary-ink" /><span><strong className="block">Peta kurikulum</strong><span className="text-meta text-muted">Semua unit dan subtopik</span></span></Link>
        <Link to="/ditandai" className="card flex items-center gap-3 p-4 hover:shadow-lift"><Bookmark className="h-6 w-6 text-primary-ink" /><span><strong className="block">Soal ditandai</strong><span className="text-meta text-muted">{num(totals.bookmarks)} soal</span></span></Link>
        <div className="card flex items-center gap-3 p-4 opacity-80" aria-disabled="true"><Timer className="h-6 w-6 text-muted" /><span><strong className="block">Try out per kampus</strong><span className="chip-muted mt-0.5">Segera hadir</span></span></div>
      </section>
    </div>
  );
}
