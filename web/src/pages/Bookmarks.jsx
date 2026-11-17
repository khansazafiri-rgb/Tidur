import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Trash2 } from 'lucide-react';
import { get, post } from '../lib/api.js';
import { dateId } from '../lib/format.js';
import { Markdown } from '../components/Markdown.jsx';
import { Alert, Button, DifficultyBadge, EmptyState, ErrorState, PageHeader, PageSkeleton } from '../components/ui.jsx';
import { SubtopicIcon, toneOf } from '../components/learn.jsx';
import { useMascot } from '../mascot/Mascot.jsx';

export default function Bookmarks() {
  const nav = useNavigate();
  const { emit } = useMascot();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState('');

  const load = useCallback(() => { setError(null); get('/me/bookmarks').then((r) => setList(r.bookmarks)).catch(setError); }, []);
  useEffect(load, [load]);
  const empty = list?.length === 0;
  useEffect(() => { if (empty) emit('bookmarks_empty'); }, [empty, emit]);

  async function remove(qid) {
    setList((l) => l.filter((b) => b.question_id !== qid));
    try { await post(`/questions/${qid}/bookmark`, { on: false }); } catch { load(); }
  }

  async function practice() {
    setBusy(true); setStartError('');
    try {
      const s = await post('/sessions', { source: 'bookmarks', count: list.length >= 30 ? 30 : list.length >= 20 ? 20 : 10, mode: 'santai' });
      nav(`/sesi/${s.id}`);
    } catch (e) { setStartError(e.message); setBusy(false); }
  }

  if (error) return <div className="wrap py-8"><ErrorState error={error} onRetry={load} /></div>;
  if (!list) return <PageSkeleton />;

  return (
    <div className="wrap max-w-4xl py-6 sm:py-8">
      <PageHeader eyebrow="Soal ditandai" title="Simpanan untuk diulang" intro="Soal yang kamu tandai saat latihan. Latih lagi sampai benar-benar paham.">
        {list.length > 0 && <Button onClick={practice} busy={busy}><Play className="h-4 w-4" /> Latih soal ditandai</Button>}
      </PageHeader>
      {startError && <Alert tone="warn" className="mb-4">{startError}</Alert>}
      {list.length === 0 ? (
        <EmptyState pose="emptyBookmark" title="Belum ada soal yang ditandai"
          action={<Link to="/kurikulum" className="btn-primary">Mulai latihan</Link>}>
          Saat latihan, ketuk <strong>Tandai</strong> pada soal yang ingin kamu ulang nanti.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => {
            const t = toneOf(b.unit_code);
            return (
              <li key={b.question_id} className="card flex gap-3 p-4">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.bg} ${t.ink}`}><SubtopicIcon code={b.subtopic_code} /></span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{b.subtopic_name}</span>
                    <DifficultyBadge level={b.difficulty} />
                    <span className="text-meta text-muted">Ditandai {dateId(b.created_at, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <Markdown className="line-clamp-3 text-sm text-ink/90">{b.stem}</Markdown>
                </div>
                <button type="button" onClick={() => remove(b.question_id)} className="btn-ghost btn-sm !px-2 self-start" aria-label="Hapus dari daftar ditandai">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
