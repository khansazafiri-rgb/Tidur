import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { UNIS } from '../../lib/format.js';
import { Markdown } from '../../components/Markdown.jsx';
import { Alert, Button, ErrorState, Segmented, Skeleton } from '../../components/ui.jsx';
import { AdminTitle } from './AdminApp.jsx';

function OwnerNote() {
  return <Alert tone="info" className="mb-4">Hanya pemilik yang bisa mengubah bagian ini. Kontributor bisa melihat.</Alert>;
}

function SubtopicRow({ s, mapping, canEdit, onSaved }) {
  const [form, setForm] = useState({ name: s.name, description: s.description, status: s.status, universities: UNIS.filter((u) => mapping.has(`${u}:${s.code}`)) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const toggle = (u) => setForm((f) => ({ ...f, universities: f.universities.includes(u) ? f.universities.filter((x) => x !== u) : [...f.universities, u] }));
  async function save() {
    setBusy(true); setMsg('');
    try { await put(`/admin/curriculum/subtopics/${s.code}`, form); setMsg('Tersimpan'); onSaved(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <tr className="border-t border-line align-top">
      <td className="p-2"><code className="text-meta">{s.code}</code><div className="text-meta text-muted">{s.active_count} soal aktif</div></td>
      <td className="p-2"><input className="input" value={form.name} disabled={!canEdit} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label={`Nama ${s.code}`} /></td>
      <td className="p-2"><textarea className="input min-h-[44px]" value={form.description} disabled={!canEdit} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label={`Deskripsi ${s.code}`} /></td>
      <td className="p-2">
        <select className="input" value={form.status} disabled={!canEdit} onChange={(e) => setForm({ ...form, status: e.target.value })} aria-label={`Status ${s.code}`}>
          <option value="active">Aktif</option><option value="soon">Segera hadir</option><option value="hidden">Disembunyikan</option>
        </select>
      </td>
      <td className="p-2">
        <div className="flex gap-2">{UNIS.map((u) => (
          <label key={u} className="flex items-center gap-1 text-sm"><input type="checkbox" disabled={!canEdit} checked={form.universities.includes(u)} onChange={() => toggle(u)} />{u}</label>
        ))}</div>
      </td>
      <td className="p-2">{canEdit && <Button size="sm" variant="secondary" busy={busy} onClick={save}>Simpan</Button>}{msg && <p className="mt-1 text-meta text-muted">{msg}</p>}</td>
    </tr>
  );
}

export function CurriculumAdmin() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => get('/admin/curriculum').then(setD).catch(setError), []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorState error={error} />;
  if (!d) return <Skeleton className="h-96" />;
  const mapping = new Set(d.mapping.map((m) => `${m.university_code}:${m.subtopic_code}`));
  const canEdit = user.role === 'owner';
  return (
    <>
      <AdminTitle title="Kurikulum" intro="Nama, deskripsi, status subtopik, dan pemetaan subtopik ke kampus. Subtopik berstatus segera hadir tampil tetapi tidak bisa dimulai." />
      {!canEdit && <OwnerNote />}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-sunken text-left"><tr><th className="p-2">Kode</th><th className="p-2">Nama</th><th className="p-2">Deskripsi</th><th className="p-2">Status</th><th className="p-2">Diuji di</th><th className="p-2" /></tr></thead>
          <tbody>{d.subtopics.map((s) => <SubtopicRow key={s.code} s={s} mapping={mapping} canEdit={canEdit} onSaved={load} />)}</tbody>
        </table>
      </div>
    </>
  );
}

export function GuidesAdmin() {
  const [uni, setUni] = useState('UNAIR');
  const [md, setMd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setMd(null); get(`/guides/${uni}`).then((r) => setMd(r.content_md)).catch(() => setMd('')); }, [uni]);
  async function save() {
    setBusy(true); setMsg(null);
    try { await put(`/admin/guides/${uni}`, { content_md: md }); setMsg({ tone: 'success', text: 'Panduan tersimpan dan langsung tampil.' }); } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(false); }
  }
  return (
    <>
      <AdminTitle title="Panduan kampus" intro="Isi halaman panduan per kampus (Markdown). Perubahan langsung tampil tanpa rilis ulang. Pertahankan catatan bahwa informasi tidak resmi." />
      <Segmented className="mb-4" value={uni} onChange={setUni} options={UNIS.map((u) => ({ value: u, label: u }))} />
      {md == null ? <Skeleton className="h-96" /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <textarea className="input min-h-[480px] font-mono text-sm" value={md} onChange={(e) => setMd(e.target.value)} aria-label={`Isi panduan ${uni}`} />
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Button busy={busy} onClick={save}>Simpan panduan</Button>
          </div>
          <div className="card p-5"><p className="eyebrow mb-2">Pratinjau</p><Markdown>{md}</Markdown></div>
        </div>
      )}
    </>
  );
}

