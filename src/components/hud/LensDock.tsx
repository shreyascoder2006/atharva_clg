import { AnimatePresence, motion } from 'motion/react';
import { Activity, ArrowRight, Gauge, Leaf, Package, Route } from 'lucide-react';
import type { ReactNode } from 'react';

import { portReading } from '@/lib/congestion';
import { CO2_FACTOR, PORTS, ROLES, T, ULIP, type Role } from '@/data/shipment';
import { formatAgo, formatDuration, formatKg, formatUsd } from '@/lib/format';
import { MODE_HEX, PALETTE, TONE_HEX } from '@/lib/palette';
import { batonAt, carbonIntensity } from '@/lib/schedule';
import { getRoute } from '@/lib/route';
import { usePlanFor, useSelectedSchedule, useShipment, ULIP_BY_ID, type Lens } from '@/store/shipment';
import { ShipmentsTab } from './ShipmentsTab';
import { Chip, Dot, Eyebrow, RoleAvatar } from './ui';

const LENSES: { id: Lens; label: string; short: string; icon: ReactNode }[] = [
  { id: 'operations', label: 'Operations', short: 'Ops', icon: <Route size={17} /> },
  { id: 'risk', label: 'Risk / Demurrage', short: 'Risk', icon: <Gauge size={17} /> },
  { id: 'carbon', label: 'Carbon (Scope 3)', short: 'CO₂e', icon: <Leaf size={17} /> },
  { id: 'ulip', label: 'ULIP / API Pulse', short: 'ULIP', icon: <Activity size={17} /> },
];

