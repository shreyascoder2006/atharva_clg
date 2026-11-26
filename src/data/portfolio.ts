/**
 * Watch-list shipments: the rest of the book, tracked from carrier feeds.
 *
 * They ride three of the ambient corridors on the globe. They have no stakeholder
 * workflow of their own, so "Track on 3D Globe" flies to their corridor instead of
 * selecting them. Every company, vessel and number here is fictional.
 */
import type { LatLon } from '@/lib/geo';
import type { Tone } from '@/lib/palette';
import type { Mode, Role, RouteId } from './shipment';

export interface WatchLeg {
  mode: Mode;
  km: number;
  from: string;
  to: string;
}

export interface WatchShipment {
  id: string;
  origin: string;
  destination: string;
  destTz: string;
  direction: 'Export' | 'Import' | 'Cross-trade';
  routeId: RouteId;
  /** Camera pose for "Track on 3D Globe". */
  focus: { cam: LatLon; camR: number };
  legs: WatchLeg[];
  /** Hours relative to app load, as in the schedule engine. */
  startH: number;
  endH: number;
  plannedEndH: number;
  cargo: string;
  hsCode: string;
  grossKg: number;
  valueUsd: number;
  incoterm: string;
  carrier: string;
  exporter: string;
  forwarder: string;
  baton: Role;
  batonTask: string;
  /** Overrides the time-derived status when something is wrong. */
  issue?: { label: string; tone: Tone };
}

export const WATCHLIST: WatchShipment[] = [
  {
    id: 'SHP-2611-0466',
    origin: 'Shanghai',
    destination: 'JNPT',
    destTz: 'Asia/Kolkata',
    direction: 'Import',
    routeId: 'ambShanghaiJnpt',
    focus: { cam: [6, 92], camR: 2.5 },
    legs: [
      { mode: 'sea', km: 4120, from: 'Shanghai', to: 'Singapore' },
      { mode: 'sea', km: 3940, from: 'Singapore', to: 'JNPT' },
      { mode: 'road', km: 92, from: 'JNPT', to: 'Taloja' },
    ],
    startH: -262,
    endH: 74,
    plannedEndH: 74,
    cargo: 'CNC spindle motors & servo drives',
    hsCode: '8501.52',
    grossKg: 18420,
    valueUsd: 248300,
    incoterm: 'FOB Shanghai',
    carrier: 'MV Pacific Lantern 218W',
    exporter: 'Taloja Machine Tools Pvt Ltd',
    forwarder: 'Arabian Gateway Logistics',
    baton: 'forwarder',
    batonTask: 'Pre-file Bill of Entry before berthing',
  },
  {
    id: 'SHP-2611-0507',
    origin: 'Chennai',
    destination: 'Felixstowe',
    destTz: 'Europe/London',
    direction: 'Export',
    routeId: 'ambChennaiFelixstowe',
    focus: { cam: [22, 41], camR: 2.6 },
    legs: [
      { mode: 'road', km: 38, from: 'Sriperumbudur', to: 'Chennai' },
      { mode: 'sea', km: 720, from: 'Chennai', to: 'Colombo' },
      { mode: 'sea', km: 11460, from: 'Colombo', to: 'Felixstowe' },
    ],
    startH: -214,
    endH: 302,
    plannedEndH: 284,
    cargo: 'Two-wheeler alloy wheels',
    hsCode: '8714.10',
    grossKg: 15960,
    valueUsd: 131700,
    incoterm: 'CIF Felixstowe',
    carrier: 'MV Coromandel Star 061W',
    exporter: 'Kanchi Alloy Castings Ltd',
    forwarder: 'Arabian Gateway Logistics',
    baton: 'forwarder',
    batonTask: 'Rebook UK haulage after the Colombo roll',
    issue: { label: 'Delayed +18h', tone: 'amber' },
  },
  {
    id: 'SHP-2611-0531',
    origin: 'Jebel Ali',
    destination: 'Mombasa',
    destTz: 'Africa/Nairobi',
    direction: 'Cross-trade',
    routeId: 'ambJebelAliMombasa',
    focus: { cam: [7, 52], camR: 2.3 },
    legs: [
      { mode: 'sea', km: 3780, from: 'Jebel Ali', to: 'Mombasa' },
      { mode: 'road', km: 18, from: 'Mombasa', to: 'Changamwe ICD' },
    ],
    startH: -236,
    endH: -20,
    plannedEndH: -26,
    cargo: 'Solar inverters & mounting kits',
    hsCode: '8504.40',
    grossKg: 9840,
    valueUsd: 87400,
    incoterm: 'CFR Mombasa',
    carrier: 'MV Zanzibar Tide 044S',
    exporter: 'Gulf Sunworks FZE',
    forwarder: 'Arabian Gateway Logistics',
    baton: 'exporter',
    batonTask: 'Delivered · awaiting buyer sign-off',
  },
];

export const WATCH_BY_ID = Object.fromEntries(WATCHLIST.map((w) => [w.id, w])) as Record<string, WatchShipment>;

/** Trailing 8-week on-time rate, as a percentage. The last point is this week. */
export const OTP_TREND = [91.8, 92.6, 93.1, 92.4, 93.8, 94.0, 93.6, 94.2];
/** Active shipments per week, last 8 weeks. */
export const ACTIVE_TREND = [4, 5, 5, 4, 6, 5, 6, 6];
/** Exceptions per week (holds, rolls, mismatches), last 8 weeks. */
export const RISK_TREND = [3, 2, 4, 3, 2, 3, 2, 3];
/** Cargo value in flight, USD millions, last 8 weeks. */
export const VALUE_TREND = [0.84, 0.91, 0.88, 0.97, 1.02, 0.99, 1.06, 1.12];
