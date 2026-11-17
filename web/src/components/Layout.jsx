import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bookmark, Home, LayoutGrid, Map, Moon, Shield, Sun, User, WifiOff } from 'lucide-react';
import { useAuth, isStaff } from '../lib/auth.jsx';
import { usePrefs } from '../lib/prefs.jsx';
import { post } from '../lib/api.js';
import { load, save } from '../lib/storage.js';
import { FloatingMascot, MascotSpacer } from '../mascot/Mascot.jsx';

export function Logo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <picture>
        <source srcSet="/brand/logo.webp" type="image/webp" />
        <img src="/brand/icon-192.png" alt="" className="h-9 w-9 rounded-xl" width="36" height="36" />
      </picture>
      {!compact && (
        <span className="whitespace-nowrap font-display text-xl font-bold leading-none">
          Persiapan<span className="text-primary"> IUP</span>
        </span>
      )}
    </span>
  );
}

export function ThemeButton() {
  const { theme, setTheme } = usePrefs();
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return (
    <button
      type="button"
      className="btn-ghost btn-sm !min-h-[40px] !px-2.5"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Pakai mode terang' : 'Pakai mode gelap'}
      title={theme === 'system' ? 'Mengikuti sistem' : undefined}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-center text-sm font-bold text-warn-ink">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      Kamu sedang offline. Jawaban yang kamu pilih akan dikirim begitu koneksi kembali.
    </div>
  );
}

function VerifyBanner() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => load('iup-verify-dismissed', false));
  const [sent, setSent] = useState(false);
  if (!user || user.email_verified || hidden) return null;
  return (
    <div className="border-b border-line bg-primary-soft">
      <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm text-primary-ink">
        <span className="font-bold">Verifikasi email kamu supaya akunmu aman dan bisa dipulihkan.</span>
        {sent ? (
          <span>Tautan sudah dikirim ke {user.email}.</span>
        ) : (
          <button type="button" className="link" onClick={() => post('/auth/verify/resend').then(() => setSent(true)).catch(() => setSent(true))}>
            Kirim ulang tautan
          </button>
        )}
        <button type="button" className="ml-auto text-meta underline" onClick={() => { save('iup-verify-dismissed', true); setHidden(true); }}>
          Nanti saja
        </button>
      </div>
    </div>
  );
}

const NAV = [
  { to: '/beranda', label: 'Beranda', icon: Home },
  { to: '/kurikulum', label: 'Kurikulum', icon: Map },
  { to: '/ditandai', label: 'Ditandai', icon: Bookmark },
  { to: '/profil', label: 'Profil', icon: User },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/60">
      <div className="wrap flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <Logo />
          <p className="mt-3">
            Web latihan gratis untuk calon mahasiswa kedokteran jalur IUP. <strong className="text-ink">Bukan situs resmi</strong> UNAIR,
            UGM, maupun UI, dan tidak menjamin kelulusan.
          </p>
        </div>
        <nav aria-label="Informasi" className="flex flex-wrap gap-x-5 gap-y-2 font-bold">
          <Link className="hover:text-ink" to="/panduan/UNAIR">Panduan kampus</Link>
          <Link className="hover:text-ink" to="/tentang">Tentang</Link>
          <Link className="hover:text-ink" to="/privasi">Privasi</Link>
          <Link className="hover:text-ink" to="/ketentuan">Ketentuan</Link>
        </nav>
      </div>
    </footer>
  );
}

/** Kerangka halaman untuk pengguna yang sudah masuk. */
export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Lewati ke konten
      </a>
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="wrap flex h-16 items-center gap-4">
          <Link to="/beranda" aria-label="Beranda Persiapan IUP"><Logo /></Link>
          <nav aria-label="Utama" className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `btn-ghost btn-sm ${isActive ? '!bg-primary-soft !text-primary-ink' : ''}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {isStaff(user) && (
              <Link to="/admin" className="btn-ghost btn-sm" aria-label="Panel admin"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Admin</span></Link>
            )}
            <ThemeButton />
          </div>
        </div>
      </header>
      <VerifyBanner />
      <main id="konten" className="flex-1 pb-24 md:pb-0">
        <Outlet />
        <MascotSpacer />
      </main>
      <Footer />
      <nav aria-label="Navigasi bawah" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[0.75rem] font-bold ${isActive ? 'text-primary-ink' : 'text-muted'}`}>
              {({ isActive }) => (
                <>
                  <span className={`grid h-7 w-12 place-items-center rounded-full ${isActive ? 'bg-primary-soft' : ''}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <FloatingMascot bottomNav />
    </div>
  );
}

/** Kerangka halaman publik (landing, masuk, panduan, info). */
export function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="wrap flex h-16 items-center gap-3">
          <Link to="/" aria-label="Halaman depan Persiapan IUP"><Logo /></Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeButton />
            {user ? (
              <Link to="/beranda" className="btn-primary btn-sm whitespace-nowrap"><LayoutGrid className="h-4 w-4" /> Beranda</Link>
            ) : (
              <>
                <Link to="/masuk" className="btn-ghost btn-sm whitespace-nowrap">Masuk</Link>
                <Link to="/daftar" className="btn-primary btn-sm whitespace-nowrap">Daftar<span className="hidden sm:inline">&nbsp;gratis</span></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="konten" className="flex-1">
        <Outlet />
        <MascotSpacer />
      </main>
      <Footer />
      <FloatingMascot />
    </div>
  );
}
