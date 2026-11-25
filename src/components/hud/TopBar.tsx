import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertOctagon,
  Box,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  FileSearch,
  Leaf,
  RotateCcw,
  ShieldAlert,
  Truck,
  Zap,
} from 'lucide-react';

import { DISRUPTIONS, ROLE_ORDER, ROLES, SHIPMENT, type DisruptionKind } from '@/data/shipment';
import { formatDelta, formatKg, formatStamp, formatTime } from '@/lib/format';
import { TONE_HEX } from '@/lib/palette';
import { batonAt } from '@/lib/schedule';
import { usePlan, useSchedule, useShipment } from '@/store/shipment';
import { Chip, Dot, Glass, RoleAvatar } from './ui';

/* --- Shipment card (top-left) ------------------------------------------------------ */

export function ShipmentCard({ collapsed = false }: { collapsed?: boolean }) {
  const schedule = useSchedule();
  const plan = usePlan();
  const docsVerified = useShipment((s) => s.docsVerified);
  const disruption = useShipment((s) => s.disruption);
  const [userOpen, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  // Folds away while the Co-Pilot needs the column, without forgetting the user's choice.
  const open = userOpen && !collapsed;

  const delta = schedule.deliveredH - plan.deliveredH;
  const status = disruption
    ? { tone: 'crimson' as const, label: DISRUPTIONS[disruption.kind].short }
    : !docsVerified
      ? { tone: 'amber' as const, label: 'Doc mismatch' }
      : Math.abs(delta) > 1
        ? { tone: delta > 0 ? ('amber' as const) : ('emerald' as const), label: 'Re-planned' }
        : { tone: 'emerald' as const, label: 'On track' };

  return (
    <Glass className="pointer-events-auto w-[340px] rounded-2xl max-md:w-[calc(100vw-32px)]">
      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <Logo />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13px] font-semibold tracking-tight text-ink">One Shipment · One Platform</div>
          <div className="text-[10.5px] text-muted">Digital logistics connectivity & collaboration</div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={collapsed}
          className="grid h-6 w-6 place-items-center rounded-lg text-muted transition-colors hover:bg-slate-900/5 hover:text-ink"
          aria-label={open ? 'Collapse shipment summary' : 'Expand shipment summary'}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className="px-3.5 pt-2.5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="num text-[12px] font-semibold text-ink">{SHIPMENT.id}</span>
            <Chip tone={status.tone}>
              <Dot tone={status.tone} pulse={status.tone !== 'emerald'} size={5} />
              {status.label}
            </Chip>
          </div>
          <span className="text-[10.5px] font-medium text-muted">Chakan → Duisburg</span>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-[var(--color-hairline)]">
                <Stat label="Container" value={SHIPMENT.container} mono small />
                <Stat label="HS code" value={SHIPMENT.hsCode} mono />
                <Stat label="Gross" value="12,850 kg" mono />
                <Stat
                  label="ETA Duisburg"
                  value={formatStamp(schedule.deliveredH, 'Europe/Berlin').slice(0, 10)}
                  sub={formatDelta(delta)}
                  subTone={Math.abs(delta) < 0.25 ? 'emerald' : delta > 0 ? 'amber' : 'cobalt'}
                />
                <Stat label="Legs" value={`${schedule.legs.length} legs`} sub={modeMix(schedule.legs.map((l) => l.mode))} subTone="cobalt" />
                <Stat
                  label="CO₂e"
                  value={formatKg(schedule.co2Kg)}
                  sub={
                    schedule.co2Kg > plan.co2Kg * 2
                      ? `×${(schedule.co2Kg / plan.co2Kg).toFixed(1)} vs plan`
                      : schedule.co2Kg > plan.co2Kg * 1.05
                        ? `+${Math.round((schedule.co2Kg / plan.co2Kg - 1) * 100)}% vs plan`
                        : 'Scope 3 · GLEC'
                  }
                  subTone={schedule.co2Kg > plan.co2Kg * 1.05 ? 'amber' : 'emerald'}
                  icon={<Leaf size={9} />}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Glass>
  );
}

function modeMix(modes: string[]) {
  const label: Record<string, string> = { road: 'Road', rail: 'Rail', sea: 'Sea', air: 'Air' };
  return [...new Set(modes)].map((m) => label[m]).join('·');
}

