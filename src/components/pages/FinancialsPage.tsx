import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Coins, Eye, FileCheck2, Landmark, Loader2, Lock, Receipt, Scale, ShieldCheck, ShieldX, Ship, Truck, Zap } from 'lucide-react';

import { Card, DashPage, Pill, RadialGauge, RoleBadge, Segmented, ShipmentPicker, StatCard } from '@/components/dash/kit';
import { DemurrageWhatIf } from '@/components/dash/DemurrageWhatIf';
import { InvoicePreview } from '@/components/dash/InvoicePreview';
import { STATUS_TONE, type LedgerRow, type LedgerStatus } from '@/components/dash/ledger';
import { usePortfolio } from '@/components/dash/usePortfolio';
import { CountUp } from '@/components/hud/ui';
import { BOOKED_DEMURRAGE, COSTS, DEMURRAGE_BUDGET, INR_PER_USD, LIVE_IDS, MUNDRA_HOLD_RATE, STATIC_INVOICES, moneyToUsd, type CostCategory } from '@/data/finance';
import { FLEET } from '@/data/fleet';
import { QUOTES } from '@/data/partners';
import { WATCH_BY_ID } from '@/data/portfolio';
import { XRAY_SETS } from '@/data/xray';
import { DISRUPTIONS, FLAGSHIP, ROLES, type EscrowLine, type Role, type ShipmentId } from '@/data/shipment';
import { SURAT } from '@/lib/fleet';
import { formatStamp, formatUsd } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { escrowStatus, milestoneStatuses, type EscrowStatus } from '@/lib/schedule';
import { demurrageUsd, payeeOf, useScheduleFor, useShipment, type ShipmentState } from '@/store/shipment';

/* --- Live money model -------------------------------------------------------------------- */

interface Exposure {
  label: string;
  usd: number;
  live: boolean;
  tone: Tone;
}

/** Demurrage and detention exposure across the book, accruing live where a box is stuck. */
function exposures(s: ShipmentState): Exposure[] {
  const out: Exposure[] = [];
  if (s.disruption) {
    const def = DISRUPTIONS[s.disruption.kind];
    out.push({ label: `${def.short} · SHP-2611-0482`, usd: demurrageUsd(def.ratePerDay, (performance.now() - s.disruption.startedMs) / 1000), live: true, tone: 'crimson' });
  }
  for (const r of s.resolved) out.push({ label: `${DISRUPTIONS[r.kind].short} (capped)`, usd: r.accruedUsd, live: false, tone: 'amber' });
  const holdEnd = s.hold0494 === 'active' ? s.nowH : (s.hold0494AtH ?? s.nowH);
  out.push({
    label: `Mundra ground rent · SHP-2611-0494${s.hold0494 === 'active' ? '' : ' (closed)'}`,
    usd: (MUNDRA_HOLD_RATE / 24) * Math.max(0, holdEnd - SURAT.holdSinceH),
    live: s.hold0494 === 'active',
    tone: s.hold0494 === 'active' ? 'crimson' : 'amber',
  });
  for (const [id, usd] of Object.entries(BOOKED_DEMURRAGE)) out.push({ label: `Colombo roll · ${id}`, usd, live: false, tone: 'amber' });
  return out;
}

function costsFor(id: string, assignments: ShipmentState['assignments'], estimate?: Record<CostCategory, number>): Record<CostCategory, number> {
  // New bookings have no contracted cost sheet yet; they carry an estimate.
  const base = COSTS[id] ?? estimate!;
  const pid = (assignments as Record<string, string | undefined>)[id];
  if (!pid) return base;
  const quote = QUOTES[id as ShipmentId]?.find((q) => q.partner === pid);
  return quote ? { ...base, freight: quote.priceUsd } : base;
}

