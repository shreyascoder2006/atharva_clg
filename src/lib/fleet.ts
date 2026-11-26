/**
 * Schedules for the two secondary shipments. They share the flagship's `Schedule`
 * shape, so the globe, the timeline, the escrow bar and the baton logic treat all three
 * shipments the same way.
 */
import { FLEET } from '@/data/fleet';
import { SPEED_KMH, type MilestoneMeta, type ShipmentId } from '@/data/shipment';
import { getRoute, nearestF } from '@/lib/route';
import { legFrom, linear, timeAtFraction, type MilestonePlan, type Schedule } from '@/lib/schedule';

function finish(
  shipmentId: ShipmentId,
  metas: (MilestoneMeta & { plannedH: number; actualH?: number; blocked?: string; atRisk?: string })[],
  rest: Omit<Schedule, 'shipmentId' | 'milestones' | 'byId'>,
): Schedule {
  const milestones: MilestonePlan[] = metas
    .map(({ plannedH, actualH, blocked, atRisk, ...meta }) => ({
      id: meta.id,
      meta,
      label: meta.label,
      plannedH,
      actualH,
      blocked: actualH === undefined ? blocked : undefined,
      atRisk: actualH === undefined ? atRisk : undefined,
    }))
    .sort((a, b) => (a.actualH ?? a.plannedH) - (b.actualH ?? b.plannedH));
  return { shipmentId, milestones, byId: Object.fromEntries(milestones.map((m) => [m.id, m])), ...rest };
}

// --- SHP-2611-0519 · Bengaluru → Frankfurt, air, cold chain -----------------------

/** In flight at LIVE: it left BLR a little over four hours ago. */
export function buildAirSchedule(): Schedule {
  const tonnes = FLEET['SHP-2611-0519'].grossKg / 1000;
  const road = legFrom('road', 'roadEcityBlr', 'origin', linear(getRoute('roadEcityBlr'), -9, 26), tonnes);
  const atd = -4.2;
  const air = legFrom('air', 'airBlrFra', 'main', linear(getRoute('airBlrFra'), atd, 840), tonnes);
  // Taxi-in, ULD breakdown and EU import release before the last-mile van.
  const lastMileStart = air.endH + 3.5;
  const van = legFrom('inland', 'roadFraMorfelden', 'destination', linear(getRoute('roadFraMorfelden'), lastMileStart, 28), tonnes);

  const m = (id: string, label: string, owner: MilestoneMeta['owner'], place: MilestoneMeta['place'], plannedH: number) => ({
    id,
    label,
    owner,
    place,
    plannedH,
  });
  const legs = [road, air, van];
  return finish(
    'SHP-2611-0519',
    [
      m('booking', 'Booking confirmed · SKB 761', 'forwarder', 'blr', -30),
      m('precool', 'Cold-chain packed · 2–8 °C', 'exporter', 'ecity', -12),
      m('pickup', 'Reefer departed Electronic City', 'transporter', 'ecity', road.startH),
      m('gateIn', 'Gate-in · BLR air cargo', 'transporter', 'blr', road.endH),
      m('leo', 'Air cargo LEO', 'broker', 'blr', road.endH + 0.8),
      m('uld', 'ULD built & screened', 'forwarder', 'blr', road.endH + 1.4),
      m('atd', 'Departed BLR', 'forwarder', 'blr', air.startH),
      m('ata', 'Landed Frankfurt', 'forwarder', 'fra', air.endH),
      m('release', 'EU import release', 'forwarder', 'fra', air.endH + 2.8),
      m('delivered', 'Delivered · Mörfelden DC', 'exporter', 'morfelden', van.endH),
    ],
    {
      legs,
      gateInH: road.endH,
      deliveredH: van.endH,
      ataH: air.endH,
      rolled: false,
      cutoffH: null,
      baton: [
        { m: 'gateIn', role: 'transporter', task: 'Reefer run to BLR cargo terminal' },
        { m: 'leo', role: 'broker', task: 'Air cargo export clearance' },
        { m: 'ata', role: 'forwarder', task: 'In flight · SKB 761 BLR → FRA' },
        { m: 'delivered', role: 'forwarder', task: 'EU import release & last mile' },
      ],
      finalBaton: { role: 'exporter', task: 'Delivered to Rhein-Main Pharma DC' },
      alert: null,
      risks: [],
      co2Kg: legs.reduce((s, l) => s + l.co2Kg, 0),
      totalKm: legs.reduce((s, l) => s + l.km, 0),
    },
  );
}

// --- SHP-2611-0494 · Surat → Mundra → Jebel Ali, sea, customs hold -----------------

export type HoldState = 'none' | 'active' | 'resolved';

