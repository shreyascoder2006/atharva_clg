import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  Download,
  FileBadge2,
  Leaf,
  Pause,
  Plane,
  Play,
  Radio,
  ScrollText,
  Server,
  Ship,
  Sprout,
  TrainFront,
  Truck,
  Webhook,
  X,
  Zap,
} from 'lucide-react';

import { Card, DashPage, Pill, ShipmentPicker } from '@/components/dash/kit';
import { usePortfolio } from '@/components/dash/usePortfolio';
import { CountUp } from '@/components/hud/ui';
import { FLEET } from '@/data/fleet';
import { CO2_FACTOR, FLAGSHIP, ROUTES, ULIP, type Mode, type ShipmentId, type UlipId } from '@/data/shipment';
import { formatKg, hourToDate } from '@/lib/format';
import { sha256Hex } from '@/lib/hash';
import { PALETTE, TONE_HEX } from '@/lib/palette';
import { carbonIntensity, type Schedule } from '@/lib/schedule';
import { ULIP_BY_ID, useScheduleFor, useShipment, type UlipEvent } from '@/store/shipment';

const MODE_ICON = { road: Truck, rail: TrainFront, sea: Ship, air: Plane } as const;
const MODE_LABEL: Record<Mode, string> = { road: 'Road', rail: 'Rail', sea: 'Sea', air: 'Air' };

/** Amber for carbon-heavy modes (road, air), emerald for clean ones (sea, rail), on the GLEC intensity scale. */
const intensityHex = (mode: Mode) => (carbonIntensity(mode) >= 0.5 ? PALETTE.amber : PALETTE.emerald);

export default function IntegrationsPage() {
  // Mode shifts per shipment; the CBAM Green Certificate reads the flagship's.
  const [shifts, setShifts] = useState<Shifts>({});
  return (
    <DashPage
      view="integrations"
      subtitle="Scope 3 transport emissions measured per leg on the GLEC method, ready for EU CBAM reporting, and the government APIs that feed every milestone on the platform."
      actions={<ShipmentPicker />}
    >
      <SectionHead icon={<Leaf size={14} />} title="Scope 3 carbon & CBAM analytics" />
      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <LegEmissions />
        <FleetByMode />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <ModeShiftSimulator shifts={shifts} onChange={setShifts} />
        <CbamCard shifts={shifts[FLAGSHIP] ?? {}} />
      </div>

      <SectionHead icon={<Webhook size={14} />} title="ULIP live API topology" className="mt-8" />
      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
        <Topology />
        <EventStream />
      </div>
      <ConnectorHealth />
    </DashPage>
  );
}

