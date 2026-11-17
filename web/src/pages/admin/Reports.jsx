import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, patch } from '../../lib/api.js';
import { dateId } from '../../lib/format.js';
import { Button, ErrorState, Skeleton, Tabs } from '../../components/ui.jsx';
import { AdminTitle, StatusChip } from './AdminApp.jsx';

function ReportRow({ r, categories, onDone }) {
  const [note, setNote] = useState(r.resolution_note || '');
  const [busy, setBusy] = useState('');
  async function setStatus(status) {
    setBusy(status);
    try { await patch(`/admin/reports/${r.id}`, { status, resolution_note: note }); onDone(); } finally { setBusy(''); }
  }
  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip-warn">{categories[r.category] || r.category}</span>
        <span className="text-meta text-muted">{dateId(r.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-meta text-muted">· {r.open_on_question} laporan terbuka di soal ini</span>
        <span className="ml-auto"><StatusChip status={r.question_status} /></span>
      </div>
      <Link to={`/admin/soal/${r.question_id}`} className="block font-semibold hover:underline">{r.stem}</Link>
      <p className="text-meta text-muted"><code>{r.subtopic_code}</code> · {r.filename}</p>
      {r.note && <p className="rounded-lg bg-sunken p-2 text-sm">“{r.note}”</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-md flex-1" placeholder="Catatan penanganan (terlihat oleh pelapor)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Catatan penanganan" />
        {r.status !== 'handling' && <Button size="sm" variant="secondary" busy={busy === 'handling'} onClick={() => setStatus('handling')}>Tangani</Button>}
        {r.status !== 'closed' && <Button size="sm" busy={busy === 'closed'} onClick={() => setStatus('closed')}>Tutup</Button>}
        {r.status === 'closed' && <Button size="sm" variant="ghost" busy={busy === 'open'} onClick={() => setStatus('open')}>Buka lagi</Button>}
      </div>
    </li>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('open');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => get(`/admin/reports?status=${tab}`).then(setData).catch(setError), [tab]);
  useEffect(() => { setData(null); load(); }, [load]);
  return (
    <>
      <AdminTitle title="Antrean laporan" intro="Soal dengan tiga laporan &quot;kunci jawaban salah&quot; dari pengguna berbeda otomatis disembunyikan sampai ditinjau. Aktifkan lagi dari halaman sunting soal setelah diperbaiki." />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
        { value: 'open', label: 'Dibuka', count: data?.counts.open },
        { value: 'handling', label: 'Ditangani', count: data?.counts.handling },
        { value: 'closed', label: 'Ditutup', count: data?.counts.closed },
      ]} />
      {error && <ErrorState error={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (data.reports.length ? (
        <ul className="space-y-3">{data.reports.map((r) => <ReportRow key={r.id} r={r} categories={data.categories} onDone={load} />)}</ul>
      ) : <p className="py-10 text-center text-muted">Tidak ada laporan di sini.</p>)}
    </>
  );
}