export function LensDock() {
  const lens = useShipment((s) => s.lens);
  const setLens = useShipment((s) => s.setLens);
  return (
    <nav className="glass pointer-events-auto flex flex-col gap-1 rounded-2xl p-1.5" aria-label="Globe lens">
      {LENSES.map((l) => {
        const active = l.id === lens;
        return (
          <button
            key={l.id}
            onClick={() => setLens(l.id)}
            className="group relative flex w-[52px] flex-col items-center gap-0.5 rounded-xl py-2 transition-colors"
            style={{ color: active ? PALETTE.cobalt : PALETTE.muted }}
            aria-pressed={active}
            title={l.label}
          >
            {active && (
              <motion.span
                layoutId="lens-pill"
                className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),inset_0_0_0_1px_rgb(15_23_42/0.06)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{l.icon}</span>
            <span className="relative text-[9.5px] font-semibold">{l.short}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The left sidebar card: the Shipments tab (the three live shipments and the network
 * corridors) or the active globe lens.
 */
export function SidebarCard() {
  const lens = useShipment((s) => s.lens);
  const tab = useShipment((s) => s.sidebarTab);
  const setTab = useShipment((s) => s.setSidebarTab);
  const meta = LENSES.find((l) => l.id === lens)!;
  const tabs = [
    { id: 'shipments' as const, label: 'Shipments', icon: <Package size={14} />, count: 3 },
    { id: 'lens' as const, label: meta.label, icon: meta.icon, count: 0 },
  ];
  return (
    <div className="glass pointer-events-auto w-[300px] overflow-hidden rounded-2xl">
      <div className="hairline flex items-center gap-1 border-b p-1.5" role="tablist" aria-label="Sidebar">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className="relative flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[11.5px] font-semibold transition-colors"
              style={{ color: active ? PALETTE.ink : PALETTE.muted }}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-tab"
                  className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),inset_0_0_0_1px_rgb(15_23_42/0.06)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative shrink-0 text-cobalt [&>svg]:h-[14px] [&>svg]:w-[14px]">{t.icon}</span>
              <span className="relative truncate">{t.label}</span>
              {t.count > 0 && <span className="num relative rounded-full bg-cobalt/10 px-1.5 text-[9.5px] text-cobalt">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab === 'shipments' ? 'shipments' : lens}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="px-3.5 py-3"
        >
          {tab === 'shipments' && <ShipmentsTab />}
          {tab === 'lens' && lens === 'operations' && <OpsLens />}
          {tab === 'lens' && lens === 'risk' && <RiskLens />}
          {tab === 'lens' && lens === 'carbon' && <CarbonLens />}
          {tab === 'lens' && lens === 'ulip' && <UlipLens />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* --- Operations ------------------------------------------------------------------ */

function OpsLens() {
  const schedule = useSelectedSchedule();
  const nowH = useShipment((s) => s.nowH);
  const baton = batonAt(schedule, nowH, nowH);
  const chain: Role[] = ['transporter', 'broker', 'forwarder', 'exporter'];
  const idx = chain.indexOf(baton.role);

  return (
    <div className="space-y-3">
      <div>
        <Eyebrow className="mb-1.5">Baton relay</Eyebrow>
        <div className="flex items-center justify-between">
          {chain.map((r, i) => (
            <div key={r} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <span className={i < idx ? '' : i === idx ? '' : 'opacity-40'}>
                  <RoleAvatar role={r} size={28} ring={i === idx} />
                </span>
                <span className="text-[9px] font-semibold text-muted">{ROLES[r].short}</span>
              </div>
              {i < chain.length - 1 && (
                <ArrowRight size={12} className="mx-1 mb-4" style={{ color: i < idx ? PALETTE.emerald : PALETTE.subtle }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <Eyebrow className="mb-1.5">Legend</Eyebrow>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-ink">
          <Swatch color={MODE_HEX.road} label="Road / rail" />
          <Swatch color={MODE_HEX.sea} label="Sea" />
          <Swatch color={MODE_HEX.air} label="Air" />
          <Swatch color={PALETTE.emerald} label="Travelled" />
          <Swatch color={PALETTE.crimson} label="Hold / delay" />
          <Swatch color="#ffffff" label="Tracer pulse" ring />
        </div>
      </div>
      <p className="text-[10.5px] leading-snug text-muted">
        Click the cargo marker to dive from orbit into the container. Drag the timeline to replay or forecast.
      </p>
    </div>
  );
}

function Swatch({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-[5px] w-5 rounded-full"
        style={{ background: color, boxShadow: ring ? 'inset 0 0 0 1px rgb(15 23 42 / 0.25)' : `0 0 8px ${color}55` }}
      />
      {label}
    </span>
  );
}

/* --- Risk / demurrage ---------------------------------------------------------------- */

function RiskLens() {
  const customs = useShipment((s) => s.customs);
  const redSea = useShipment((s) => s.redSea);
  const hold0494 = useShipment((s) => s.hold0494);
  const nowH = useShipment((s) => s.nowH);
  const resolved = useShipment((s) => s.resolved);
  const schedule = useSelectedSchedule();
  const cutoff = (schedule.cutoffH ?? T.cutoff) - nowH;
  const exposure = resolved.reduce((a, r) => a + r.accruedUsd, 0);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-white/70 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
        <div className="grid grid-cols-[1fr_52px_44px] gap-2 px-2.5 pt-2 pb-1 text-[9px] font-semibold tracking-[0.1em] text-subtle uppercase">
          <span>Hub</span>
          <span className="text-right">Dwell</span>
          <span className="text-right">Yard</span>
        </div>
        {PORTS.map((p) => {
          const r = portReading(p, { customs, redSea, hold0494 }, nowH * 3600);
          const hex = TONE_HEX[r.tone];
          return (
            <div key={p.id} className="hairline grid grid-cols-[1fr_52px_44px] items-center gap-2 border-t px-2.5 py-1.5 text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <span className="h-3 w-1 rounded-full" style={{ background: hex }} />
                {p.name}
              </span>
              <span className="num text-right font-semibold" style={{ color: hex }}>
                {r.dwell.toFixed(1)}d
              </span>
              <span className="num text-right text-muted">{Math.round(r.util * 100)}%</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Metric
          label="Vessel cutoff"
          value={schedule.rolled ? 'Missed' : formatDuration(Math.max(0, cutoff))}
          tone={schedule.rolled ? 'crimson' : cutoff < 6 ? 'amber' : 'ink'}
        />
        <Metric label="Exposure contained" value={formatUsd(exposure)} tone={exposure > 0 ? 'emerald' : 'ink'} />
      </div>
      <p className="text-[10.5px] leading-snug text-muted">
        Column height is container dwell time; colour is congestion. Amber route bands mark chokepoints and the ghat.
      </p>
    </div>
  );
}

function Metric({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'amber' | 'crimson' | 'emerald' }) {
  const color = tone === 'ink' ? PALETTE.ink : TONE_HEX[tone];
  return (
    <div className="rounded-xl bg-white/70 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
      <div className="text-[9.5px] font-semibold tracking-[0.08em] text-subtle uppercase">{label}</div>
      <div className="num text-[13px] font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/* --- Carbon ------------------------------------------------------------------------- */

function CarbonLens() {
  const selected = useShipment((s) => s.selected);
  const schedule = useSelectedSchedule();
  const plan = usePlanFor(selected);
  const max = Math.max(...schedule.legs.map((l) => l.co2Kg));
  const delta = schedule.co2Kg / plan.co2Kg - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="num text-[26px] leading-none font-semibold tracking-tight text-ink">{formatKg(schedule.co2Kg)}</div>
          <div className="mt-1 text-[10.5px] text-muted">CO₂e well-to-wheel · per shipment</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Chip tone="emerald">Scope 3 · Cat 4</Chip>
          {Math.abs(delta) > 0.02 && (
            <Chip tone={delta > 1 ? 'crimson' : delta > 0 ? 'amber' : 'emerald'}>
              {delta > 1 ? `×${(delta + 1).toFixed(1)} vs plan` : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}% vs plan`}
            </Chip>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {schedule.legs.map((l) => {
          const t = carbonIntensity(l.mode);
          const color = mixHex(PALETTE.emerald, PALETTE.amber, t);
          return (
            <div key={`${l.id}-${l.routeId}`}>
              <div className="flex items-baseline justify-between text-[10.5px]">
                <span className="font-semibold text-ink">{getRoute(l.routeId).label}</span>
                <span className="num text-muted">
                  {formatKg(l.co2Kg)} · {Math.round(CO2_FACTOR[l.mode] * 1000)} g/tkm
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.05]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, (l.co2Kg / max) * 100)}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span className="h-1.5 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${PALETTE.emerald}, ${PALETTE.amber})` }} />
        low → high emission intensity
      </div>
    </div>
  );
}

function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

/* --- ULIP / API pulse ------------------------------------------------------------- */

function UlipLens() {
  const log = useShipment((s) => s.ulipLog);
  const nowH = useShipment((s) => s.nowH);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {ULIP.map((c) => {
          const last = log.find((e) => e.connector === c.id);
          const fresh = !!last && (nowH - last.h) * 3600 < 3;
          return (
            <div
              key={c.id}
              className="rounded-xl bg-white/70 px-2.5 py-2 transition-shadow"
              style={{ boxShadow: fresh ? `inset 0 0 0 1.5px ${PALETTE.sky}` : 'inset 0 0 0 1px rgb(15 23 42 / 0.05)' }}
            >
              <div className="flex items-center gap-1.5">
                <Dot tone="emerald" pulse={fresh} size={6} />
                <span className="text-[11.5px] font-semibold text-ink">{c.name}</span>
              </div>
              <div className="text-[9.5px] text-subtle">{c.system}</div>
              <div className="num mt-0.5 text-[10px] text-muted">{c.latencyMs}ms · 200 OK</div>
            </div>
          );
        })}
      </div>
      <div>
        <Eyebrow className="mb-1.5">Auto-fed milestones</Eyebrow>
        <ol className="space-y-1">
          <AnimatePresence initial={false}>
            {log.slice(0, 4).map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-[10.5px] leading-snug"
              >
                <span className="num mt-px w-[54px] shrink-0 font-semibold text-sky">{ULIP_BY_ID[e.connector].name}</span>
                <span className="min-w-0 flex-1 text-muted">{e.text}</span>
                <span className="num shrink-0 text-[9.5px] text-subtle">{formatAgo(nowH - e.h)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {log.length === 0 && <li className="text-[10.5px] text-subtle">Waiting for the next connector event…</li>}
        </ol>
      </div>
    </div>
  );
}

