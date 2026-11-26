import { useShipmentStatus, type ShipmentStatus } from '@/components/hud/shipmentStatus';
import { FLEET } from '@/data/fleet';
import { WATCHLIST, type WatchShipment } from '@/data/portfolio';
import { CO2_FACTOR, PLACES, type Mode, type Role, type ShipmentId } from '@/data/shipment';
import { batonAt, cargoAt, type Schedule } from '@/lib/schedule';
import { partyOf, usePlanFor, useScheduleFor, useShipment } from '@/store/shipment';

export interface PortfolioLeg {
  mode: Mode;
  km: number;
  /** 0–1 along this leg. */
  progress: number;
  co2Kg: number;
}

export interface PortfolioRow {
  id: string;
  /** Set for the three shipments with a full workflow; null for the watch list. */
  live: ShipmentId | null;
  origin: string;
  destination: string;
  destTz: string;
  direction: string;
  /** Node names at each leg boundary, when known. */
  nodes: string[];
  legs: PortfolioLeg[];
  progress: number;
  status: ShipmentStatus;
  etaH: number;
  etaDeltaH: number;
  co2Kg: number;
  grossKg: number;
  valueUsd: number;
  cargo: string;
  hsCode: string;
  carrier: string;
  forwarder: string;
  baton: { role: Role; initials: string; person: string; task: string; projected: boolean };
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function legsAt(schedule: Schedule, h: number): { legs: PortfolioLeg[]; progress: number } {
  const s = cargoAt(schedule, h).s;
  let acc = 0;
  const legs = schedule.legs.map((l) => {
    const progress = Math.max(0, Math.min(1, (s - acc) / (l.km || 1)));
    acc += l.km;
    return { mode: l.mode, km: l.km, progress, co2Kg: l.co2Kg };
  });
  return { legs, progress: Math.min(1, s / schedule.totalKm) };
}

function useLiveRow(id: ShipmentId): PortfolioRow {
  const def = FLEET[id];
  const schedule = useScheduleFor(id);
  const plan = usePlanFor(id);
  const status = useShipmentStatus(id, schedule, plan);
  const nowH = useShipment((s) => s.nowH);
  const assignments = useShipment((s) => s.assignments);
  const { legs, progress } = legsAt(schedule, nowH);
  const baton = batonAt(schedule, nowH, nowH);
  const holder = partyOf(assignments, id, baton.role);
  const nodes = def.hubs.map((hb) => PLACES[hb.place].name.replace(/ (MIDC|ICD)$/, ''));
  return {
    id,
    live: id,
    origin: def.origin,
    destination: def.destination,
    destTz: def.destTz,
    direction: 'Export',
    nodes,
    legs,
    progress,
    status,
    etaH: schedule.deliveredH,
    etaDeltaH: schedule.deliveredH - plan.deliveredH,
    co2Kg: schedule.co2Kg,
    grossKg: def.grossKg,
    valueUsd: def.valueUsd,
    cargo: def.cargo,
    hsCode: def.hsCode,
    carrier: def.carrier,
    forwarder: partyOf(assignments, id, 'forwarder').org,
    baton: { role: baton.role, initials: holder.initials, person: holder.person, task: baton.task, projected: baton.projected },
  };
}

export function watchRow(w: WatchShipment, nowH: number): PortfolioRow {
  const tonnes = w.grossKg / 1000;
  const totalKm = w.legs.reduce((a, l) => a + l.km, 0);
  const progress = Math.max(0, Math.min(1, (nowH - w.startH) / (w.endH - w.startH)));
  let acc = 0;
  const pos = progress * totalKm;
  const legs = w.legs.map((l) => {
    const p = Math.max(0, Math.min(1, (pos - acc) / l.km));
    acc += l.km;
    return { mode: l.mode, km: l.km, progress: p, co2Kg: l.km * tonnes * CO2_FACTOR[l.mode] };
  });
  const current = legs.find((l) => l.progress < 1) ?? legs[legs.length - 1];
  const status: ShipmentStatus = w.issue
    ? { tone: w.issue.tone, label: w.issue.label, alert: w.issue.tone === 'crimson' }
    : progress >= 1
      ? { tone: 'emerald', label: 'Delivered', alert: false }
      : current.mode === 'sea'
        ? { tone: 'cobalt', label: 'At sea', alert: false }
        : { tone: 'emerald', label: 'On track', alert: false };
  const person = w.baton === 'exporter' ? w.exporter : w.forwarder;
  return {
    id: w.id,
    live: null,
    origin: w.origin,
    destination: w.destination,
    destTz: w.destTz,
    direction: w.direction,
    nodes: [w.legs[0].from, ...w.legs.map((l) => l.to)],
    legs,
    progress,
    status,
    etaH: w.endH,
    etaDeltaH: w.endH - w.plannedEndH,
    co2Kg: legs.reduce((a, l) => a + l.co2Kg, 0),
    grossKg: w.grossKg,
    valueUsd: w.valueUsd,
    cargo: w.cargo,
    hsCode: w.hsCode,
    carrier: w.carrier,
    forwarder: w.forwarder,
    baton: { role: w.baton, initials: initials(person), person, task: w.batonTask, projected: false },
  };
}

/** All six shipments on the platform, live state merged with the watch list. */
export function usePortfolio(): PortfolioRow[] {
  // One call per live shipment, in a fixed order (hooks cannot run in a loop).
  const a = useLiveRow('SHP-2611-0482');
  const b = useLiveRow('SHP-2611-0519');
  const c = useLiveRow('SHP-2611-0494');
  const nowH = useShipment((s) => s.nowH);
  return [a, b, c, ...WATCHLIST.map((w) => watchRow(w, nowH))];
}
