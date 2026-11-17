import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { UNIS } from '../lib/format.js';
import { Markdown } from '../components/Markdown.jsx';
import { ErrorState, PageSkeleton, Segmented } from '../components/ui.jsx';
import { SubtopicIcon } from '../components/learn.jsx';
import NotFound from './NotFound.jsx';

const IMG = { UNAIR: 'kampus-unair', UGM: 'kampus-ugm', UI: 'kampus-ui' };

export default function Guide() {
  const { code: raw } = useParams();
  const code = String(raw || '').toUpperCase();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => { setData(null); setError(null); get(`/guides/${code}`).then(setData).catch(setError); }, [code]);
  useEffect(() => { if (UNIS.includes(code)) load(); }, [code, load]);

  if (!UNIS.includes(code)) return <NotFound />;
  if (error) return <div className="wrap py-8"><ErrorState error={error} onRetry={load} /></div>;
  if (!data) return <PageSkeleton />;
  const active = data.subtopics.filter((s) => s.status === 'active');
  const soon = data.subtopics.filter((s) => s.status !== 'active');

  return (
    <div className="pb-8">
      <div className="relative">
        <picture>
          <source srcSet={`/illustrations/${IMG[code]}.webp`} type="image/webp" />
          <img src={`/illustrations/${IMG[code]}.jpg`} alt="" className="h-48 w-full object-cover sm:h-64" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
      </div>
      <div className="wrap -mt-16 max-w-4xl">
        <div className="relative card p-5 sm:p-8">
          <p className="eyebrow">Panduan kampus</p>
          <h1 className="text-page">{data.university.name} ({code})</h1>
          <p className="mt-1 text-muted">{data.university.tagline}</p>
          <Segmented className="mt-5" value={code} onChange={(v) => window.location.assign(`/panduan/${v}`)} options={UNIS.map((u) => ({ value: u, label: u }))} />
          <Markdown className="mt-6">{data.content_md}</Markdown>

          <h2 className="mt-8 text-section">Subtopik yang diuji</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {active.map((s) => (
              <li key={s.code} className="chip-info !py-1.5 text-sm"><SubtopicIcon code={s.code} className="h-4 w-4" /> {s.name}</li>
            ))}
            {soon.map((s) => (
              <li key={s.code} className="chip-muted !py-1.5 text-sm"><SubtopicIcon code={s.code} className="h-4 w-4" /> {s.name} · segera hadir</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link to={user ? `/kurikulum?kampus=${code}` : '/daftar'} className="btn-primary">
              {user ? `Buka kurikulum ${code}` : 'Daftar dan mulai latihan'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-6 text-meta text-muted">Web ini bukan situs resmi {data.university.name} dan tidak menjamin hasil tes.</p>
        </div>
      </div>
    </div>
  );
}