function Stat({
  label,
  value,
  sub,
  subTone,
  mono,
  small,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: 'emerald' | 'amber' | 'cobalt' | 'crimson';
  mono?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white/85 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-subtle uppercase">
        {icon}
        {label}
      </div>
      <div className={`${mono ? 'num' : ''} ${small ? 'text-[10.5px]' : 'text-[12px]'} mt-0.5 truncate font-semibold text-ink`}>{value}</div>
      {sub && (
        <div className="num text-[9.5px] font-semibold" style={{ color: subTone ? TONE_HEX[subTone] : undefined }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-white to-[#e8eff9] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.08),0_2px_6px_rgb(15_23_42/0.06)]">
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
        <circle cx="16" cy="16" r="10.5" fill="#dce8f5" stroke="#0f172a" strokeOpacity=".14" />
        <path d="M6.6 19c4.4-5.6 13.6-7.8 18.6-3.4" stroke="#2563eb" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="6.6" cy="19" r="2.3" fill="#059669" />
        <circle cx="25.2" cy="15.6" r="2.3" fill="#2563eb" />
      </svg>
    </span>
  );
}

/* --- Role switcher (top-centre) --------------------------------------------------- */

export function RoleSwitcher() {
  const role = useShipment((s) => s.role);
  const setRole = useShipment((s) => s.setRole);
  const schedule = useSchedule();
  const nowH = useShipment((s) => s.nowH);
  const baton = batonAt(schedule, nowH, nowH);

  return (
    <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1" role="tablist" aria-label="Stakeholder lens">
      {ROLE_ORDER.map((r, i) => {
        const active = r === role;
        const meta = ROLES[r];
        return (
          <button
            key={r}
            role="tab"
            aria-selected={active}
            onClick={() => setRole(r)}
            className="relative flex h-9 items-center gap-2 rounded-full px-3 text-[12px] font-semibold transition-colors"
            style={{ color: active ? '#0f172a' : '#475569' }}
            title={`${meta.label} · ${meta.zoneLabel} (${i + 1})`}
          >
            {active && (
              <motion.span
                layoutId="role-pill"
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),0_6px_16px_-6px_rgb(15_23_42/0.18),inset_0_0_0_1px_rgb(15_23_42/0.06)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <RoleAvatar role={r} size={20} />
              <span className="hidden whitespace-nowrap min-[1360px]:inline">{meta.label}</span>
              {baton.role === r && (
                <span className="flex items-center" title="Currently holds the shipment baton">
                  <Dot tone={meta.tone} pulse size={6} />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* --- Toolbar (top-right) ------------------------------------------------------------ */

export function Toolbar() {
  const nowH = useShipment((s) => s.nowH);
  const docsVerified = useShipment((s) => s.docsVerified);
  const setXray = useShipment((s) => s.setXray);
  const startDive = useShipment((s) => s.startDive);
  const reset = useShipment((s) => s.reset);

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <div className="glass hidden h-10 items-center gap-2 rounded-xl px-3 min-[1600px]:flex">
        <Dot tone="emerald" pulse size={6} />
        <div className="leading-none">
          <div className="num text-[12px] font-semibold text-ink">{formatTime(nowH, 'Asia/Kolkata', true)}</div>
          <div className="mt-0.5 text-[9px] font-semibold tracking-[0.12em] text-subtle uppercase">IST · Live</div>
        </div>
      </div>

      <ToolButton onClick={() => setXray(true)} label="X-Ray" title="AI Document X-Ray" icon={<FileSearch size={15} />} badge={docsVerified ? undefined : '1'} />
      <span className="max-md:hidden">
        <ToolButton onClick={startDive} label="Twin" title="Orbital-to-container 3D cargo twin" icon={<Box size={15} />} />
      </span>
      <DisruptionMenu />
      <button
        onClick={reset}
        className="glass grid h-10 w-10 place-items-center rounded-xl text-muted transition-colors hover:text-ink max-md:hidden"
        title="Reset demo"
        aria-label="Reset demo"
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}

function ToolButton({
  onClick,
  label,
  title,
  icon,
  badge,
}: {
  onClick: () => void;
  label: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="glass relative flex h-10 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-ink transition-all hover:bg-white/95 active:scale-[0.98]"
      title={title}
      aria-label={title}
    >
      <span className="text-cobalt">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
      {badge && (
        <span className="num absolute -top-1.5 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_white]">
          {badge}
        </span>
      )}
    </button>
  );
}

const DISRUPTION_ICON: Record<DisruptionKind, React.ReactNode> = {
  customs_hold: <ShieldAlert size={15} />,
  highway_delay: <Truck size={15} />,
  red_sea: <CloudLightning size={15} />,
};

function DisruptionMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useShipment((s) => s.triggerDisruption);
  const active = useShipment((s) => s.disruption);
  const highway = useShipment((s) => s.highway);
  const customs = useShipment((s) => s.customs);
  const redSea = useShipment((s) => s.redSea);
  const gateIn = useShipment((s) => s.actuals.gateIn !== undefined || s.driving);
  const leo = useShipment((s) => s.actuals.leo !== undefined);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const reason = (k: DisruptionKind): string | null => {
    if (active) return 'Resolve the active disruption first';
    if (k === 'highway_delay') return highway !== 'none' ? 'Already simulated' : gateIn ? 'Truck already gated in' : null;
    if (k === 'customs_hold') return customs !== 'none' ? 'Already simulated' : leo ? 'Customs already cleared' : null;
    return redSea !== 'none' ? 'Already simulated' : null;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 items-center gap-2 rounded-xl border border-crimson/20 bg-white/80 px-3 text-[12px] font-semibold text-crimson shadow-[var(--shadow-glass)] backdrop-blur-xl transition-all hover:bg-white active:scale-[0.98]"
        aria-expanded={open}
      >
        {active ? <AlertOctagon size={15} className="animate-pulse" /> : <Zap size={15} />}
        <span className="hidden lg:inline">{active ? 'Disruption live' : 'Simulate'}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass-strong absolute top-12 right-0 z-50 w-[330px] origin-top-right rounded-2xl p-1.5"
          >
            <div className="eyebrow px-2.5 pt-1.5 pb-1">Disruption & demurrage simulator</div>
            {(Object.keys(DISRUPTIONS) as DisruptionKind[]).map((k) => {
              const d = DISRUPTIONS[k];
              const why = reason(k);
              return (
                <button
                  key={k}
                  disabled={!!why}
                  onClick={() => {
                    trigger(k);
                    setOpen(false);
                  }}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors enabled:hover:bg-crimson/[0.06] disabled:opacity-50"
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-crimson/[0.08] text-crimson">{DISRUPTION_ICON[k]}</span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-ink">{d.title}</span>
                    <span className="block text-[10.5px] text-muted">{d.where}</span>
                    <span className="num mt-0.5 block text-[10px] font-medium text-crimson/80">
                      {why ?? `Demurrage exposure $${d.ratePerDay.toLocaleString()}/day`}
                    </span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
