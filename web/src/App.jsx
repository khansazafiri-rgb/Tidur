import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, isStaff } from './lib/auth.jsx';
import { PrefsProvider } from './lib/prefs.jsx';
import { get } from './lib/api.js';
import { MascotProvider } from './mascot/Mascot.jsx';
import { AppLayout, PublicLayout } from './components/Layout.jsx';
import { PageSkeleton } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from './pages/Auth.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Curriculum from './pages/Curriculum.jsx';
import PracticeSetup from './pages/PracticeSetup.jsx';
import Bookmarks from './pages/Bookmarks.jsx';
import Guide from './pages/Guide.jsx';
import Profile from './pages/Profile.jsx';
import { About, Privacy, Terms } from './pages/Info.jsx';
import NotFound from './pages/NotFound.jsx';

const Session = lazy(() => import('./pages/Session.jsx'));
const Result = lazy(() => import('./pages/Result.jsx'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));
const Tutorial = lazy(() => import('./pages/Tutorial.jsx'));

function RequireAuth({ children, onboarding = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to={`/masuk?lanjut=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (onboarding && !user.onboarded) return <Navigate to="/mulai" replace />;
  return children;
}

function RequireStaff({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/masuk?lanjut=/admin" replace />;
  if (!isStaff(user)) return <NotFound />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (user) return <Navigate to={user.onboarded ? '/beranda' : '/mulai'} replace />;
  return children;
}

function Shell() {
  // Saklar admin untuk mematikan semua maskot.
  const [mascotEnabled, setMascotEnabled] = useState(true);
  useEffect(() => { get('/settings/public').then((s) => setMascotEnabled(s.mascot_enabled !== false)).catch(() => {}); }, []);
  return (
    <MascotProvider enabled={mascotEnabled}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="masuk" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="daftar" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="lupa-sandi" element={<ForgotPassword />} />
            <Route path="atur-sandi" element={<ResetPassword />} />
            <Route path="verifikasi" element={<VerifyEmail />} />
            <Route path="mulai" element={<RequireAuth onboarding={false}><Onboarding /></RequireAuth>} />
            <Route path="panduan/:code" element={<Guide />} />
            <Route path="tentang" element={<About />} />
            <Route path="privasi" element={<Privacy />} />
            <Route path="ketentuan" element={<Terms />} />
          </Route>
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="beranda" element={<Home />} />
            <Route path="kurikulum" element={<Curriculum />} />
            <Route path="latihan/baru" element={<PracticeSetup />} />
            <Route path="ditandai" element={<Bookmarks />} />
            <Route path="profil" element={<Profile />} />
            <Route path="sesi/:id/hasil" element={<Result />} />
          </Route>
          <Route path="sesi/:id" element={<RequireAuth><Session /></RequireAuth>} />
          <Route path="tutorial" element={<RequireAuth><Tutorial /></RequireAuth>} />
          <Route path="admin/*" element={<RequireStaff><AdminApp /></RequireStaff>} />
          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </MascotProvider>
  );
}

export function App() {
  return (
    <PrefsProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </PrefsProvider>
  );
}
