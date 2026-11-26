import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Award, BadgeCheck, Check, Clock, Gauge, Leaf, Lock, ShieldCheck, Sparkles, Star, Timer, TrendingDown, Zap } from 'lucide-react';

import { Bar, Card, DashPage, Pill, RadialGauge, ShipmentPicker } from '@/components/dash/kit';
import { COSTS } from '@/data/finance';
import { FLEET } from '@/data/fleet';
import {
  INCUMBENT,
  PARTNER_IDS,
  PARTNERS,
  PRIORITY_PRESETS,
  QUOTES,
  quoteBadges,
  scoreQuotes,
  type Badge,
  type CarbonGrade,
  type PartnerId,
  type Priority,
  type Quote,
  type Weights,
} from '@/data/partners';
import { formatUsd } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { escrowStatus, milestoneStatuses } from '@/lib/schedule';
import { CountUp } from '@/components/hud/ui';
import { useScheduleFor, useShipment } from '@/store/shipment';

const BADGE_STYLE: Record<Badge, { tone: Tone; icon: React.ReactNode }> = {
  'Best Value': { tone: 'cobalt', icon: <TrendingDown size={11} /> },
  'Fastest Customs': { tone: 'violet', icon: <Zap size={11} /> },
  'Lowest Carbon': { tone: 'emerald', icon: <Leaf size={11} /> },
  'Most Reliable': { tone: 'amber', icon: <Award size={11} /> },
};

const GRADE_VALUE: Record<CarbonGrade, number> = { A: 1, B: 0.75, C: 0.5, D: 0.25 };
const GRADE_TONE: Record<CarbonGrade, Tone> = { A: 'emerald', B: 'cobalt', C: 'amber', D: 'crimson' };

/** Reassignment is closed once the forwarder's payout has been released: the freight already moved. */
function useAssignLock(): string | null {
  const id = useShipment((s) => s.selected);
  const schedule = useScheduleFor(id);
  const nowH = useShipment((s) => s.nowH);
  const line = FLEET[id].escrow.find((e) => e.id === 'forwarder')!;
  const st = escrowStatus(milestoneStatuses(schedule, nowH, nowH)[line.trigger]);
  return st === 'released' ? 'Freight already executed. Reassignment applies to the next booking.' : null;
}

export default function PartnersPage() {
  const id = useShipment((s) => s.selected);
  const assigned = useShipment((s) => s.assignments[s.selected]);
  const quotes = QUOTES[id];
  const badges = quoteBadges(quotes);
  const def = FLEET[id];
  const lock = useAssignLock();
  const [weights, setWeights] = useState<Weights>(PRIORITY_PRESETS[0].weights);
  const scored = scoreQuotes(quotes, weights);

  return (
    <DashPage
      view="partners"
      subtitle="Live bids from vetted forwarders for the active shipment, scored on reliability, customs speed, demurrage and carbon. Assigning one rewires escrow, documents and comms."
      actions={<ShipmentPicker />}
    >
      <CurrentPartner />

      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <div className="eyebrow">Quote comparison</div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            {quotes.length} bids · {def.origin} → {def.destination} · {def.unit.equipment}
          </h2>
        </div>
        <span className="text-[11px] text-subtle">All-in USD · {def.incoterm}</span>
      </div>

      <Priorities weights={weights} onChange={setWeights} />

      <div className="mt-3 grid grid-cols-4 gap-4 max-[1320px]:grid-cols-2 max-sm:grid-cols-1">
        {scored.map((s, rank) => (
          <QuoteCard
            key={s.quote.partner}
            q={s.quote}
            score={s.score}
            rank={rank}
            badges={badges[s.quote.partner] ?? []}
            assigned={assigned === s.quote.partner}
            current={COSTS[id].freight}
            lock={lock}
          />
        ))}
      </div>

      <Scorecard quotes={quotes} assigned={assigned} />

      <p className="mt-3 text-[11px] text-subtle">
        Partner names are used for illustration only. Quotes, scores, contacts and volumes are demo data, not real carrier performance.
      </p>
    </DashPage>
  );
}

