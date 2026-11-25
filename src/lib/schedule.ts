/**
 * The shipment's time model, as pure functions of the store's facts.
 *
 * Every hour value is relative to the moment the app loaded (LIVE = 0 at load). The
 * scrubber, the cargo marker, milestone states, escrow and the baton holder are all
 * derived from one `Schedule`, so a disruption or a recovery can never leave two views
 * disagreeing about where the box is.
 */
import {
  CO2_FACTOR,
  MILESTONES,
  PLACES,
  ROLES,
  SPEED_KMH,
  T,
  type MilestoneId,
  type MilestoneMeta,
  type Mode,
  type Role,
  type RouteId,
} from '@/data/shipment';
import { getRoute, nearestF, pointAt, type RouteGeom } from '@/lib/route';

export type HighwayState = 'none' | 'active' | 'nh48' | 'rail';
export type CustomsState = 'none' | 'active' | 'ai_reclass' | 'cfs_roll';
export type RedSeaState = 'none' | 'active' | 'cape' | 'seaair';

export interface ScheduleInputs {
  nowH: number;
  actuals: Partial<Record<MilestoneId, number>>;
  docsVerified: boolean;
  highway: HighwayState;
  highwayAtH: number | null;
  customs: CustomsState;
  customsAtH: number | null;
  redSea: RedSeaState;
  redSeaAtH: number | null;
  /** Set when the driver confirms arrival: the inland legs end at this hour. */
  forcedArrivalH: number | null;
}

export const DEFAULT_INPUTS: Omit<ScheduleInputs, 'nowH' | 'actuals'> = {
  docsVerified: false,
  highway: 'none',
  highwayAtH: null,
  customs: 'none',
  customsAtH: null,
  redSea: 'none',
  redSeaAtH: null,
  forcedArrivalH: null,
};

/** A piece of a leg's timeline: ground fraction moves linearly from f0 to f1. */
export interface Seg {
  t0: number;
  t1: number;
  f0: number;
  f1: number;
}

export type LegGroup = 'origin' | 'main' | 'destination';

export interface LegSchedule {
  id: string;
  routeId: RouteId;
  mode: Mode;
  group: LegGroup;
  segs: Seg[];
  startH: number;
  endH: number;
  km: number;
  co2Kg: number;
}

export interface AlertRange {
  legId: string;
  from: number;
  to: number;
}

export interface MilestonePlan {
  id: MilestoneId;
  meta: MilestoneMeta;
  label: string;
  plannedH: number;
  actualH?: number;
  blocked?: string;
  atRisk?: string;
}

export interface Schedule {
  legs: LegSchedule[];
  milestones: MilestonePlan[];
  byId: Record<MilestoneId, MilestonePlan>;
  /** Arrival at the JNPT gate. */
  arrivalJnptH: number;
  deliveredH: number;
  ataH: number;
  rolled: boolean;
  alert: AlertRange | null;
  risks: (AlertRange & { label: string })[];
  co2Kg: number;
  totalKm: number;
}

const CARGO_TONNES = 12.85;
/**
 * Duration of a forced "jump" segment, in hours (about a third of a second). The visible
 * drive to the gate comes from the marker's smoothing, not from the schedule, so the
 * schedule itself should land the box at once.
 */
const EPS = 1e-4;

// --- Leg construction ---------------------------------------------------------

function legFrom(
  id: string,
  routeId: RouteId,
  group: LegGroup,
  segs: Seg[],
): LegSchedule {
  const g = getRoute(routeId);
  return {
    id,
    routeId,
    mode: g.mode,
    group,
    segs,
    startH: segs[0].t0,
    endH: segs[segs.length - 1].t1,
    km: g.km,
    co2Kg: g.km * CARGO_TONNES * CO2_FACTOR[g.mode],
  };
}

/** A leg run at constant speed from `startH`, with optional dwell stops at fractions. */
function linear(g: RouteGeom, startH: number, speed: number, stops: { f: number; h: number }[] = []): Seg[] {
  const hoursPerF = g.km / speed;
  const segs: Seg[] = [];
  let t = startH;
  let f = 0;
  for (const stop of [...stops].sort((a, b) => a.f - b.f)) {
    if (stop.f <= f) continue;
    const t1 = t + (stop.f - f) * hoursPerF;
    segs.push({ t0: t, t1, f0: f, f1: stop.f });
    segs.push({ t0: t1, t1: t1 + stop.h, f0: stop.f, f1: stop.f });
    t = t1 + stop.h;
    f = stop.f;
  }
  segs.push({ t0: t, t1: t + (1 - f) * hoursPerF, f0: f, f1: 1 });
  return segs;
}

