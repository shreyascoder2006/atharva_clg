import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

import { ROLES, type Role, type ShipmentId } from '@/data/shipment';
import { partyOf, useShipment } from '@/store/shipment';
import { TONE_HEX, type Tone } from '@/lib/palette';

/** Initials of the party playing `role` on a shipment (the selected one by default). */
export function RoleAvatar({ role, size = 24, ring = false, shipment }: { role: Role; size?: number; ring?: boolean; shipment?: ShipmentId }) {
  const meta = ROLES[role];
  const initials = useShipment((s) => partyOf(s.assignments, shipment ?? s.selected, role).initials);
  const hex = TONE_HEX[meta.tone];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: hex,
        background: `color-mix(in oklab, ${hex} 12%, white)`,
        boxShadow: ring ? `0 0 0 2px white, 0 0 0 3.5px ${hex}` : `inset 0 0 0 1px color-mix(in oklab, ${hex} 22%, transparent)`,
      }}
      aria-label={meta.label}
    >
      {initials}
    </span>
  );
}

export function Glass({ className, strong, ...rest }: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return <div className={clsx(strong ? 'glass-strong' : 'glass', className)} {...rest} />;
}

export function Chip({
  tone = 'slate',
  children,
  className,
  solid,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  solid?: boolean;
}) {
  const hex = TONE_HEX[tone];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold whitespace-nowrap', className)}
      style={
        solid
          ? { color: 'white', background: hex }
          : { color: hex, background: `color-mix(in oklab, ${hex} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hex} 18%, transparent)` }
      }
    >
      {children}
    </span>
  );
}

export function Dot({ tone, pulse, size = 6 }: { tone: Tone; pulse?: boolean; size?: number }) {
  const hex = TONE_HEX[tone];
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: hex }} />}
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: hex }} />
    </span>
  );
}

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone; size?: 'sm' | 'md' }
>(function Button({ tone = 'secondary', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-45 disabled:shadow-none',
        size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-3.5 text-[12px]',
        tone === 'primary' &&
          'bg-cobalt text-white shadow-[0_6px_18px_-6px_rgb(37_99_235/0.7),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110 active:scale-[0.98] disabled:hover:brightness-100',
        tone === 'success' &&
          'bg-emerald text-white shadow-[0_6px_18px_-6px_rgb(5_150_105/0.7),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110 active:scale-[0.98]',
        tone === 'danger' &&
          'bg-crimson text-white shadow-[0_6px_18px_-6px_rgb(220_38_38/0.65),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110 active:scale-[0.98]',
        tone === 'secondary' &&
          'border border-hairline bg-white/80 text-ink shadow-[0_1px_2px_rgb(15_23_42/0.05)] hover:bg-white active:scale-[0.98]',
        tone === 'ghost' && 'text-muted hover:bg-slate-900/[0.05] hover:text-ink',
        className,
      )}
      {...rest}
    />
  );
});

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('eyebrow', className)}>{children}</div>;
}

/** Small inline sparkline. Values are drawn into a fixed box; min/max auto-scale. */
export function Sparkline({
  values,
  tone = 'cobalt',
  width = 96,
  height = 26,
  band,
}: {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  /** Safe operating band, drawn as a faint fill. */
  band?: [number, number];
}) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const lo = Math.min(...values, band?.[0] ?? Infinity);
  const hi = Math.max(...values, band?.[1] ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - lo) / span) * (height - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const hex = TONE_HEX[tone];
  return (
    <svg width={width} height={height} className="overflow-visible">
      {band && <rect x={0} y={y(band[1])} width={width} height={Math.max(1, y(band[0]) - y(band[1]))} fill={hex} opacity={0.07} rx={2} />}
      <path d={`${d}L${width} ${height}L0 ${height}Z`} fill={hex} opacity={0.08} />
      <path d={d} fill="none" stroke={hex} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.2} fill={hex} />
    </svg>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="num rounded border border-hairline bg-white px-1 text-[9px] font-medium text-muted shadow-[0_1px_0_rgb(15_23_42/0.08)]">
      {children}
    </kbd>
  );
}
