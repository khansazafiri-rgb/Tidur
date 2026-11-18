import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../../lib/api.js';
import { num } from '../../lib/format.js';
import { Alert, Button, ErrorState, Skeleton } from '../../components/ui.jsx';
import { AdminTitle } from './AdminApp.jsx';
import { useAuth } from '../../lib/auth.jsx';

export default function Sources() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [enrichment, setEnrichment] = useState(null);
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [confirmedRights, setConfirmedRights] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => Promise.all([
    get('/admin/sources'), get('/admin/enrichment/preview'),
  ]).then(([r, e]) => { setRows(r.sources); setEnrichment(e); setError(null); }).catch(setError), []);
  useEffect(() => { load(); }, [load]);

  const folders = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) {
      const k = r.folder || '(tanpa folder)';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return [...m.entries()];
  }, [rows]);

  async function publish(body, key) {
    setBusy(key); setMsg('');
    try { const r = await post('/admin/sources/publish', body); setMsg(`${r.changed} soal diperbarui statusnya.`); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  }

  async function verifyEnrichment() {
    setBusy('verify-enrichment');
    setMsg('');
    try {
      const result = await post('/admin/enrichment/verify', { confirmedReview, confirmedRights });
      setMsg(num(result.changed) + ' soal lengkap dipindahkan ke draf setelah konfirmasi admin. Terbitkan secara terpisah.');
      setConfirmedReview(false);
      setConfirmedRights(false);
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy('');
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!rows) return <Skeleton className="h-64" />;
  return (
    <>
      <AdminTitle title="Sumber soal" intro="Setiap file JSON yang sudah diimpor, dikelompokkan per folder pengumpulan. Soal draf belum tampil ke pengguna; buka sampelnya lalu terbitkan per kelompok." />
      {msg && <Alert tone="info" className="mb-4" onClose={() => setMsg('')}>{msg}</Alert>}
      {enrichment && (
        <section className="card mb-5 p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Verifikasi pengayaan massal</h2>
          <p className="mt-1 text-sm text-muted">
            Pemeriksaan otomatis hanya memastikan kelengkapan data, bukan kebenaran kunci atau pembahasan.
            Soal yang sudah dikonfirmasi pemilik dipindahkan ke draf; tidak otomatis diterbitkan.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="chip-muted">{num(enrichment.total)} menunggu pengayaan</span>
            <span className="chip-success">{num(enrichment.ready)} lengkap secara teknis</span>
            <span className="chip-warn">{num(enrichment.blocked)} masih kurang lengkap</span>
          </div>
          {enrichment.blocked > 0 && (
            <p className="mt-2 text-sm text-muted">
              Kekurangan: {[
                ['answer', 'kunci'], ['explanation', 'pembahasan'], ['subtopic', 'subtopik'],
                ['difficulty', 'kesulitan'], ['options', 'pilihan'], ['stem', 'pertanyaan'], ['format', 'format'],
              ].filter(([key]) => enrichment.reasons[key]).map(([key, label]) => label + ' ' + num(enrichment.reasons[key])).join(' · ')}.
              Satu soal bisa memiliki lebih dari satu kekurangan.
              <Link to="/admin/soal?status=pending_enrichment" className="link ml-2">Periksa daftar soal</Link>
            </p>
          )}
          {user?.role === 'owner' && (
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={confirmedReview} onChange={(e) => setConfirmedReview(e.target.checked)} />
                <span>Saya sudah meninjau dan memastikan kunci serta pembahasan soal yang akan diproses benar.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={confirmedRights} onChange={(e) => setConfirmedRights(e.target.checked)} />
                <span>Saya memiliki izin atau hak yang diperlukan untuk menggunakan dan menerbitkan soal.</span>
              </label>
              <Button
                busy={busy === 'verify-enrichment'}
                disabled={!enrichment.ready || !confirmedReview || !confirmedRights || !!busy}
                onClick={verifyEnrichment}
              >
                Verifikasi {num(enrichment.ready)} soal lengkap → Draf
              </Button>
            </div>
          )}
        </section>
      )}
      <div className="space-y-5">
        {folders.map(([folder, files]) => {
          const sum = (k) => files.reduce((n, f) => n + (f[k] || 0), 0);
          return (
            <section key={folder} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-sunken/60 px-4 py-3">
                <h2 className="font-bold">{folder}</h2>
                <span className="text-meta text-muted">{files.length} file · aktif {num(sum('active'))} · draf {num(sum('draft'))} · pengayaan {num(sum('pending'))} · dilewati {num(sum('skipped'))}</span>
                <div className="ml-auto flex gap-2">
                  {sum('draft') > 0 && <Button size="sm" busy={busy === folder} onClick={() => publish({ folder }, folder)}>Terbitkan folder</Button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-meta text-muted"><tr><th className="p-2">File</th><th className="p-2">Bentuk</th><th className="p-2">Kampus</th><th className="p-2 text-right">Aktif</th><th className="p-2 text-right">Draf</th><th className="p-2 text-right">Pengayaan</th><th className="p-2 text-right">Disembunyikan</th><th className="p-2 text-right">Dilewati</th><th className="p-2" /></tr></thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id} className="border-t border-line">
                        <td className="max-w-[320px] p-2"><Link className="link truncate" to={`/admin/soal?source=${f.id}`} title={f.filename}>{f.filename}</Link>{f.progress_status && f.progress_status !== 'complete' && <span className="chip-warn ml-2">{f.progress_status}</span>}</td>
                        <td className="p-2"><code>{f.format}</code></td>
                        <td className="p-2">{f.university || '–'}</td>
                        <td className="p-2 text-right tabular-nums">{f.active || 0}</td>
                        <td className="p-2 text-right tabular-nums">{f.draft || 0}</td>
                        <td className="p-2 text-right tabular-nums">{f.pending || 0}</td>
                        <td className="p-2 text-right tabular-nums">{f.hidden || 0}</td>
                        <td className="p-2 text-right tabular-nums">{f.skipped || 0}</td>
                        <td className="p-2 text-right">
                          {f.draft > 0 && <Button size="sm" variant="secondary" busy={busy === f.id} onClick={() => publish({ ids: [f.id] }, f.id)}>Terbitkan</Button>}
                          {f.active > 0 && !f.draft && <Button size="sm" variant="ghost" busy={busy === f.id} onClick={() => publish({ ids: [f.id], unpublish: true }, f.id)}>Jadikan draf</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {!folders.length && <p className="py-10 text-center text-muted">Belum ada file. Mulai dari halaman Impor JSON, atau jalankan <code>npm run import</code>.</p>}
      </div>
    </>
  );
}
