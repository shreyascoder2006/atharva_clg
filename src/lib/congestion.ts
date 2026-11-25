import type { PortCongestion } from '@/data/shipment';
import type { CustomsState, RedSeaState } from '@/lib/schedule';

/** Live congestion reading, nudged by whatever disruption is in play. */
/**
 * @param t seconds on any monotonic clock; the HUD and the globe both pass the store's
 *          live hour in seconds so a pillar and its tag always show the same reading.
 */
export function portReading(p: PortCongestion, st: { customs: CustomsState; redSea: RedSeaState }, t: number) {
  let dwell = p.dwellDays;
  let util = p.yardUtil;
  if (p.id === 'jnpt' && st.customs === 'active') {
    dwell += 1.3;
    util += 0.08;
  }
  if (p.id === 'suez' && st.redSea === 'active') dwell += 0.9;
  if (p.id === 'jebelAli' && st.redSea === 'seaair') {
    dwell += 0.4;
    util += 0.06;
  }
  // A slow, deterministic breath per port so the column feels live.
  const phase = p.at[0] * 0.37 + p.at[1] * 0.11;
  dwell *= 1 + Math.sin(t * 0.21 + phase) * 0.035;
  util = Math.min(0.99, util * (1 + Math.sin(t * 0.17 + phase * 2) * 0.015));
  const score = 0.55 * util + 0.45 * Math.min(1, dwell / 4);
  const tone = score >= 0.75 ? 'crimson' : score >= 0.58 ? 'amber' : 'emerald';
  return { dwell, util, score, tone } as const;
}
