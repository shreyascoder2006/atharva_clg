import { useId, type ReactNode } from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

import { RoleSwitcher } from '@/components/hud/TopBar';
import { Dot, Kbd, Sparkline } from '@/components/hud/ui';
import { FLEET } from '@/data/fleet';
import { ROLES, SHIPMENT_IDS, type Role, type ShipmentId } from '@/data/shipment';
import { formatTime } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { VIEW_BY_ID, VIEWS, type ViewId } from '@/lib/routes';
import { useShipment } from '@/store/shipment';

/* --- Page frame ------------------------------------------------------------------- */

export function DashPage({
  view,
  subtitle,
  actions,
  children,
  fill,
}: {
  view: ViewId;
  subtitle: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Fill the viewport instead of scrolling (the comms hub). */
  fill?: boolean;
}) {
  const meta = VIEW_BY_ID[view];
  const index = VIEWS.findIndex((v) => v.id === view);
  return (
    <div className={clsx('scroll-quiet absolute inset-0', fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto')}>
      <div className={clsx('mx-auto w-full max-w-[1480px] px-6 pt-5 max-md:px-4', fill ? 'flex min-h-0 flex-1 flex-col pb-5' : 'pb-10')}>
        <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-[24px] leading-tight font-semibold tracking-[-0.02em] text-ink max-md:text-[20px]">
              {meta.title}
              <span className="translate-y-px max-md:hidden" title={`Alt+${index + 1} opens ${meta.label} from anywhere`}>
                <Kbd>Alt {index + 1}</Kbd>
              </span>
            </h1>
            <p className="mt-1.5 max-w-[620px] text-[12.5px] text-muted">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <LiveClock />
            <RoleSwitcher compact />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function LiveClock() {
  const nowH = useShipment((s) => s.nowH);
  return (
    <div className="glass flex h-10 items-center gap-2 rounded-xl px-3 max-lg:hidden">
      <Dot tone="emerald" pulse size={6} />
      <div className="leading-none">
        <div className="num text-[12px] font-semibold text-ink">{formatTime(nowH, 'Asia/Kolkata', true)}</div>
        <div className="mt-0.5 text-[9px] font-semibold tracking-[0.12em] text-subtle uppercase">IST · Live</div>
      </div>
    </div>
  );
}

/* --- Cards -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  title,
  eyebrow,
  action,
  pad = true,
}: {
  className?: string;
  children: ReactNode;
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  pad?: boolean;
}) {
  return (
    <section
      className={clsx(
        'glass rounded-[20px]',
        pad && 'p-5 max-md:p-4',
        className,
      )}
    >
      {(title || eyebrow || action) && (
        <div className={clsx('mb-4 flex items-start justify-between gap-3', !pad && 'px-5 pt-5')}>
          <div className="min-w-0">
            {title && <h2 className="text-[14.5px] font-semibold tracking-tight text-ink">{title}</h2>}
            {eyebrow && <p className="mt-0.5 text-[11.5px] text-muted">{eyebrow}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  subTone = 'slate',
  icon,
  tone = 'cobalt',
  spark,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subTone?: Tone;
  icon: ReactNode;
  tone?: Tone;
  spark?: number[];
  children?: ReactNode;
}) {
  const hex = TONE_HEX[tone];
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ color: hex, background: `color-mix(in oklab, ${hex} 10%, white)` }}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="num text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink">{value}</div>
        {spark && (
          <div className="shrink-0">
            <Sparkline values={spark} tone={tone} width={84} height={30} />
          </div>
        )}
      </div>
      {sub && (
        <div className="mt-2 line-clamp-2 text-[11px] font-medium" style={{ color: TONE_HEX[subTone] }}>
          {sub}
        </div>
      )}
      {children}
    </Card>
  );
}

/* --- Gauges ------------------------------------------------------------------------- */

/** Ring gauge. `value` is 0–1 of the arc; `display` is what is printed in the middle. */
export function RadialGauge({
  value,
  display,
  caption,
  tone = 'cobalt',
  size = 92,
  stroke = 8,
  sweep = 270,
}: {
  value: number;
  display: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  size?: number;
  stroke?: number;
  /** Degrees of arc. 360 is a full ring; 270 leaves a gap at the bottom. */
  sweep?: number;
}) {
  // useId output contains characters that break url(#…) references; keep it plain.
  const id = `rg${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = (c * sweep) / 360;
  const v = Math.max(0, Math.min(1, value));
  const hex = TONE_HEX[tone];
  const rot = 90 + (360 - sweep) / 2;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hex} stopOpacity={0.65} />
            <stop offset="100%" stopColor={hex} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth={stroke} strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: arc * (1 - v) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="num text-[15px] font-semibold text-ink">{display}</div>
          {caption && <div className="mt-1 text-[9px] font-semibold tracking-[0.1em] text-subtle uppercase">{caption}</div>}
        </div>
      </div>
    </div>
  );
}

/** Horizontal comparison bar that animates to its width. */
export function Bar({ value, tone = 'cobalt', height = 6, highlight }: { value: number; tone?: Tone; height?: number; highlight?: boolean }) {
  const hex = TONE_HEX[tone];
  return (
    <div className="w-full overflow-hidden rounded-full bg-slate-900/[0.06]" style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: highlight ? hex : `color-mix(in oklab, ${hex} 55%, white)` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/* --- Controls ----------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  id,
}: {
  value: T;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  /** Distinguishes several toggles on one page, for the shared-layout pill. */
  id: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="scroll-quiet flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-900/[0.05] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="relative flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[12px] font-semibold whitespace-nowrap transition-colors"
            style={{ color: active ? '#0F172A' : '#475569' }}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),inset_0_0_0_1px_rgb(15_23_42/0.06)]"
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Picks which live shipment a dashboard is about. Same selection as the globe's. */
export function ShipmentPicker() {
  const selected = useShipment((s) => s.selected);
  const select = useShipment((s) => s.selectShipment);
  return (
    <label className="glass relative flex h-10 items-center rounded-xl pr-8 pl-3">
      <span className="sr-only">Active shipment</span>
      <select
        value={selected}
        onChange={(e) => select(e.target.value as ShipmentId)}
        className="num cursor-pointer appearance-none bg-transparent text-[12px] font-semibold text-ink outline-none"
      >
        {SHIPMENT_IDS.map((id) => (
          <option key={id} value={id}>
            {id} · {FLEET[id].origin} → {FLEET[id].destination}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-muted" />
    </label>
  );
}

/* --- Badges ------------------------------------------------------------------------- */

/** EXP / FF / CHA / TRN in the role's colour. */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const meta = ROLES[role];
  const hex = TONE_HEX[meta.tone];
  return (
    <span
      className={clsx('num inline-flex h-[18px] items-center rounded-md px-1.5 text-[9.5px] font-bold tracking-wide', className)}
      style={{ color: hex, background: `color-mix(in oklab, ${hex} 11%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hex} 22%, transparent)` }}
      title={meta.label}
    >
      {meta.short}
    </span>
  );
}

export function Pill({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  const hex = TONE_HEX[tone];
  return (
    <span
      className="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap"
      style={{ color: hex, background: `color-mix(in oklab, ${hex} 9%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hex} 20%, transparent)` }}
    >
      <Dot tone={tone} size={6} pulse={pulse} />
      {children}
    </span>
  );
}
