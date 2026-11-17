import { useEffect, useState } from 'react';
import { get } from '../../lib/api.js';
import { num, pct } from '../../lib/format.js';
import { ErrorState, Skeleton, Stat } from '../../components/ui.jsx';
import { AdminTitle, STATUS_LABEL } from './AdminApp.jsx';

function Bars({ rows, label }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Belum ada data 14 hari terakhir.</p>;
  return (
    <div>
      <div className="flex h-36 items-end gap-1" role="img" aria-label={label}>
        {rows.map((r) => (
          <div key={r.day} className="group relative flex-1">
            <div className="rounded-t bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${(r.n / max) * 130 + 2}px` }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[0.7rem] text-bg group-hover:block">{r.day.slice(5)}: {r.n}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.75rem] text-muted"><span>{rows[0].day.slice(5)}</span><span>{rows.at(-1).day.slice(5)}</span></div>
    </div>
  );
}

export default function Overview() {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { get('/admin/metrics').then(setM).catch(setError); }, []);
  if (error) return <ErrorState error={error} />;
  if (!m) return <Skeleton className="h-64" />;
  const qs = m.questions_by_status;
  return (
    <>
      <AdminTitle title="Ringkasan" intro="Metrik ringkas pemakaian dan kesehatan bank soal." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><Stat value={num(m.users_total)} label="Pengguna" hint={`+${num(m.users_new_7d)} minggu ini`} /></div>
        <div className="card p-4"><Stat value={num(qs.active || 0)} label="Soal aktif" /></div>
        <div className="card p-4"><Stat value={num(m.reports_open)} label="Laporan terbuka" /></div>
        <div className="card p-4"><Stat value={m.helpful_rate.n ? pct(m.helpful_rate.r) : '–'} label="Pembahasan membantu" hint={`${num(m.helpful_rate.n)} penilaian`} /></div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-bold">Sesi latihan per hari</h2><Bars rows={m.sessions_per_day} label="Grafik sesi per hari" /></section>
        <section className="card p-5"><h2 className="mb-3 font-bold">Soal dijawab per hari</h2><Bars rows={m.answers_per_day} label="Grafik jawaban per hari" /></section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Bank soal per status</h2>
          <ul className="space-y-2">
            {Object.entries(STATUS_LABEL).map(([k, [cls, label]]) => (
              <li key={k} className="flex items-center justify-between"><span className={cls}>{label}</span><span className="font-bold tabular-nums">{num(qs[k] || 0)}</span></li>
            ))}
            <li className="flex items-center justify-between border-t border-line pt-2"><span className="chip-muted">Dilewati (butuh gambar)</span><span className="font-bold tabular-nums">{num(m.skipped_total)}</span></li>
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Corong aktivasi</h2>
          <ul className="space-y-3">
            {[['Daftar', m.funnel.signup], ['Onboarding selesai', m.funnel.onboarding], ['Latihan pertama selesai', m.funnel.first_practice]].map(([label, n]) => (
              <li key={label}>
                <div className="flex justify-between text-sm"><span>{label}</span><span className="font-bold">{num(n)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-sunken"><div className="h-full rounded-full bg-accent" style={{ width: `${m.funnel.signup ? (n / m.funnel.signup) * 100 : 0}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
