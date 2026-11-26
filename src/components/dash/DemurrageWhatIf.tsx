import { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Hourglass } from 'lucide-react';

import { CountUp } from '@/components/hud/ui';
import { FLEET } from '@/data/fleet';
import { FLAGSHIP, T, type ShipmentId } from '@/data/shipment';
import { SURAT } from '@/lib/fleet';
import { formatUsd } from '@/lib/format';
import { TONE_HEX } from '@/lib/palette';
import { milestoneStatuses, type Schedule } from '@/lib/schedule';
import { useScheduleFor, useShipment } from '@/store/shipment';
import { Card, Pill } from './kit';

/** Tariff for what a delay costs one shipment. Rates are illustrative. */
interface WhatIfParams {
  /** Delay the box can absorb before it misses its vessel; null once it has sailed or flown. */
  rollAfterH: number | null;
  /** Extra wait when it does miss: the next sailing. */
  rollShiftH: number;
  rollFee: number;
  storageFreeH: number;
  storagePerDay: number;
  detentionFreeH: number;
  detentionPerDay: number;
  slaFreeH: number;
  slaPerDay: number;
  carryPerH: number;
  where: string;
}

function paramsFor(id: ShipmentId, schedule: Schedule, nowH: number, hold: boolean): WhatIfParams {
  const value = FLEET[id].valueUsd;
  const carryPerH = (value * 0.09) / 8760;
  const ms = milestoneStatuses(schedule, nowH, nowH);
  if (id === FLAGSHIP) {
    const cutoff = schedule.cutoffH ?? nowH + T.cutoff;
    return {
      rollAfterH: ms.loaded === 'done' ? null : Math.max(0, cutoff - Math.max(nowH, schedule.gateInH)),
      rollShiftH: T.nextSailingShiftH,
      rollFee: 1450,
      storageFreeH: 24,
      storagePerDay: 180,
      detentionFreeH: 48,
      detentionPerDay: 95,
      slaFreeH: 48,
      slaPerDay: value * 0.005,
      carryPerH,
      where: 'JNPT terminal',
    };
  }
  if (id === 'SHP-2611-0494') {
    return {
      rollAfterH: ms.loaded === 'done' ? null : Math.max(0, SURAT.cutoffH - nowH),
      rollShiftH: SURAT.nextSailingShiftH,
      rollFee: 980,
      storageFreeH: hold ? 0 : 24,
      storagePerDay: 260,
      detentionFreeH: 24,
      detentionPerDay: 85,
      slaFreeH: 72,
      slaPerDay: value * 0.004,
      carryPerH,
      where: 'Mundra MICT',
    };
  }
  return {
    rollAfterH: null,
    rollShiftH: 0,
    rollFee: 0,
    storageFreeH: 12,
    storagePerDay: 310,
    detentionFreeH: 24,
    detentionPerDay: 40,
    slaFreeH: 12,
    slaPerDay: value * 0.01,
    carryPerH,
    where: 'FRA cool room',
  };
}

interface Breakdown {
  storage: number;
  detention: number;
  roll: number;
  sla: number;
  carry: number;
  total: number;
  effectiveH: number;
  rolled: boolean;
}

function costAt(p: WhatIfParams, h: number): Breakdown {
  const rolled = p.rollAfterH !== null && h > p.rollAfterH;
  const eff = h + (rolled ? p.rollShiftH : 0);
  const storage = (Math.max(0, eff - p.storageFreeH) / 24) * p.storagePerDay;
  const detention = (Math.max(0, eff - p.detentionFreeH) / 24) * p.detentionPerDay;
  const roll = rolled ? p.rollFee : 0;
  const sla = (Math.max(0, eff - p.slaFreeH) / 24) * p.slaPerDay;
  const carry = eff * p.carryPerH;
  return { storage, detention, roll, sla, carry, total: storage + detention + roll + sla + carry, effectiveH: eff, rolled };
}

const W = 560;
const H = 200;
const PAD = { l: 52, r: 14, t: 14, b: 26 };
const MAX_H = 72;

/**
 * Drag a hypothetical delay and see what it costs: storage, container detention, a
 * missed sailing, the buyer's late-delivery penalty and inventory carrying cost. The
 * curve steps up where the box would miss its vessel's cutoff.
 */
