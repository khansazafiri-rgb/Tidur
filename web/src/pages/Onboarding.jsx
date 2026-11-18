import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { UNIS, UNI_NAMES } from '../lib/format.js';
import { Alert, Button, ProgressBar } from '../components/ui.jsx';
import { MascotPose } from '../mascot/Mascot.jsx';

const MINUTES = [15, 30, 60, 90, 120];
const POSES = ['greeting', 'thinking', 'studying'];

export default function Onboarding() {
  const { user, updateProfile } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [unis, setUnis] = useState(user.target_universities || []);
  const [date, setDate] = useState(user.exam_date || '');
  const [minutes, setMinutes] = useState(user.daily_minutes || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (u) => setUnis((cur) => (cur.includes(u) ? cur.filter((x) => x !== u) : cur.length >= 3 ? cur : [...cur, u]));

  async function finish(changes = {}) {
    setBusy(true); setError('');
    try {
      const u = await updateProfile({ target_universities: unis, exam_date: date || null, daily_minutes: minutes, ...changes, onboarded: true });
      // Pengguna baru langsung diajak tutorial (bisa dilewati di sana).
      nav(u.tutorial_status ? '/beranda' : '/tutorial', { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const next = () => (step < 2 ? setStep(step + 1) : finish());
  const skip = () => {
    if (step === 0) setUnis([]);
    if (step === 1) setDate('');
    if (step === 2) { setMinutes(null); finish({ daily_minutes: null }); return; }
    setStep(step + 1);
  };

  return (
    <div className="wrap max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-meta font-bold text-muted">Langkah {step + 1} dari 3</span>
        <ProgressBar value={step + 1} max={3} tone="accent" className="flex-1" label="Kemajuan pengisian" />
      </div>
      <div className="card grid gap-6 p-6 sm:grid-cols-[1fr_180px] sm:p-8">
        <div>
          {step === 0 && (
            <>
              <h1 className="text-page">Kampus mana yang kamu incar?</h1>
              <p className="mt-2 text-muted">Pilih satu sampai tiga. Kurikulum dan rekomendasi latihan akan menyesuaikan.</p>
              <div className="mt-6 grid gap-3" role="group" aria-label="Kampus target">
                {UNIS.map((u) => {
                  const on = unis.includes(u);
                  return (
                    <button key={u} type="button" onClick={() => toggle(u)} aria-pressed={on}
                      style={{ '--lip': on ? 'var(--primary-lip)' : 'var(--line-strong)' }}
                      className={`flex min-h-[68px] items-center gap-4 rounded-2xl border-2 px-4 text-left shadow-[0_4px_0_rgb(var(--lip))] transition-[transform,box-shadow] active:translate-y-[4px] active:shadow-none ${on ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-sunken'}`}>
                      <span className={`grid h-7 w-7 place-items-center rounded-lg border-2 ${on ? 'border-primary bg-primary text-white' : 'border-line'}`}>{on && <Check className="h-4 w-4" />}</span>
                      <span><span className="block font-display text-lg font-bold">{u}</span><span className="text-sm text-muted">{UNI_NAMES[u]}</span></span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="text-page">Kapan tesnya?</h1>
              <p className="mt-2 text-muted">Kami tampilkan hitung mundur di beranda. Boleh dilewati kalau belum tahu.</p>
              <label htmlFor="tgl" className="label mt-6">Tanggal tes</label>
              <input id="tgl" type="date" className="input max-w-xs" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-page">Berapa lama belajar per hari?</h1>
              <p className="mt-2 text-muted">Sedikit tapi rutin lebih ampuh. 15 menit cukup untuk 10 soal.</p>
              <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Waktu belajar per hari">
                {MINUTES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
                    style={{ '--lip': minutes === m ? 'var(--primary-lip)' : 'var(--line-strong)' }}
                    className={`min-h-[50px] rounded-2xl border-2 px-4 font-display font-semibold shadow-[0_4px_0_rgb(var(--lip))] active:translate-y-[4px] active:shadow-none ${minutes === m ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line bg-surface hover:bg-sunken'}`}>
                    {m >= 120 ? '2 jam+' : m >= 60 ? `${m / 60 === 1 ? '1' : '1,5'} jam` : `${m} menit`}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Kembali</Button>}
            <Button variant="ghost" className="ml-auto" onClick={skip} disabled={busy}>Lewati</Button>
            <Button onClick={next} busy={busy && step === 2} disabled={step === 0 && unis.length === 0}>
              {step < 2 ? <>Lanjut <ArrowRight className="h-4 w-4" /></> : 'Selesai'}
            </Button>
          </div>
        </div>
        <div className="order-first flex items-end justify-center sm:order-none"><MascotPose pose={POSES[step]} size={170} /></div>
      </div>
    </div>
  );
}