function SectionHead({ icon, title, className = '' }: { icon: React.ReactNode; title: string; className?: string }) {
  return (
    <div className={`mb-3 flex items-center gap-2.5 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-cobalt shadow-[inset_0_0_0_1px_rgb(15_23_42/0.08)]">{icon}</span>
      <h2 className="text-[15px] leading-tight font-semibold tracking-tight text-ink">{title}</h2>
    </div>
  );
}

/* --- Per-leg emissions ----------------------------------------------------------------------- */

function LegEmissions() {
  const id = useShipment((s) => s.selected);
  const schedule = useScheduleFor(id);
  const tonnes = FLEET[id].grossKg / 1000;
  const max = Math.max(...schedule.legs.map((l) => l.co2Kg));
  const byMode = (['road', 'rail', 'sea', 'air'] as Mode[]).map((m) => ({ m, kg: schedule.legs.filter((l) => l.mode === m).reduce((a, l) => a + l.co2Kg, 0) })).filter((x) => x.kg > 0);
  const tkm = schedule.legs.reduce((a, l) => a + l.km * tonnes, 0);

  return (
    <Card className="col-span-2 max-xl:col-span-1" eyebrow={`Per-leg CO₂e · ${id}`} title={`${formatKg(schedule.co2Kg)} CO₂e well-to-wheel · ${Math.round(schedule.totalKm).toLocaleString('en-US')} km`} action={<Pill tone="emerald">{((schedule.co2Kg * 1000) / tkm).toFixed(1)} g / t-km</Pill>}>
      <ul className="space-y-3">
        {schedule.legs.map((l, i) => {
          const Icon = MODE_ICON[l.mode];
          return (
            <li key={`${l.id}-${i}`} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_80px] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ color: intensityHex(l.mode), background: `color-mix(in oklab, ${intensityHex(l.mode)} 10%, white)` }}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12px] font-semibold text-ink">{ROUTES[l.routeId].label}</div>
                  <div className="num text-[10.5px] text-subtle">
                    {MODE_LABEL[l.mode]} · {Math.round(l.km).toLocaleString('en-US')} km · {CO2_FACTOR[l.mode] * 1000} g/t-km
                  </div>
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-900/[0.05]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${intensityHex(l.mode)} 55%, white), ${intensityHex(l.mode)})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(1.5, (l.co2Kg / max) * 100)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="num text-right text-[12px] font-semibold text-ink">{formatKg(l.co2Kg)}</div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgba(15,23,42,0.06)] pt-3">
        {byMode.map(({ m, kg }) => (
          <span key={m} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900/[0.03] px-2 py-1 text-[11px]">
            <span className="h-2 w-2 rounded-full" style={{ background: intensityHex(m) }} />
            <span className="text-muted">{MODE_LABEL[m]}</span>
            <span className="num font-semibold text-ink">{formatKg(kg)}</span>
            <span className="num text-subtle">{((kg / schedule.co2Kg) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

function FleetByMode() {
  const rows = usePortfolio();
  const totals: Record<Mode, number> = { road: 0, rail: 0, sea: 0, air: 0 };
  for (const r of rows) for (const l of r.legs) totals[l.mode] += l.co2Kg;
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  const modes = (['air', 'road', 'sea', 'rail'] as Mode[]).filter((m) => totals[m] > 0);
  return (
    <Card eyebrow="Fleet Scope 3 by mode" title={`${formatKg(sum)} CO₂e across ${rows.length} shipments`}>
      <div className="flex h-4 overflow-hidden rounded-full">
        {modes.map((m) => (
          <motion.div key={m} style={{ background: intensityHex(m) }} initial={{ width: 0 }} animate={{ width: `${(totals[m] / sum) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="h-full border-r-2 border-white last:border-0" />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {modes.map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <li key={m} className="flex items-center gap-2.5 text-[12px]">
              <Icon size={14} style={{ color: intensityHex(m) }} />
              <span className="flex-1 text-muted">{MODE_LABEL[m]}</span>
              <span className="num font-semibold text-ink">{formatKg(totals[m])}</span>
              <span className="num w-[40px] text-right text-[11px] text-subtle">{((totals[m] / sum) * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 rounded-xl bg-amber/[0.06] p-2.5 text-[11px] leading-snug text-muted shadow-[inset_0_0_0_1px_rgb(217_119_6/0.15)]">
        <span className="font-semibold text-amber">Air is {((totals.air / sum) * 100).toFixed(0)}% of emissions</span> from a single 1.8 t shipment. Moving one pharma lane to sea-air would cut more CO₂e than every road leg combined.
      </p>
    </Card>
  );
}

/* --- Mode-shift carbon simulator ---------------------------------------------------- */

/**
 * The greener alternative for each mode, as an emission factor per tonne-km. Electric
 * rail uses an Indian grid-mix factor, not zero; LNG and SAF are well-to-wheel.
 */
const SHIFT: Record<Mode, { to: string; factor: number; kmMult: number; cost: string; time: string; icon: typeof Truck }> = {
  road: { to: 'Electric rail · CONCOR', factor: 0.017, kmMult: 1.12, cost: '+$140', time: '+6h', icon: TrainFront },
  rail: { to: 'Electric traction', factor: 0.017, kmMult: 1, cost: '+$40', time: '±0h', icon: TrainFront },
  sea: { to: 'LNG dual-fuel vessel', factor: CO2_FACTOR.sea * 0.85, kmMult: 1, cost: '+$95', time: '±0h', icon: Ship },
  air: { to: '30% SAF blend · book & claim', factor: CO2_FACTOR.air * 0.76, kmMult: 1, cost: '+$610', time: '±0h', icon: Plane },
};

export type Shifts = Partial<Record<ShipmentId, Record<number, boolean>>>;

/** Each leg's CO2e with and without its shift applied. */
function shiftedLegs(schedule: Schedule, on: Record<number, boolean> = {}) {
  return schedule.legs.map((l, i) => {
    const tkm = l.co2Kg / CO2_FACTOR[l.mode];
    const green = tkm * SHIFT[l.mode].kmMult * SHIFT[l.mode].factor;
    return { leg: l, i, current: l.co2Kg, green, applied: !!on[i], kg: on[i] ? green : l.co2Kg };
  });
}

function ModeShiftSimulator({ shifts, onChange }: { shifts: Shifts; onChange: (s: Shifts) => void }) {
  const id = useShipment((s) => s.selected);
  const schedule = useScheduleFor(id);
  const on = shifts[id] ?? {};
  const legs = shiftedLegs(schedule, on);
  const base = legs.reduce((a, l) => a + l.current, 0);
  const sim = legs.reduce((a, l) => a + l.kg, 0);
  const saved = base - sim;
  const pct = (saved / base) * 100;
  const set = (next: Record<number, boolean>) => onChange({ ...shifts, [id]: next });

  return (
    <Card
      className="col-span-2 max-xl:col-span-1"
      eyebrow={`Mode-shift carbon simulator · ${id}`}
      title="Switch a leg to a greener mode and watch the footprint move"
      action={
        <div className="flex items-center gap-1.5">
          <button onClick={() => set(Object.fromEntries(legs.map((l) => [l.i, true])))} className="h-8 rounded-lg px-2.5 text-[11.5px] font-semibold text-emerald hover:bg-emerald/[0.08]">
            Apply all
          </button>
          <button onClick={() => set({})} className="h-8 rounded-lg px-2.5 text-[11.5px] font-semibold text-muted hover:bg-slate-900/[0.05] hover:text-ink">
            Reset
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <div className="rounded-2xl bg-slate-900/[0.03] p-3">
          <div className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">As routed</div>
          <div className="num mt-1 text-[20px] font-semibold text-ink">
            <CountUp value={base} format={(n) => formatKg(n)} />
          </div>
        </div>
        <div className="rounded-2xl p-3" style={{ background: saved > 1 ? 'rgba(5,150,105,0.07)' : 'rgba(15,23,42,0.03)' }}>
          <div className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">Simulated</div>
          <div className="num mt-1 text-[20px] font-semibold" style={{ color: saved > 1 ? TONE_HEX.emerald : '#0F172A' }}>
            <CountUp value={sim} format={(n) => formatKg(n)} duration={0.6} />
          </div>
        </div>
        <div className="rounded-2xl p-3" style={{ background: saved > 1 ? 'rgba(5,150,105,0.07)' : 'rgba(15,23,42,0.03)' }}>
          <div className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">Saved</div>
          <div className="num mt-1 text-[20px] font-semibold text-emerald">
            <CountUp value={pct} format={(n) => `${n.toFixed(1)}%`} duration={0.6} />
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <BarRow label="Routed" value={base} max={base} color={intensityHex(schedule.legs.some((l) => l.mode === 'air') ? 'air' : 'road')} />
        <BarRow label="Simulated" value={sim} max={base} color={TONE_HEX.emerald} />
      </div>

      <ul className="mt-4 divide-y divide-[rgba(15,23,42,0.06)]">
        {legs.map(({ leg, i, current, green, applied }) => {
          const Icon = MODE_ICON[leg.mode];
          const To = SHIFT[leg.mode].icon;
          return (
            <li key={`${leg.id}-${i}`} className="flex items-center gap-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ color: intensityHex(leg.mode), background: `color-mix(in oklab, ${intensityHex(leg.mode)} 10%, white)` }}>
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12px] font-semibold text-ink">{ROUTES[leg.routeId].label}</div>
                <div className="flex items-center gap-1 text-[10.5px] text-muted">
                  <span>{MODE_LABEL[leg.mode]}</span>
                  <ArrowRight size={10} />
                  <To size={11} className="text-emerald" />
                  <span className="truncate text-emerald">{SHIFT[leg.mode].to}</span>
                  <span className="num text-subtle">
                    · {SHIFT[leg.mode].cost} · {SHIFT[leg.mode].time}
                  </span>
                </div>
              </div>
              <div className="num w-[104px] shrink-0 text-right text-[11.5px]">
                <span className={applied ? 'text-subtle line-through' : 'font-semibold text-ink'}>{formatKg(current)}</span>
                {applied && <span className="ml-1.5 font-semibold text-emerald">{formatKg(green)}</span>}
              </div>
              <button
                role="switch"
                aria-checked={applied}
                aria-label={`Shift ${ROUTES[leg.routeId].label} to ${SHIFT[leg.mode].to}`}
                onClick={() => set({ ...on, [i]: !applied })}
                className="relative h-[20px] w-9 shrink-0 rounded-full transition-colors"
                style={{ background: applied ? TONE_HEX.emerald : '#CBD5E1' }}
              >
                <motion.span className="absolute top-[2px] h-4 w-4 rounded-full bg-white shadow" animate={{ left: applied ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[52px] shrink-0 text-[10.5px] text-subtle">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-900/[0.04]">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <span className="num w-[58px] shrink-0 text-right text-[11px] font-semibold text-ink">{formatKg(value)}</span>
    </div>
  );
}

/* --- CBAM ------------------------------------------------------------------------------------ */

function useCbamStatement(shifts: Record<number, boolean>) {
  const schedule = useScheduleFor(FLAGSHIP);
  return useMemo(() => {
    const legs = shiftedLegs(schedule, shifts);
    const baseline = legs.reduce((a, l) => a + l.current, 0);
    const green = legs.reduce((a, l) => a + l.kg, 0);
    const net = 11.62;
    const direct = 1.42;
    const indirect = 0.61;
    return {
      statement: 'CBAM-IN-2611-0482',
      template: 'EU CBAM embedded emissions communication (voluntary)',
      period: 'Q4 2026',
      declarant: { name: 'Rhein-Ruhr Antriebstechnik GmbH', eori: 'DE447122098813', country: 'DE' },
      producer: { name: 'Deccan Precision Components Pvt Ltd', installation: 'Chakan MIDC Plant 2, Pune', country: 'IN' },
      goods: { description: 'Machined gearbox housings & transmission shafts', cn: '8708 40', netMassT: net },
      embedded: {
        directTPerT: direct,
        indirectTPerT: indirect,
        totalT: +(net * (direct + indirect)).toFixed(2),
        method: 'Actual values, verified · precursor: hot-rolled steel bar (CN 7214)',
      },
      transportScope3: { co2eT: +(green / 1000).toFixed(3), baselineT: +(baseline / 1000).toFixed(3), method: 'GLEC v3 well-to-wheel', note: 'Informational; transport is not part of CBAM embedded emissions' },
      greenCorridor: legs.filter((l) => l.applied).map((l) => ({ leg: ROUTES[l.leg.routeId].label, shift: SHIFT[l.leg.mode].to, savedKg: Math.round(l.current - l.green) })),
      carbonPricePaid: { currency: 'INR', amount: 0 },
      scopeNote: 'CN 8708 is not listed in CBAM Annex I. Statement prepared voluntarily for the buyer’s supply-chain reporting.',
    };
  }, [schedule, shifts]);
}

function CbamCard({ shifts }: { shifts: Record<number, boolean> }) {
  const [open, setOpen] = useState(false);
  const st = useCbamStatement(shifts);
  return (
    <Card eyebrow="EU CBAM Green Certificate" title="Embedded emissions + green corridor · SHP-2611-0482">
      <button onClick={() => setOpen(true)} className="group block w-full text-left" aria-label="Preview EU CBAM certificate">
        <div className="relative overflow-hidden rounded-xl bg-white p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_10px_24px_-14px_rgb(15_23_42/0.25),inset_0_0_0_1px_rgb(15_23_42/0.06)] transition-transform group-hover:-translate-y-0.5">
          <div className="h-1 rounded-full bg-gradient-to-r from-[#003399] to-cobalt" />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.16em] text-[#003399] uppercase">CBAM · Q4 2026</span>
            <FileBadge2 size={16} className="text-[#003399]" />
          </div>
          <div className="num mt-1 text-[12px] font-semibold text-ink">{st.statement}</div>
          <dl className="mt-2 space-y-1 text-[10.5px]">
            <Row k="CN code" v={st.goods.cn} />
            <Row k="Net mass" v={`${st.goods.netMassT} t`} />
            <Row k="Embedded" v={`${st.embedded.totalT} tCO₂e`} />
            <Row k="Transport (Scope 3)" v={`${st.transportScope3.co2eT} tCO₂e`} />
            <Row k="Green measures" v={st.greenCorridor.length ? `${st.greenCorridor.length} applied` : 'none yet'} />
          </dl>
          <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-cobalt/[0.06]" />
        </div>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-ink text-[12.5px] font-semibold text-white shadow-[0_10px_22px_-12px_rgb(15_23_42/0.8)] transition-transform active:scale-[0.98]"
      >
        <ScrollText size={14} /> Generate EU CBAM Green Certificate
      </button>
      <p className="mt-2 text-[10.5px] leading-snug text-subtle">{st.scopeNote}</p>
      {/* Portalled: the page sits in a transformed transition wrapper, which would
          otherwise become the containing block for this fixed-position dialog. */}
      {createPortal(<AnimatePresence>{open && <CbamModal shifts={shifts} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed border-slate-900/[0.07] pb-1">
      <dt className="text-muted">{k}</dt>
      <dd className="num font-semibold text-ink">{v}</dd>
    </div>
  );
}

function CbamModal({ shifts, onClose }: { shifts: Record<number, boolean>; onClose: () => void }) {
  const st = useCbamStatement(shifts);
  const [digest, setDigest] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const json = JSON.stringify(st, null, 2);

  useEffect(() => {
    let live = true;
    void sha256Hex(json).then((d) => live && setDigest(d));
    return () => {
      live = false;
    };
  }, [json]);

  const download = () => {
    const blob = new Blob([JSON.stringify({ ...st, sha256: digest }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${st.statement}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#eef3f9]/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="EU CBAM Green Certificate preview"
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong relative flex max-h-[calc(100vh-32px)] w-[720px] max-w-full flex-col overflow-hidden rounded-[24px]"
      >
        <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.06)] px-5 py-3.5">
          <FileBadge2 size={18} className="text-[#003399]" />
          <div className="flex-1 leading-tight">
            <div className="text-[14px] font-semibold text-ink">EU CBAM Green Certificate preview</div>
            <div className="text-[11px] text-muted">{st.template}</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-900/5 hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="scroll-quiet overflow-y-auto bg-gradient-to-b from-[#f6f8fc] to-[#eef3fa] p-5">
          <div className="paper relative rounded-2xl p-6">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-[#003399] via-cobalt to-emerald" />
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold tracking-[0.18em] text-[#003399] uppercase">Carbon Border Adjustment Mechanism</div>
                <div className="mt-1 text-[18px] font-semibold tracking-tight text-ink">Embedded Emissions &amp; Green Corridor Statement</div>
                <div className="num mt-0.5 text-[12px] text-muted">
                  {st.statement} · reporting period {st.period}
                </div>
              </div>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-[#003399]/40 text-[9px] font-bold tracking-wider text-[#003399] uppercase">EU</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[11.5px] max-sm:grid-cols-1">
              <Field k="Declarant (EU importer)" v={`${st.declarant.name}`} sub={`EORI ${st.declarant.eori}`} />
              <Field k="Producer / installation" v={st.producer.name} sub={st.producer.installation} />
              <Field k="Goods" v={st.goods.description} sub={`CN ${st.goods.cn} · ${st.goods.netMassT} t net`} />
              <Field k="Carbon price paid at origin" v="None" sub="INR 0 · no deduction claimed" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              <Big k="Direct" v={`${st.embedded.directTPerT}`} u="tCO₂e / t" />
              <Big k="Indirect" v={`${st.embedded.indirectTPerT}`} u="tCO₂e / t" />
              <Big k="Total embedded" v={`${st.embedded.totalT}`} u="tCO₂e" strong />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald/[0.06] px-3 py-2 text-[11px] text-ink shadow-[inset_0_0_0_1px_rgb(5_150_105/0.15)]">
              <Sprout size={14} className="text-emerald" />
              Transport, Scope 3 (informational): <span className="num font-semibold">{st.transportScope3.co2eT} tCO₂e</span>
              {st.greenCorridor.length > 0 && <span className="num text-subtle line-through">{st.transportScope3.baselineT}</span>} · {st.transportScope3.method}
            </div>
            <div className="mt-3 rounded-xl bg-slate-900/[0.03] p-3">
              <div className="text-[9.5px] font-semibold tracking-[0.1em] text-subtle uppercase">Green corridor measures</div>
              {st.greenCorridor.length ? (
                <ul className="mt-1.5 space-y-1 text-[11px]">
                  {st.greenCorridor.map((g) => (
                    <li key={g.leg} className="flex justify-between gap-3">
                      <span className="text-ink">
                        {g.leg} → <span className="font-semibold text-emerald">{g.shift}</span>
                      </span>
                      <span className="num font-semibold text-emerald">−{formatKg(g.savedKg)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-[11px] text-muted">None applied. Toggle legs in the mode-shift simulator to add them to the certificate.</div>
              )}
            </div>
            <p className="mt-3 text-[10.5px] leading-snug text-muted">
              {st.embedded.method}. {st.scopeNote}
            </p>
            <div className="num mt-4 flex items-center gap-1.5 border-t border-dashed border-slate-900/10 pt-3 text-[10px] text-muted">
              <BadgeCheck size={12} className="text-emerald" /> sha256 {digest ? `${digest.slice(0, 32)}…` : 'computing…'}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.06)] bg-white/70 px-5 py-3">
          <span className="text-[11px] text-muted">{saved ? `Saved ${st.statement}.json` : 'Exports the statement as signed JSON for the declarant’s CBAM registry upload.'}</span>
          <button onClick={download} disabled={!digest} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cobalt px-3.5 text-[12px] font-semibold text-white shadow-[0_8px_18px_-8px_rgb(37_99_235/0.8)] disabled:opacity-50">
            {saved ? <BadgeCheck size={14} /> : <Download size={14} />} {saved ? 'Downloaded' : 'Download .json'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-[0.1em] text-subtle uppercase">{k}</div>
      <div className="font-semibold text-ink">{v}</div>
      <div className="num text-[10.5px] text-muted">{sub}</div>
    </div>
  );
}

function Big({ k, v, u, strong }: { k: string; v: string; u: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${strong ? 'bg-[#003399] text-white' : 'bg-slate-900/[0.03]'}`}>
      <div className={`text-[9.5px] font-semibold tracking-[0.1em] uppercase ${strong ? 'text-white/70' : 'text-subtle'}`}>{k}</div>
      <div className="num text-[20px] leading-tight font-semibold">{v}</div>
      <div className={`text-[10px] ${strong ? 'text-white/70' : 'text-muted'}`}>{u}</div>
    </div>
  );
}

/* --- ULIP topology ---------------------------------------------------------------------------- */

const NODE_POS: Record<UlipId, { x: number; y: number }> = {
  icegate: { x: 320, y: 46 },
  portgate: { x: 556, y: 120 },
  ewaybill: { x: 490, y: 282 },
  vahan: { x: 150, y: 282 },
  fastag: { x: 84, y: 120 },
};
const HUB = { x: 320, y: 178 };
const VB = { w: 640, h: 330 };

const EVENT_TYPE: Record<UlipId, string> = {
  fastag: 'fastag.toll_read',
  icegate: 'icegate.status',
  vahan: 'vahan.verification',
  portgate: 'pcs.gate_event',
  ewaybill: 'ewb.validity',
};

/** Deterministic jitter around each connector's median, per event. */
const latencyOf = (e: UlipEvent) => Math.max(8, ULIP_BY_ID[e.connector].latencyMs + ((e.id * 37) % 15) - 7);

function shipmentOf(text: string): ShipmentId {
  if (/0494|5512094|GJ05|2419 8834|Mundra/.test(text)) return 'SHP-2611-0494';
  if (/0519|5508371|KA01/.test(text)) return 'SHP-2611-0519';
  return FLAGSHIP;
}

function Topology() {
  const log = useShipment((s) => s.ulipLog);
  const nowH = useShipment((s) => s.nowH);
  const latest = log[0];
  // Connectors report every 5–9 s; show the rate over the last five minutes.
  const perMin = log.filter((e) => nowH - e.h < 5 / 60).length / 5;
  return (
    <Card eyebrow="ULIP gateway" title="Platform ↔ Unified Logistics Interface Platform" action={<Pill tone="emerald" pulse>{ULIP.length} connectors live</Pill>}>
      <div className="relative w-full" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="hubglow">
              <stop offset="0%" stopColor={TONE_HEX.cobalt} stopOpacity="0.18" />
              <stop offset="100%" stopColor={TONE_HEX.cobalt} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={HUB.x} cy={HUB.y} r={110} fill="url(#hubglow)" />
          {ULIP.map((c, i) => {
            const p = NODE_POS[c.id];
            return (
              <g key={c.id}>
                <line x1={p.x} y1={p.y} x2={HUB.x} y2={HUB.y} stroke="rgba(5,150,105,0.28)" strokeWidth={1.5} strokeDasharray="4 5">
                  <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.4s" repeatCount="indefinite" />
                </line>
                {/* Heartbeat: a small packet every few seconds. */}
                <motion.circle
                  r={2.6}
                  fill={TONE_HEX.emerald}
                  initial={{ cx: p.x, cy: p.y, opacity: 0 }}
                  animate={{ cx: [p.x, HUB.x], cy: [p.y, HUB.y], opacity: [0, 0.8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 + i * 0.7, delay: i * 0.5, ease: 'easeInOut' }}
                />
              </g>
            );
          })}
          {/* A bright packet for each real event as it arrives. */}
          {latest && (
            <motion.circle
              key={latest.id}
              r={5}
              fill={TONE_HEX.emerald}
              initial={{ cx: NODE_POS[latest.connector].x, cy: NODE_POS[latest.connector].y, opacity: 1 }}
              animate={{ cx: HUB.x, cy: HUB.y, opacity: [1, 1, 0] }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: 'drop-shadow(0 0 6px rgba(5,150,105,0.8))' }}
            />
          )}
        </svg>

        {/* Hub. */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(HUB.x / VB.w) * 100}%`, top: `${(HUB.y / VB.h) * 100}%` }}>
          <div className="flex items-center gap-2 rounded-2xl bg-ink px-3 py-2 text-white shadow-[0_14px_30px_-12px_rgb(15_23_42/0.6)]">
            <Server size={15} />
            <div className="leading-tight">
              <div className="text-[11.5px] font-semibold whitespace-nowrap">One Platform · ULIP gateway</div>
              <div className="num text-[9.5px] text-white/70">{perMin.toFixed(1)} events / min · OAuth2 · mTLS</div>
            </div>
          </div>
        </div>

        {ULIP.map((c) => {
          const p = NODE_POS[c.id];
          const last = log.find((e) => e.connector === c.id);
          const lat = last ? latencyOf(last) : c.latencyMs;
          const fresh = last && latest && last.id === latest.id;
          return (
            <div key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(p.x / VB.w) * 100}%`, top: `${(p.y / VB.h) * 100}%` }}>
              <motion.div
                animate={{ scale: fresh ? [1, 1.06, 1] : 1, boxShadow: fresh ? '0 0 0 3px rgba(5,150,105,0.25), 0 10px 24px -14px rgba(15,23,42,0.35)' : '0 1px 2px rgba(15,23,42,0.06), 0 10px 24px -14px rgba(15,23,42,0.35)' }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 rounded-xl border border-[rgba(15,23,42,0.08)] bg-white px-2.5 py-1.5"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky/10 text-sky">
                  <Radio size={12} />
                </span>
                <div className="leading-tight">
                  <div className="text-[11px] font-semibold whitespace-nowrap text-ink">{c.id === 'portgate' ? 'JNPT Port Gate' : c.name}</div>
                  <div className="text-[9.5px] whitespace-nowrap text-subtle">{c.system}</div>
                </div>
                <span
                  className="num ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ color: lat < 80 ? TONE_HEX.emerald : TONE_HEX.amber, background: `color-mix(in oklab, ${lat < 80 ? TONE_HEX.emerald : TONE_HEX.amber} 10%, white)` }}
                >
                  {lat}ms
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* --- Event stream ----------------------------------------------------------------------------- */

function EventStream() {
  const log = useShipment((s) => s.ulipLog);
  const pushUlip = useShipment((s) => s.pushUlip);
  const [paused, setPaused] = useState<UlipEvent[] | null>(null);
  const [only, setOnly] = useState<UlipId | 'all'>('all');
  const [fired, setFired] = useState<{ n: number; label: string } | null>(null);
  const turn = useRef(0);
  const events = (paused ?? log).filter((e) => only === 'all' || e.connector === only).slice(0, 8);

  /** Deliver a real event through the store: the topology pulses and the stream appends it. */
  const fire = () => {
    const i = turn.current++;
    const c = only === 'all' ? ULIP[i % ULIP.length] : ULIP_BY_ID[only];
    pushUlip(c.id, c.messages[i % c.messages.length]);
    setPaused(null);
    setFired({ n: i, label: `${c.id === 'portgate' ? 'JNPT Gate' : c.name} · 200 OK` });
  };

  return (
    <Card
      pad={false}
      className="flex flex-col overflow-hidden"
      eyebrow="Webhook event stream"
      title="POST /v1/webhooks/ulip"
      action={
        <div className="flex items-center gap-1.5">
          <button
            onClick={fire}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald px-2.5 text-[11.5px] font-semibold text-white shadow-[0_6px_14px_-8px_rgb(5_150_105/0.9)] transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Zap size={12} /> Fire Live ULIP Webhook
          </button>
          <button
            onClick={() => setPaused(paused ? null : log)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900/[0.05] px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-slate-900/[0.08]"
            aria-pressed={!!paused}
            aria-label={paused ? 'Resume stream' : 'Pause stream'}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-1 px-5 pb-3">
        <AnimatePresence>
          {fired && (
            <motion.span
              key={fired.n}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              onAnimationComplete={() => setTimeout(() => setFired((f) => (f?.n === fired.n ? null : f)), 1800)}
              className="num mr-1 rounded-full bg-emerald/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald"
            >
              ✓ {fired.label}
            </motion.span>
          )}
        </AnimatePresence>
        {(['all', ...ULIP.map((c) => c.id)] as (UlipId | 'all')[]).map((k) => (
          <button
            key={k}
            onClick={() => setOnly(k)}
            className={`h-6 rounded-full px-2 text-[10.5px] font-semibold transition-colors ${only === k ? 'bg-ink text-white' : 'bg-slate-900/[0.04] text-muted hover:text-ink'}`}
          >
            {k === 'all' ? 'All' : ULIP_BY_ID[k].name}
          </button>
        ))}
      </div>
      <div className="scroll-quiet max-h-[392px] min-h-[220px] flex-1 overflow-y-auto bg-[#0B1220] px-4 py-3">
        {events.length === 0 && <div className="num py-8 text-center text-[11px] text-white/40">Waiting for the next connector event…</div>}
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const body = {
              id: `evt_${e.id.toString(36).padStart(6, '0')}`,
              type: EVENT_TYPE[e.connector],
              source: `${ULIP_BY_ID[e.connector].name} · ${ULIP_BY_ID[e.connector].system}`,
              shipment: shipmentOf(e.text),
              latency_ms: latencyOf(e),
              received_at: hourToDate(e.h).toISOString().replace(/\.\d+Z$/, 'Z'),
              data: { message: e.text },
            };
            return (
              <motion.pre
                key={e.id}
                layout
                initial={{ opacity: 0, y: -10, backgroundColor: 'rgba(37,99,235,0.18)' }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0.02)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="num mb-2 rounded-lg p-2.5 text-[10.5px] leading-relaxed whitespace-pre-wrap text-[#CBD5E1] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
              >
                <Json value={body} />
              </motion.pre>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1.5 border-t border-[rgba(15,23,42,0.06)] px-5 py-2.5 text-[10.5px] text-subtle">
        <Activity size={12} /> Signed with HMAC-SHA256 · retried with exponential backoff · {paused ? 'paused' : 'live'}
      </div>
    </Card>
  );
}

/** Minimal JSON syntax colouring. */
function Json({ value }: { value: Record<string, unknown> }) {
  const lines = JSON.stringify(value, null, 2).split('\n');
  return (
    <>
      {lines.map((l, i) => {
        const m = /^(\s*)"([^"]+)":\s(.*)$/.exec(l);
        if (!m) return <div key={i}>{l}</div>;
        const v = m[3];
        const color = v.startsWith('"') ? '#86EFAC' : /^[\d.-]/.test(v) ? '#FCD34D' : '#CBD5E1';
        return (
          <div key={i}>
            {m[1]}
            <span className="text-[#93C5FD]">"{m[2]}"</span>: <span style={{ color }}>{v}</span>
          </div>
        );
      })}
    </>
  );
}

/* --- Connector health -------------------------------------------------------------------------- */

/** 30 days of uptime per connector: mostly perfect, with a couple of realistic dips. */
function uptimeDays(id: UlipId): number[] {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 30 }, (_, d) => {
    const r = ((seed * 9301 + d * 49297) % 233280) / 233280;
    if (r > 0.95) return 99.2 + r * 0.5;
    if (r > 0.88) return 99.9;
    return 100;
  });
}

function ConnectorHealth() {
  const log = useShipment((s) => s.ulipLog);
  return (
    <Card className="mt-4" eyebrow="Connector health" title="Latency and 30-day uptime per endpoint">
      <div className="grid grid-cols-5 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {ULIP.map((c) => {
          const days = uptimeDays(c.id);
          const avg = days.reduce((a, b) => a + b, 0) / days.length;
          const recent = log.filter((e) => e.connector === c.id).slice(0, 6);
          const lats = recent.map(latencyOf);
          return (
            <div key={c.id} className="rounded-2xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.07)]">
              <div className="flex items-center justify-between">
                <div className="leading-tight">
                  <div className="text-[12.5px] font-semibold text-ink">{c.id === 'portgate' ? 'JNPT Port Gate' : c.name}</div>
                  <div className="text-[10px] text-subtle">{c.feeds}</div>
                </div>
                <Building2 size={14} className="text-subtle" />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="num text-[20px] leading-none font-semibold text-ink">
                    {lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : c.latencyMs}
                    <span className="text-[11px] font-medium text-muted">ms</span>
                  </div>
                  <div className="text-[10px] text-subtle">p50 latency</div>
                </div>
                <div className="text-right">
                  <div className="num text-[13px] font-semibold text-emerald">{avg.toFixed(2)}%</div>
                  <div className="text-[10px] text-subtle">uptime · 30d</div>
                </div>
              </div>
              <div className="mt-2.5 flex h-6 items-end gap-[2px]" aria-label={`30-day uptime ${avg.toFixed(2)}%`}>
                {days.map((u, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-[2px]"
                    title={`Day ${i + 1}: ${u.toFixed(2)}%`}
                    style={{ height: u >= 100 ? '100%' : u >= 99.9 ? '85%' : '60%', background: u >= 99.9 ? TONE_HEX.emerald : TONE_HEX.amber, opacity: u >= 100 ? 0.85 : 1 }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
