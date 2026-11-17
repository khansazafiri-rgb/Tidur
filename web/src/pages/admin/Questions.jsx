import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { get, patch } from '../../lib/api.js';
import { num, dateId, pct, duration } from '../../lib/format.js';
import { Markdown } from '../../components/Markdown.jsx';
import { Alert, Button, DifficultyBadge, ErrorState, Field, Skeleton } from '../../components/ui.jsx';
import { AdminTitle, StatusChip, STATUS_LABEL } from './AdminApp.jsx';

function useSubtopics() {
  const [subs, setSubs] = useState([]);
  useEffect(() => { get('/admin/curriculum').then((r) => setSubs(r.subtopics)).catch(() => {}); }, []);
  return subs;
}

export function QuestionList() {
  const [params, setParams] = useSearchParams();
  const subs = useSubtopics();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState(params.get('q') || '');
  const offset = Number(params.get('offset') || 0);
  const limit = 25;

  const load = useCallback(() => {
    setError(null);
    const p = new URLSearchParams(params);
    p.set('limit', String(limit));
    get(`/admin/questions?${p}`).then(setData).catch(setError);
  }, [params]);
  useEffect(load, [load]);

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'offset') n.delete('offset');
    setParams(n);
  };

  return (
    <>
      <AdminTitle title="Bank soal" intro="Cari dan saring soal, lalu buka untuk menyunting, menyembunyikan, atau melihat catatan revisi dan versi aslinya." />
      <form className="card mb-4 grid gap-3 p-4 md:grid-cols-[2fr_1.5fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); setParam('q', q); }}>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Cari teks soal atau id" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari soal" /></div>
        <select className="input" value={params.get('subtopic') || ''} onChange={(e) => setParam('subtopic', e.target.value)} aria-label="Subtopik">
          <option value="">Semua subtopik</option>
          {subs.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
        </select>
        <select className="input" value={params.get('status') || ''} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="input" value={params.get('difficulty') || ''} onChange={(e) => setParam('difficulty', e.target.value)} aria-label="Kesulitan">
          <option value="">Semua kesulitan</option><option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option>
        </select>
        <Button type="submit" variant="secondary">Cari</Button>
        <div className="flex flex-wrap gap-4 text-sm md:col-span-5">
          <label className="flex items-center gap-2"><input type="checkbox" checked={params.get('revised') === '1'} onChange={(e) => setParam('revised', e.target.checked ? '1' : '')} /> Hanya yang direvisi</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={params.get('reported') === '1'} onChange={(e) => setParam('reported', e.target.checked ? '1' : '')} /> Punya laporan terbuka</label>
          {params.get('source') && <button type="button" className="link" onClick={() => setParam('source', '')}>Hapus filter file</button>}
        </div>
      </form>
      {error && <ErrorState error={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-96" />}
      {data && (
        <>
          <p className="mb-2 text-sm text-muted">{num(data.total)} soal</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left"><tr><th className="p-2">Soal</th><th className="p-2">Subtopik</th><th className="p-2">Kesulitan</th><th className="p-2">Status</th><th className="p-2">File</th></tr></thead>
              <tbody>
                {data.questions.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top hover:bg-sunken/40">
                    <td className="max-w-[420px] p-2"><Link to={`/admin/soal/${r.id}`} className="font-semibold hover:underline">{r.stem || <em className="text-muted">(teks kosong)</em>}</Link>
                      <div className="mt-1 flex flex-wrap gap-1">{r.revised ? <span className="chip-warn">revisi</span> : null}{r.open_reports ? <span className="chip-danger">{r.open_reports} laporan</span> : null}{r.explanation_source === 'ai' && <span className="chip-muted">pembahasan AI</span>}</div></td>
                    <td className="p-2"><code className="text-meta">{r.subtopic_code}</code></td>
                    <td className="p-2"><DifficultyBadge level={r.difficulty_final} />{r.difficulty_calibrated && <span className="mt-1 block text-meta text-muted">AI: {r.difficulty_ai}</span>}</td>
                    <td className="p-2"><StatusChip status={r.status} /></td>
                    <td className="max-w-[220px] truncate p-2 text-meta text-muted" title={r.filename}>{r.filename} · seq {r.seq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setParam('offset', String(Math.max(0, offset - limit)))}>Sebelumnya</Button>
            <span className="text-sm text-muted">{offset + 1}–{Math.min(offset + limit, data.total)} dari {num(data.total)}</span>
            <Button variant="secondary" size="sm" disabled={offset + limit >= data.total} onClick={() => setParam('offset', String(offset + limit))}>Berikutnya</Button>
          </div>
        </>
      )}
    </>
  );
}

export function QuestionEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const subs = useSubtopics();
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => get(`/admin/questions/${id}`).then((r) => {
    setD(r);
    const q = r.question;
    setForm({ stem: q.stem, options: q.options, answer: q.answer || '', explanation: q.explanation || '', subtopic_code: q.subtopic_code, difficulty_calibrated: q.difficulty_calibrated || '', status: q.status, reason: '' });
  }).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true); setMsg(null);
    try {
      await patch(`/admin/questions/${id}`, { ...form, difficulty_calibrated: form.difficulty_calibrated || null });
      setMsg({ tone: 'success', text: 'Tersimpan.' });
      load();
    } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(false); }
  }

  if (error) return <ErrorState error={error} />;
  if (!d || !form) return <Skeleton className="h-96" />;
  const q = d.question;

  return (
    <>
      <button type="button" className="btn-ghost btn-sm mb-3" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /> Kembali</button>
      <AdminTitle title="Sunting soal" intro={`${q.filename} · seq ${q.seq} · nomor ${q.number ?? '–'} · versi ${q.version}`}><StatusChip status={q.status} /></AdminTitle>
      {q.hidden_reason && <Alert tone="warn" className="mb-4">{q.hidden_reason}</Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card space-y-4 p-5">
          {q.passage_text && <details className="rounded-lg bg-sunken p-3 text-sm"><summary className="cursor-pointer font-bold">Bacaan: {q.passage_title || q.passage_id}</summary><Markdown>{q.passage_text}</Markdown></details>}
          <Field label="Teks soal (Markdown + KaTeX)" htmlFor="stem" hint="Rumus ditulis di antara $...$. Untuk tanda dolar biasa (mata uang), tulis \$."><textarea id="stem" className="input min-h-[140px] font-mono text-sm" value={form.stem} onChange={(e) => set('stem', e.target.value)} /></Field>
          <fieldset className="space-y-2">
            <legend className="label">Pilihan</legend>
            {Object.keys(form.options).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <label className="flex w-14 items-center gap-1 font-bold"><input type="radio" name="answer" checked={form.answer === k} onChange={() => set('answer', k)} aria-label={`Jawaban benar ${k}`} />{k}</label>
                <input className="input font-mono text-sm" value={form.options[k]} onChange={(e) => set('options', { ...form.options, [k]: e.target.value })} aria-label={`Pilihan ${k}`} />
              </div>
            ))}
          </fieldset>
          <Field label="Pembahasan" htmlFor="expl"><textarea id="expl" className="input min-h-[160px] font-mono text-sm" value={form.explanation} onChange={(e) => set('explanation', e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Subtopik" htmlFor="sub"><select id="sub" className="input" value={form.subtopic_code} onChange={(e) => set('subtopic_code', e.target.value)}>{subs.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}</select></Field>
            <Field label="Kesulitan (timpa)" htmlFor="dif" hint={`Label AI: ${q.difficulty_ai || '–'}`}><select id="dif" className="input" value={form.difficulty_calibrated} onChange={(e) => set('difficulty_calibrated', e.target.value)}><option value="">Ikuti label AI</option><option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option></select></Field>
            <Field label="Status" htmlFor="st"><select id="st" className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(STATUS_LABEL).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          </div>
          <Field label="Alasan perubahan" htmlFor="rs" hint="Disimpan bersama versi lama di riwayat."><input id="rs" className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)} /></Field>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button busy={busy} onClick={save}>Simpan perubahan</Button>
        </section>
        <section className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-2 font-bold">Pratinjau</h2>
            <Markdown className="q-scale">{form.stem}</Markdown>
            <ul className="mt-3 space-y-1">{Object.entries(form.options).map(([k, v]) => <li key={k} className={k === form.answer ? 'font-bold text-success-ink' : ''}>{k}. <Markdown inline>{v}</Markdown></li>)}</ul>
            <div className="mt-3 rounded-lg bg-sunken p-3 text-sm"><Markdown>{form.explanation}</Markdown></div>
            <p className="mt-2 text-meta text-muted">Sumber jawaban: {q.answer_source || '–'} · sumber pembahasan: {q.explanation_source || '–'}</p>
          </div>
          {q.revision && (
            <div className="card p-5">
              <h2 className="mb-2 font-bold">Catatan revisi (hanya admin)</h2>
              <p className="text-sm"><span className="chip-warn">{q.revision.type}</span> {q.revision.note || q.revision.reason}</p>
              {q.revision.original && <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-sunken p-3 text-meta">{JSON.stringify(q.revision.original, null, 2)}</pre>}
            </div>
          )}
          <div className="card p-5">
            <h2 className="mb-2 font-bold">Statistik</h2>
            {d.stats ? <p className="text-sm">{num(d.stats.attempts)} jawaban dari {num(d.stats.distinct_users)} pengguna · benar {pct(d.stats.pct_correct)} · median {duration(d.stats.median_ms)}</p> : <p className="text-sm text-muted">Belum ada data (diperbarui saat kalibrasi).</p>}
            <p className="mt-1 text-sm">Pembahasan: {d.ratings.total ? `${d.ratings.helpful} dari ${d.ratings.total} menilai membantu` : 'belum dinilai'}</p>
          </div>
          {d.reports.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 font-bold">Laporan</h2>
              <ul className="space-y-2 text-sm">{d.reports.map((r) => <li key={r.id}><span className="chip-muted">{r.status}</span> <strong>{r.category}</strong> {r.note && `· ${r.note}`} <span className="text-meta text-muted">{dateId(r.created_at)}</span></li>)}</ul>
            </div>
          )}
          {d.versions.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 font-bold">Riwayat versi</h2>
              <ul className="space-y-2 text-sm">{d.versions.map((v, i) => (
                <li key={i}><details><summary className="cursor-pointer">Versi {v.version} · {dateId(v.created_at)} · {v.reason}</summary>
                  <div className="mt-2 rounded-lg bg-sunken p-3"><Markdown>{v.snapshot.stem}</Markdown><p className="mt-1 text-meta">Jawaban: {v.snapshot.answer}</p></div></details></li>
              ))}</ul>
            </div>
          )}
          {Object.keys(q.extra || {}).length > 0 && (
            <details className="card p-5"><summary className="cursor-pointer font-bold">Data tambahan dari file</summary><pre className="mt-2 max-h-72 overflow-auto text-meta">{JSON.stringify(q.extra, null, 2)}</pre></details>
          )}
        </section>
      </div>
    </>
  );
}