export function fractionAt(segs: Seg[], h: number): number {
  if (h <= segs[0].t0) return segs[0].f0;
  for (const s of segs) {
    if (h <= s.t1) {
      const span = s.t1 - s.t0;
      return span > 0 ? s.f0 + ((h - s.t0) / span) * (s.f1 - s.f0) : s.f1;
    }
  }
  return segs[segs.length - 1].f1;
}

/** Truncate a leg so it ends by `h`: the remaining distance is covered in an instant. */
function forceEnd(leg: LegSchedule, h: number): LegSchedule {
  if (leg.endH <= h) return leg;
  if (leg.startH >= h) {
    return { ...leg, segs: [{ t0: h, t1: h + EPS, f0: 0, f1: 1 }], startH: h, endH: h + EPS };
  }
  const f = fractionAt(leg.segs, h);
  const kept = leg.segs
    .filter((s) => s.t0 < h)
    .map((s) => (s.t1 > h ? { ...s, t1: h, f1: f } : s));
  kept.push({ t0: h, t1: h + EPS, f0: f, f1: 1 });
  return { ...leg, segs: kept, endH: h + EPS };
}

function originLegs(inp: ScheduleInputs): LegSchedule[] {
  const S = T.departFactory;
  const v = SPEED_KMH.road;
  const exp = getRoute('roadExpressway');
  const ghatF = nearestF(exp, PLACES.khandala.at[0], PLACES.khandala.at[1]);

  // The expressway timeline as it would run with the ghat blocked, so a reroute can
  // pick the truck up exactly where it was when the decision was made.
  const blockedSegs = linear(exp, S, v, [{ f: ghatF, h: 6 }]);

  if (inp.highway === 'none') return [legFrom('road', 'roadExpressway', 'origin', linear(exp, S, v))];
  if (inp.highway === 'active') return [legFrom('road', 'roadExpressway', 'origin', blockedSegs)];

  const at = inp.highwayAtH ?? inp.nowH;
  const rawPos = fractionAt(blockedSegs, at) * exp.rawKm;

  if (inp.highway === 'nh48') {
    const nh = getRoute('roadNh48');
    // Both routes share the Chakan to Talegaon prefix, so equal raw distance is the same
    // physical point. Past the fork the truck is snapped back onto it.
    const prefixRaw = nh.waypointF[3] * nh.rawKm;
    const f0 = Math.min(rawPos, prefixRaw) / nh.rawKm;
    const slower = v * 0.86; // the old ghat road is slower and busier
    const segs: Seg[] = [
      { t0: S, t1: at, f0: 0, f1: f0 },
      { t0: at, t1: at + ((1 - f0) * nh.km) / slower, f0, f1: 1 },
    ];
    return [legFrom('road', 'roadNh48', 'origin', segs)];
  }

  // Rail: finish the short hop to Talegaon ICD, transload, then the CONCOR rake.
  const icd = getRoute('roadToIcd');
  const fIcd = Math.min(1, rawPos / icd.rawKm);
  const roadEnd = at + ((1 - fIcd) * icd.km) / v;
  const road = legFrom('road', 'roadToIcd', 'origin', [
    { t0: S, t1: at, f0: 0, f1: fIcd },
    { t0: at, t1: Math.max(at + EPS, roadEnd), f0: fIcd, f1: 1 },
  ]);
  const rail = getRoute('railIcd');
  const railStart = road.endH + T.icdTransloadH;
  return [road, legFrom('rail', 'railIcd', 'origin', linear(rail, railStart, SPEED_KMH.rail))];
}

// --- Schedule --------------------------------------------------------------------