function compositionToText(c) {
  return Object.entries(c).map(([k, v]) => `${k}: ${v}`).join('\n');
}
function textToComposition(t) {
  const out = {};
  for (const line of t.split('\n')) {
    const m = line.match(/^\s*([A-Z_.]+)\s*:\s*(\d+)\s*$/i);
    if (m) out[m[1].toUpperCase()] = Number(m[2]);
  }
  return out;
}

function BlueprintCard({ b, canEdit, onSaved }) {
  const [name, setName] = useState(b.name);
  const [note, setNote] = useState(b.source_note);
  const [sections, setSections] = useState(b.sections.map((s) => ({ ...s, text: compositionToText(s.composition) })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const total = sections.reduce((n, s) => n + Object.values(textToComposition(s.text)).reduce((a, x) => a + x, 0), 0);
  const minutes = sections.reduce((n, s) => n + Number(s.minutes || 0), 0);
  async function save() {
    setBusy(true); setMsg(null);
    try {
      await put(`/admin/blueprints/${b.id}`, { name, source_note: note, rules: b.rules, sections: sections.map((s) => ({ name: s.name, minutes: Number(s.minutes), composition: textToComposition(s.text) })) });
      setMsg({ tone: 'success', text: 'Blueprint tersimpan.' }); onSaved();
    } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(false); }
  }
  const upd = (i, k, v) => setSections((ss) => ss.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  return (
    <section className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2"><span className="chip-info">{b.university_code}</span><input className="input max-w-xs font-bold" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} aria-label="Nama paket" /><span className="text-meta text-muted">{total} soal · {minutes} menit</span></div>
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((s, i) => (
          <div key={i} className="rounded-xl2 border border-line p-3">
            <div className="flex gap-2"><input className="input" value={s.name} disabled={!canEdit} onChange={(e) => upd(i, 'name', e.target.value)} aria-label="Nama bagian" /><input className="input w-24" type="number" min={1} value={s.minutes} disabled={!canEdit} onChange={(e) => upd(i, 'minutes', e.target.value)} aria-label="Durasi menit" /></div>
            <textarea className="input mt-2 min-h-[90px] font-mono text-sm" value={s.text} disabled={!canEdit} onChange={(e) => upd(i, 'text', e.target.value)} aria-label="Komposisi, satu baris per unit atau subtopik" />
            <p className="text-meta text-muted">Format: <code>UNIT atau SUBTOPIK: jumlah</code> per baris.</p>
          </div>
        ))}
      </div>
      <textarea className="input text-sm" value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} aria-label="Sumber angka" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {canEdit && <Button size="sm" busy={busy} onClick={save}>Simpan</Button>}
    </section>
  );
}

export function BlueprintsAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const load = useCallback(() => get('/admin/blueprints').then((r) => setRows(r.blueprints)).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <AdminTitle title="Blueprint try out" intro="Struktur try out per kampus disimpan sebagai data, bukan kode. Fitur try out untuk pengguna dibuka di Fase 2; angka di sini masih sementara (1 soal 1 menit) sampai ada angka resmi." />
      {user.role !== 'owner' && <OwnerNote />}
      {!rows ? <Skeleton className="h-96" /> : <div className="space-y-4">{rows.map((b) => <BlueprintCard key={b.id} b={b} canEdit={user.role === 'owner'} onSaved={load} />)}</div>}
    </>
  );
}
