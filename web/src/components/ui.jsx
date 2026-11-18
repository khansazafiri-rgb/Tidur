import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, X, XCircle } from 'lucide-react';
import { DIFF_LABEL } from '../lib/format.js';
import { MascotPose } from '../mascot/Mascot.jsx';

export function Button({ variant = 'primary', size, busy = false, className = '', children, ...rest }) {
  const v = { primary: 'btn-primary', accent: 'btn-accent', success: 'btn-success', dangerSolid: 'btn-danger-solid', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' }[variant];
  return (
    <button type="button" className={`${v} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''} ${className}`} aria-busy={busy || undefined} disabled={busy || rest.disabled} {...rest}>
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ bold = false, className = '', as: Tag = 'div', children, ...rest }) {
  return <Tag className={`${bold ? 'card-bold' : 'card'} ${className}`} {...rest}>{children}</Tag>;
}

export function PageHeader({ eyebrow, title, intro, children, art }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-end gap-4">
        {art}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-page">{title}</h1>
          {intro && <p className="mt-2 max-w-2xl text-intro text-muted">{intro}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/** Kontrol pilihan tunggal berbentuk tombol bersambung. */
export function Segmented({ label, value, onChange, options, className = '', size }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <span id={id} className="label">{label}</span>}
      <div role="radiogroup" aria-labelledby={label ? id : undefined} className="flex max-w-full flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={o.disabled}
              onClick={() => onChange(o.value)}
              style={{ '--lip': active ? 'var(--primary-lip)' : 'var(--line-strong)' }}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-xl2 border-2 px-4 font-display ${size === 'sm' ? 'text-sm' : 'text-[1rem]'} font-semibold shadow-[0_3px_0_rgb(var(--lip))] transition-[transform,box-shadow] active:translate-y-[3px] active:shadow-none disabled:opacity-40 ${
                active ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line bg-surface text-ink hover:bg-sunken'
              }`}
            >
              {o.icon}
              {o.label}
              {o.hint != null && <span className="rounded-full bg-black/5 px-1.5 text-meta font-bold opacity-80">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const BAR_TONE = { primary: 'bg-primary', success: 'bg-success', accent: 'bg-accent', danger: 'bg-danger', warn: 'bg-warn' };

export function ProgressBar({ value, max = 1, tone = 'primary', label, className = '', thin = false }) {
  const p = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const color = BAR_TONE[tone] || tone;
  return (
    <div className={`bar ${thin ? '!h-3' : ''} ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={label}>
      <i className={color} style={{ width: `${p > 0 ? Math.max(p * 100, 6) : 0}%` }} />
    </div>
  );
}

/** Cincin progres. value 0..1 atau null (belum ada data). */
export function Ring({ value, size = 48, stroke = 6, tone = 'rgb(var(--primary))', label, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <span className="absolute text-[0.75rem] font-extrabold">{children}</span>
    </div>
  );
}

const DIFF_STYLE = {
  easy: { bars: 1, cls: 'bg-success-soft text-success-ink' },
  medium: { bars: 2, cls: 'bg-warn-soft text-warn-ink' },
  hard: { bars: 3, cls: 'bg-danger-soft text-danger-ink' },
};

/** Lencana kesulitan: ikon bertingkat + teks, tidak hanya warna. */
export function DifficultyBadge({ level, count }) {
  const s = DIFF_STYLE[level] || DIFF_STYLE.medium;
  return (
    <span className={`chip ${s.cls}`}>
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3].map((b) => (
          <span key={b} className={`w-[3px] rounded-sm ${b <= s.bars ? 'bg-current' : 'bg-current opacity-25'}`} style={{ height: 4 + b * 3 }} />
        ))}
      </span>
      {DIFF_LABEL[level] || level}
      {count != null && <span className="opacity-75">· {count}</span>}
    </span>
  );
}

export function Stat({ label, value, hint, icon, tone = 'bg-primary-soft text-primary-ink' }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="font-display text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1 text-meta text-muted">{label}{hint && <span> · {hint}</span>}</div>
      </div>
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className = '', onClose }) {
  const map = {
    info: ['bg-primary-soft text-primary-ink', Info],
    success: ['bg-success-soft text-success-ink', CheckCircle2],
    warn: ['bg-warn-soft text-warn-ink', AlertTriangle],
    danger: ['bg-danger-soft text-danger-ink', XCircle],
  };
  const [cls, Icon] = map[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border-2 border-current/10 px-4 py-3 ${cls} ${className}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-extrabold">{title}</p>}
        {children && <div className="text-ink/90">{children}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="-m-1 rounded-lg p-1 hover:bg-black/5" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="wrap py-8" aria-busy="true" aria-label="Memuat">
      <Skeleton className="mb-3 h-5 w-32" />
      <Skeleton className="mb-8 h-10 w-2/3 max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
    </div>
  );
}

/** Layar kosong dengan ilustrasi kontekstual maskot. */
export function EmptyState({ pose = 'emptySearch', title, children, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-10'}`}>
      <MascotPose pose={pose} size={compact ? 150 : 220} />
      <h2 className="mt-3 text-section">{title}</h2>
      {children && <div className="mt-1 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, pose = 'lost' }) {
  const offline = error?.status === 0;
  return (
    <EmptyState
      pose={offline ? 'offline' : pose}
      title={offline ? 'Koneksi terputus' : 'Ada yang tidak beres'}
      action={onRetry && <Button variant="secondary" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Coba lagi</Button>}
    >
      {error?.message || 'Halaman ini gagal dimuat.'}
    </EmptyState>
  );
}

/** Dialog modal berbasis <dialog> (fokus terkunci dan Esc menutup secara bawaan). */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onClose?.(); }}
      onClick={(e) => { if (e.target === ref.current) onClose?.(); }}
      className={`w-[calc(100%-2rem)] ${w} rounded-[1.75rem] border-2 border-line bg-surface p-0 text-ink shadow-[0_6px_0_rgb(var(--line-strong)),0_24px_60px_rgb(30_35_71/0.25)] backdrop:bg-[rgb(30_35_71/0.45)] backdrop:backdrop-blur-[2px]`}
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
            <h2 id="modal-title" className="text-section">{title}</h2>
            <button type="button" onClick={onClose} className="-m-2 rounded-xl p-2 text-muted hover:bg-sunken hover:text-ink" aria-label="Tutup">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-3">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pb-6 pt-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full border-2 px-4 font-display font-semibold transition-colors ${
            value === t.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-muted hover:text-ink'
          }`}
        >
          {t.label}
          {t.count != null && <span className={`rounded-full px-2 text-meta font-extrabold ${value === t.value ? 'bg-white/25' : 'bg-sunken'}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-meta text-muted">{hint}</p>}
      {error && <p className="mt-1 text-meta font-bold text-danger-ink">{error}</p>}
    </div>
  );
}

/** Angka yang menghitung naik (dimatikan bila kurangi gerak). */
export function CountUp({ value, duration = 900, format = (v) => Math.round(v), reduced }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <>{format(shown)}</>;
}

export function Toggle({ checked, onChange, label, description, id }) {
  const autoId = useId();
  const fid = id || autoId;
  return (
    <label htmlFor={fid} className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block font-bold">{label}</span>
        {description && <span className="block text-meta text-muted">{description}</span>}
      </span>
      <span className="relative mt-1 inline-flex shrink-0">
        <input id={fid} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
