import { Plane, Ship, TrainFront, Truck } from 'lucide-react';

import type { Mode } from '@/data/shipment';
import { MODE_HEX, PALETTE } from '@/lib/palette';
import type { PortfolioLeg } from './usePortfolio';

const ICON = { road: Truck, rail: TrainFront, sea: Ship, air: Plane } as const;
const LABEL: Record<Mode, string> = { road: 'Road', rail: 'Rail', sea: 'Sea', air: 'Air' };

/**
 * Multi-modal progress: one segment per leg, coloured by mode and filled to where the
 * box is now. Segment length follows the square root of distance, so a 150 km truck
 * leg stays visible next to an 11,000 km ocean leg.
 */
export function ModeTrack({ legs, labels = false, width = 220 }: { legs: PortfolioLeg[]; labels?: boolean; width?: number }) {
  const W = width;
  const H = labels ? 46 : 30;
  const y = labels ? 24 : 18;
  const pad = 7;
  const weights = legs.map((l) => Math.sqrt(Math.max(l.km, 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  const xs: number[] = [pad];
  weights.forEach((w) => xs.push(xs[xs.length - 1] + ((W - 2 * pad) * w) / total));

  const current = legs.findIndex((l) => l.progress < 1);
  const done = current === -1;
  const cur = done ? legs.length - 1 : current;
  const markerX = xs[cur] + (xs[cur + 1] - xs[cur]) * (done ? 1 : legs[cur].progress);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: labels ? undefined : W }}
      className="block overflow-visible"
      role="img"
      aria-label={`${legs.map((l) => LABEL[l.mode]).join(' → ')}, ${Math.round((legs.reduce((a, l) => a + l.progress * l.km, 0) / legs.reduce((a, l) => a + l.km, 0)) * 100)}% complete`}
    >
      {legs.map((l, i) => {
        const x0 = xs[i] + 4;
        const x1 = xs[i + 1] - 4;
        const hex = MODE_HEX[l.mode];
        const Icon = ICON[l.mode];
        const mid = (xs[i] + xs[i + 1]) / 2;
        return (
          <g key={i}>
            <line x1={x0} x2={x1} y1={y} y2={y} stroke={hex} strokeOpacity={0.16} strokeWidth={4} strokeLinecap="round" />
            {l.progress > 0 && (
              <line x1={x0} x2={x0 + (x1 - x0) * l.progress} y1={y} y2={y} stroke={hex} strokeWidth={4} strokeLinecap="round" />
            )}
            <Icon x={mid - 5.5} y={y - 17} width={11} height={11} color={l.progress > 0 ? hex : PALETTE.subtle} strokeWidth={2.2} />
            {labels && (
              <text x={mid} y={y + 16} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={PALETTE.subtle} letterSpacing="0.06em">
                {LABEL[l.mode].toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
      {xs.map((x, i) => {
        const reached = i === 0 ? legs[0].progress > 0 || done : legs[i - 1].progress >= 1;
        const hex = MODE_HEX[legs[Math.min(i, legs.length - 1)].mode];
        return (
          <circle key={`n${i}`} cx={x} cy={y} r={3.6} fill={reached ? (i === xs.length - 1 ? PALETTE.emerald : hex) : 'white'} stroke={reached ? 'white' : 'rgba(15,23,42,0.22)'} strokeWidth={1.5} />
        );
      })}
      {!done && (
        <g>
          <circle cx={markerX} cy={y} r={5.5} fill={MODE_HEX[legs[cur].mode]} opacity={0.25}>
            <animate attributeName="r" values="5;10;5" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={markerX} cy={y} r={4.6} fill="white" stroke={MODE_HEX[legs[cur].mode]} strokeWidth={2.4} />
        </g>
      )}
    </svg>
  );
}