export function buildSchedule(inp: ScheduleInputs): Schedule {
  // Origin: Chakan to the JNPT gate.
  let origin = originLegs(inp);
  if (inp.forcedArrivalH !== null) {
    let cursor = inp.forcedArrivalH;
    origin = origin.map((leg) => {
      const next = forceEnd(leg, cursor);
      cursor = Math.max(cursor, next.endH);
      return next;
    });
  }
  const arrival = origin[origin.length - 1].endH;
  const gateInH = inp.actuals.gateIn ?? arrival;

  // Customs clearance.
  const examine = gateInH + T.examineH;
  let leoPlanned = examine;
  if (inp.customs === 'active') leoPlanned = examine + 24;
  else if (inp.customs === 'ai_reclass') leoPlanned = Math.max(examine, (inp.customsAtH ?? 0) + 4);
  else if (inp.customs === 'cfs_roll') leoPlanned = Math.max(examine, (inp.customsAtH ?? 0) + 24);
  const leoH = inp.actuals.leo ?? leoPlanned;

  // Vessel: a late LEO, or an explicit roll, moves the box to the next sailing.
  const rolled = inp.customs === 'cfs_roll' || leoH + 1 > T.cutoff;
  const loadedH = rolled ? T.loadPlanned + T.nextSailingShiftH : Math.max(T.loadPlanned, leoH + 1);
  const atdH = loadedH + T.sailAfterLoadH;
  const eblH = inp.actuals.ebl ?? atdH + T.eblAfterSailH;
  const lcH = inp.actuals.lc ?? eblH + T.lcAfterEblH;

  // Main carriage.
  const main: LegSchedule[] = [];
  const dest: LegSchedule[] = [];
  let transitH: number;
  let transitLabel: string;
  let ataLabel = 'Arrived Rotterdam';
  let alert: AlertRange | null = null;
  const risks: Schedule['risks'] = [];

  const exp = getRoute('roadExpressway');
  const ghatF = nearestF(exp, PLACES.khandala.at[0], PLACES.khandala.at[1]);
  if (origin[0].routeId === 'roadExpressway') {
    risks.push({ legId: 'road', from: ghatF - 0.07, to: ghatF + 0.05, label: 'Ghat section' });
    if (inp.highway === 'active') alert = { legId: 'road', from: ghatF - 0.08, to: ghatF + 0.06 };
  }

  if (inp.redSea === 'seaair') {
    const feeder = getRoute('seaFeederJebelAli');
    const feedLeg = legFrom('sea', 'seaFeederJebelAli', 'main', linear(feeder, atdH, SPEED_KMH.sea));
    const air = getRoute('airDwcAms');
    const upliftH = feedLeg.endH + T.feederTranshipH;
    const airLeg = legFrom('air', 'airDwcAms', 'main', linear(air, upliftH, SPEED_KMH.air));
    airLeg.segs[airLeg.segs.length - 1].t1 += 4; // taxi, holding and ULD breakdown
    airLeg.endH += 4;
    main.push(feedLeg, airLeg);
    transitH = upliftH;
    transitLabel = 'Air uplift · DWC';
    ataLabel = 'Landed Schiphol';
    const road = getRoute('roadAmsDuisburg');
    dest.push(legFrom('inland', 'roadAmsDuisburg', 'destination', linear(road, airLeg.endH + T.airHandlingH, SPEED_KMH.road * 1.4)));
  } else {
    const cape = inp.redSea === 'cape';
    const routeId: RouteId = cape ? 'seaCape' : 'seaSuez';
    const g = getRoute(routeId);
    const stops: { f: number; h: number }[] = [];
    const suezF = g.waypointF[13];
    const bemF = g.waypointF[6];
    if (!cape) {
      stops.push({ f: suezF, h: T.canalTransitH });
      risks.push({ legId: 'sea', from: bemF - 0.025, to: bemF + 0.05, label: 'Bab-el-Mandeb' });
      risks.push({ legId: 'sea', from: suezF - 0.012, to: suezF + 0.012, label: 'Suez queue' });
      // An unresolved advisory holds the ship at anchorage short of the strait.
      if (inp.redSea === 'active') {
        stops.push({ f: bemF - 0.03, h: 14 * 24 });
        alert = { legId: 'sea', from: bemF - 0.035, to: bemF + 0.07 };
      }
    }
    const seaLeg = legFrom('sea', routeId, 'main', linear(g, atdH, SPEED_KMH.sea, stops));
    main.push(seaLeg);
    const markF = cape ? g.waypointF[9] : suezF;
    transitH = timeAtFraction(seaLeg.segs, markF);
    transitLabel = cape ? 'Cape rounding' : 'Suez transit';
    const rail = getRoute('railBetuwe');
    dest.push(legFrom('inland', 'railBetuwe', 'destination', linear(rail, seaLeg.endH + T.dischargeDwellH, SPEED_KMH.rail)));
  }

  if (inp.customs === 'active') alert = { legId: 'sea', from: 0, to: 0.07 };

  const legs = [...origin, ...main, ...dest];
  const ataH = main[main.length - 1].endH;
  const deliveredH = dest[dest.length - 1].endH;

  // Milestones.
  const planned: Record<MilestoneId, number> = {
    invoice: -46,
    booking: -40,
    stuffing: -8,
    ewaybill: -7,
    shippingBill: -6,
    departFactory: T.departFactory,
    gateIn: arrival,
    leo: leoPlanned,
    vgm: Math.max(T.vgmPlanned, gateInH + 0.5),
    loaded: loadedH,
    atd: atdH,
    ebl: eblH,
    lc: lcH,
    transit: transitH,
    ata: ataH,
    delivered: deliveredH,
  };

  const milestones: MilestonePlan[] = MILESTONES.map((meta) => {
    const m: MilestonePlan = {
      id: meta.id,
      meta,
      label: meta.id === 'transit' ? transitLabel : meta.id === 'ata' ? ataLabel : meta.label,
      plannedH: planned[meta.id],
      actualH: inp.actuals[meta.id],
    };
    if (m.actualH === undefined) {
      if ((meta.id === 'leo' || meta.id === 'ebl') && !inp.docsVerified) m.blocked = 'Document mismatch';
      if (meta.id === 'leo' && inp.customs === 'active') m.blocked = 'RMS hold';
      if (meta.id === 'gateIn' && inp.highway === 'active') m.atRisk = '6h ghat delay';
      if (meta.id === 'loaded' && rolled) m.atRisk = 'Rolled to next sailing';
      if (meta.id === 'transit' && inp.redSea === 'active') m.blocked = 'Security advisory';
    }
    return m;
  });
  milestones.sort((a, b) => (a.actualH ?? a.plannedH) - (b.actualH ?? b.plannedH));
  const byId = Object.fromEntries(milestones.map((m) => [m.id, m])) as Record<MilestoneId, MilestonePlan>;

  return {
    legs,
    milestones,
    byId,
    arrivalJnptH: arrival,
    deliveredH,
    ataH,
    rolled,
    alert,
    risks,
    co2Kg: legs.reduce((s, l) => s + l.co2Kg, 0),
    totalKm: legs.reduce((s, l) => s + l.km, 0),
  };
}