const TRIGGER_STAGE: Record<string, { title: string; proof: string; icon: React.ReactNode }> = {
  gateIn: { title: 'Gate-In Proof', proof: 'Geo-tagged photo + OCR gate read', icon: <Truck size={15} /> },
  leo: { title: 'Customs LEO', proof: 'ICEGATE Let Export Order', icon: <ShieldCheck size={15} /> },
  loaded: { title: 'Shipped on Board', proof: 'Carrier on-board confirmation', icon: <Ship size={15} /> },
  lc: { title: 'e-BL Surrender', proof: 'e-BL presented under the LC', icon: <FileCheck2 size={15} /> },
  ata: { title: 'Arrival Notice', proof: 'FRA ULD breakdown scan', icon: <Ship size={15} /> },
  delivered: { title: 'Proof of Delivery', proof: 'Consignee e-POD signature', icon: <FileCheck2 size={15} /> },
};

export default function FinancialsPage() {
  const state = useShipment();
  const rows = usePortfolio();
  const exp = exposures(state);
  const exposure = exp.reduce((a, e) => a + e.usd, 0);
  const accruing = exp.some((e) => e.live);

  const allCosts = rows.map((r) => ({ id: r.id, c: costsFor(r.id, state.assignments, r.costs) }));
  const spend = allCosts.reduce((a, x) => a + x.c.freight + x.c.customs + x.c.inland + x.c.port + x.c.insurance, 0);
  const kg = rows.reduce((a, r) => a + r.grossKg, 0);

  const s0482 = useScheduleFor('SHP-2611-0482');
  const s0519 = useScheduleFor('SHP-2611-0519');
  const s0494 = useScheduleFor('SHP-2611-0494');
  const scheds = { 'SHP-2611-0482': s0482, 'SHP-2611-0519': s0519, 'SHP-2611-0494': s0494 } as const;
  const payouts = LIVE_IDS.flatMap((id) => {
    const st = milestoneStatuses(scheds[id], state.nowH, state.nowH);
    return FLEET[id].escrow.filter((e) => e.id !== 'exporter').map((e) => ({ id, e, usd: moneyToUsd(e.amount), st: escrowStatus(st[e.trigger]) }));
  });
  const released = payouts.filter((p) => p.st === 'released').reduce((a, p) => a + p.usd, 0);
  const locked = payouts.filter((p) => p.st !== 'released').reduce((a, p) => a + p.usd, 0);

  return (
    <DashPage
      view="financials"
      subtitle="Spend, exposure and payouts tied to milestone proof. Escrow releases itself when the gate, customs or carrier confirms; demurrage is counted while it happens, not on next month's invoice."
      actions={<ShipmentPicker />}
    >
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <Card className="relative overflow-hidden">
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ color: TONE_HEX.crimson, background: `color-mix(in oklab, ${TONE_HEX.crimson} 10%, white)` }}>
              <Scale size={15} />
            </span>
            Demurrage Exposure
            {accruing && <Pill tone="crimson" pulse>accruing</Pill>}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <RadialGauge
              value={exposure / DEMURRAGE_BUDGET}
              display={`${Math.round((exposure / DEMURRAGE_BUDGET) * 100)}%`}
              caption="of budget"
              tone={exposure / DEMURRAGE_BUDGET > 0.6 ? 'crimson' : exposure / DEMURRAGE_BUDGET > 0.3 ? 'amber' : 'emerald'}
              size={84}
              stroke={8}
            />
            <div className="min-w-0">
              <div className="num text-[24px] leading-none font-semibold tracking-[-0.03em] text-ink">
                <CountUp value={exposure} format={(n) => formatUsd(n)} duration={0.7} />
              </div>
              <div className="mt-1 text-[11px] text-muted">of {formatUsd(DEMURRAGE_BUDGET)} monthly budget</div>
            </div>
          </div>
          <ul className="mt-2 space-y-0.5">
            {exp.map((e) => (
              <li key={e.label} className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="flex min-w-0 items-center gap-1 truncate text-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_HEX[e.tone] }} />
                  {e.label}
                </span>
                <span className="num font-semibold" style={{ color: e.live ? TONE_HEX.crimson : '#0F172A' }}>
                  {formatUsd(e.usd)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <StatCard
          label="Total Freight Spend"
          icon={<Receipt size={15} />}
          value={<CountUp value={spend} format={(n) => formatUsd(n)} />}
          sub={`${rows.length} shipments · freight, customs, inland, port, insurance`}
          spark={[19.8, 21.0, 20.4, 22.1, 21.6, 22.8, 23.5, spend / 1000]}
        />
        <Card>
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ color: TONE_HEX.emerald, background: `color-mix(in oklab, ${TONE_HEX.emerald} 10%, white)` }}>
              <Lock size={14} />
            </span>
            Escrow Locked vs. Released
          </div>
          <div className="num mt-3 text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink">
            <CountUp value={released} format={(n) => formatUsd(n)} /> <span className="text-[13px] font-medium text-muted">released</span>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-900/[0.06]">
            <motion.div className="h-full bg-emerald" animate={{ width: `${(released / (released + locked || 1)) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
            <div className="h-full flex-1 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.10)_0_4px,transparent_4px_8px)]" />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px]">
            <span className="font-medium text-emerald">{payouts.filter((p) => p.st === 'released').length} payouts released</span>
            <span className="num text-muted">{formatUsd(locked)} locked</span>
          </div>
          <div className="mt-1 text-[10.5px] text-subtle">Partner payouts across the three live shipments. LC and CAD proceeds are tracked in the ledger.</div>
        </Card>
        <StatCard
          label="Cost per kg"
          icon={<Coins size={15} />}
          tone="violet"
          value={<CountUp value={spend / kg} format={(n) => `$${n.toFixed(3)}`} />}
          sub={`${formatUsd(spend)} over ${(kg / 1000).toFixed(1)} t gross · lane benchmark $0.390`}
          subTone={spend / kg < 0.39 ? 'emerald' : 'amber'}
          spark={[0.41, 0.4, 0.39, 0.4, 0.38, 0.37, 0.375, spend / kg]}
        />
      </div>

      <EscrowPipeline />
      <DemurrageWhatIf />

      <div className="mt-4 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] gap-4 max-[1180px]:grid-cols-1">
        <CostBreakdown allCosts={allCosts} exposure={exposure} />
        <Ledger />
      </div>
    </DashPage>
  );
}

/* --- Escrow pipeline ----------------------------------------------------------------------- */

type StageState = 'locked' | 'verified' | 'released' | 'blocked' | 'scheduled';

/**
 * Milestone proof lands, the contract verifies it, then funds move. A payout reads
 * "Verified" for the first couple of seconds after its proof arrives, so the hand-off
 * is visible when it happens live.
 */
const VERIFY_WINDOW_H = 2.2 / 3600;

function stageState(st: EscrowStatus, actualH: number | undefined, nowH: number): StageState {
  if (st === 'released' && actualH !== undefined && nowH - actualH < VERIFY_WINDOW_H) return 'verified';
  return st;
}

const STAGE_META: Record<StageState, { label: string; tone: Tone; icon: React.ReactNode }> = {
  locked: { label: 'Locked in Escrow', tone: 'slate', icon: <Lock size={11} /> },
  scheduled: { label: 'Releases on forecast', tone: 'cobalt', icon: <Lock size={11} /> },
  blocked: { label: 'Blocked', tone: 'crimson', icon: <ShieldX size={11} /> },
  verified: { label: 'Verified · releasing', tone: 'cobalt', icon: <ShieldCheck size={11} /> },
  released: { label: 'Released', tone: 'emerald', icon: <BadgeCheck size={11} /> },
};

function EscrowPipeline() {
  const id = useShipment((s) => s.selected);
  const nowH = useShipment((s) => s.nowH);
  const assignments = useShipment((s) => s.assignments);
  const schedule = useScheduleFor(id);
  const ms = milestoneStatuses(schedule, nowH, nowH);
  const lines = FLEET[id].escrow;
  const states = lines.map((l) => stageState(escrowStatus(ms[l.trigger]), schedule.byId[l.trigger]?.actualH, nowH));
  // Proof can only be supplied for the next stage in line; later ones wait their turn.
  const next = states.findIndex((s) => s !== 'released' && s !== 'verified');
  const total = lines.reduce((a, l) => a + moneyToUsd(l.amount), 0);

  return (
    <Card
      className="mt-4"
      eyebrow={`Smart escrow pipeline · ${id}`}
      title="Each payout waits for its proof, then pays itself"
      action={<Pill tone="cobalt">{formatUsd(total)} under contract</Pill>}
    >
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {lines.map((l, i) => {
          const st = states[i];
          const meta = STAGE_META[st];
          const hex = TONE_HEX[meta.tone];
          const stage = TRIGGER_STAGE[l.trigger] ?? { title: l.triggerLabel, proof: 'Milestone proof', icon: <FileCheck2 size={15} /> };
          const plan = schedule.byId[l.trigger];
          const at = plan?.actualH ?? plan?.plannedH;
          return (
            <div key={l.id} className="relative">
              {i < lines.length - 1 && <Flow active={st === 'released' || st === 'verified'} />}
              <motion.div
                layout
                className="relative h-full rounded-2xl bg-white p-3.5"
                animate={{
                  boxShadow:
                    st === 'released'
                      ? '0 0 0 1.5px rgba(5,150,105,0.45), 0 14px 30px -18px rgba(5,150,105,0.55)'
                      : st === 'verified'
                        ? ['0 0 0 1.5px rgba(37,99,235,0.35), 0 0 0 0 rgba(37,99,235,0.0)', '0 0 0 1.5px rgba(37,99,235,0.6), 0 0 0 8px rgba(37,99,235,0.10)']
                        : st === 'blocked'
                          ? '0 0 0 1.5px rgba(220,38,38,0.4), 0 10px 24px -18px rgba(220,38,38,0.5)'
                          : '0 0 0 1px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
                }}
                transition={st === 'verified' ? { duration: 0.6, repeat: Infinity, repeatType: 'reverse' } : { duration: 0.4 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ color: hex, background: `color-mix(in oklab, ${hex} 10%, white)` }}>
                      {stage.icon}
                    </span>
                    <span className="num text-[10px] font-semibold text-subtle">STEP {i + 1}</span>
                  </span>
                  <RoleBadge role={l.id} />
                </div>
                <div className="mt-2 text-[13.5px] font-semibold text-ink">{stage.title}</div>
                <div className="text-[11px] text-muted">{stage.proof}</div>
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="num text-[18px] font-semibold tracking-tight text-ink">{l.amount}</span>
                  <span className="truncate text-[10.5px] text-muted">→ {payeeOf(assignments, id, l)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={st}
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold"
                      style={{ color: hex, background: `color-mix(in oklab, ${hex} 10%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hex} 24%, transparent)` }}
                    >
                      {meta.icon}
                      {meta.label}
                    </motion.span>
                  </AnimatePresence>
                  {at !== undefined && <span className="num text-[10px] text-subtle">{formatStamp(at).slice(4, 16)}</span>}
                </div>
                {st !== 'released' && st !== 'verified' && (
                  <div className="mt-3 border-t border-dashed border-slate-900/[0.08] pt-2.5">
                    {i === next ? <ProofButton id={id} line={l} /> : <span className="text-[10.5px] text-subtle">Waits for step {next + 1}</span>}
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-muted">
        {(['locked', 'verified', 'released'] as StageState[]).map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight size={11} className="text-subtle" />}
            <span className="h-2 w-2 rounded-full" style={{ background: TONE_HEX[STAGE_META[s].tone] }} />
            {STAGE_META[s].label.replace(' · releasing', '')}
          </span>
        ))}
        <span className="ml-auto text-subtle">Rupee payouts settle via UPI; dollar payouts via SWIFT gpi. FX ₹{INR_PER_USD}/US$ (demo).</span>
      </div>
    </Card>
  );
}

/** Why the next stage's proof cannot be supplied yet, if it cannot. */
function useProofGate(id: ShipmentId, trigger: string): { ok: boolean; busy?: string; reason?: string; fix?: { view: 'documents' | 'tower'; label: string } } {
  const gateIn = useShipment((s) => s.actuals.gateIn !== undefined);
  const leo = useShipment((s) => s.actuals.leo !== undefined);
  const loaded = useShipment((s) => s.actuals.loaded !== undefined);
  const driving = useShipment((s) => s.driving);
  const docs = useShipment((s) => s.docsVerified);
  const customs = useShipment((s) => s.customs);
  const hold = useShipment((s) => s.hold0494 === 'active');
  if (id === 'SHP-2611-0494') return trigger === 'leo' && hold ? { ok: true } : { ok: false };
  if (id !== FLAGSHIP) return { ok: false };
  if (trigger === 'gateIn') return driving ? { ok: false, busy: 'Truck driving to Gate 4…' } : { ok: true };
  if (trigger === 'leo') {
    if (!gateIn) return { ok: false, reason: 'Needs gate-in proof first' };
    if (!docs) return { ok: false, reason: 'Blocked by the weight mismatch', fix: { view: 'documents', label: 'Resolve in Documents' } };
    if (customs === 'active') return { ok: false, reason: 'Blocked by the customs hold', fix: { view: 'tower', label: 'Open the Co-Pilot' } };
    return { ok: true };
  }
  if (trigger === 'loaded') return leo ? { ok: true } : { ok: false, reason: 'Needs Customs LEO first' };
  if (trigger === 'lc') return loaded ? { ok: true } : { ok: false, reason: 'Needs shipped-on-board first' };
  return { ok: false };
}

/** Supplies the milestone's proof through the real workflow action, so every view moves with it. */
function ProofButton({ id, line }: { id: ShipmentId; line: EscrowLine }) {
  const prove = useShipment((s) => s.proveMilestone);
  const setView = useShipment((s) => s.setView);
  const gate = useProofGate(id, line.trigger);
  if (gate.busy)
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cobalt">
        <Loader2 size={12} className="animate-spin" /> {gate.busy}
      </span>
    );
  if (!gate.ok && !gate.reason) return <span className="text-[10.5px] text-subtle">Auto-releases {line.triggerLabel}</span>;
  if (!gate.ok)
    return (
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[10.5px] font-medium" style={{ color: gate.fix ? TONE_HEX.crimson : '#94A3B8' }}>
          {gate.reason}
        </span>
        {gate.fix && (
          <button onClick={() => setView(gate.fix!.view)} className="text-[10.5px] font-semibold text-cobalt hover:underline">
            {gate.fix.label} →
          </button>
        )}
      </div>
    );
  return (
    <button
      onClick={() => prove(line.trigger)}
      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-cobalt text-[11.5px] font-semibold text-white shadow-[0_6px_14px_-8px_rgb(37_99_235/0.9),inset_0_1px_0_rgb(255_255_255/0.25)] transition-all hover:brightness-110 active:scale-[0.98]"
    >
      <Zap size={12} /> Simulate milestone proof
    </button>
  );
}

/** The connector between two stages; funds "flow" along it once the first stage pays. */
function Flow({ active }: { active: boolean }) {
  return (
    <svg className="pointer-events-none absolute top-[34px] -right-3 z-10 max-lg:hidden" width="12" height="10" aria-hidden>
      <line x1="0" y1="5" x2="12" y2="5" stroke={active ? TONE_HEX.emerald : 'rgba(15,23,42,0.25)'} strokeWidth="2" strokeDasharray={active ? '0' : '2 2'}>
        {!active && <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.8s" repeatCount="indefinite" />}
      </line>
    </svg>
  );
}

/* --- Cost breakdown --------------------------------------------------------------------- */

const BUCKETS: { key: 'freight' | 'customs' | 'inland' | 'demurrage'; label: string; tone: Tone }[] = [
  { key: 'freight', label: 'Freight & insurance', tone: 'cobalt' },
  { key: 'customs', label: 'Customs & CHA', tone: 'emerald' },
  { key: 'inland', label: 'Inland & port', tone: 'violet' },
  { key: 'demurrage', label: 'Demurrage risk', tone: 'crimson' },
];

function CostBreakdown({ allCosts, exposure }: { allCosts: { id: string; c: Record<CostCategory, number> }[]; exposure: number }) {
  const [hover, setHover] = useState<(typeof BUCKETS)[number]['key'] | null>(null);
  const totals = {
    freight: allCosts.reduce((a, x) => a + x.c.freight + x.c.insurance, 0),
    customs: allCosts.reduce((a, x) => a + x.c.customs, 0),
    inland: allCosts.reduce((a, x) => a + x.c.inland + x.c.port, 0),
    demurrage: exposure,
  };
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const max = Math.max(...allCosts.map((x) => x.c.freight + x.c.insurance + x.c.customs + x.c.inland + x.c.port));

  return (
    <Card eyebrow="Cost breakdown" title="Where the logistics dollar goes">
      <div className="flex items-center gap-5 max-sm:flex-col">
        <div className="relative shrink-0">
          <svg width={160} height={160} viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }} className="overflow-visible" aria-hidden>
            <circle cx={80} cy={80} r={R} fill="none" stroke="rgba(15,23,42,0.05)" strokeWidth={18} />
            {BUCKETS.map((b) => {
              const frac = totals[b.key] / sum;
              const seg = Math.max(0, frac * C - 3);
              const off = -acc * C;
              acc += frac;
              return (
                <motion.circle
                  key={b.key}
                  cx={80}
                  cy={80}
                  r={R}
                  fill="none"
                  stroke={TONE_HEX[b.tone]}
                  strokeDashoffset={off}
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onPointerEnter={() => setHover(b.key)}
                  onPointerLeave={() => setHover(null)}
                  initial={{ strokeDasharray: `0 ${C}`, strokeWidth: 18 }}
                  animate={{ strokeDasharray: `${seg} ${C - seg}`, strokeWidth: hover === b.key ? 24 : 18, opacity: hover && hover !== b.key ? 0.3 : 1 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], strokeWidth: { duration: 0.2 }, opacity: { duration: 0.2 } }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center leading-tight">
            <div>
              <div className="num text-[18px] font-semibold text-ink">
                <CountUp value={hover ? totals[hover] : sum} format={(n) => formatUsd(n)} duration={0.4} />
              </div>
              <div className="max-w-[96px] text-[9.5px] font-semibold tracking-[0.1em] uppercase" style={{ color: hover ? TONE_HEX[BUCKETS.find((b) => b.key === hover)!.tone] : '#94A3B8' }}>
                {hover ? `${BUCKETS.find((b) => b.key === hover)!.label} · ${((totals[hover] / sum) * 100).toFixed(0)}%` : 'landed cost'}
              </div>
            </div>
          </div>
        </div>
        <ul className="w-full space-y-2">
          {BUCKETS.map((b) => (
            <li
              key={b.key}
              onPointerEnter={() => setHover(b.key)}
              onPointerLeave={() => setHover(null)}
              className="-mx-1.5 flex cursor-default items-center gap-2 rounded-lg px-1.5 py-0.5 text-[12px] transition-colors"
              style={{ background: hover === b.key ? `color-mix(in oklab, ${TONE_HEX[b.tone]} 8%, transparent)` : undefined, opacity: hover && hover !== b.key ? 0.5 : 1 }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: TONE_HEX[b.tone] }} />
              <span className="flex-1 text-muted">{b.label}</span>
              <span className="num font-semibold text-ink">{formatUsd(totals[b.key])}</span>
              <span className="num w-[42px] text-right text-[11px] text-subtle">{((totals[b.key] / sum) * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="eyebrow mt-5 mb-2">By shipment</div>
      <ul className="space-y-2">
        {allCosts.map((x) => {
          const parts = [x.c.freight + x.c.insurance, x.c.customs, x.c.inland + x.c.port];
          const total = parts.reduce((a, b) => a + b, 0);
          return (
            <li key={x.id} className="flex items-center gap-2">
              <span className="num w-[44px] shrink-0 text-[11px] font-semibold text-muted">{x.id.slice(-4)}</span>
              <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-slate-900/[0.05]">
                <div className="flex h-full" style={{ width: `${(total / max) * 100}%` }}>
                  {parts.map((p, i) => (
                    <motion.div
                      key={i}
                      className="h-full"
                      style={{ background: TONE_HEX[BUCKETS[i].tone] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(p / total) * 100}%` }}
                      transition={{ duration: 0.7, delay: 0.05 * i }}
                    />
                  ))}
                </div>
              </div>
              <span className="num w-[58px] text-right text-[11px] font-semibold text-ink">{formatUsd(total)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* --- Ledger ------------------------------------------------------------------------------- */

const CATEGORY: Record<Role, string> = { transporter: 'Inland haulage', broker: 'Customs & CHA', forwarder: 'Freight', exporter: 'LC / CAD proceeds' };

function Ledger() {
  const assignments = useShipment((s) => s.assignments);
  const nowH = useShipment((s) => s.nowH);
  const s0482 = useScheduleFor('SHP-2611-0482');
  const s0519 = useScheduleFor('SHP-2611-0519');
  const s0494 = useScheduleFor('SHP-2611-0494');
  const [status, setStatus] = useState<'all' | LedgerStatus>('all');
  const [ship, setShip] = useState('all');
  const [preview, setPreview] = useState<LedgerRow | null>(null);

  const rows = useMemo<LedgerRow[]>(() => {
    const scheds = { 'SHP-2611-0482': s0482, 'SHP-2611-0519': s0519, 'SHP-2611-0494': s0494 } as const;
    const live = LIVE_IDS.flatMap((id) => {
      const ms = milestoneStatuses(scheds[id], nowH, nowH);
      return FLEET[id].escrow.map((e, i): LedgerRow => {
        const st = escrowStatus(ms[e.trigger]);
        return {
          id: `ESC-${id.slice(4)}-${String(i + 1).padStart(2, '0')}`,
          shipment: id,
          payee: payeeOf(assignments, id, e),
          role: e.id,
          category: CATEGORY[e.id],
          usd: moneyToUsd(e.amount),
          original: e.amount,
          dueH: scheds[id].byId[e.trigger]?.plannedH ?? nowH,
          status: st === 'released' ? 'Settled' : st === 'blocked' ? 'On hold' : 'In escrow',
          // Proceeds are billed to the buyer; every partner payout to the exporter.
          billTo: e.id === 'exporter' ? XRAY_SETS[id].docs[0].values.consignee : FLEET[id].parties.exporter.org,
          trigger: e.triggerLabel.replace(/^on /, ''),
        };
      });
    });
    const fixed = STATIC_INVOICES.map(
      (x): LedgerRow => ({
        id: x.id,
        shipment: x.shipment,
        payee: x.payee,
        role: null,
        category: x.category === 'demurrage' ? 'Demurrage' : { freight: 'Freight', customs: 'Customs & CHA', inland: 'Inland haulage', port: 'Port & THC', insurance: 'Insurance' }[x.category],
        usd: x.amountUsd,
        original: formatUsd(x.amountUsd),
        dueH: x.dueH,
        status: x.status === 'settled' ? 'Settled' : x.status === 'disputed' ? 'Disputed' : 'Pending',
        billTo: WATCH_BY_ID[x.shipment]?.exporter ?? ROLES.exporter.org,
      }),
    );
    return [...live, ...fixed].sort((a, b) => a.dueH - b.dueH);
  }, [s0482, s0519, s0494, nowH, assignments]);

  const shown = rows.filter((r) => (status === 'all' || r.status === status) && (ship === 'all' || r.shipment === ship));
  const total = shown.reduce((a, r) => a + r.usd, 0);
  const ships = [...new Set(rows.map((r) => r.shipment))];

  return (
    <Card
      pad={false}
      className="overflow-hidden"
      eyebrow="Invoice settlement ledger"
      title={`${shown.length} invoices · ${formatUsd(total)} gross volume`}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex h-8 items-center rounded-lg border border-[rgba(15,23,42,0.08)] bg-white px-2">
            <span className="sr-only">Shipment</span>
            <select value={ship} onChange={(e) => setShip(e.target.value)} className="num bg-transparent text-[11.5px] font-semibold text-ink outline-none">
              <option value="all">All shipments</option>
              {ships.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <div className="px-5 pb-3">
        <Segmented
          id="ledger"
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={(['all', 'In escrow', 'Settled', 'Pending', 'On hold', 'Disputed'] as const).map((v) => ({
            value: v,
            label: v === 'all' ? `All ${rows.length}` : `${v} ${rows.filter((r) => r.status === v).length}`,
          }))}
        />
      </div>
      <div className="scroll-quiet max-h-[420px] overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
            <tr className="border-y border-[rgba(15,23,42,0.06)] text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">
              <th className="py-2.5 pr-3 pl-5 font-semibold">Invoice</th>
              <th className="px-3 font-semibold">Payee</th>
              <th className="px-3 font-semibold">Category</th>
              <th className="px-3 font-semibold">Due</th>
              <th className="px-3 text-right font-semibold">Amount</th>
              <th className="px-3 font-semibold">Status</th>
              <th className="py-2.5 pr-5 pl-1" aria-label="Preview" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {shown.map((r) => (
                <motion.tr
                  key={r.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPreview(r)}
                  className="cursor-pointer border-b border-[rgba(15,23,42,0.05)] text-[11.5px] last:border-0 hover:bg-cobalt/[0.03]"
                >
                  <td className="py-2.5 pr-3 pl-5">
                    <div className="num font-semibold text-ink">{r.id}</div>
                    <div className="num text-[10px] text-subtle">{r.shipment}</div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="max-w-[170px] truncate font-medium text-ink">{r.payee}</span>
                      {r.role && <RoleBadge role={r.role} />}
                    </div>
                  </td>
                  <td className="px-3 text-muted">{r.category}</td>
                  <td className="num px-3 whitespace-nowrap text-muted">{formatStamp(r.dueH).slice(4, 10)}</td>
                  <td className="px-3 text-right">
                    <div className="num font-semibold text-ink">{formatUsd(r.usd)}</div>
                    {r.original.startsWith('₹') && <div className="num text-[10px] text-subtle">{r.original}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <Pill tone={STATUS_TONE[r.status]} pulse={r.status === 'On hold'}>
                      {r.status}
                    </Pill>
                  </td>
                  <td className="py-2.5 pr-5 pl-1 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreview(r);
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold whitespace-nowrap text-cobalt transition-colors hover:bg-cobalt/[0.08]"
                      aria-label={`Preview invoice ${r.id}`}
                    >
                      <Eye size={12} /> Preview Invoice
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 border-t border-[rgba(15,23,42,0.06)] px-5 py-2.5 text-[10.5px] text-subtle">
        <Landmark size={12} /> Escrow rows settle automatically on milestone proof. {ROLES.exporter.label} proceeds are receivables, not spend.
      </div>
      <InvoicePreview row={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}
