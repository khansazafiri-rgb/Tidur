import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { get, post } from '../lib/api.js';
import { Alert, Button, Field } from '../components/ui.jsx';
import { MascotPose } from '../mascot/Mascot.jsx';

function AuthCard({ title, intro, children, pose = 'greeting' }) {
  return (
    <div className="wrap grid max-w-5xl items-center gap-8 py-10 md:grid-cols-[1fr_1.1fr]">
      <div className="hidden justify-center md:flex"><MascotPose pose={pose} size={300} /></div>
      <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="text-page">{title}</h1>
        {intro && <p className="mt-1 text-muted">{intro}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} className="input pr-12" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} required minLength={8} />
      <button type="button" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink"
        onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

function GoogleButton() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { get('/auth/providers').then((p) => setEnabled(p.google)).catch(() => {}); }, []);
  if (!enabled) return null;
  return (
    <>
      <a href="/api/auth/google" className="btn-secondary w-full">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" /></svg>
        Lanjut dengan Google
      </a>
      <div className="my-5 flex items-center gap-3 text-meta text-muted"><span className="h-px flex-1 bg-line" />atau<span className="h-px flex-1 bg-line" /></div>
    </>
  );
}

function safeNext(next, fallback) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('galat') || '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(email, password);
      nav(u.onboarded ? safeNext(params.get('lanjut'), '/beranda') : '/mulai', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Masuk" intro="Lanjutkan latihanmu dari perangkat mana saja.">
      <GoogleButton />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email" htmlFor="email">
          <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Kata sandi" htmlFor="password">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <div className="text-right"><Link to="/lupa-sandi" className="link text-sm">Lupa kata sandi?</Link></div>
        <Button type="submit" busy={busy} className="w-full">Masuk</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Belum punya akun? <Link to="/daftar" className="link">Daftar gratis</Link></p>
    </AuthCard>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) { setError('Kata sandi minimal 8 karakter.'); return; }
    setBusy(true); setError('');
    try {
      await register(form.email, form.password, form.name);
      nav('/mulai', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Daftar gratis" intro="Tanpa biaya dan tanpa persetujuan admin. Langsung bisa latihan.">
      <GoogleButton />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Nama panggilan" htmlFor="name" hint="Dipakai untuk menyapamu. Bisa diubah nanti.">
          <input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="nickname" maxLength={60} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </Field>
        <Field label="Kata sandi" htmlFor="password" hint="Minimal 8 karakter.">
          <PasswordInput id="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Button type="submit" busy={busy} className="w-full">Buat akun</Button>
        <p className="text-meta text-muted">
          Dengan mendaftar kamu menyetujui <Link to="/ketentuan" className="link">ketentuan</Link> dan <Link to="/privasi" className="link">kebijakan privasi</Link>.
          Kalau usiamu di bawah 18 tahun, pastikan orang tua atau walimu mengetahuinya.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Sudah punya akun? <Link to="/masuk" className="link">Masuk</Link></p>
    </AuthCard>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await post('/auth/forgot', { email }); setSent(true); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <AuthCard title="Lupa kata sandi" intro="Kami kirim tautan untuk membuat kata sandi baru." pose="thinking">
      {sent ? (
        <Alert tone="success" title="Cek email kamu">Kalau email itu terdaftar, tautan atur ulang sudah dikirim. Tautan berlaku 1 jam.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email" htmlFor="email">
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Button type="submit" busy={busy} className="w-full">Kirim tautan</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/masuk" className="link">Kembali ke halaman masuk</Link></p>
    </AuthCard>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await post('/auth/reset', { token: params.get('token'), password });
      setUser(r.user);
      nav('/beranda', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard title="Buat kata sandi baru" pose="thinking">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Kata sandi baru" htmlFor="password" hint="Minimal 8 karakter.">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        <Button type="submit" busy={busy} className="w-full">Simpan dan masuk</Button>
      </form>
    </AuthCard>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    post('/auth/verify', { token: params.get('token') })
      .then(() => { setState('ok'); refresh(); })
      .catch((e) => { setError(e.message); setState('error'); });
  }, [params, refresh]);
  return (
    <AuthCard title="Verifikasi email" pose={state === 'error' ? 'thinking' : 'excited'}>
      {state === 'loading' && <p className="text-muted">Sedang memverifikasi…</p>}
      {state === 'ok' && <Alert tone="success" title="Email terverifikasi">Terima kasih! Akunmu sudah aman.</Alert>}
      {state === 'error' && <Alert tone="danger">{error}</Alert>}
      <Link to="/beranda" className="btn-primary mt-6 w-full">Ke beranda</Link>
    </AuthCard>
  );
}
