import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Boxes, ChevronRight, CircleDollarSign, LayoutGrid, Leaf, ListChecks, Plus, Search, ShieldAlert, Table2, Timer } from 'lucide-react';

import { Card, DashPage, Pill, RoleBadge, Segmented, StatCard } from '@/components/dash/kit';
import { MiniStepper } from '@/components/dash/MiniStepper';
import { ModeTrack } from '@/components/dash/ModeTrack';
import { NewShipmentModal } from '@/components/dash/NewShipmentModal';
import { usePortfolio, type PortfolioRow } from '@/components/dash/usePortfolio';
import { ACTIVE_TREND, OTP_TREND, RISK_TREND, VALUE_TREND } from '@/data/portfolio';
import { ROLES } from '@/data/shipment';
import { formatDelta, formatKg, formatStamp, formatUsd } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { CountUp } from '@/components/hud/ui';
import { useShipment } from '@/store/shipment';

type Layout = 'table' | 'grid';
type Filter = 'all' | 'active' | 'risk' | 'cleared';

const isRisk = (r: PortfolioRow) => r.status.tone === 'crimson' || r.status.tone === 'amber';

export default function ShipmentsPage() {
  const rows = usePortfolio();
  const [layout, setLayout] = useState<Layout>('table');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [booking, setBooking] = useState(false);

  const active = rows.filter((r) => r.status.label !== 'Delivered');
  const risky = rows.filter(isRisk);
  const value = rows.reduce((a, r) => a + r.valueUsd, 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'active' && r.status.label === 'Delivered') return false;
      if (filter === 'risk' && !isRisk(r)) return false;
      if (filter === 'cleared' && !r.cleared) return false;
      if (!q) return true;
      return [r.id, r.origin, r.destination, r.cargo, r.carrier, r.forwarder].some((x) => x.toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  return (
    <DashPage
      view="shipments"
      subtitle="Every shipment on the platform, priced, tracked and owned by someone right now. Live rows run on the same schedule engine as the Control Tower."
      actions={
        <button
          onClick={() => setBooking(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cobalt px-3.5 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(37_99_235/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <Plus size={15} strokeWidth={2.5} /> New Shipment
        </button>
      }
    >
      <NewShipmentModal open={booking} onClose={() => setBooking(false)} />
      {/* KPI strip. */}
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <StatCard
          label="Active Shipments"
          icon={<Boxes size={15} />}
          value={<CountUp value={active.length} />}
          sub={`${rows.length} on the platform · ${rows.filter((r) => r.live).length} live workflows`}
          spark={[...ACTIVE_TREND.slice(0, -1), active.length]}
        />
        <StatCard label="On-Time Rate" icon={<Timer size={15} />} tone="emerald" value={<CountUp value={94.2} format={(n) => `${n.toFixed(1)}%`} />} sub="+0.6 pts vs last week · 90-day OTP" subTone="emerald" spark={OTP_TREND} />
        <StatCard
          label="At-Risk / Holds"
          icon={<ShieldAlert size={15} />}
          tone={risky.length ? 'crimson' : 'emerald'}
          value={<CountUp value={risky.length} />}
          sub={risky.length ? risky.map((r) => r.status.label).join(' · ') : 'No exceptions open'}
          subTone={risky.length ? 'crimson' : 'emerald'}
          spark={[...RISK_TREND.slice(0, -1), risky.length]}
        />
        <StatCard
          label="Total Cargo Value"
          icon={<CircleDollarSign size={15} />}
          tone="violet"
          value={<CountUp value={value / 1e6} format={(n) => `$${n.toFixed(2)}M`} />}
          sub={`${formatUsd(value)} in flight · CIF/CIP insured`}
          spark={[...VALUE_TREND.slice(0, -1), value / 1e6]}
        />
      </div>

      <Card className="mt-4" pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <div className="eyebrow">Fleet command</div>
            <h2 className="text-[14.5px] font-semibold tracking-tight text-ink">
              {shown.length} shipment{shown.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-[rgba(15,23,42,0.08)] bg-white px-2.5 text-muted focus-within:ring-2 focus-within:ring-cobalt/30">
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ID, port, cargo…"
                className="w-[170px] bg-transparent text-[12px] text-ink outline-none placeholder:text-subtle"
                aria-label="Search shipments"
              />
            </label>
            <Segmented
              id="filter"
              label="Filter shipments"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All ${rows.length}` },
                { value: 'active', label: `Active ${active.length}` },
                { value: 'risk', label: `At Risk ${risky.length}` },
                { value: 'cleared', label: `Cleared ${rows.filter((r) => r.cleared).length}` },
              ]}
            />
            <Segmented
              id="layout"
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'table', label: 'Table', icon: <Table2 size={13} /> },
                { value: 'grid', label: 'Corridors', icon: <LayoutGrid size={13} /> },
              ]}
            />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={layout} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {shown.length === 0 ? (
              <div className="px-5 pb-8 text-center text-[12px] text-muted">No shipments match.</div>
            ) : layout === 'table' ? (
              <ShipmentTable rows={shown} />
            ) : (
              <div className="grid grid-cols-3 gap-4 px-5 pb-5 max-xl:grid-cols-2 max-md:grid-cols-1">
                {shown.map((r) => (
                  <CorridorCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
      <p className="mt-3 text-[11px] text-subtle">
        Live rows carry the full four-party workflow. Watch-list rows come from carrier feeds; tracking one flies the globe to its corridor.
      </p>
    </DashPage>
  );
}

/* --- Table ------------------------------------------------------------------------- */

function ShipmentTable({ rows }: { rows: PortfolioRow[] }) {
  const selected = useShipment((s) => s.selected);
  const select = useShipment((s) => s.selectShipment);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead>
          <tr className="border-y border-[rgba(15,23,42,0.06)] bg-slate-900/[0.02] text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">
            <th className="w-[40px] py-2.5 pl-4" aria-label="Expand" />
            <th className="py-2.5 pr-3 pl-1 font-semibold">Shipment</th>
            <th className="px-3 font-semibold">Route</th>
            <th className="px-3 font-semibold">Progress</th>
            <th className="px-3 font-semibold">Status</th>
            <th className="px-3 font-semibold">ETA</th>
            <th className="px-3 font-semibold">CO₂e</th>
            <th className="px-3 font-semibold">Baton</th>
            <th className="px-3 text-right font-semibold">Value</th>
            <th className="py-2.5 pr-5 pl-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isSel = r.live === selected;
            const expanded = open === r.id;
            return (
              <Fragment key={r.id}>
              <tr
                onClick={() => r.live && select(r.live)}
                className={`group border-b border-[rgba(15,23,42,0.05)] transition-colors last:border-0 ${r.live ? 'cursor-pointer' : ''} ${isSel ? 'bg-cobalt/[0.035]' : 'hover:bg-slate-900/[0.02]'}`}
                aria-selected={isSel}
              >
                <td className="relative py-3 pl-4">
                  {isSel && <span className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-cobalt" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(expanded ? null : r.id);
                    }}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} milestones for ${r.id}`}
                    className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-slate-900/[0.05] hover:text-ink"
                  >
                    <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
                  </button>
                </td>
                <td className="py-3 pr-3 pl-1">
                  <div className="num flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                    {r.id}
                    {r.custom && <span className="rounded bg-cobalt/10 px-1 text-[9px] font-bold text-cobalt">NEW</span>}
                  </div>
                  <div className="max-w-[170px] truncate text-[11px] text-muted">{r.cargo}</div>
                </td>
                <td className="px-3">
                  <div className="text-[12.5px] font-semibold whitespace-nowrap text-ink">
                    {r.origin} <span className="text-subtle">→</span> {r.destination}
                  </div>
                  <div className="text-[10.5px] text-subtle">
                    {r.direction} · {r.live ? 'Live workflow' : 'Carrier feed'}
                  </div>
                </td>
                <td className="px-3">
                  <div className="w-[172px]">
                    <ModeTrack legs={r.legs} width={172} />
                  </div>
                </td>
                <td className="px-3">
                  <Pill tone={r.status.tone} pulse={r.status.alert}>
                    {r.status.label}
                  </Pill>
                </td>
                <td className="px-3 whitespace-nowrap">
                  <div className="num text-[12px] font-semibold text-ink">{formatStamp(r.etaH, r.destTz).slice(0, 16)}</div>
                  <div className="num text-[10.5px] font-semibold" style={{ color: TONE_HEX[deltaTone(r.etaDeltaH)] }}>
                    {formatDelta(r.etaDeltaH)}
                  </div>
                </td>
                <td className="px-3">
                  <Co2Tag kg={r.co2Kg} heavy={r.legs.some((l) => l.mode === 'air')} />
                </td>
                <td className="px-3">
                  <Baton r={r} />
                </td>
                <td className="num px-3 text-right text-[12px] font-semibold text-ink">{formatUsd(r.valueUsd)}</td>
                <td className="py-3 pr-5 pl-3 text-right">
                  <TrackButton id={r.id} />
                </td>
              </tr>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.tr key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-[rgba(15,23,42,0.05)] bg-[#F7F9FC]">
                    <td colSpan={10} className="px-5 pt-3 pb-1">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">
                        <ListChecks size={12} /> Milestones · {r.steps.filter((s) => s.status === 'done').length}/{r.steps.length} done
                      </div>
                      <MiniStepper steps={r.steps} />
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- Corridor cards -------------------------------------------------------------------- */

function CorridorCard({ r }: { r: PortfolioRow }) {
  const selected = useShipment((s) => s.selected);
  const select = useShipment((s) => s.selectShipment);
  const isSel = r.live === selected;
  const [steps, setSteps] = useState(false);
  return (
    <motion.article
      layout
      onClick={() => r.live && select(r.live)}
      className={`group relative flex flex-col rounded-[18px] border bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_28px_-16px_rgb(15_23_42/0.18)] transition-shadow hover:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_36px_-16px_rgb(15_23_42/0.24)] ${r.live ? 'cursor-pointer' : ''}`}
      style={{ borderColor: isSel ? 'rgba(37,99,235,0.45)' : 'rgba(15,23,42,0.08)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-[11.5px] font-semibold text-muted">{r.id}</span>
        <Pill tone={r.status.tone} pulse={r.status.alert}>
          {r.status.label}
        </Pill>
      </div>
      <div className="mt-2 text-[18px] leading-tight font-semibold tracking-tight text-ink">
        {r.origin} <span className="text-subtle">→</span> {r.destination}
      </div>
      <div className="truncate text-[11.5px] text-muted">
        {r.cargo} · {r.carrier}
      </div>

      <div className="mt-3 rounded-xl bg-[#F7F9FC] px-2 pt-1 pb-0.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.04)]">
        <ModeTrack legs={r.legs} labels width={300} />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] font-medium text-subtle">
        <span>{r.nodes[0]}</span>
        <span className="num">{Math.round(r.progress * 100)}% complete</span>
        <span>{r.nodes[r.nodes.length - 1]}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini label={`ETA ${r.destination}`} value={formatStamp(r.etaH, r.destTz).slice(4, 10)} sub={formatDelta(r.etaDeltaH)} subTone={deltaTone(r.etaDeltaH)} />
        <Mini label="CO₂e" value={formatKg(r.co2Kg)} sub={r.legs.some((l) => l.mode === 'air') ? 'Air · carbon-heavy' : 'Scope 3 · GLEC'} subTone={r.legs.some((l) => l.mode === 'air') ? 'amber' : 'emerald'} />
        <Mini label="Value" value={`$${(r.valueUsd / 1000).toFixed(1)}k`} sub={r.hsCode} />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setSteps((v) => !v);
        }}
        aria-expanded={steps}
        className="mt-3 flex items-center gap-1 self-start text-[11px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ChevronRight size={13} className={`transition-transform duration-200 ${steps ? 'rotate-90' : ''}`} />
        Milestones · {r.steps.filter((s) => s.status === 'done').length}/{r.steps.length}
      </button>
      <AnimatePresence initial={false}>
        {steps && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2">
              <MiniStepper steps={r.steps} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[rgba(15,23,42,0.06)] pt-3">
        <Baton r={r} />
        <TrackButton id={r.id} />
      </div>
    </motion.article>
  );
}

function Mini({ label, value, sub, subTone = 'slate' }: { label: string; value: string; sub?: string; subTone?: Tone }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-900/[0.025] px-2.5 py-2">
      <div className="truncate text-[9px] font-semibold tracking-[0.1em] text-subtle uppercase">{label}</div>
      <div className="num mt-0.5 truncate text-[12.5px] font-semibold text-ink">{value}</div>
      {sub && (
        <div className="num truncate text-[10px] font-semibold" style={{ color: TONE_HEX[subTone] }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* --- Bits ------------------------------------------------------------------------------ */

function deltaTone(h: number): 'emerald' | 'amber' | 'cobalt' | 'slate' {
  if (Math.abs(h) < 0.25) return 'emerald';
  return h > 0 ? 'amber' : 'cobalt';
}

function Co2Tag({ kg, heavy }: { kg: number; heavy?: boolean }) {
  return (
    <span
      className={`num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${heavy ? 'bg-amber/[0.08] text-amber shadow-[inset_0_0_0_1px_rgb(217_119_6/0.18)]' : 'bg-emerald/[0.08] text-emerald shadow-[inset_0_0_0_1px_rgb(5_150_105/0.15)]'}`}
      title={heavy ? 'Carbon-heavy: includes an air leg' : 'Scope 3 transport emissions'}
    >
      <Leaf size={10} />
      {formatKg(kg)}
    </span>
  );
}

function Baton({ r }: { r: PortfolioRow }) {
  const hex = TONE_HEX[ROLES[r.baton.role].tone];
  return (
    <div className="flex min-w-0 items-center gap-2" title={`${ROLES[r.baton.role].label} holds the baton: ${r.baton.task}`}>
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold"
        style={{ color: hex, background: `color-mix(in oklab, ${hex} 12%, white)`, boxShadow: `0 0 0 2px white, 0 0 0 3.5px color-mix(in oklab, ${hex} 55%, transparent)` }}
      >
        {r.baton.initials}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="max-w-[110px] truncate text-[11.5px] font-semibold text-ink">{r.baton.person}</span>
          <RoleBadge role={r.baton.role} />
        </div>
        <div className="max-w-[170px] truncate text-[10.5px] text-muted">{r.baton.task}</div>
      </div>
    </div>
  );
}

function TrackButton({ id }: { id: string }) {
  const track = useShipment((s) => s.trackShipment);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        track(id);
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold whitespace-nowrap text-cobalt transition-colors hover:bg-cobalt/[0.08]"
      aria-label={`Track ${id} on the 3D globe`}
    >
      Track on 3D Globe <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
