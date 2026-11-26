import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
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
} from 'lucide-react';

import { Card, DashPage, Pill, ShipmentPicker } from '@/components/dash/kit';
import { usePortfolio } from '@/components/dash/usePortfolio';
import { FLEET } from '@/data/fleet';
import { CO2_FACTOR, FLAGSHIP, ROUTES, ULIP, type Mode, type ShipmentId, type UlipId } from '@/data/shipment';
import { formatKg, hourToDate } from '@/lib/format';
import { sha256Hex } from '@/lib/hash';
import { MODE_HEX, TONE_HEX } from '@/lib/palette';
import type { Schedule } from '@/lib/schedule';
import { ULIP_BY_ID, useScheduleFor, useShipment, type UlipEvent } from '@/store/shipment';

const MODE_ICON = { road: Truck, rail: TrainFront, sea: Ship, air: Plane } as const;
const MODE_LABEL: Record<Mode, string> = { road: 'Road', rail: 'Rail', sea: 'Sea', air: 'Air' };

export default function IntegrationsPage() {
  return (
    <DashPage
      view="integrations"
      subtitle="Scope 3 transport emissions measured per leg on the GLEC method, ready for EU CBAM reporting, and the government APIs that feed every milestone on the platform."
      actions={<ShipmentPicker />}
    >
      <SectionHead icon={<Leaf size={14} />} eyebrow="Section A" title="Scope 3 carbon & CBAM analytics" />
      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <LegEmissions />
        <FleetByMode />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <GreenCorridors />
        <CbamCard />
      </div>

      <SectionHead icon={<Webhook size={14} />} eyebrow="Section B" title="ULIP live API topology" className="mt-8" />
      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
        <Topology />
        <EventStream />
      </div>
      <ConnectorHealth />
    </DashPage>
  );
}

