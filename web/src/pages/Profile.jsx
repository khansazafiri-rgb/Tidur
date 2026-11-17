import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, GraduationCap, LogOut, Trash2 } from 'lucide-react';
import { del, get, post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { usePrefs, TEXT_SCALES } from '../lib/prefs.jsx';
import { UNIS, UNI_NAMES, dateId, duration } from '../lib/format.js';
import { Alert, Button, Field, Modal, PageHeader, Segmented, Tabs, Toggle } from '../components/ui.jsx';

const REPORT_STATUS = { open: ['chip-info', 'Dibuka'], handling: ['chip-warn', 'Ditangani'], closed: ['chip-success', 'Ditutup'] };

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.display_name);
  const [unis, setUnis] = useState(user.target_universities);
  const [date, setDate] = useState(user.exam_date || '');
  const [minutes, setMinutes] = useState(user.daily_minutes || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const toggle = (u) => setUnis((cur) => (cur.includes(u) ? cur.filter((x) => x !== u) : cur.length >= 3 ? cur : [...cur, u]));
  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await updateProfile({ display_name: name, target_universities: unis, exam_date: date || null, daily_minutes: minutes ? Number(minutes) : null });
      setMsg({ tone: 'success', text: 'Profil tersimpan.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: err.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="card space-y-5 p-5 sm:p-6">
      <Field label="Nama tampil" htmlFor="nama"><input id="nama" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required /></Field>
      <fieldset>
        <legend className="label">Kampus target</legend>
        <div className="flex flex-wrap gap-2">
          {UNIS.map((u) => (
            <button key={u} type="button" aria-pressed={unis.includes(u)} onClick={() => toggle(u)} title={UNI_NAMES[u]}
              className={`min-h-[44px] rounded-xl2 border-2 px-4 font-bold ${unis.includes(u) ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line'}`}>{u}</button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal tes" htmlFor="tgl"><input id="tgl" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Waktu belajar per hari (menit)" htmlFor="menit"><input id="menit" type="number" min={5} max={600} className="input" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
      </div>
      <p className="text-meta text-muted">Email: {user.email} {user.email_verified ? '· terverifikasi' : '· belum terverifikasi'}</p>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" busy={busy}>Simpan profil</Button>
    </form>
  );
}

function Preferences() {
  const { theme, setTheme, textScale, setTextScale, mascotHidden, setMascotHidden } = usePrefs();
  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <Segmented label="Tema" value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }, { value: 'system', label: 'Ikuti sistem' }]} />
      <Segmented label="Ukuran teks soal" value={textScale} onChange={setTextScale} options={TEXT_SCALES.map((v) => ({ value: v, label: `${Math.round(v * 100)}%` }))} />
      <Toggle checked={!mascotHidden} onChange={(v) => setMascotHidden(!v)} label="Tampilkan Oyen" description="Kucing dokter di pojok kanan bawah: misi harian, petunjuk soal, dan tips. Animasinya otomatis mati bila perangkatmu memakai pengaturan kurangi gerak." />
      <Link to="/tutorial" className="btn-secondary"><GraduationCap className="h-4 w-4" /> Ulangi tutorial</Link>
      <p className="text-meta text-muted">Pengaturan ini tersimpan di perangkat ini saja.</p>
    </div>
  );
}

function History() {
  const [rows, setRows] = useState(null);
  useEffect(() => { get('/me/sessions').then((r) => setRows(r.sessions)).catch(() => setRows([])); }, []);
  if (!rows) return <div className="skeleton h-32" />;
  if (!rows.length) return <p className="py-6 text-center text-muted">Belum ada sesi latihan.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{r.title}</p>
            <p className="text-meta text-muted">{dateId(r.started_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.total} soal · mode {r.mode}{r.total_ms ? ` · ${duration(r.total_ms)}` : ''}</p>
          </div>
          {r.status === 'submitted' ? (
            <Link to={`/sesi/${r.id}/hasil`} className="btn-secondary btn-sm">{Math.round(r.score)}% · Lihat</Link>
          ) : (
            <Link to={`/sesi/${r.id}`} className="btn-accent btn-sm">Lanjutkan</Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function MyReports() {
  const [rows, setRows] = useState(null);
  useEffect(() => { get('/me/reports').then((r) => setRows(r.reports)).catch(() => setRows([])); }, []);
  if (!rows) return <div className="skeleton h-32" />;
  if (!rows.length) return <p className="py-6 text-center text-muted">Kamu belum pernah melapor soal. Kalau menemukan kunci yang salah, tombol Lapor ada di setiap soal.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const [cls, label] = REPORT_STATUS[r.status];
        return (
          <li key={r.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2"><span className={cls}>{label}</span><span className="text-meta text-muted">{dateId(r.created_at)}</span></div>
            <p className="mt-1 line-clamp-2 text-sm">{r.stem}</p>
            {r.note && <p className="text-meta text-muted">Catatanmu: {r.note}</p>}
            {r.resolution_note && <p className="text-meta font-bold text-success-ink">Tanggapan admin: {r.resolution_note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function DangerZone() {
  const { user, logout, setUser } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true); setError('');
    try {
      await del('/me', user.has_password ? { password } : { confirm });
      setUser(null);
      nav('/', { replace: true });
    } catch (e) { setError(e.message); setBusy(false); }
  }
  return (
    <div className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={async () => { await logout(); nav('/', { replace: true }); }}><LogOut className="h-4 w-4" /> Keluar</Button>
        <a href="/api/me/export" className="btn-secondary" download><Download className="h-4 w-4" /> Unduh data saya</a>
        <Button variant="danger" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" /> Hapus akun</Button>
      </div>
      <p className="text-meta text-muted">Menghapus akun akan menghapus profil, riwayat latihan, dan soal yang kamu tandai secara permanen.</p>
      <Modal open={open} onClose={() => setOpen(false)} title="Hapus akun?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button><Button variant="danger" busy={busy} onClick={remove}>Hapus permanen</Button></>}>
        <p>Semua datamu akan dihapus dan tidak bisa dikembalikan.</p>
        {user.has_password ? (
          <Field label="Masukkan kata sandimu" htmlFor="pw" error={error}><input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        ) : (
          <Field label='Ketik "HAPUS" untuk mengonfirmasi' htmlFor="cf" error={error}><input id="cf" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        )}
      </Modal>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profil');
  return (
    <div className="wrap max-w-3xl py-6 sm:py-8">
      <PageHeader eyebrow="Profil" title={user.display_name} intro="Atur target, preferensi tampilan, dan data akunmu." />
      {!user.email_verified && (
        <Alert tone="info" className="mb-4">
          Email belum terverifikasi. <button type="button" className="link" onClick={() => post('/auth/verify/resend').catch(() => {})}>Kirim ulang tautan verifikasi</button>
        </Alert>
      )}
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { value: 'profil', label: 'Profil' },
        { value: 'tampilan', label: 'Tampilan' },
        { value: 'riwayat', label: 'Riwayat' },
        { value: 'laporan', label: 'Laporan saya' },
        { value: 'akun', label: 'Akun' },
      ]} />
      {tab === 'profil' && <ProfileForm />}
      {tab === 'tampilan' && <Preferences />}
      {tab === 'riwayat' && <div className="card px-5"><History /></div>}
      {tab === 'laporan' && <div className="card px-5"><MyReports /></div>}
      {tab === 'akun' && <DangerZone />}
    </div>
  );
}
