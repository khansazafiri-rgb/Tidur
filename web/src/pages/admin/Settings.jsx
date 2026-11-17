import { useCallback, useEffect, useState } from 'react';
import { get, post, put } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { num } from '../../lib/format.js';
import { Alert, Button, Field, Skeleton, Toggle } from '../../components/ui.jsx';
import { AdminTitle } from './AdminApp.jsx';

export function SettingsAdmin() {
  const { user } = useAuth();
  const owner = user.role === 'owner';
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const [staff, setStaff] = useState([]);
  const [role, setRole] = useState({ email: '', role: 'contributor' });
  const load = useCallback(() => {
    get('/admin/settings').then(setS).catch(() => {});
    get('/admin/staff').then((r) => setStaff(r.staff)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(body, key) {
    setBusy(key); setMsg(null);
    try { await put('/admin/settings', body); setMsg({ tone: 'success', text: 'Pengaturan tersimpan.' }); load(); } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(''); }
  }
  async function calibrate() {
    setBusy('cal'); setMsg(null);
    try { const r = await post('/admin/calibrate'); setMsg({ tone: 'success', text: `Kalibrasi selesai: ${r.calibrated} soal dikalibrasi dari ${r.questions_with_data} soal yang punya data.` }); } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(''); }
  }
  async function setStaffRole(e) {
    e.preventDefault();
    setBusy('role'); setMsg(null);
    try { await put('/admin/roles', role); setMsg({ tone: 'success', text: 'Peran diperbarui.' }); setRole({ email: '', role: 'contributor' }); load(); } catch (err) { setMsg({ tone: 'danger', text: err.message }); } finally { setBusy(''); }
  }

  if (!s) return <Skeleton className="h-96" />;
  const cal = s.calibration;
  const mix = s.difficulty_mix;
  return (
    <>
      <AdminTitle title="Pengaturan" intro="Saklar maskot, aturan sembunyi otomatis, ambang kalibrasi kesulitan, dan peran admin." />
      {!owner && <Alert tone="info" className="mb-4">Hanya pemilik yang bisa mengubah pengaturan.</Alert>}
      {msg && <Alert tone={msg.tone} className="mb-4" onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Maskot dan laporan</h2>
          <Toggle checked={s.mascot_enabled} onChange={(v) => owner && save({ mascot_enabled: v }, 'mascot')} label="Tampilkan maskot di seluruh web"
            description="Mematikan maskot melayang dan reaksinya untuk semua pengguna. Ilustrasi layar kosong tetap tampil." />
          <Field label="Sembunyikan otomatis setelah N laporan &quot;kunci salah&quot;" htmlFor="ah">
            <div className="flex gap-2">
              <input id="ah" type="number" min={1} className="input w-24" defaultValue={s.auto_hide_wrong_key_reports} disabled={!owner} onBlur={(e) => owner && save({ auto_hide_wrong_key_reports: Number(e.target.value) }, 'ah')} />
            </div>
          </Field>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Kalibrasi kesulitan</h2>
          <p className="text-sm text-muted">Label AI tidak pernah ditimpa. Hasil kalibrasi dipakai bila sudah ada cukup jawaban dari sesi yang selesai. Berjalan otomatis setiap hari.</p>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({ calibration: {
              min_distinct_users: Number(f.get('min')), easy_above: Number(f.get('easy')) / 100, hard_below: Number(f.get('hard')) / 100, slow_factor: Number(f.get('slow')),
              target_seconds: { easy: Number(f.get('te')), medium: Number(f.get('tm')), hard: Number(f.get('th')) },
            } }, 'cal-save');
          }}>
            <Field label="Minimal pengguna berbeda" htmlFor="min"><input id="min" name="min" type="number" className="input" defaultValue={cal.min_distinct_users} disabled={!owner} /></Field>
            <Field label="Kali waktu target = naik level" htmlFor="slow"><input id="slow" name="slow" type="number" step="0.1" className="input" defaultValue={cal.slow_factor} disabled={!owner} /></Field>
            <Field label="Mudah bila benar di atas (%)" htmlFor="easy"><input id="easy" name="easy" type="number" className="input" defaultValue={Math.round(cal.easy_above * 100)} disabled={!owner} /></Field>
            <Field label="Sulit bila benar di bawah (%)" htmlFor="hard"><input id="hard" name="hard" type="number" className="input" defaultValue={Math.round(cal.hard_below * 100)} disabled={!owner} /></Field>
            <Field label="Waktu target mudah (detik)" htmlFor="te"><input id="te" name="te" type="number" className="input" defaultValue={cal.target_seconds?.easy} disabled={!owner} /></Field>
            <Field label="Waktu target sedang (detik)" htmlFor="tm"><input id="tm" name="tm" type="number" className="input" defaultValue={cal.target_seconds?.medium} disabled={!owner} /></Field>
            <Field label="Waktu target sulit (detik)" htmlFor="th"><input id="th" name="th" type="number" className="input" defaultValue={cal.target_seconds?.hard} disabled={!owner} /></Field>
            {owner && <div className="col-span-2 flex flex-wrap gap-2"><Button type="submit" variant="secondary" busy={busy === 'cal-save'}>Simpan ambang</Button><Button busy={busy === 'cal'} onClick={calibrate}>Jalankan kalibrasi sekarang</Button></div>}
          </form>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Bobot kesulitan campuran</h2>
          <p className="text-sm text-muted">Dipakai saat pengguna memilih kesulitan &quot;Campuran&quot;. Bawaan PRD: 30% mudah, 50% sedang, 20% sulit.</p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({ difficulty_mix: { easy: Number(f.get('e')) / 100, medium: Number(f.get('m')) / 100, hard: Number(f.get('h')) / 100 } }, 'mix');
          }}>
            {[['e', 'Mudah', mix.easy], ['m', 'Sedang', mix.medium], ['h', 'Sulit', mix.hard]].map(([k, l, v]) => (
              <Field key={k} label={`${l} (%)`} htmlFor={`mx-${k}`}><input id={`mx-${k}`} name={k} type="number" className="input w-24" defaultValue={Math.round(v * 100)} disabled={!owner} /></Field>
            ))}
            {owner && <Button type="submit" variant="secondary" busy={busy === 'mix'}>Simpan</Button>}
          </form>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Peran admin</h2>
          <ul className="space-y-1 text-sm">{staff.map((m) => <li key={m.email} className="flex justify-between"><span>{m.display_name} · {m.email}</span><span className="chip-muted">{m.role === 'owner' ? 'Pemilik' : 'Kontributor'}</span></li>)}</ul>
          {owner && (
            <form onSubmit={setStaffRole} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <Field label="Email pengguna terdaftar" htmlFor="re"><input id="re" type="email" className="input" value={role.email} onChange={(e) => setRole({ ...role, email: e.target.value })} required /></Field>
              <select className="input w-auto" value={role.role} onChange={(e) => setRole({ ...role, role: e.target.value })} aria-label="Peran"><option value="contributor">Kontributor</option><option value="owner">Pemilik</option><option value="user">Pengguna biasa</option></select>
              <Button type="submit" variant="secondary" busy={busy === 'role'}>Terapkan</Button>
            </form>
          )}
          <p className="text-meta text-muted">Pemilik bisa mengubah blueprint, kurikulum, dan pengaturan. Kontributor bisa mengimpor soal dan menangani laporan.</p>
        </section>
      </div>
    </>
  );
}

