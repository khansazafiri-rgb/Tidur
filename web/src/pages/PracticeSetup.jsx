import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpenCheck, Clock, Coffee, Play } from 'lucide-react';
import { get, post } from '../lib/api.js';
import { num } from '../lib/format.js';
import { Alert, Button, ErrorState, PageSkeleton, Segmented, Toggle } from '../components/ui.jsx';
import { SubtopicIcon, UnitImage, toneOf } from '../components/learn.jsx';
import { useMascot, useMascotContext } from '../mascot/Mascot.jsx';

export default function PracticeSetup() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const mascot = useMascot();
  const subCode = params.get('subtopik');
  const unitCode = params.get('unit');
  const source = params.get('sumber');
  const [cur, setCur] = useState(null);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('mixed');
  const [mode, setMode] = useState('santai');
  const [timer, setTimer] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState('');
  useMascotContext('learningPage');

  useEffect(() => { get('/curriculum?all=1').then(setCur).catch(setError); }, []);
  useEffect(() => { setMinutes(count); }, [count]);

  const target = useMemo(() => {
    if (!cur) return null;
    if (source === 'ditandai') return { kind: 'bookmarks', name: 'Soal yang ditandai', unit: 'KHUSUS' };
    for (const u of cur.units) {
      if (unitCode && u.code === unitCode) {
        const subs = u.subtopics.filter((s) => s.status === 'active');
        const diffs = { easy: 0, medium: 0, hard: 0 };
        subs.forEach((s) => { diffs.easy += s.difficulties.easy; diffs.medium += s.difficulties.medium; diffs.hard += s.difficulties.hard; });
        return { kind: 'unit', name: `Unit ${u.name}`, unit: u.code, code: u.code, total: u.question_count, difficulties: diffs, description: u.description };
      }
      const s = u.subtopics.find((x) => x.code === subCode);
      if (s) return { kind: 'subtopic', name: s.name, unit: u.code, code: s.code, total: s.question_count, difficulties: s.difficulties, description: s.description, soon: s.status !== 'active' };
    }
    return null;
  }, [cur, subCode, unitCode, source]);

  async function start() {
    setBusy(true); setStartError('');
    try {
      const body = { count, difficulty, mode, timerMinutes: timer ? minutes : null };
      if (target.kind === 'unit') Object.assign(body, { source: 'unit', unit: target.code });
      else if (target.kind === 'bookmarks') Object.assign(body, { source: 'bookmarks' });
      else Object.assign(body, { source: 'subtopic', subtopics: [target.code] });
      const s = await post('/sessions', body);
      mascot.emit('study_started');
      nav(`/sesi/${s.id}`);
    } catch (e) {
      setStartError(e.message);
      setBusy(false);
    }
  }

  if (error) return <div className="wrap py-8"><ErrorState error={error} /></div>;
  if (!cur) return <PageSkeleton />;
  if (!target) {
    return (
      <div className="wrap py-8">
        <Alert tone="warn" title="Subtopik tidak ditemukan">Pilih subtopik dari <Link to="/kurikulum" className="link">peta kurikulum</Link>.</Alert>
      </div>
    );
  }
  const t = toneOf(target.unit);
  const diffAvail = target.difficulties || { easy: 1, medium: 1, hard: 1 };

  return (
    <div className="wrap max-w-3xl py-6 sm:py-8">
      <p className="eyebrow mb-1">Atur sesi latihan</p>
      <div className={`card-bold mb-6 flex items-center gap-4 ${t.bg} p-4`} style={{ '--lip': t.lip }}>
        {target.kind === 'subtopic' ? (
          <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${t.fill} text-white`} style={{ boxShadow: `0 4px 0 rgb(${t.lip})` }}><SubtopicIcon code={target.code} className="h-8 w-8" /></span>
        ) : (
          <UnitImage unit={target.unit} className="h-16 w-16 shrink-0 object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.8rem] font-semibold leading-tight">{target.name}</h1>
          {target.description && <p className="text-sm text-ink/80">{target.description}</p>}
          {target.total != null && <p className="text-meta font-bold text-ink/70">{num(target.total)} soal tersedia</p>}
        </div>
        <Link to="/kurikulum" className="btn-ghost btn-sm shrink-0">Ganti</Link>
      </div>

      {target.soon ? (
        <Alert tone="info" title="Segera hadir">Soal subtopik ini butuh gambar dan sedang disiapkan.</Alert>
      ) : (
        <div className="card space-y-6 p-5 sm:p-6">
          <Segmented label="Jumlah soal" value={count} onChange={setCount} options={[10, 20, 30].map((n) => ({ value: n, label: `${n} soal` }))} />
          <Segmented
            label="Tingkat kesulitan"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'mixed', label: 'Campuran' },
              { value: 'easy', label: 'Mudah', hint: target.difficulties ? num(diffAvail.easy) : null, disabled: target.difficulties && !diffAvail.easy },
              { value: 'medium', label: 'Sedang', hint: target.difficulties ? num(diffAvail.medium) : null, disabled: target.difficulties && !diffAvail.medium },
              { value: 'hard', label: 'Sulit', hint: target.difficulties ? num(diffAvail.hard) : null, disabled: target.difficulties && !diffAvail.hard },
            ]}
          />
          <div>
            <span className="label">Mode</span>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Mode latihan">
              {[
                { v: 'santai', icon: Coffee, title: 'Santai', desc: 'Pembahasan muncul langsung setelah kamu menjawab tiap soal.' },
                { v: 'ujian', icon: BookOpenCheck, title: 'Ujian', desc: 'Jawaban bisa diganti. Pembahasan baru dibuka setelah sesi dikumpulkan.' },
              ].map(({ v, icon: Icon, title, desc }) => (
                <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                  style={{ '--lip': mode === v ? 'var(--primary-lip)' : 'var(--line-strong)' }}
                  className={`flex gap-3 rounded-2xl border-2 p-4 text-left shadow-[0_4px_0_rgb(var(--lip))] transition-[transform,box-shadow] active:translate-y-[4px] active:shadow-none ${mode === v ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-sunken'}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${mode === v ? 'bg-primary text-white' : 'bg-sunken text-muted'}`}><Icon className="h-6 w-6" /></span>
                  <span><strong className="block font-display text-lg font-semibold">{title}</strong><span className="text-sm text-muted">{desc}</span></span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl2 border border-line px-4 py-2">
            <Toggle checked={timer} onChange={setTimer} label="Pakai timer" description="Saat waktu habis, sesi dikumpulkan otomatis. Bawaannya 1 menit per soal." />
            {timer && (
              <div className="flex items-center gap-3 pb-2">
                <Clock className="h-5 w-5 text-muted" aria-hidden="true" />
                <label htmlFor="menit" className="text-sm font-bold">Durasi</label>
                <input id="menit" type="number" min={1} max={180} className="input w-24" value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
                <span className="text-sm text-muted">menit</span>
              </div>
            )}
          </div>
          {startError && <Alert tone="warn">{startError}</Alert>}
          <Button onClick={start} busy={busy} size="lg" className="w-full"><Play className="h-5 w-5 fill-current" /> Mulai latihan</Button>
        </div>
      )}
    </div>
  );
}
