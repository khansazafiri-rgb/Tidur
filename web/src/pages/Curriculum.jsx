import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookMarked, Eye, EyeOff } from 'lucide-react';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { num, pct } from '../lib/format.js';
import { DifficultyBadge, ErrorState, PageHeader, PageSkeleton, Ring, Segmented } from '../components/ui.jsx';
import { SubtopicIcon, UnitImage, toneOf } from '../components/learn.jsx';
import { useMascotContext } from '../mascot/Mascot.jsx';

function SubtopicRow({ s, tone }) {
  const soon = s.status !== 'active';
  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl2 border border-line bg-surface p-3 sm:flex-nowrap ${soon ? 'opacity-70' : ''}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.bg} ${tone.ink}`}><SubtopicIcon code={s.code} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{s.name}</p>
          {soon ? <span className="chip-muted">Segera hadir</span> : <span className="text-meta text-muted">{num(s.question_count)} soal</span>}
          {!s.in_university && <span className="chip-warn">Tidak diuji kampus ini</span>}
        </div>
        <p className="text-sm text-muted">{s.description}</p>
        {!soon && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {['easy', 'medium', 'hard'].filter((d) => s.difficulties[d] > 0).map((d) => <DifficultyBadge key={d} level={d} count={s.difficulties[d]} />)}
          </div>
        )}
      </div>
      {!soon && (
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          <Ring value={s.accuracy} size={46} stroke={5} tone={tone.ring} label={s.accuracy == null ? 'Belum ada data akurasi' : `Akurasi ${pct(s.accuracy)}`}>
            {s.accuracy == null ? '–' : Math.round(s.accuracy * 100)}
          </Ring>
          <Link to={`/latihan/baru?subtopik=${encodeURIComponent(s.code)}`} className="btn-primary btn-sm" aria-label={`Latihan ${s.name}`}>
            Latihan <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </li>
  );
}

export default function Curriculum() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const uni = params.get('kampus') || user.target_universities?.[0] || 'UNAIR';
  const showAll = params.get('semua') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useMascotContext('learningPage');

  const load = useCallback(() => {
    setError(null);
    get(`/curriculum?university=${uni}${showAll ? '&all=1' : ''}`).then(setData).catch(setError);
  }, [uni, showAll]);
  useEffect(load, [load]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v == null) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="wrap py-6 sm:py-8">
      <PageHeader eyebrow="Peta kurikulum" title={`Yang diuji di ${uni}`} intro="Lima unit dan subtopiknya. Pilih subtopik untuk mulai latihan.">
        <Link to={`/panduan/${uni}`} className="btn-secondary"><BookMarked className="h-4 w-4" /> Panduan {uni}</Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={uni} onChange={(v) => setParam('kampus', v)} options={['UNAIR', 'UGM', 'UI'].map((u) => ({ value: u, label: u }))} />
        {data && (data.hidden_count > 0 || showAll) && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setParam('semua', showAll ? null : '1')}>
            {showAll ? <><EyeOff className="h-4 w-4" /> Hanya yang diuji {uni}</> : <><Eye className="h-4 w-4" /> Tampilkan semua subtopik ({data.hidden_count} lagi)</>}
          </button>
        )}
      </div>

      {error && <ErrorState error={error} onRetry={load} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <div className="space-y-6">
          {data.units.map((u) => {
            const t = toneOf(u.code);
            const activeSubs = u.subtopics.filter((s) => s.status === 'active');
            return (
              <section key={u.code} className="card-bold overflow-hidden" aria-labelledby={`unit-${u.code}`}>
                <div className={`flex items-center gap-4 ${t.bg} px-4 py-3 sm:px-6`}>
                  <UnitImage unit={u.code} className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24" />
                  <div className="min-w-0 flex-1">
                    <h2 id={`unit-${u.code}`} className={`text-section ${t.ink}`}>{u.name}</h2>
                    <p className="text-sm text-ink/80">{u.description}</p>
                    <p className="mt-1 text-meta font-bold text-ink/70">{num(u.question_count)} soal · {num(u.answered)} sudah kamu jawab</p>
                  </div>
                  {activeSubs.length > 1 && (
                    <Link to={`/latihan/baru?unit=${u.code}`} className="btn-secondary btn-sm hidden shrink-0 sm:inline-flex">Latih satu unit</Link>
                  )}
                </div>
                <ul className="space-y-2 bg-sunken/40 p-3 sm:p-4">
                  {u.subtopics.map((s) => <SubtopicRow key={s.code} s={s} tone={t} />)}
                </ul>
                {activeSubs.length > 1 && (
                  <div className="border-t border-line p-3 sm:hidden">
                    <Link to={`/latihan/baru?unit=${u.code}`} className="btn-secondary w-full">Latih satu unit {u.name}</Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