export function DemurrageWhatIf() {
  const id = useShipment((s) => s.selected);
  const nowH = useShipment((s) => s.nowH);
  const hold = useShipment((s) => s.hold0494 === 'active');
  const schedule = useScheduleFor(id);
  const p = paramsFor(id, schedule, nowH, hold);
  const [delay, setDelay] = useState(24);
  const [hoverH, setHoverH] = useState<number | null>(null);

  const samples = Array.from({ length: MAX_H * 2 + 1 }, (_, i) => i / 2);
  const totals = samples.map((h) => costAt(p, h).total);
  const yMax = Math.max(500, ...totals) * 1.08;
  const x = (h: number) => PAD.l + (h / MAX_H) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const line = samples.map((h, i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)} ${y(totals[i]).toFixed(1)}`).join('');
  const area = `${line}L${x(MAX_H)} ${H - PAD.b}L${x(0)} ${H - PAD.b}Z`;
  const b = costAt(p, delay);
  const hb = hoverH !== null ? costAt(p, hoverH) : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  const rows = [
    { label: `Port storage · ${p.where}`, v: b.storage, tone: 'amber' as const },
    { label: 'Container / ULD detention', v: b.detention, tone: 'amber' as const },
    { label: 'Missed-sailing roll fee', v: b.roll, tone: 'crimson' as const },
    { label: 'Buyer late-delivery penalty', v: b.sla, tone: 'crimson' as const },
    { label: 'Inventory carrying cost', v: b.carry, tone: 'slate' as const },
  ];

  return (
    <Card
      className="mt-4"
      eyebrow={`Demurrage what-if · ${id}`}
      title="What would a delay cost?"
      action={
        p.rollAfterH !== null ? (
          <Pill tone="amber">Cutoff slack {Math.round(p.rollAfterH)}h · then rolls {p.rollShiftH}h</Pill>
        ) : (
          <Pill tone="slate">Already departed · no roll risk</Pill>
        )
      }
    >
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 max-lg:grid-cols-1">
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none"
            role="img"
            aria-label={`Delay cost curve. ${delay} hours of delay costs ${formatUsd(b.total)}.`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              setHoverH(Math.max(0, Math.min(MAX_H, ((px - PAD.l) / (W - PAD.l - PAD.r)) * MAX_H)));
            }}
            onPointerLeave={() => setHoverH(null)}
            onClick={() => hoverH !== null && setDelay(Math.round(hoverH))}
          >
            <defs>
              <linearGradient id="whatif-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TONE_HEX.amber} stopOpacity={0.22} />
                <stop offset="100%" stopColor={TONE_HEX.amber} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(15,23,42,0.06)" />
                <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" fontSize={9.5} fill="#94A3B8" className="num">
                  {t >= 1000 ? `$${(t / 1000).toFixed(t >= 10000 ? 0 : 1)}k` : `$${Math.round(t)}`}
                </text>
              </g>
            ))}
            {[0, 12, 24, 36, 48, 60, 72].map((h) => (
              <text key={h} x={x(h)} y={H - 8} textAnchor="middle" fontSize={9.5} fill="#94A3B8" className="num">
                +{h}h
              </text>
            ))}
            {p.rollAfterH !== null && p.rollAfterH < MAX_H && (
              <g>
                <rect x={x(p.rollAfterH)} y={PAD.t} width={x(MAX_H) - x(p.rollAfterH)} height={H - PAD.t - PAD.b} fill={TONE_HEX.crimson} opacity={0.035} />
                <line x1={x(p.rollAfterH)} x2={x(p.rollAfterH)} y1={PAD.t} y2={H - PAD.b} stroke={TONE_HEX.crimson} strokeDasharray="3 3" strokeOpacity={0.6} />
                <text x={x(p.rollAfterH) + 5} y={PAD.t + 10} fontSize={9.5} fontWeight={600} fill={TONE_HEX.crimson}>
                  Cutoff missed · rolls +{p.rollShiftH}h
                </text>
              </g>
            )}
            <path d={area} fill="url(#whatif-fill)" />
            <motion.path d={line} fill="none" stroke={TONE_HEX.amber} strokeWidth={2} strokeLinejoin="round" initial={false} animate={{ d: line }} transition={{ duration: 0.4 }} />
            <line x1={x(delay)} x2={x(delay)} y1={PAD.t} y2={H - PAD.b} stroke={TONE_HEX.cobalt} strokeWidth={1.5} />
            <circle cx={x(delay)} cy={y(b.total)} r={5} fill="white" stroke={TONE_HEX.cobalt} strokeWidth={2.5} />
            {hb && hoverH !== null && (
              <g pointerEvents="none">
                <line x1={x(hoverH)} x2={x(hoverH)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(15,23,42,0.25)" strokeDasharray="2 3" />
                <circle cx={x(hoverH)} cy={y(hb.total)} r={3.5} fill={TONE_HEX.amber} />
                <g transform={`translate(${Math.min(x(hoverH) + 8, W - 128)}, ${Math.max(PAD.t + 4, y(hb.total) - 34)})`}>
                  <rect width={120} height={30} rx={8} fill="white" stroke="rgba(15,23,42,0.1)" />
                  <text x={9} y={13} fontSize={9.5} fill="#475569" className="num">
                    +{hoverH.toFixed(0)}h delay
                  </text>
                  <text x={9} y={25} fontSize={11} fontWeight={700} fill="#0F172A" className="num">
                    {formatUsd(hb.total)}
                  </text>
                </g>
              </g>
            )}
          </svg>
          <div className="mt-2 flex items-center gap-3">
            <Hourglass size={14} className="shrink-0 text-cobalt" />
            <input
              type="range"
              min={0}
              max={MAX_H}
              step={1}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              aria-label="Hypothetical delay, hours"
              className="w-full"
              style={{ accentColor: TONE_HEX.cobalt }}
            />
            <span className="num w-[52px] shrink-0 text-right text-[13px] font-semibold text-ink">+{delay}h</span>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] font-medium text-muted">Cost of a +{delay}h delay</div>
              <div className="num text-[28px] leading-none font-semibold tracking-[-0.03em] text-ink">
                <CountUp value={b.total} format={(n) => formatUsd(n)} duration={0.45} />
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: b.rolled ? TONE_HEX.crimson : TONE_HEX.amber }}>
              <Clock size={12} /> ETA +{Math.round(b.effectiveH)}h{b.rolled ? ' (rolled)' : ''}
            </span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {rows.map((r) => (
              <li key={r.label}>
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{r.label}</span>
                  <span className="num font-semibold text-ink">
                    <CountUp value={r.v} format={(n) => formatUsd(n)} duration={0.45} />
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/[0.05]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: TONE_HEX[r.tone] }}
                    animate={{ width: `${b.total ? (r.v / b.total) * 100 : 0}%` }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10.5px] leading-snug text-subtle">Illustrative tariff. Click the chart or drag the slider; the cutoff step is where escalating early pays for itself.</p>
        </div>
      </div>
    </Card>
  );
}