export function timeAtFraction(segs: Seg[], f: number): number {
  for (const s of segs) {
    if (f <= s.f1 && s.f1 > s.f0) {
      return s.t0 + ((f - s.f0) / (s.f1 - s.f0)) * (s.t1 - s.t0);
    }
  }
  return segs[segs.length - 1].t1;
}

// --- Position ---------------------------------------------------------------------

export type Phase = 'origin' | 'port' | 'main' | 'hub' | 'destination' | 'delivered';

export interface CargoState {
  legIndex: number;
  leg: LegSchedule;
  f: number;
  lat: number;
  lon: number;
  r: number;
  phase: Phase;
  moving: boolean;
  /** Cumulative distance along the whole journey, km. Smoothed by the marker. */
  s: number;
}

export function cargoAt(schedule: Schedule, h: number): CargoState {
  const { legs } = schedule;
  let idx: number;
  let f: number;
  let phase: Phase = 'origin';
  let moving = false;

  if (h <= legs[0].startH) {
    idx = 0;
    f = 0;
  } else {
    idx = legs.length - 1;
    f = 1;
    phase = 'delivered';
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (h < leg.startH) {
        // Between legs: dwelling at the end of the previous one.
        idx = i - 1;
        f = 1;
        const prev = legs[i - 1];
        phase = prev.group === 'origin' && leg.group === 'main' ? 'port' : 'hub';
        break;
      }
      if (h <= leg.endH) {
        idx = i;
        f = fractionAt(leg.segs, h);
        phase = leg.group;
        moving = leg.segs.some((s) => h >= s.t0 && h <= s.t1 && s.f1 > s.f0);
        break;
      }
    }
  }

  const leg = legs[idx];
  const p = pointAt(getRoute(leg.routeId), f);
  let s = 0;
  for (let i = 0; i < idx; i++) s += legs[i].km;
  s += f * leg.km;
  return { legIndex: idx, leg, f, lat: p.lat, lon: p.lon, r: p.r, phase, moving, s };
}