function CurrentPartner() {
  const id = useShipment((s) => s.selected);
  const assigned = useShipment((s) => s.assignments[s.selected]);
  const def = FLEET[id];
  const p = assigned ? PARTNERS[assigned] : null;
  const quote = p ? QUOTES[id].find((q) => q.partner === p.id) : null;
  return (
    <Card className="relative overflow-hidden">
      <AnimatePresence>
        {p && (
          <motion.div
            key={p.id}
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald/[0.10] via-emerald/[0.03] to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.55] }}
            transition={{ duration: 1.2 }}
          />
        )}
      </AnimatePresence>
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <Monogram text={p?.monogram ?? 'AG'} accent={p?.accent ?? '#4F46E5'} size={44} />
          <div className="min-w-0 leading-tight">
            <div className="eyebrow">Assigned freight forwarder · {id}</div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={p?.id ?? 'incumbent'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-0.5 text-[17px] font-semibold tracking-tight text-ink">
                {p?.name ?? INCUMBENT.org}
              </motion.div>
            </AnimatePresence>
            <div className="text-[11.5px] text-muted">
              {p ? `${p.contact.person} · ${p.contact.title}` : `${def.parties.forwarder.person} · ${def.parties.forwarder.title}`}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {p ? (
            <Pill tone="emerald">
              <span className="flex items-center gap-1">
                <BadgeCheck size={12} /> Assigned via marketplace · {formatUsd(quote!.priceUsd)}
              </span>
            </Pill>
          ) : (
            <Pill tone="slate">Incumbent · contracted rate {formatUsd(COSTS[id].freight)}</Pill>
          )}
          <Pill tone="cobalt">Escrow payee: {p?.short ?? INCUMBENT.short}</Pill>
        </div>
      </div>
    </Card>
  );
}

function Monogram({ text, accent, size = 36 }: { text: string; accent: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-bold tracking-tight text-white"
      style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 70%, #0F172A))`, boxShadow: `0 8px 18px -8px ${accent}` }}
    >
      {text}
    </span>
  );
}

const PRIORITY_META: Record<Priority, { label: string; hint: string; tone: Tone }> = {
  cost: { label: 'Cost', hint: 'All-in price', tone: 'cobalt' },
  speed: { label: 'Transit speed', hint: 'Transit days + customs hours', tone: 'violet' },
  carbon: { label: 'Carbon', hint: 'g CO₂e / t-km', tone: 'emerald' },
  reliability: { label: 'Reliability', hint: 'OTP + demurrage rate', tone: 'amber' },
};

/** Weight the four criteria; the bids below re-score and re-rank as you drag. */
function Priorities({ weights, onChange }: { weights: Weights; onChange: (w: Weights) => void }) {
  const preset = PRIORITY_PRESETS.find((p) => (Object.keys(p.weights) as Priority[]).every((k) => p.weights[k] === weights[k]));
  return (
    <Card className="mt-3" pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <div className="eyebrow">Your priorities</div>
          <div className="text-[13px] font-semibold text-ink">Re-rank the bids for what matters on this shipment</div>
        </div>
        <div role="radiogroup" aria-label="Priority preset" className="flex flex-wrap gap-1.5">
          {PRIORITY_PRESETS.map((p) => {
            const active = preset?.id === p.id;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={active}
                onClick={() => onChange(p.weights)}
                className={`h-8 rounded-full px-3 text-[11.5px] font-semibold transition-colors ${active ? 'bg-cobalt text-white shadow-[0_6px_14px_-8px_rgb(37_99_235/0.9)]' : 'bg-slate-900/[0.05] text-muted hover:text-ink'}`}
              >
                {p.label}
              </button>
            );
          })}
          {!preset && <span className="grid h-8 place-items-center rounded-full bg-violet/10 px-3 text-[11.5px] font-semibold text-violet">Custom</span>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-5 px-5 pt-3 pb-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {(Object.keys(PRIORITY_META) as Priority[]).map((k) => (
          <label key={k} className="block">
            <span className="flex items-baseline justify-between text-[11.5px]">
              <span className="font-semibold text-ink">{PRIORITY_META[k].label}</span>
              <span className="num font-semibold" style={{ color: TONE_HEX[PRIORITY_META[k].tone] }}>
                {weights[k]}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[k]}
              onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })}
              aria-label={`${PRIORITY_META[k].label} weight`}
              className="mt-1.5 w-full"
              style={{ accentColor: TONE_HEX[PRIORITY_META[k].tone] }}
            />
            <span className="text-[10px] text-subtle">{PRIORITY_META[k].hint}</span>
          </label>
        ))}
      </div>
    </Card>
  );
}

