import { NavLink, Route, Routes, Link } from 'react-router-dom';
import { BarChart3, BookOpen, FileJson, FolderOpen, Home, ImageOff, Library, MessageSquareWarning, Settings } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import { Logo, ThemeButton } from '../../components/Layout.jsx';
import Overview from './Overview.jsx';
import Import from './Import.jsx';
import Sources from './Sources.jsx';
import { QuestionList, QuestionEdit } from './Questions.jsx';
import Reports from './Reports.jsx';
import { CurriculumAdmin, GuidesAdmin, BlueprintsAdmin } from './Content.jsx';
import { SettingsAdmin, SkippedAdmin } from './Settings.jsx';

const LINKS = [
  ['', 'Ringkasan', BarChart3],
  ['impor', 'Impor JSON', FileJson],
  ['sumber', 'Sumber soal', FolderOpen],
  ['soal', 'Bank soal', Library],
  ['laporan', 'Laporan', MessageSquareWarning],
  ['kurikulum', 'Kurikulum', BookOpen],
  ['panduan', 'Panduan kampus', BookOpen],
  ['blueprint', 'Blueprint try out', BookOpen],
  ['dilewati', 'Soal bergambar', ImageOff],
  ['pengaturan', 'Pengaturan', Settings],
];

export default function AdminApp() {
  const { user } = useAuth();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link to="/admin" className="flex items-center gap-2"><Logo compact /><span className="font-display text-lg font-bold">Admin</span></Link>
          <span className="chip-muted">{user.role === 'owner' ? 'Pemilik' : 'Kontributor'}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeButton />
            <Link to="/beranda" className="btn-ghost btn-sm"><Home className="h-4 w-4" /> Ke web</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Menu admin" className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:self-start">
          {LINKS.map(([to, label, Icon]) => (
            <NavLink key={to} to={to ? `/admin/${to}` : '/admin'} end={!to} className={({ isActive }) => `btn-ghost btn-sm shrink-0 !justify-start ${isActive ? '!bg-primary-soft !text-primary-ink' : ''}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="impor" element={<Import />} />
            <Route path="sumber" element={<Sources />} />
            <Route path="soal" element={<QuestionList />} />
            <Route path="soal/:id" element={<QuestionEdit />} />
            <Route path="laporan" element={<Reports />} />
            <Route path="kurikulum" element={<CurriculumAdmin />} />
            <Route path="panduan" element={<GuidesAdmin />} />
            <Route path="blueprint" element={<BlueprintsAdmin />} />
            <Route path="dilewati" element={<SkippedAdmin />} />
            <Route path="pengaturan" element={<SettingsAdmin />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function AdminTitle({ title, intro, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export const STATUS_LABEL = {
  active: ['chip-success', 'Aktif'],
  draft: ['chip-info', 'Draf'],
  pending_enrichment: ['chip-warn', 'Menunggu pengayaan'],
  hidden: ['chip-danger', 'Disembunyikan'],
  retired: ['chip-muted', 'Dipensiunkan'],
};

export function StatusChip({ status }) {
  const [cls, label] = STATUS_LABEL[status] || ['chip-muted', status];
  return <span className={cls}>{label}</span>;
}
