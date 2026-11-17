import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../../lib/api.js';
import { num } from '../../lib/format.js';
import { Alert, Button, ErrorState, Skeleton } from '../../components/ui.jsx';
import { AdminTitle } from './AdminApp.jsx';

export default function Sources() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => get('/admin/sources').then((r) => setRows(r.sources)).catch(setError), []);
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

  if (error) return <ErrorState error={error} />;
  if (!rows) return <Skeleton className="h-64" />;
  return (
    <>
      <AdminTitle title="Sumber soal" intro="Setiap file JSON yang sudah diimpor, dikelompokkan per folder pengumpulan. Soal draf belum tampil ke pengguna; buka sampelnya lalu terbitkan per kelompok." />
      {msg && <Alert tone="info" className="mb-4" onClose={() => setMsg('')}>{msg}</Alert>}
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