function QuoteCard({
  q,
  score,
  rank,
  badges,
  assigned,
  current,
  lock,
}: {
  q: Quote;
  score: number;
  rank: number;
  badges: Badge[];
  assigned: boolean;
  current: number;
  lock: string | null;
}) {
  const p = PARTNERS[q.partner];
  const assign = useShipment((s) => s.assignPartner);
  const delta = q.priceUsd - current;
  return (
    <motion.article
      layout
      className="relative flex flex-col rounded-[20px] border bg-white/80 p-4 backdrop-blur-xl"
      animate={{
        borderColor: assigned ? 'rgba(5,150,105,0.55)' : 'rgba(15,23,42,0.08)',
        boxShadow: assigned
          ? 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 4px rgba(5,150,105,0.10), 0 18px 40px -18px rgba(5,150,105,0.45)'
          : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 32px rgba(15,23,42,0.06)',
      }}
      transition={{ duration: 0.45 }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`num inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold ${rank === 0 ? 'bg-cobalt text-white' : 'bg-slate-900/[0.05] text-muted'}`}>
          #{rank + 1}
        </span>
        <span className="flex items-baseline gap-1 text-[11px] text-muted">
          Match
          <span className="num text-[15px] font-semibold text-ink">
            <CountUp value={score} format={(n) => Math.round(n).toString()} duration={0.5} />
          </span>
        </span>
      </div>
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-900/[0.05]">
        <motion.div className="h-full rounded-full bg-cobalt" animate={{ width: `${Math.max(3, score)}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <div className="flex min-h-[22px] flex-wrap gap-1">
        {badges.map((b) => (
          <span
            key={b}
            className="inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold"
            style={{ color: TONE_HEX[BADGE_STYLE[b].tone], background: `color-mix(in oklab, ${TONE_HEX[BADGE_STYLE[b].tone]} 10%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${TONE_HEX[BADGE_STYLE[b].tone]} 22%, transparent)` }}
          >
            {BADGE_STYLE[b].icon}
            {b}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <Monogram text={p.monogram} accent={p.accent} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[14px] font-semibold text-ink">{p.name}</div>
          <div className="truncate text-[11px] text-muted">{p.kind}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
        <Star size={11} className="fill-amber text-amber" />
        <span className="num font-semibold text-ink">{p.rating.toFixed(1)}</span>
        <span>· {p.volume90d} shipments / 90d</span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="num text-[28px] leading-none font-semibold tracking-[-0.03em] text-ink">
            <CountUp value={q.priceUsd} format={(n) => formatUsd(n)} />
          </div>
          <div className="num mt-1 text-[11px] font-semibold" style={{ color: TONE_HEX[delta <= 0 ? 'emerald' : 'amber'] }}>
            {delta <= 0 ? '−' : '+'}
            {formatUsd(Math.abs(delta))} vs current rate
          </div>
        </div>
        <div className="text-right text-[11px] leading-tight text-muted">
          <div className="flex items-center justify-end gap-1 font-semibold text-ink">
            <Timer size={12} /> <span className="num">{q.transitDays}d</span> transit
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <Clock size={11} /> valid <span className="num">{q.validH}h</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center rounded-2xl bg-slate-900/[0.025] pt-2.5 pb-1.5">
          <RadialGauge value={(p.otp - 0.8) / 0.2} display={`${(p.otp * 100).toFixed(0)}%`} caption="OTP" tone={p.otp >= 0.95 ? 'emerald' : 'cobalt'} size={78} stroke={7} />
          <span className="-mt-1 text-[10px] font-medium text-muted">90-day on-time</span>
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-slate-900/[0.025] pt-2.5 pb-1.5">
          <RadialGauge value={GRADE_VALUE[p.carbon]} display={p.carbon} caption="Carbon" tone={GRADE_TONE[p.carbon]} size={78} stroke={7} />
          <span className="num -mt-1 text-[10px] font-medium text-muted">{p.gPerTkm} g/t-km</span>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-[11px]">
        <Metric label="Customs clearance" value={`${p.customsHrs.toFixed(1)} h`} fill={1 - p.customsHrs / 10} tone="violet" icon={<Gauge size={11} />} />
        <Metric label="Demurrage rate" value={`${(p.demurrageRate * 100).toFixed(1)}%`} fill={1 - p.demurrageRate / 0.06} tone="amber" icon={<ShieldCheck size={11} />} />
      </dl>

      <ul className="mt-3 flex-1 space-y-1">
        {q.includes.map((x) => (
          <li key={x} className="flex items-center gap-1.5 text-[11px] text-muted">
            <Check size={11} className="shrink-0 text-emerald" strokeWidth={3} /> {x}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <AnimatePresence mode="wait" initial={false}>
          {assigned ? (
            <motion.div
              key="done"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(5_150_105/0.8)]"
            >
              <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.08, type: 'spring', stiffness: 500, damping: 18 }}>
                <BadgeCheck size={16} />
              </motion.span>
              Partner assigned
            </motion.div>
          ) : (
            <motion.button
              key="assign"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => assign(q.partner)}
              disabled={!!lock}
              title={lock ?? `Assign ${p.name} as freight forwarder`}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-cobalt text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(37_99_235/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] transition-all hover:brightness-110 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
            >
              {lock ? <Lock size={14} /> : <Sparkles size={14} />}
              {lock ? 'Locked' : 'Assign Partner'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

function Metric({ label, value, fill, tone, icon }: { label: string; value: string; fill: number; tone: Tone; icon: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <dt className="flex items-center gap-1 text-muted">
          {icon}
          {label}
        </dt>
        <dd className="num font-semibold text-ink">{value}</dd>
      </div>
      <Bar value={fill} tone={tone} />
    </div>
  );
}

/* --- Scorecard: every metric, every partner, on one axis -------------------------------- */

interface MetricDef {
  key: string;
  label: string;
  hint: string;
  tone: Tone;
  value: (id: PartnerId) => number;
  format: (v: number) => string;
  /** Lower is better. */
  lower?: boolean;
  max: number;
}

const METRICS: MetricDef[] = [
  { key: 'otp', label: 'On-Time Performance', hint: '90-day OTP', tone: 'emerald', value: (id) => PARTNERS[id].otp * 100, format: (v) => `${v.toFixed(0)}%`, max: 100 },
  { key: 'customs', label: 'Avg. Customs Clearance', hint: 'Hours, gate-in to LEO', tone: 'violet', value: (id) => PARTNERS[id].customsHrs, format: (v) => `${v.toFixed(1)} h`, lower: true, max: 9 },
  { key: 'dem', label: 'Demurrage Rate', hint: 'Share of boxes charged', tone: 'amber', value: (id) => PARTNERS[id].demurrageRate * 100, format: (v) => `${v.toFixed(1)}%`, lower: true, max: 5 },
  { key: 'co2', label: 'Carbon Grade', hint: 'g CO₂e per tonne-km', tone: 'cobalt', value: (id) => PARTNERS[id].gPerTkm, format: (v) => `${v.toFixed(1)} g`, lower: true, max: 40 },
];

function Scorecard({ quotes, assigned }: { quotes: Quote[]; assigned?: PartnerId }) {
  const ids = quotes.map((q) => q.partner).filter((id) => PARTNER_IDS.includes(id));
  return (
    <Card className="mt-4" eyebrow="Partner scorecard" title="Head-to-head on the four metrics that move landed cost">
      <div className="grid grid-cols-4 gap-6 max-[1320px]:grid-cols-2 max-sm:grid-cols-1">
        {METRICS.map((m) => {
          const vals = ids.map((id) => m.value(id));
          const best = m.lower ? Math.min(...vals) : Math.max(...vals);
          return (
            <div key={m.key}>
              <div className="text-[12.5px] font-semibold text-ink">{m.label}</div>
              <div className="text-[10.5px] text-subtle">{m.hint}</div>
              <div className="mt-3 space-y-2.5">
                {ids.map((id, i) => {
                  const v = vals[i];
                  const isBest = v === best;
                  return (
                    <div key={id}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className={`flex items-center gap-1 truncate ${assigned === id ? 'font-semibold text-emerald' : 'text-muted'}`}>
                          {assigned === id && <BadgeCheck size={11} />}
                          {PARTNERS[id].short}
                          {m.key === 'co2' && <span className="num ml-1 rounded bg-slate-900/[0.05] px-1 text-[9.5px] font-bold text-ink">{PARTNERS[id].carbon}</span>}
                        </span>
                        <span className={`num font-semibold ${isBest ? '' : 'text-ink'}`} style={isBest ? { color: TONE_HEX[m.tone] } : undefined}>
                          {m.format(v)}
                        </span>
                      </div>
                      <Bar value={m.lower ? 1 - v / m.max + 0.08 : v / m.max} tone={m.tone} highlight={isBest} height={7} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