function SectionHead({ icon, eyebrow, title, className = '' }: { icon: React.ReactNode; eyebrow: string; title: string; className?: string }) {
  return (
    <div className={`mb-3 flex items-center gap-2.5 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-cobalt shadow-[inset_0_0_0_1px_rgb(15_23_42/0.08)]">{icon}</span>
      <div className="leading-tight">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      </div>
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
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ color: MODE_HEX[l.mode], background: `color-mix(in oklab, ${MODE_HEX[l.mode]} 10%, white)` }}>
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
                  style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${MODE_HEX[l.mode]} 55%, white), ${MODE_HEX[l.mode]})` }}
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
            <span className="h-2 w-2 rounded-full" style={{ background: MODE_HEX[m] }} />
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
          <motion.div key={m} style={{ background: MODE_HEX[m] }} initial={{ width: 0 }} animate={{ width: `${(totals[m] / sum) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="h-full border-r-2 border-white last:border-0" />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {modes.map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <li key={m} className="flex items-center gap-2.5 text-[12px]">
              <Icon size={14} style={{ color: MODE_HEX[m] }} />
              <span className="flex-1 text-muted">{MODE_LABEL[m]}</span>
              <span className="num font-semibold text-ink">{formatKg(totals[m])}</span>
              <span className="num w-[40px] text-right text-[11px] text-subtle">{((totals[m] / sum) * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 rounded-xl bg-sky/[0.06] p-2.5 text-[11px] leading-snug text-muted shadow-[inset_0_0_0_1px_rgb(2_132_199/0.12)]">
        <span className="font-semibold text-sky">Air is {((totals.air / sum) * 100).toFixed(0)}% of emissions</span> from a single 1.8 t shipment. Moving one pharma lane to sea-air would cut more CO₂e than every road leg combined.
      </p>
    </Card>
  );
}

/* --- Green corridors ---------------------------------------------------------------------- */

interface Alternative {
  id: ShipmentId;
  title: string;
  current: number;
  green: number;
  cost: string;
  time: string;
}

/** Re-price each leg's tonne-km at the factor the greener option would use. */
function greenFor(id: ShipmentId, schedule: Schedule): Alternative {
  const tkm = (l: Schedule['legs'][number]) => l.co2Kg / CO2_FACTOR[l.mode];
  const current = schedule.co2Kg;
  let green = 0;
  for (const l of schedule.legs) {
    if (id === FLAGSHIP) green += l.mode === 'road' ? tkm(l) * 1.12 * CO2_FACTOR.rail : l.mode === 'sea' ? l.co2Kg * 0.85 : l.co2Kg;
    else if (id === 'SHP-2611-0519') green += l.mode === 'air' ? l.co2Kg * 0.76 : l.co2Kg;
    else green += l.mode === 'road' && l.group === 'origin' ? tkm(l) * 1.1 * CO2_FACTOR.sea + 0.03 * l.co2Kg : l.co2Kg;
  }
  if (id === FLAGSHIP) return { id, title: 'Rail to JNPT via Talegaon ICD, LNG dual-fuel vessel', current, green, cost: '+$140', time: '+6h' };
  if (id === 'SHP-2611-0519') return { id, title: '30% SAF blend on SKB 761 (book and claim)', current, green, cost: '+$610', time: '±0h' };
  return { id, title: 'Coastal feeder from Hazira instead of road to Mundra', current, green, cost: '−$90', time: '+14h' };
}

function GreenCorridors() {
  const a = useScheduleFor('SHP-2611-0482');
  const b = useScheduleFor('SHP-2611-0519');
  const c = useScheduleFor('SHP-2611-0494');
  const alts = [greenFor('SHP-2611-0482', a), greenFor('SHP-2611-0519', b), greenFor('SHP-2611-0494', c)];
  const saved = alts.reduce((x, y) => x + (y.current - y.green), 0);
  return (
    <Card className="col-span-2 max-xl:col-span-1" eyebrow="Green corridor savings" title="What the greener routing would save, per live shipment" action={<Pill tone="emerald">−{formatKg(saved)} CO₂e possible</Pill>}>
      <ul className="space-y-4">
        {alts.map((x) => {
          const pct = (1 - x.green / x.current) * 100;
          const max = x.current;
          return (
            <li key={x.id}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="num mr-2 text-[11px] font-semibold text-muted">{x.id}</span>
                  <span className="text-[12.5px] font-semibold text-ink">{x.title}</span>
                </div>
                <span className="flex items-center gap-2 text-[11px]">
                  <span className="num font-semibold text-emerald">−{pct.toFixed(0)}%</span>
                  <span className="num text-muted">
                    {x.cost} · {x.time}
                  </span>
                </span>
              </div>
              <div className="space-y-1">
                <BarRow label="Current" value={x.current} max={max} color="#94A3B8" />
                <BarRow label="Green" value={x.green} max={max} color={TONE_HEX.emerald} />
              </div>
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

function useCbamStatement() {
  const schedule = useScheduleFor(FLAGSHIP);
  return useMemo(() => {
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
      transportScope3: { co2eT: +(schedule.co2Kg / 1000).toFixed(3), method: 'GLEC v3 well-to-wheel', note: 'Informational; transport is not part of CBAM embedded emissions' },
      carbonPricePaid: { currency: 'INR', amount: 0 },
      scopeNote: 'CN 8708 is not listed in CBAM Annex I. Statement prepared voluntarily for the buyer’s supply-chain reporting.',
    };
  }, [schedule.co2Kg]);
}

function CbamCard() {
  const [open, setOpen] = useState(false);
  const st = useCbamStatement();
  return (
    <Card eyebrow="EU CBAM" title="Embedded emissions statement · SHP-2611-0482">
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
          </dl>
          <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-cobalt/[0.06]" />
        </div>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-ink text-[12.5px] font-semibold text-white shadow-[0_10px_22px_-12px_rgb(15_23_42/0.8)] transition-transform active:scale-[0.98]"
      >
        <ScrollText size={14} /> Export EU CBAM Certificate
      </button>
      <p className="mt-2 text-[10.5px] leading-snug text-subtle">{st.scopeNote}</p>
      {/* Portalled: the page sits in a transformed transition wrapper, which would
          otherwise become the containing block for this fixed-position dialog. */}
      {createPortal(<AnimatePresence>{open && <CbamModal onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
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

function CbamModal({ onClose }: { onClose: () => void }) {
  const st = useCbamStatement();
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
        aria-label="EU CBAM certificate preview"
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong relative flex max-h-[calc(100vh-32px)] w-[720px] max-w-full flex-col overflow-hidden rounded-[24px]"
      >
        <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.06)] px-5 py-3.5">
          <FileBadge2 size={18} className="text-[#003399]" />
          <div className="flex-1 leading-tight">
            <div className="text-[14px] font-semibold text-ink">EU CBAM certificate preview</div>
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
                <div className="mt-1 text-[18px] font-semibold tracking-tight text-ink">Embedded Emissions Statement</div>
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
              Transport, Scope 3 (informational): <span className="num font-semibold">{st.transportScope3.co2eT} tCO₂e</span> · {st.transportScope3.method}
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
                <line x1={p.x} y1={p.y} x2={HUB.x} y2={HUB.y} stroke="rgba(37,99,235,0.22)" strokeWidth={1.5} strokeDasharray="4 5">
                  <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.4s" repeatCount="indefinite" />
                </line>
                {/* Heartbeat: a small packet every few seconds. */}
                <motion.circle
                  r={2.6}
                  fill={TONE_HEX.cobalt}
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
  const [paused, setPaused] = useState<UlipEvent[] | null>(null);
  const [only, setOnly] = useState<UlipId | 'all'>('all');
  const events = (paused ?? log).filter((e) => only === 'all' || e.connector === only).slice(0, 8);

  return (
    <Card
      pad={false}
      className="flex flex-col overflow-hidden"
      eyebrow="Webhook event stream"
      title="POST /v1/webhooks/ulip"
      action={
        <button
          onClick={() => setPaused(paused ? null : log)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900/[0.05] px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-slate-900/[0.08]"
          aria-pressed={!!paused}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
        </button>
      }
    >
      <div className="flex flex-wrap gap-1 px-5 pb-3">
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
