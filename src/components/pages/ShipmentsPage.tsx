import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Boxes, CircleDollarSign, LayoutGrid, Leaf, Search, ShieldAlert, Table2, Timer } from 'lucide-react';

import { Card, DashPage, Pill, RoleBadge, Segmented, StatCard } from '@/components/dash/kit';
import { ModeTrack } from '@/components/dash/ModeTrack';
import { usePortfolio, type PortfolioRow } from '@/components/dash/usePortfolio';
import { ACTIVE_TREND, OTP_TREND, RISK_TREND, VALUE_TREND } from '@/data/portfolio';
import { ROLES } from '@/data/shipment';
import { formatDelta, formatKg, formatStamp, formatUsd } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { useShipment } from '@/store/shipment';

type Layout = 'table' | 'grid';
type Filter = 'all' | 'live' | 'risk';

export default function ShipmentsPage() {
  const rows = usePortfolio();
  const [layout, setLayout] = useState<Layout>('table');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const active = rows.filter((r) => r.status.label !== 'Delivered');
  const risky = rows.filter((r) => r.status.tone === 'crimson' || r.status.tone === 'amber');
  const value = rows.reduce((a, r) => a + r.valueUsd, 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'live' && !r.live) return false;
      if (filter === 'risk' && r.status.tone !== 'crimson' && r.status.tone !== 'amber') return false;
      if (!q) return true;
      return [r.id, r.origin, r.destination, r.cargo, r.carrier, r.forwarder].some((x) => x.toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  return (
    <DashPage view="shipments" subtitle="Every shipment on the platform, priced, tracked and owned by someone right now. Live rows run on the same schedule engine as the Control Tower.">
      {/* KPI strip. */}
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <StatCard
          label="Active Shipments"
          icon={<Boxes size={15} />}
          value={active.length}
          sub={`${rows.length} on the platform · ${rows.filter((r) => r.live).length} live workflows`}
          spark={[...ACTIVE_TREND.slice(0, -1), active.length]}
        />
        <StatCard label="On-Time Rate" icon={<Timer size={15} />} tone="emerald" value="94.2%" sub="+0.6 pts vs last week · 90-day OTP" subTone="emerald" spark={OTP_TREND} />
        <StatCard
          label="At-Risk / Holds"
          icon={<ShieldAlert size={15} />}
          tone={risky.length ? 'crimson' : 'emerald'}
          value={risky.length}
          sub={risky.length ? risky.map((r) => r.status.label).join(' · ') : 'No exceptions open'}
          subTone={risky.length ? 'crimson' : 'emerald'}
          spark={[...RISK_TREND.slice(0, -1), risky.length]}
        />
        <StatCard
          label="Total Cargo Value"
          icon={<CircleDollarSign size={15} />}
          tone="violet"
          value={`$${(value / 1e6).toFixed(2)}M`}
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
                { value: 'all', label: 'All' },
                { value: 'live', label: 'Live' },
                { value: 'risk', label: 'At risk' },
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse text-left">
        <thead>
          <tr className="border-y border-[rgba(15,23,42,0.06)] bg-slate-900/[0.02] text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">
            <th className="py-2.5 pr-3 pl-5 font-semibold">Shipment</th>
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
            return (
              <tr
                key={r.id}
                onClick={() => r.live && select(r.live)}
                className={`group border-b border-[rgba(15,23,42,0.05)] transition-colors last:border-0 ${r.live ? 'cursor-pointer' : ''} ${isSel ? 'bg-cobalt/[0.035]' : 'hover:bg-slate-900/[0.02]'}`}
                aria-selected={isSel}
              >
                <td className="relative py-3 pr-3 pl-5">
                  {isSel && <span className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-cobalt" />}
                  <div className="num text-[12px] font-semibold text-ink">{r.id}</div>
                  <div className="max-w-[190px] truncate text-[11px] text-muted">{r.cargo}</div>
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
                  <div className="w-[200px]">
                    <ModeTrack legs={r.legs} width={200} />
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
                  <Co2Tag kg={r.co2Kg} />
                </td>
                <td className="px-3">
                  <Baton r={r} />
                </td>
                <td className="num px-3 text-right text-[12px] font-semibold text-ink">{formatUsd(r.valueUsd)}</td>
                <td className="py-3 pr-5 pl-3 text-right">
                  <TrackButton id={r.id} />
                </td>
              </tr>
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
        <Mini label="CO₂e" value={formatKg(r.co2Kg)} sub="Scope 3 · GLEC" subTone="emerald" />
        <Mini label="Value" value={`$${(r.valueUsd / 1000).toFixed(1)}k`} sub={r.hsCode} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(15,23,42,0.06)] pt-3">
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

function Co2Tag({ kg }: { kg: number }) {
  return (
    <span className="num inline-flex items-center gap-1 rounded-md bg-emerald/[0.08] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-emerald shadow-[inset_0_0_0_1px_rgb(5_150_105/0.15)]">
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
