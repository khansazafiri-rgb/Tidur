import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileUp, Upload } from 'lucide-react';
import { get, post } from '../../lib/api.js';
import { num, dateId } from '../../lib/format.js';
import { Markdown } from '../../components/Markdown.jsx';
import { Alert, Button, DifficultyBadge, Toggle } from '../../components/ui.jsx';
import { AdminTitle } from './AdminApp.jsx';

function Count({ label, value, tone = '' }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <div className={`font-display text-2xl font-bold ${tone}`}>{num(value || 0)}</div>
      <div className="text-meta text-muted">{label}</div>
    </div>
  );
}

function Preview({ p }) {
  const c = p.counts;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip-info">Bentuk: {p.format}</span>
        {p.university && <span className="chip-muted">Kampus: {p.university}</span>}
        {p.year && <span className="chip-muted">Tahun: {p.year}</span>}
        {p.language && <span className="chip-muted">Bahasa: {p.language}</span>}
        {p.already_imported && <span className="chip-warn">{p.file_unchanged ? 'Sudah pernah diimpor, isi sama' : 'Sudah pernah diimpor, isi berubah'}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Count label="Total soal" value={c.total} />
        <Count label="Baru" value={c.new} tone="text-success-ink" />
        <Count label="Diperbarui" value={c.updated} tone="text-primary-ink" />
        <Count label="Tidak berubah" value={c.unchanged} />
        <Count label="Duplikat" value={c.duplicates} tone="text-warn-ink" />
        <Count label="Dilewati (gambar)" value={c.skipped} />
        <Count label="Direvisi" value={c.revised} />
        <Count label="Menunggu pengayaan" value={c.pending_enrichment} tone="text-warn-ink" />
      </div>
      {p.errors.length > 0 && (
        <Alert tone="danger" title={`${p.errors.length} galat: file akan ditolak utuh`}>
          <ul className="mt-1 max-h-60 list-disc overflow-y-auto pl-5">{p.errors.slice(0, 100).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Alert>
      )}
      {p.warnings.length > 0 && (
        <Alert tone="warn" title={`${p.warnings.length} peringatan`}>
          <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5">{p.warnings.slice(0, 100).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="mb-2 font-bold">Sebaran per subtopik</h3>
          <ul className="space-y-1 text-sm">{Object.entries(p.by_subtopic).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between"><code>{k}</code><span className="font-bold">{v}</span></li>)}</ul>
        </section>
        <section className="card p-4">
          <h3 className="mb-2 font-bold">Sebaran kesulitan</h3>
          <ul className="space-y-1 text-sm">{Object.entries(p.by_difficulty).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-bold">{v}</span></li>)}</ul>
          {(p.duplicates.length > 0 || p.near_duplicates.length > 0) && (
            <>
              <h3 className="mb-1 mt-4 font-bold">Duplikat dan soal mirip</h3>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-meta text-muted">
                {p.duplicates.map((d) => <li key={`d${d.seq}`}>seq {d.seq}: sama dengan {d.of}{d.action ? ` (${d.action})` : ''}</li>)}
                {p.near_duplicates.map((d) => <li key={`n${d.seq}`}>seq {d.seq}: mirip {d.similar_to} (dicek admin, tidak dihapus)</li>)}
              </ul>
            </>
          )}
        </section>
      </div>
      {p.samples?.length > 0 && (
        <section>
          <h3 className="mb-2 font-bold">Lima soal acak untuk diperiksa</h3>
          <div className="space-y-3">
            {p.samples.map((q) => (
              <article key={q.seq} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-meta"><span className="font-bold">seq {q.seq}</span><code>{q.subtopic}</code>{q.difficulty && <DifficultyBadge level={q.difficulty} />}{q.revision && <span className="chip-warn">revisi: {q.revision.type}</span>}</div>
                {q.passage && <details className="rounded-lg bg-sunken p-2 text-sm"><summary className="cursor-pointer font-bold">Bacaan{q.passage.title ? `: ${q.passage.title}` : ''}</summary><Markdown>{q.passage.text}</Markdown></details>}
                <Markdown>{q.stem}</Markdown>
                <ul className="space-y-1 text-sm">{Object.entries(q.options).map(([k, v]) => <li key={k} className={k === q.answer ? 'font-bold text-success-ink' : ''}>{k}. <Markdown inline>{v}</Markdown>{k === q.answer && ' ✓'}</li>)}</ul>
                {q.explanation && <div className="rounded-lg bg-sunken p-3 text-sm"><Markdown>{q.explanation}</Markdown><p className="mt-1 text-meta text-muted">sumber pembahasan: {q.explanation_source || '–'}</p></div>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function Import() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [content, setContent] = useState(null);
  const [folder, setFolder] = useState('');
  const [publish, setPublish] = useState(true);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [logs, setLogs] = useState([]);
  const loadLogs = () => get('/admin/import/logs').then((r) => setLogs(r.logs)).catch(() => {});
  useEffect(() => { loadLogs(); }, []);

  async function choose(f) {
    setFile(f); setPreview(null); setResult(null); setError('');
    if (!f) return;
    const text = await f.text();
    setContent(text);
    setBusy('preview');
    try { setPreview(await post('/admin/import/preview', { filename: f.name, folder: folder || null, content: text })); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  async function commit() {
    setBusy('commit'); setError('');
    try {
      const r = await post('/admin/import/commit', { filename: file.name, folder: folder || null, content, publish });
      setResult(r); setPreview(null); loadLogs();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(''); }
  }

  return (
    <>
      <AdminTitle title="Impor JSON" intro="Unggah satu file hasil skill pemrosesan PDF. Web memvalidasi, memeriksa duplikat, lalu menampilkan pratinjau sebelum disimpan. Impor ulang file yang sama tidak menggandakan soal." />
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
          <div>
            <span className="label">File JSON</span>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl2 border-2 border-dashed border-line bg-sunken/50 p-4 text-left hover:border-primary">
              <FileUp className="h-8 w-8 text-primary-ink" />
              <span><strong className="block">{file ? file.name : 'Pilih file .json'}</strong><span className="text-meta text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : 'Skema IUP, skema lama, atau SOAL STRIKE'}</span></span>
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => choose(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label htmlFor="folder" className="label">Folder pengumpulan (opsional)</label>
            <input id="folder" className="input" placeholder="mis. UNAIR - NUMERIK" value={folder} onChange={(e) => setFolder(e.target.value)} />
          </div>
        </div>
        {busy === 'preview' && <p className="text-muted">Memeriksa file…</p>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      {preview && (
        <div className="mt-6 space-y-4">
          <Preview p={preview} />
          <div className="card flex flex-wrap items-center gap-4 p-4">
            <div className="flex-1"><Toggle checked={publish} onChange={setPublish} label="Langsung terbitkan" description="Matikan untuk menyimpan sebagai draf, lalu terbitkan dari halaman Sumber soal setelah dicek." /></div>
            <Button busy={busy === 'commit'} disabled={!preview.ok} onClick={commit}><Upload className="h-4 w-4" /> Simpan ke bank soal</Button>
          </div>
        </div>
      )}
      {result && (
        <Alert tone={result.committed ? 'success' : 'danger'} className="mt-6" title={result.committed ? `File ${result.outcome}` : 'File ditolak'}>
          {result.committed
            ? <>Baru {result.counts.new}, diperbarui {result.counts.updated}, duplikat {result.counts.duplicates}, dilewati {result.counts.skipped}.</>
            : <ul className="list-disc pl-5">{result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </Alert>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-bold">Log impor</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left"><tr><th className="p-2">Waktu</th><th className="p-2">File</th><th className="p-2">Folder</th><th className="p-2">Hasil</th><th className="p-2 text-right">Baru</th><th className="p-2 text-right">Duplikat</th><th className="p-2 text-right">Dilewati</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="whitespace-nowrap p-2">{dateId(l.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="max-w-[280px] truncate p-2" title={l.filename}>{l.filename}</td>
                  <td className="p-2">{l.folder || '–'}</td>
                  <td className="p-2">{l.outcome === 'ditolak' ? <span className="chip-danger">ditolak</span> : <span className="chip-success"><CheckCircle2 className="h-3 w-3" />{l.outcome}</span>}</td>
                  <td className="p-2 text-right tabular-nums">{l.summary.counts?.new ?? '–'}</td>
                  <td className="p-2 text-right tabular-nums">{l.summary.counts?.duplicates ?? '–'}</td>
                  <td className="p-2 text-right tabular-nums">{l.summary.counts?.skipped ?? '–'}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={7} className="p-4 text-center text-muted">Belum ada impor.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