export const SURAT = {
  holdSinceH: -6,
  cutoffH: 4,
  loadPlannedH: 6,
  sailAfterLoadH: 4,
  nextSailingShiftH: 48,
  examineH: 4,
  dischargeH: 18,
};

/**
 * The box gated in at Mundra yesterday and has sat in an RMS examination since this
 * morning. Unresolved, the projected LEO misses the feeder cutoff and the box rolls to
 * the next sailing. Resolving the query lands LEO at once and can still make the cutoff.
 */
export function buildSuratSchedule(hold: HoldState, resolvedAtH: number | null): Schedule {
  const tonnes = FLEET['SHP-2611-0494'].grossKg / 1000;
  const road = legFrom('road', 'roadSuratMundra', 'origin', linear(getRoute('roadSuratMundra'), -34, 40), tonnes);
  const gateIn = road.endH;

  let leoPlanned = gateIn + SURAT.examineH;
  let leoActual: number | undefined;
  if (hold === 'active') leoPlanned = SURAT.holdSinceH + 30;
  if (hold === 'resolved') {
    leoActual = resolvedAtH ?? 0;
    leoPlanned = leoActual;
  }
  const leo = leoActual ?? leoPlanned;
  const rolled = leo + 1 > SURAT.cutoffH;
  const loaded = rolled ? SURAT.loadPlannedH + SURAT.nextSailingShiftH : Math.max(SURAT.loadPlannedH, leo + 1);
  const atd = loaded + SURAT.sailAfterLoadH;

  const sea = getRoute('seaMundraJebelAli');
  const seaLeg = legFrom('sea', 'seaMundraJebelAli', 'main', linear(sea, atd, SPEED_KMH.sea), tonnes);
  const delivered = seaLeg.endH + SURAT.dischargeH;
  const hormuzF = nearestF(sea, 26.45, 56.6);

  const legs = [road, seaLeg];
  const m = (
    id: string,
    label: string,
    owner: MilestoneMeta['owner'],
    place: MilestoneMeta['place'],
    plannedH: number,
    extra: { manual?: boolean; actualH?: number; blocked?: string; atRisk?: string } = {},
  ) => ({ id, label, owner, place, plannedH, ...extra });

  return finish(
    'SHP-2611-0494',
    [
      m('booking', 'Booking confirmed · 112E', 'forwarder', 'mundra', -60),
      m('stuffing', 'Stuffed & e-sealed · Sachin', 'exporter', 'surat', -40),
      m('ewaybill', 'e-Way Bill generated', 'transporter', 'surat', -35),
      m('departFactory', 'Trailer departed Surat', 'transporter', 'surat', road.startH),
      m('shippingBill', 'Shipping Bill filed', 'broker', 'mundra', -22),
      m('gateIn', 'Gate-in · Mundra MICT', 'transporter', 'mundra', gateIn),
      m('leo', 'Customs cleared · LEO', 'broker', 'mundra', leoPlanned, {
        manual: true,
        actualH: leoActual,
        blocked: hold === 'active' ? 'RMS hold' : undefined,
      }),
      m('loaded', 'Loaded · MV Kutch Pioneer', 'forwarder', 'mundra', loaded, {
        atRisk: rolled ? 'Rolled to next sailing' : undefined,
      }),
      m('atd', 'Departed Mundra', 'forwarder', 'mundra', atd),
      m('transit', 'Strait of Hormuz', 'forwarder', 'jebelAli', timeAtFraction(seaLeg.segs, hormuzF)),
      m('ata', 'Arrived Jebel Ali', 'forwarder', 'jebelAli', seaLeg.endH),
      m('delivered', 'Released · JAFZA', 'exporter', 'jafza', delivered),
    ],
    {
      legs,
      gateInH: gateIn,
      deliveredH: delivered,
      ataH: seaLeg.endH,
      rolled,
      cutoffH: SURAT.cutoffH,
      baton: [
        { m: 'gateIn', role: 'transporter', task: 'Trailer run to Mundra' },
        { m: 'leo', role: 'broker', task: hold === 'active' ? 'Customs examination · RMS hold' : 'Export customs clearance' },
        { m: 'ata', role: 'forwarder', task: 'Feeder to Jebel Ali' },
        { m: 'delivered', role: 'forwarder', task: 'Discharge & JAFZA release' },
      ],
      finalBaton: { role: 'exporter', task: 'Released to the consignee' },
      alert: hold === 'active' ? { legId: 'sea', from: 0, to: 0.12 } : null,
      risks: [{ legId: 'sea', from: hormuzF - 0.05, to: hormuzF + 0.04, label: 'Strait of Hormuz' }],
      co2Kg: legs.reduce((s, l) => s + l.co2Kg, 0),
      totalKm: legs.reduce((s, l) => s + l.km, 0),
    },
  );
}
