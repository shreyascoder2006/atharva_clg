import { useShipmentStatus, type ShipmentStatus } from '@/components/hud/shipmentStatus';
import type { CostCategory } from '@/data/finance';
import { FLEET } from '@/data/fleet';
import { LANE_BY_ID, type CustomShipment } from '@/data/lanes';
import { WATCHLIST, type WatchShipment } from '@/data/portfolio';
import { CO2_FACTOR, PLACES, type Mode, type Role, type RouteId, type ShipmentId } from '@/data/shipment';
import { getRoute } from '@/lib/route';
import { batonAt, cargoAt, milestoneStatuses, type MilestoneStatus, type Schedule } from '@/lib/schedule';
import { partyOf, usePlanFor, useScheduleFor, useShipment } from '@/store/shipment';

export interface PortfolioLeg {
  mode: Mode;
  km: number;
  /** 0–1 along this leg. */
  progress: number;
  co2Kg: number;
}

export type StepStatus = MilestoneStatus;

export interface PortfolioStep {
  label: string;
  atH: number;
  status: StepStatus;
}

export interface PortfolioRow {
  id: string;
  /** Set for the three shipments with a full workflow; null for the watch list. */
  live: ShipmentId | null;
  /** Booked from the "+ New Shipment" modal in this session. */
  custom: boolean;
  origin: string;
  destination: string;
  destTz: string;
  direction: string;
  /** Node names at each leg boundary, when known. */
  nodes: string[];
  legs: PortfolioLeg[];
  progress: number;
  status: ShipmentStatus;
  /** Export customs cleared (LEO granted) or delivered. */
  cleared: boolean;
  steps: PortfolioStep[];
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
  /** Landed-cost estimate for shipments without a contracted cost sheet. */
  costs?: Record<CostCategory, number>;
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

/** Steps for a synthetic timeline: done before now, the first open one active. */
function stepStatuses(steps: { label: string; atH: number }[], nowH: number, risk: boolean): PortfolioStep[] {
  let active = false;
  return steps.map((s) => {
    if (s.atH <= nowH) return { ...s, status: 'done' };
    if (!active) {
      active = true;
      return { ...s, status: risk ? 'risk' : 'active' };
    }
    return { ...s, status: 'pending' };
  });
}

/** Departure and arrival times along a leg list, spreading transit time by distance. */
function legSteps(legs: { from: string; to: string; km: number }[], startH: number, endH: number, bookedH: number, destination: string) {
  const total = legs.reduce((a, l) => a + l.km, 0);
  let acc = 0;
  const out = [{ label: 'Booking confirmed', atH: bookedH }];
  for (const l of legs) {
    out.push({ label: `Departed ${l.from}`, atH: startH + ((endH - startH) * acc) / total });
    acc += l.km;
  }
  out.push({ label: `Delivered · ${destination}`, atH: endH });
  return out;
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
  const ms = milestoneStatuses(schedule, nowH, nowH);
  const steps = schedule.milestones.map((m) => ({ label: m.label, atH: m.actualH ?? m.plannedH, status: ms[m.id] }));
  return {
    id,
    live: id,
    custom: false,
    origin: def.origin,
    destination: def.destination,
    destTz: def.destTz,
    direction: 'Export',
    nodes,
    legs,
    progress,
    status,
    cleared: ms.leo === 'done' || ms.delivered === 'done',
    steps,
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

function progressRow(
  base: Omit<PortfolioRow, 'legs' | 'progress' | 'status' | 'steps' | 'co2Kg' | 'nodes'>,
  legDefs: { mode: Mode; km: number; from: string; to: string }[],
  startH: number,
  endH: number,
  bookedH: number,
  nowH: number,
  issue?: ShipmentStatus,
): PortfolioRow {
  const tonnes = base.grossKg / 1000;
  const totalKm = legDefs.reduce((a, l) => a + l.km, 0);
  const progress = Math.max(0, Math.min(1, (nowH - startH) / (endH - startH)));
  let acc = 0;
  const pos = progress * totalKm;
  const legs = legDefs.map((l) => {
    const p = Math.max(0, Math.min(1, (pos - acc) / l.km));
    acc += l.km;
    return { mode: l.mode, km: l.km, progress: p, co2Kg: l.km * tonnes * CO2_FACTOR[l.mode] };
  });
  const current = legs.find((l) => l.progress < 1) ?? legs[legs.length - 1];
  const status: ShipmentStatus =
    issue ??
    (progress >= 1
      ? { tone: 'emerald', label: 'Delivered', alert: false }
      : nowH < startH
        ? { tone: 'cobalt', label: 'Booked', alert: false }
        : current.mode === 'sea'
          ? { tone: 'cobalt', label: 'At sea', alert: false }
          : current.mode === 'air'
            ? { tone: 'sky', label: 'In flight', alert: false }
            : { tone: 'emerald', label: 'On track', alert: false });
  return {
    ...base,
    nodes: [legDefs[0].from, ...legDefs.map((l) => l.to)],
    legs,
    progress,
    status,
    steps: stepStatuses(legSteps(legDefs, startH, endH, bookedH, base.destination), nowH, !!issue && issue.tone !== 'emerald'),
    co2Kg: legs.reduce((a, l) => a + l.co2Kg, 0),
  };
}

export function watchRow(w: WatchShipment, nowH: number): PortfolioRow {
  const person = w.baton === 'exporter' ? w.exporter : w.forwarder;
  return progressRow(
    {
      id: w.id,
      live: null,
      custom: false,
      origin: w.origin,
      destination: w.destination,
      destTz: w.destTz,
      direction: w.direction,
      cleared: w.direction !== 'Import' || nowH >= w.endH,
      etaH: w.endH,
      etaDeltaH: w.endH - w.plannedEndH,
      grossKg: w.grossKg,
      valueUsd: w.valueUsd,
      cargo: w.cargo,
      hsCode: w.hsCode,
      carrier: w.carrier,
      forwarder: w.forwarder,
      baton: { role: w.baton, initials: initials(person), person, task: w.batonTask, projected: false },
    },
    w.legs,
    w.startH,
    w.endH,
    w.startH - 36,
    nowH,
    w.issue ? { tone: w.issue.tone, label: w.issue.label, alert: w.issue.tone === 'crimson' } : undefined,
  );
}

export function customRow(c: CustomShipment, nowH: number): PortfolioRow {
  const lane = LANE_BY_ID[c.laneId];
  const mainKm = Math.round(getRoute(lane.route.id as RouteId).km);
  const freight = Math.round(lane.ratePerKg * c.grossKg);
  return progressRow(
    {
      id: c.id,
      live: null,
      custom: true,
      origin: lane.origin,
      destination: lane.destination,
      destTz: lane.destTz,
      direction: 'Export',
      cleared: false,
      etaH: c.endH,
      etaDeltaH: 0,
      grossKg: c.grossKg,
      valueUsd: c.valueUsd,
      cargo: c.cargo,
      hsCode: lane.hsCode,
      carrier: lane.carrier,
      forwarder: c.forwarder,
      baton: { role: 'forwarder', initials: initials(c.forwarder), person: c.forwarder, task: 'Confirm pickup slot · open Shipping Bill draft', projected: false },
      costs: {
        freight,
        customs: 190,
        inland: Math.round(lane.roadKm * 1.9),
        port: lane.mode === 'sea' ? 320 : 140,
        insurance: Math.round(c.valueUsd * 0.0018),
      },
    },
    [
      { mode: 'road', km: lane.roadKm, from: lane.roadFrom, to: lane.route.label.split(' → ')[0] },
      { mode: lane.mode, km: mainKm, from: lane.route.label.split(' → ')[0], to: lane.destination },
    ],
    c.startH,
    c.endH,
    c.createdH,
    nowH,
  );
}

/** Every shipment on the platform: live workflows, the watch list, and new bookings. */
export function usePortfolio(): PortfolioRow[] {
  // One call per live shipment, in a fixed order (hooks cannot run in a loop).
  const a = useLiveRow('SHP-2611-0482');
  const b = useLiveRow('SHP-2611-0519');
  const c = useLiveRow('SHP-2611-0494');
  const nowH = useShipment((s) => s.nowH);
  const custom = useShipment((s) => s.customShipments);
  return [a, b, c, ...WATCHLIST.map((w) => watchRow(w, nowH)), ...custom.map((x) => customRow(x, nowH))];
}