/** Inverse of `cargoAt(...).s`: leg and fraction for a cumulative distance. */
export function locateS(schedule: Schedule, s: number): { leg: LegSchedule; f: number } {
  let acc = 0;
  for (const leg of schedule.legs) {
    if (s <= acc + leg.km) return { leg, f: Math.max(0, (s - acc) / leg.km) };
    acc += leg.km;
  }
  const last = schedule.legs[schedule.legs.length - 1];
  return { leg: last, f: 1 };
}

// --- Status at a view time -----------------------------------------------------------

export type MilestoneStatus = 'done' | 'forecast' | 'active' | 'blocked' | 'risk' | 'pending';

export function isDoneAt(m: MilestonePlan, h: number, nowH: number): boolean {
  if (m.actualH !== undefined) return m.actualH <= h;
  // Automatic milestones complete on their own once real time passes them.
  return !m.meta.manual && m.plannedH <= Math.min(h, nowH);
}

export function milestoneStatuses(
  schedule: Schedule,
  h: number,
  nowH: number,
): Record<MilestoneId, MilestoneStatus> {
  const out = {} as Record<MilestoneId, MilestoneStatus>;
  const future = h > nowH + 1e-3;
  let activeAssigned = false;
  for (const m of schedule.milestones) {
    let st: MilestoneStatus;
    if (isDoneAt(m, h, nowH)) st = 'done';
    else if (future && m.plannedH <= h) st = m.blocked ? 'blocked' : 'forecast';
    else if (m.blocked) st = 'blocked';
    else if (m.atRisk) st = 'risk';
    else st = 'pending';
    if (!activeAssigned && st !== 'done' && st !== 'forecast') {
      if (st === 'pending') st = 'active';
      activeAssigned = true;
    }
    out[m.id] = st;
  }
  return out;
}

const BATON_CHAIN: { m: MilestoneId; role: Role; task: string }[] = [
  { m: 'gateIn', role: 'transporter', task: 'Driving to JNPT Gate 4' },
  { m: 'leo', role: 'broker', task: 'Export customs clearance' },
  { m: 'ebl', role: 'forwarder', task: 'Vessel loading & e-BL' },
  { m: 'lc', role: 'exporter', task: 'LC drawdown on e-BL' },
  { m: 'delivered', role: 'forwarder', task: 'Ocean transit to Europe' },
];

export interface Baton {
  role: Role;
  task: string;
  projected: boolean;
}

/** Who holds responsibility for the box at time h. Projected when h is in the future. */
export function batonAt(schedule: Schedule, h: number, nowH: number): Baton {
  const future = h > nowH + 1e-3;
  for (const step of BATON_CHAIN) {
    const m = schedule.byId[step.m];
    const done = isDoneAt(m, h, nowH) || (future && m.plannedH <= h);
    if (!done) {
      const task = step.m === 'delivered' && schedule.legs.some((l) => l.mode === 'air') ? 'Sea-air transit to Europe' : step.task;
      return { role: step.role, task, projected: future };
    }
  }
  return { role: 'exporter', task: `Delivered to ${ROLES.exporter.org.split(' ')[0]}'s buyer`, projected: future };
}

export type EscrowStatus = 'released' | 'scheduled' | 'locked' | 'blocked';

export function escrowStatus(st: MilestoneStatus): EscrowStatus {
  if (st === 'done') return 'released';
  if (st === 'forecast') return 'scheduled';
  if (st === 'blocked') return 'blocked';
  return 'locked';
}

// --- Carbon ------------------------------------------------------------------------------

/** 0 (cleanest) to 1 (dirtiest), log-scaled across modes so sea and rail stay readable. */
export function carbonIntensity(mode: Mode): number {
  const lo = Math.log10(0.008);
  const hi = Math.log10(0.6);
  return Math.max(0, Math.min(1, (Math.log10(CO2_FACTOR[mode]) - lo) / (hi - lo)));
}
