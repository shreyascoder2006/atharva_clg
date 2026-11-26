/**
 * Lane templates for "+ New Shipment". Choosing one books a shipment on that lane and
 * registers its route with the globe at runtime, so the corridor draws itself in.
 *
 * Waypoints follow real sea lanes and great-circle air routes. Carriers, voyages and
 * rates are fictional.
 */
import type { LatLon } from '@/lib/geo';
import { ROUTES, type Mode, type RouteDef } from './shipment';

export interface LaneTemplate {
  id: string;
  label: string;
  origin: string;
  destination: string;
  destTz: string;
  mode: Mode;
  /** Pre-carriage by road, then the main leg drawn on the globe. */
  roadKm: number;
  roadFrom: string;
  route: RouteDef;
  transitH: number;
  /** Booking to pickup, hours. */
  leadH: number;
  cargo: string;
  hsCode: string;
  carrier: string;
  /** All-in freight estimate, USD per kg gross. */
  ratePerKg: number;
  focus: { cam: LatLon; camR: number };
}

const suez = ROUTES.seaSuez;

export const LANES: LaneTemplate[] = [
  {
    id: 'jnpt-ham',
    label: 'Nhava Sheva → Hamburg',
    origin: 'Pune',
    destination: 'Hamburg',
    destTz: 'Europe/Berlin',
    mode: 'sea',
    roadKm: 148,
    roadFrom: 'Chakan',
    route: {
      id: 'lane-jnpt-ham',
      mode: 'sea',
      label: 'JNPT → Suez → Rotterdam → Hamburg',
      windiness: 1,
      liftScale: 0.8,
      waypoints: [...suez.waypoints, [52.8, 4.1], [53.72, 6.6], [53.93, 8.45], [53.54, 9.97]],
      touchdowns: [...(suez.touchdowns ?? []), suez.waypoints.length + 3],
    },
    transitH: 26 * 24,
    leadH: 18,
    cargo: 'Forged crankshafts',
    hsCode: '8483.10',
    carrier: 'MV Konkan Meridian 049W',
    ratePerKg: 0.27,
    focus: { cam: [30, 40], camR: 3.3 },
  },
  {
    id: 'maa-sin',
    label: 'Chennai → Singapore',
    origin: 'Sriperumbudur',
    destination: 'Singapore',
    destTz: 'Asia/Singapore',
    mode: 'sea',
    roadKm: 42,
    roadFrom: 'Sriperumbudur',
    route: {
      id: 'lane-maa-sin',
      mode: 'sea',
      label: 'Chennai → Malacca Strait → Singapore',
      windiness: 1,
      liftScale: 0.8,
      waypoints: [
        [13.08, 80.3],
        [11.6, 82.4],
        [8.2, 87.8],
        [6.3, 94.2],
        [5.9, 97.4],
        [4.1, 99.7],
        [2.6, 101.2],
        [1.26, 103.84],
      ],
      touchdowns: [0, 7],
    },
    transitH: 5 * 24,
    leadH: 12,
    cargo: 'Automotive wiring harnesses',
    hsCode: '8544.30',
    carrier: 'MV Bay Express 112E',
    ratePerKg: 0.12,
    focus: { cam: [6, 92], camR: 2.3 },
  },
  {
    id: 'del-jfk',
    label: 'Delhi → New York JFK',
    origin: 'Manesar',
    destination: 'New York',
    destTz: 'America/New_York',
    mode: 'air',
    roadKm: 46,
    roadFrom: 'Manesar',
    route: {
      id: 'lane-del-jfk',
      mode: 'air',
      label: 'DEL → JFK',
      windiness: 1,
      waypoints: [
        [28.56, 77.1],
        [40.64, -73.78],
      ],
      touchdowns: [0, 1],
    },
    transitH: 34,
    leadH: 10,
    cargo: 'Pharmaceutical APIs · 15–25 °C',
    hsCode: '2941.90',
    carrier: 'Skybridge Cargo SKB 104',
    ratePerKg: 3.1,
    focus: { cam: [55, 18], camR: 3.4 },
  },
  {
    id: 'bom-lhr',
    label: 'Mumbai → London Heathrow',
    origin: 'Bhiwandi',
    destination: 'London',
    destTz: 'Europe/London',
    mode: 'air',
    roadKm: 38,
    roadFrom: 'Bhiwandi',
    route: {
      id: 'lane-bom-lhr',
      mode: 'air',
      label: 'BOM → LHR',
      windiness: 1,
      waypoints: [
        [19.09, 72.87],
        [51.47, -0.45],
      ],
      touchdowns: [0, 1],
    },
    transitH: 20,
    leadH: 8,
    cargo: 'Hand-knotted wool rugs',
    hsCode: '5701.10',
    carrier: 'Skybridge Cargo SKB 211',
    ratePerKg: 2.4,
    focus: { cam: [40, 36], camR: 2.9 },
  },
];

export const LANE_BY_ID = Object.fromEntries(LANES.map((l) => [l.id, l])) as Record<string, LaneTemplate>;

/** A shipment booked from the "+ New Shipment" modal. */
export interface CustomShipment {
  id: string;
  laneId: string;
  cargo: string;
  grossKg: number;
  valueUsd: number;
  exporter: string;
  forwarder: string;
  createdH: number;
  startH: number;
  endH: number;
}