export function SkippedAdmin() {
  const [d, setD] = useState(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => { get(`/admin/skipped?limit=200&offset=${offset}`).then(setD).catch(() => setD({ skipped: [], total: 0 })); }, [offset]);
  return (
    <>
      <AdminTitle title="Soal bergambar (dilewati)" intro="Soal yang dilewati saat pemrosesan karena butuh gambar. Disimpan lengkap dengan halaman dan subtopiknya untuk dikerjakan di Fase 4." />
      {!d ? <Skeleton className="h-96" /> : (
        <>
          <p className="mb-2 text-sm text-muted">{num(d.total)} soal</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left"><tr><th className="p-2">Folder</th><th className="p-2">File</th><th className="p-2 text-right">seq</th><th className="p-2 text-right">Hal.</th><th className="p-2">Subtopik</th><th className="p-2">Alasan</th></tr></thead>
              <tbody>
                {d.skipped.map((k) => (
                  <tr key={k.id} className="border-t border-line">
                    <td className="p-2">{k.folder}</td>
                    <td className="max-w-[260px] truncate p-2" title={k.filename}>{k.filename}</td>
                    <td className="p-2 text-right tabular-nums">{k.seq}</td>
                    <td className="p-2 text-right tabular-nums">{k.page ?? '–'}</td>
                    <td className="p-2"><code className="text-meta">{k.subtopic_code || '–'}</code></td>
                    <td className="max-w-[320px] p-2 text-meta text-muted">{k.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between">
            <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 200))}>Sebelumnya</Button>
            <Button size="sm" variant="secondary" disabled={offset + 200 >= d.total} onClick={() => setOffset(offset + 200)}>Berikutnya</Button>
          </div>
        </>
      )}
    </>
  );
}
