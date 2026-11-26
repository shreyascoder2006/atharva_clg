/**
 * Pre-seeded shipment universe.
 *
 * Coordinates, UN/LOCODEs and the ULIP connector names are real. Every company, person,
 * vessel and document number is fictional. The container number is a valid
 * ISO 6346 code (see lib/iso6346.ts), so the check digit holds up to scrutiny.
 */
import type { LatLon } from '@/lib/geo';
import type { Tone } from '@/lib/palette';
import { containerId } from '@/lib/iso6346';

// --- Roles -------------------------------------------------------------------

export type Role = 'exporter' | 'forwarder' | 'broker' | 'transporter';
export const ROLE_ORDER: Role[] = ['exporter', 'forwarder', 'broker', 'transporter'];

export interface RoleMeta {
  id: Role;
  label: string;
  short: string;
  org: string;
  person: string;
  title: string;
  initials: string;
  tone: Tone;
  /** Where the camera flies when this lens is chosen, in words. */
  zoneLabel: string;
}

export const ROLES: Record<Role, RoleMeta> = {
  exporter: {
    id: 'exporter',
    label: 'Exporter',
    short: 'EXP',
    org: 'Deccan Precision Components Pvt Ltd',
    person: 'Ananya Kulkarni',
    title: 'Head of Exports · Chakan',
    initials: 'AK',
    tone: 'cobalt',
    zoneLabel: 'Global corridor',
  },
  forwarder: {
    id: 'forwarder',
    label: 'Freight Forwarder',
    short: 'FF',
    org: 'Arabian Gateway Logistics',
    person: 'Farhan Shaikh',
    title: 'Ocean Ops Lead · Navi Mumbai',
    initials: 'FS',
    tone: 'indigo',
    zoneLabel: 'Ocean leg · Arabian Sea',
  },
  broker: {
    id: 'broker',
    label: 'Customs Broker',
    short: 'CHA',
    org: 'Nhava Sheva Clearing House',
    person: 'Priya Menon',
    title: 'Licensed CHA · JNPT',
    initials: 'PM',
    tone: 'emerald',
    zoneLabel: 'JNPT port gate',
  },
  transporter: {
    id: 'transporter',
    label: 'Transporter',
    short: 'TRN',
    org: 'Sahyadri Roadlines',
    person: 'Ramesh Patil',
    title: 'Driver · MH12 TX 4471',
    initials: 'RP',
    tone: 'violet',
    zoneLabel: 'Pune → JNPT inland leg',
  },
};

// --- Places ------------------------------------------------------------------

export interface Place {
  id: string;
  name: string;
  sub?: string;
  code?: string;
  at: LatLon;
}

const P = <T extends Record<string, Omit<Place, 'id'>>>(m: T) =>
  Object.fromEntries(Object.entries(m).map(([id, p]) => [id, { id, ...p }])) as {
    [K in keyof T]: Place;
  };

export const PLACES = P({
  chakan: { name: 'Chakan MIDC', sub: 'Factory · Pune', at: [18.7606, 73.8636] },
  talegaon: { name: 'Talegaon ICD', sub: 'Rail-linked depot', at: [18.7352, 73.6755] },
  lonavala: { name: 'Lonavala', at: [18.7537, 73.4074] },
  khandala: { name: 'Khandala Ghat', sub: 'Expressway ghat section', at: [18.7647, 73.3721] },
  panvel: { name: 'Panvel', at: [18.9894, 73.1175] },
  mumbai: { name: 'Mumbai', at: [18.9388, 72.8354] },
  jnpt: { name: 'JNPT · Nhava Sheva', sub: 'Gate 4', code: 'INNSA', at: [18.949, 72.951] },
  jebelAli: { name: 'Jebel Ali', code: 'AEJEA', at: [25.0113, 55.0612] },
  dwc: { name: 'Dubai World Central', code: 'DWC', at: [24.896, 55.161] },
  babElMandeb: { name: 'Bab-el-Mandeb', sub: 'Chokepoint', at: [12.58, 43.33] },
  suez: { name: 'Suez Canal', code: 'EGSUZ', at: [30.58, 32.27] },
  gibraltar: { name: 'Gibraltar', sub: 'Strait', at: [35.95, -5.6] },
  cape: { name: 'Cape of Good Hope', at: [-34.36, 18.47] },
  rotterdam: { name: 'Port of Rotterdam', sub: 'Maasvlakte II', code: 'NLRTM', at: [51.9496, 4.1453] },
  schiphol: { name: 'Amsterdam Schiphol', code: 'AMS', at: [52.3105, 4.7683] },
  duisburg: { name: 'Duisburg · duisport', sub: 'Consignee DC', code: 'DEDUI', at: [51.4344, 6.7623] },

  // SHP-2611-0519 · Bengaluru → Frankfurt (air)
  ecity: { name: 'Electronic City', sub: 'Pharma plant · Bengaluru', at: [12.8456, 77.6603] },
  blr: { name: 'Bengaluru Air Cargo', sub: 'Kempegowda Intl', code: 'BLR', at: [13.1986, 77.7066] },
  fra: { name: 'Frankfurt CargoCity', code: 'FRA', at: [50.0379, 8.5622] },
  morfelden: { name: 'Mörfelden', sub: 'Pharma DC', at: [49.977, 8.567] },

  // SHP-2611-0494 · Surat → Mundra → Jebel Ali (sea)
  surat: { name: 'Surat · Sachin GIDC', sub: 'Yarn mill', at: [21.087, 72.885] },
  mundra: { name: 'Mundra', sub: 'MICT', code: 'INMUN', at: [22.7396, 69.7036] },
  jafza: { name: 'JAFZA', sub: 'Consignee DC', at: [24.988, 55.11] },

  // Ambient network corridors
  shanghai: { name: 'Shanghai · Yangshan', code: 'CNSHA', at: [30.63, 122.07] },
  singapore: { name: 'Singapore', code: 'SGSIN', at: [1.264, 103.84] },
  chennai: { name: 'Chennai', code: 'INMAA', at: [13.095, 80.3] },
  colombo: { name: 'Colombo', code: 'LKCMB', at: [6.95, 79.84] },
  felixstowe: { name: 'Felixstowe', code: 'GBFXT', at: [51.955, 1.335] },
  newark: { name: 'New York · Newark', code: 'USEWR', at: [40.684, -74.145] },
  mombasa: { name: 'Mombasa', code: 'KEMBA', at: [-4.065, 39.665] },
});

export type PlaceId = keyof typeof PLACES;

/** The three interactive shipments on the platform. 0482 carries the full workflow. */
export type ShipmentId = 'SHP-2611-0482' | 'SHP-2611-0519' | 'SHP-2611-0494';
export const SHIPMENT_IDS: ShipmentId[] = ['SHP-2611-0482', 'SHP-2611-0519', 'SHP-2611-0494'];
export const FLAGSHIP = 'SHP-2611-0482' as const satisfies ShipmentId;

// --- Routes ------------------------------------------------------------------

export type Mode = 'road' | 'rail' | 'sea' | 'air';

export interface RouteDef {
  id: string;
  mode: Mode;
  label: string;
  waypoints: LatLon[];
  /**
   * Indices into `waypoints` where an elevated sea or air arc touches back down:
   * chokepoints and transhipment hubs. The arc lifts between them.
   */
  touchdowns?: number[];
  /** Road and rail are longer than the great-circle chord through the waypoints. */
  windiness: number;
  /** Multiplier on the hop lift. Ambient corridors sit lower than the primary arcs. */
  liftScale?: number;
}

const roadPrefix: LatLon[] = [
  PLACES.chakan.at,
  [18.7468, 73.8012],
  [18.7398, 73.7316],
  PLACES.talegaon.at,
];

export const ROUTES = {
  roadExpressway: {
    id: 'roadExpressway',
    mode: 'road',
    label: 'Mumbai–Pune Expressway',
    windiness: 1.16,
    waypoints: [
      ...roadPrefix,
      [18.7222, 73.6216],
      [18.7336, 73.5293],
      PLACES.lonavala.at,
      PLACES.khandala.at,
      [18.7905, 73.3328],
      [18.8296, 73.2865],
      [18.8946, 73.2086],
      [18.9563, 73.1517],
      PLACES.panvel.at,
      [18.9784, 73.0567],
      [18.9612, 72.9993],
      PLACES.jnpt.at,
    ],
  },
  roadNh48: {
    id: 'roadNh48',
    mode: 'road',
    label: 'Old NH-48 via Khopoli',
    windiness: 1.2,
    waypoints: [
      ...roadPrefix,
      [18.7625, 73.6012],
      [18.7676, 73.5502],
      [18.7612, 73.4651],
      PLACES.lonavala.at,
      [18.7773, 73.3612],
      [18.7883, 73.3441],
      [18.8318, 73.3047],
      [18.9012, 73.2496],
      [18.9842, 73.1852],
      [19.0087, 73.1322],
      PLACES.panvel.at,
      [18.9714, 73.0371],
      PLACES.jnpt.at,
    ],
  },
  roadToIcd: {
    id: 'roadToIcd',
    mode: 'road',
    label: 'Chakan → Talegaon ICD',
    windiness: 1.16,
    waypoints: roadPrefix,
  },
  railIcd: {
    id: 'railIcd',
    mode: 'rail',
    label: 'CONCOR rake · Talegaon ICD → JNPT',
    windiness: 1.1,
    waypoints: [
      PLACES.talegaon.at,
      [18.7601, 73.5598],
      PLACES.lonavala.at,
      [18.8022, 73.3517],
      [18.9112, 73.3238],
      [18.9654, 73.2255],
      PLACES.panvel.at,
      [18.9681, 73.0247],
      [18.9555, 72.9662],
      PLACES.jnpt.at,
    ],
  },
  seaSuez: {
    id: 'seaSuez',
    mode: 'sea',
    label: 'JNPT → Suez → Rotterdam',
    windiness: 1,
    touchdowns: [0, 6, 13, 22, 33],
    waypoints: [
      PLACES.jnpt.at,
      [18.62, 72.4],
      [16.4, 66.0],
      [14.0, 56.8],
      [12.75, 50.2],
      [12.2, 45.6],
      PLACES.babElMandeb.at, // 6
      [14.6, 42.15],
      [17.6, 40.2],
      [20.9, 38.3],
      [24.1, 36.15],
      [27.25, 34.1],
      [29.05, 32.75],
      PLACES.suez.at, // 13
      [31.32, 32.3],
      [32.7, 29.1],
      [34.1, 23.6],
      [35.55, 16.2],
      [37.35, 11.15],
      [37.55, 8.0],
      [37.0, 2.0],
      [36.15, -2.4],
      PLACES.gibraltar.at, // 22
      [36.4, -8.0],
      [37.05, -9.45],
      [40.1, -10.0],
      [43.25, -9.95],
      [46.6, -7.4],
      [48.65, -5.6],
      [49.75, -2.4],
      [50.62, 0.6],
      [51.08, 1.62],
      [51.66, 2.9],
      PLACES.rotterdam.at, // 33
    ],
  },
  seaCape: {
    id: 'seaCape',
    mode: 'sea',
    label: 'JNPT → Cape of Good Hope → Rotterdam',
    windiness: 1,
    touchdowns: [0, 9, 19, 27],
    waypoints: [
      PLACES.jnpt.at,
      [18.3, 71.6],
      [12.0, 66.2],
      [2.0, 59.5],
      [-8.5, 52.5],
      [-17.5, 43.2],
      [-25.5, 36.6],
      [-31.6, 30.8],
      [-35.2, 23.8],
      PLACES.cape.at, // 9
      [-31.5, 15.4],
      [-24.0, 10.6],
      [-14.0, 5.0],
      [-3.0, -2.0],
      [5.0, -12.5],
      [12.5, -19.0],
      [20.5, -19.5],
      [28.0, -16.4],
      [33.8, -12.9],
      [37.05, -9.45], // 19
      [40.1, -10.0],
      [43.25, -9.95],
      [46.6, -7.4],
      [48.65, -5.6],
      [49.75, -2.4],
      [50.62, 0.6],
      [51.66, 2.9],
      PLACES.rotterdam.at, // 27
    ],
  },
  seaFeederJebelAli: {
    id: 'seaFeederJebelAli',
    mode: 'sea',
    label: 'JNPT → Jebel Ali feeder',
    windiness: 1,
    touchdowns: [0, 6],
    waypoints: [
      PLACES.jnpt.at,
      [19.4, 69.5],
      [22.3, 62.6],
      [25.3, 58.0],
      [26.45, 56.6],
      [25.75, 55.6],
      PLACES.jebelAli.at,
    ],
  },
  airDwcAms: {
    id: 'airDwcAms',
    mode: 'air',
    label: 'DWC → AMS air bridge',
    windiness: 1,
    touchdowns: [0, 1],
    waypoints: [PLACES.dwc.at, PLACES.schiphol.at],
  },
  railBetuwe: {
    id: 'railBetuwe',
    mode: 'rail',
    label: 'Betuweroute · Rotterdam → Duisburg',
    windiness: 1.08,
    waypoints: [
      PLACES.rotterdam.at,
      [51.89, 4.52],
      [51.88, 5.28],
      [51.93, 6.07],
      [51.83, 6.25],
      PLACES.duisburg.at,
    ],
  },
  roadAmsDuisburg: {
    id: 'roadAmsDuisburg',
    mode: 'road',
    label: 'A12/A3 · Schiphol → Duisburg',
    windiness: 1.18,
    waypoints: [PLACES.schiphol.at, [52.09, 5.12], [51.98, 5.9], [51.82, 6.4], PLACES.duisburg.at],
  },
  // --- SHP-2611-0519 · Bengaluru → Frankfurt ---------------------------------
  roadEcityBlr: {
    id: 'roadEcityBlr',
    mode: 'road',
    label: 'Reefer · Electronic City → BLR cargo',
    windiness: 1.18,
    waypoints: [
      PLACES.ecity.at,
      [12.885, 77.645],
      [12.917, 77.623],
      [12.957, 77.7],
      [13.007, 77.695],
      [13.04, 77.64],
      [13.08, 77.63],
      [13.13, 77.66],
      PLACES.blr.at,
    ],
  },
  airBlrFra: {
    id: 'airBlrFra',
    mode: 'air',
    label: 'SKB 761 · BLR → FRA',
    windiness: 1,
    touchdowns: [0, 1],
    waypoints: [PLACES.blr.at, PLACES.fra.at],
  },
  roadFraMorfelden: {
    id: 'roadFraMorfelden',
    mode: 'road',
    label: 'Cool van · FRA → Mörfelden',
    windiness: 1.2,
    waypoints: [PLACES.fra.at, [50.012, 8.581], PLACES.morfelden.at],
  },

  // --- SHP-2611-0494 · Surat → Mundra → Jebel Ali -----------------------------
  roadSuratMundra: {
    id: 'roadSuratMundra',
    mode: 'road',
    label: 'NH-48 / NH-41 · Surat → Mundra',
    windiness: 1.14,
    waypoints: [
      PLACES.surat.at,
      [21.7, 72.98],
      [22.3, 73.18],
      [22.99, 72.6],
      [23.12, 72.03],
      [23.09, 70.77],
      [23.29, 70.34],
      [23.08, 70.13],
      PLACES.mundra.at,
    ],
  },
  seaMundraJebelAli: {
    id: 'seaMundraJebelAli',
    mode: 'sea',
    label: 'MV Kutch Pioneer 112E · Mundra → Jebel Ali',
    windiness: 1,
    touchdowns: [0, 5, 7],
    waypoints: [
      PLACES.mundra.at,
      [22.55, 69.0],
      [22.6, 67.5],
      [24.0, 63.0],
      [25.2, 58.6],
      [26.45, 56.6],
      [25.75, 55.6],
      PLACES.jebelAli.at,
    ],
  },

  // --- Ambient network corridors ---------------------------------------------
  ambShanghaiJnpt: {
    id: 'ambShanghaiJnpt',
    mode: 'sea',
    label: 'Shanghai → Singapore → JNPT',
    windiness: 1,
    liftScale: 0.45,
    touchdowns: [0, 6, 14],
    waypoints: [
      PLACES.shanghai.at,
      [24.6, 119.8],
      [18.0, 114.6],
      [10.0, 109.6],
      [5.0, 105.6],
      [2.6, 104.6],
      PLACES.singapore.at,
      [2.6, 101.2],
      [5.9, 97.4],
      [6.0, 90.0],
      [5.6, 80.6],
      [7.9, 76.4],
      [12.8, 73.4],
      [17.6, 72.6],
      PLACES.jnpt.at,
    ],
  },
  ambChennaiFelixstowe: {
    id: 'ambChennaiFelixstowe',
    mode: 'sea',
    label: 'Chennai → Colombo → Felixstowe',
    windiness: 1,
    liftScale: 0.45,
    touchdowns: [0, 2, 7, 13, 21, 30],
    waypoints: [
      PLACES.chennai.at,
      [10.8, 81.2],
      PLACES.colombo.at,
      [6.4, 75.8],
      [10.2, 64.0],
      [12.6, 52.0],
      [12.0, 45.4],
      [12.35, 43.5],
      [15.0, 41.9],
      [18.2, 39.9],
      [22.0, 37.6],
      [26.6, 34.6],
      [29.2, 32.9],
      [30.45, 32.35],
      [32.9, 29.6],
      [34.4, 22.8],
      [35.9, 15.4],
      [37.6, 10.0],
      [37.3, 4.0],
      [36.4, -1.6],
      [36.1, -5.4],
      [36.7, -8.6],
      [40.3, -10.4],
      [43.6, -10.3],
      [46.9, -7.9],
      [48.9, -6.1],
      [49.9, -2.9],
      [50.7, 0.2],
      [51.2, 1.7],
      [51.6, 1.65],
      PLACES.felixstowe.at,
    ],
  },
  ambRotterdamNewark: {
    id: 'ambRotterdamNewark',
    mode: 'sea',
    label: 'Rotterdam → New York / Newark',
    windiness: 1,
    liftScale: 0.45,
    touchdowns: [0, 9],
    waypoints: [
      PLACES.rotterdam.at,
      [51.75, 2.6],
      [50.9, 1.0],
      [50.1, -2.4],
      [49.4, -6.6],
      [47.6, -20.0],
      [44.6, -38.0],
      [41.8, -56.0],
      [40.3, -69.0],
      PLACES.newark.at,
    ],
  },
  ambJebelAliMombasa: {
    id: 'ambJebelAliMombasa',
    mode: 'sea',
    label: 'Jebel Ali → Mombasa',
    windiness: 1,
    liftScale: 0.45,
    touchdowns: [0, 3, 8],
    waypoints: [
      PLACES.jebelAli.at,
      [25.95, 55.9],
      [26.35, 56.75],
      [24.6, 58.7],
      [20.5, 60.4],
      [13.5, 56.0],
      [5.0, 50.6],
      [-1.8, 43.6],
      PLACES.mombasa.at,
    ],
  },
} satisfies Record<string, RouteDef>;

export type RouteId = keyof typeof ROUTES;

export type RoadVariant = 'expressway' | 'nh48' | 'rail';
export type SeaVariant = 'suez' | 'cape' | 'seaair';

/** Cruise speeds in km/h, including typical congestion for the mode. */
export const SPEED_KMH: Record<Mode, number> = {
  road: 42,
  rail: 36,
  sea: 29.6, // 16 knots
  air: 780,
};

// --- Shipment identity -------------------------------------------------------

export const CONTAINER = containerId('OSP', 'U', '482190');

export const SHIPMENT = {
  id: 'SHP-2611-0482',
  container: CONTAINER,
  seal: 'ES-8842117',
  equipment: "40' High Cube",
  cargo: 'Machined gearbox housings & transmission shafts',
  hsCode: '8708.40',
  packages: '36 PLT',
  grossKg: 12850,
  netKg: 11620,
  invoiceValueUsd: 186420,
  incoterm: 'CIF Rotterdam',
  vessel: 'MV Konkan Meridian',
  voyage: '047W',
  truck: 'MH12 TX 4471',
  driver: 'Ramesh Patil',
  bookingRef: 'AGL-047W-0482',
  ewayBill: 'EWB 3718 4462 0915',
  shippingBill: 'SB 4471823',
  consignee: 'Rhein-Ruhr Antriebstechnik GmbH',
  consigneeCity: 'Duisburg, DE',
  shipper: 'Deccan Precision Components Pvt Ltd',
  shipperCity: 'Chakan MIDC, Pune 410501',
} as const;

// --- Schedule constants (hours relative to the moment the app loaded) ---------

export const T = {
  /** Truck left the factory. Sets how far along the road leg LIVE starts. */
  departFactory: -0.3,
  examineH: 4,
  vgmPlanned: 9,
  cutoff: 14,
  loadPlanned: 16,
  sailAfterLoadH: 6,
  eblAfterSailH: 2,
  lcAfterEblH: 4,
  canalTransitH: 12,
  dischargeDwellH: 30,
  feederTranshipH: 20,
  airHandlingH: 14,
  nextSailingShiftH: 72,
  icdTransloadH: 1.5,
  scrubMin: -48,
  scrubMax: 96,
} as const;

// --- Milestones ----------------------------------------------------------------

export type MilestoneId =
  | 'invoice'
  | 'booking'
  | 'stuffing'
  | 'ewaybill'
  | 'shippingBill'
  | 'departFactory'
  | 'gateIn'
  | 'leo'
  | 'vgm'
  | 'loaded'
  | 'atd'
  | 'ebl'
  | 'lc'
  | 'transit'
  | 'ata'
  | 'delivered';

export interface MilestoneMeta {
  id: string;
  label: string;
  owner: Role;
  /** Where the milestone happens, for sonar ripples. */
  place: keyof typeof PLACES;
  /** Needs a person to act; the forecast alone never completes it at LIVE. */
  manual?: boolean;
}

export const MILESTONES: MilestoneMeta[] = [
  { id: 'invoice', label: 'Commercial Invoice issued', owner: 'exporter', place: 'chakan' },
  { id: 'booking', label: 'Booking confirmed · 047W', owner: 'forwarder', place: 'jnpt' },
  { id: 'stuffing', label: 'Stuffed & e-sealed', owner: 'exporter', place: 'chakan' },
  { id: 'ewaybill', label: 'e-Way Bill generated', owner: 'transporter', place: 'chakan' },
  { id: 'shippingBill', label: 'Shipping Bill filed', owner: 'broker', place: 'jnpt' },
  { id: 'departFactory', label: 'Truck departed Chakan', owner: 'transporter', place: 'chakan' },
  { id: 'gateIn', label: 'Gate-in · JNPT', owner: 'transporter', place: 'jnpt', manual: true },
  { id: 'leo', label: 'Customs cleared · LEO', owner: 'broker', place: 'jnpt', manual: true },
  { id: 'vgm', label: 'VGM submitted', owner: 'forwarder', place: 'jnpt', manual: true },
  { id: 'loaded', label: 'Loaded on vessel', owner: 'forwarder', place: 'jnpt' },
  { id: 'atd', label: 'Vessel departed', owner: 'forwarder', place: 'jnpt' },
  { id: 'ebl', label: 'e-BL issued', owner: 'forwarder', place: 'jnpt', manual: true },
  { id: 'lc', label: 'LC proceeds drawn', owner: 'exporter', place: 'chakan', manual: true },
  { id: 'transit', label: 'Suez transit', owner: 'forwarder', place: 'suez' },
  { id: 'ata', label: 'Arrived Rotterdam', owner: 'forwarder', place: 'rotterdam' },
  { id: 'delivered', label: 'Delivered · Duisburg', owner: 'exporter', place: 'duisburg' },
];

/** Already happened when the app opens. */
export const SEED_ACTUALS: Partial<Record<MilestoneId, number>> = {
  invoice: -46,
  booking: -40,
  stuffing: -8,
  ewaybill: -7,
  shippingBill: -6,
  departFactory: T.departFactory,
};

// --- Escrow ------------------------------------------------------------------

export interface EscrowLine {
  id: Role;
  party: string;
  amount: string;
  trigger: string;
  triggerLabel: string;
}

export const ESCROW: EscrowLine[] = [
  {
    id: 'transporter',
    party: 'Sahyadri Roadlines',
    amount: '₹18,500',
    trigger: 'gateIn',
    triggerLabel: 'on gate-in',
  },
  {
    id: 'broker',
    party: 'Nhava Sheva Clearing',
    amount: '₹14,200',
    trigger: 'leo',
    triggerLabel: 'on LEO',
  },
  {
    id: 'forwarder',
    party: 'Arabian Gateway',
    amount: '$2,140',
    trigger: 'loaded',
    triggerLabel: 'on shipped-on-board',
  },
  {
    id: 'exporter',
    party: 'Deccan Precision',
    amount: '$186,420',
    trigger: 'lc',
    triggerLabel: 'LC on e-BL',
  },
];

// --- Documents -------------------------------------------------------------------

export type Access = 'full' | 'redacted' | 'view' | 'none';

export interface DocMeta {
  id: string;
  name: string;
  ref: string;
  issuer: Role | 'customs' | 'gst';
  access: Record<Role, Access>;
  /** Shown when a role sees this document redacted or not at all. */
  restriction?: string;
}

export const DOCUMENTS: DocMeta[] = [
  {
    id: 'ci',
    name: 'Commercial Invoice',
    ref: 'DPC/EXP/26-27/0482',
    issuer: 'exporter',
    access: { exporter: 'full', forwarder: 'redacted', broker: 'full', transporter: 'none' },
    restriction: 'Commercial pricing is restricted to the Exporter and Customs Broker.',
  },
  {
    id: 'pl',
    name: 'Packing List',
    ref: 'PL-0482',
    issuer: 'exporter',
    access: { exporter: 'full', forwarder: 'full', broker: 'full', transporter: 'full' },
  },
  {
    id: 'ebl',
    name: 'e-Bill of Lading',
    ref: 'KMOL-047W-0482',
    issuer: 'forwarder',
    access: { exporter: 'full', forwarder: 'full', broker: 'view', transporter: 'none' },
    restriction: 'Title document. The Transporter never holds the e-BL.',
  },
  {
    id: 'sb',
    name: 'Shipping Bill',
    ref: SHIPMENT.shippingBill,
    issuer: 'customs',
    access: { exporter: 'view', forwarder: 'view', broker: 'full', transporter: 'none' },
    restriction: 'Customs declaration, filed by the CHA on ICEGATE.',
  },
  {
    id: 'ewb',
    name: 'e-Way Bill',
    ref: SHIPMENT.ewayBill,
    issuer: 'gst',
    access: { exporter: 'full', forwarder: 'none', broker: 'view', transporter: 'full' },
    restriction: 'Domestic GST movement document. Not needed past the port gate.',
  },
  {
    id: 'vgm',
    name: 'VGM Declaration',
    ref: 'VGM-JNPT-WB03-7741',
    issuer: 'forwarder',
    access: { exporter: 'view', forwarder: 'full', broker: 'view', transporter: 'view' },
  },
  {
    id: 'eir',
    name: 'Gate Pass / EIR',
    ref: 'PG-0482-G4',
    issuer: 'transporter',
    access: { exporter: 'none', forwarder: 'view', broker: 'view', transporter: 'full' },
    restriction: 'Terminal equipment interchange, for the haulier and forwarder.',
  },
  {
    id: 'coo',
    name: 'Certificate of Origin',
    ref: 'COO-IN-EU-2611-0482',
    issuer: 'exporter',
    access: { exporter: 'full', forwarder: 'view', broker: 'full', transporter: 'none' },
    restriction: 'Origin and preference evidence for the buyer and customs.',
  },
];

// --- Document X-Ray: the three trade documents compared field by field ---------

export type XrayFieldKey = 'consignee' | 'hs' | 'gross' | 'container';
export type XrayDocId = 'ci' | 'pl' | 'ebl';

export interface XrayField {
  key: XrayFieldKey;
  label: string;
}

export const XRAY_FIELDS: XrayField[] = [
  { key: 'consignee', label: 'Consignee' },
  { key: 'hs', label: 'HS Code' },
  { key: 'gross', label: 'Gross Weight' },
  { key: 'container', label: 'Container #' },
];

/** Each document lays its fields out in its own order, as real trade documents do. */
export const XRAY_LAYOUT: Record<XrayDocId, XrayFieldKey[]> = {
  ci: ['consignee', 'hs', 'gross', 'container'],
  pl: ['container', 'consignee', 'gross', 'hs'],
  ebl: ['consignee', 'container', 'hs', 'gross'],
};

export const XRAY_VALUES: Record<XrayDocId, Record<XrayFieldKey, string>> = {
  ci: {
    consignee: `${SHIPMENT.consignee}, Duisburg`,
    hs: SHIPMENT.hsCode,
    gross: '12,400 kg',
    container: CONTAINER,
  },
  pl: {
    consignee: `${SHIPMENT.consignee}, Duisburg`,
    hs: SHIPMENT.hsCode,
    gross: '12,850 kg',
    container: CONTAINER,
  },
  ebl: {
    consignee: `${SHIPMENT.consignee}, Duisburg`,
    hs: SHIPMENT.hsCode,
    gross: '12,850 kg',
    container: CONTAINER,
  },
};

export const XRAY_FIX = {
  doc: 'ci' as XrayDocId,
  field: 'gross' as XrayFieldKey,
  from: '12,400 kg',
  to: '12,850 kg',
  rationale:
    'The invoice gross weight was derived from net weight plus a standard 780 kg packing allowance. The Packing List (36 pallets × 34.2 kg tare) and the JNPT weighbridge VGM reading (12,846 kg, WB-03) agree on 12,850 kg. The Commercial Invoice is amended. Value, HS code and Incoterm are unchanged.',
  confidence: 0.97,
};

// --- Disruptions and AI recovery ---------------------------------------------------

export type DisruptionKind = 'customs_hold' | 'highway_delay' | 'red_sea';

export interface RecoveryOption {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  /** Incremental cost of executing the plan, USD. Time and CO2 come from the schedule. */
  costUsd: number;
  confidence: number;
  recommended?: boolean;
}

export interface DisruptionDef {
  kind: DisruptionKind;
  title: string;
  short: string;
  where: string;
  place: keyof typeof PLACES;
  detail: string;
  /** Projected demurrage and detention, USD per day. */
  ratePerDay: number;
  options: [RecoveryOption, RecoveryOption];
}

export const DISRUPTIONS: Record<DisruptionKind, DisruptionDef> = {
  customs_hold: {
    kind: 'customs_hold',
    title: 'Customs HS Code Hold',
    short: 'HS hold',
    where: 'JNPT · ICEGATE RMS',
    place: 'jnpt',
    detail:
      'ICEGATE RMS flagged the Shipping Bill. The description "transmission shafts" suggests CTH 8483.10 rather than the declared 8708.40. Examination order raised; LEO withheld.',
    ratePerDay: 1450,
    options: [
      {
        id: 'ai_reclass',
        title: 'AI classification brief + e-Sanchit upload',
        summary:
          'Co-Pilot drafts a reasoned note (GIR 1 & 6, Section XVII Note 2(e)) with drawings and mill test certificates, and asks RMS to re-assess the Shipping Bill.',
        steps: [
          'Draft classification note',
          'Attach drawings to e-Sanchit',
          'Request RMS re-assessment',
        ],
        costUsd: 180,
        confidence: 0.86,
        recommended: true,
      },
      {
        id: 'cfs_roll',
        title: 'Move to CFS & roll to next sailing',
        summary:
          'Shift the box to Uran CFS to stop terminal demurrage and rebook it on MV Arabian Crest 049W while the query is answered by post.',
        steps: ['Book CFS slot', 'Rebook on 049W', 'Notify consignee of +3 days'],
        costUsd: 960,
        confidence: 0.98,
      },
    ],
  },
  highway_delay: {
    kind: 'highway_delay',
    title: '6-Hour Highway Delay',
    short: 'Ghat delay',
    where: 'Khandala Ghat · Expressway',
    place: 'khandala',
    detail:
      'Multi-trailer pile-up in the Khandala ghat section, Pune → Mumbai carriageway. Highway Police estimate six hours. The FASTag gap at Khalapur plaza confirms the standstill.',
    ratePerDay: 960,
    options: [
      {
        id: 'nh48',
        title: 'Divert via old NH-48 ghat (Khopoli)',
        summary:
          'Leave at Lonavala onto the old Mumbai–Pune highway and rejoin at Panvel. The pre-gate token is rebooked for a later slot at Gate 4.',
        steps: ['Push new route to driver', 'Rebook pre-gate slot', 'Re-validate e-Way Bill'],
        costUsd: 29,
        confidence: 0.91,
        recommended: true,
      },
      {
        id: 'rail',
        title: 'Transload at Talegaon ICD → CONCOR rail',
        summary:
          'Put the box on the 18:40 CONCOR double-stack rake from Talegaon ICD to JNPT rail yard. It avoids the ghat entirely and cuts road emissions.',
        steps: ['Reserve rake slot', 'Transload at ICD', 'Port rail gate-in'],
        costUsd: 310,
        confidence: 0.84,
      },
    ],
  },
  red_sea: {
    kind: 'red_sea',
    title: 'Red Sea Security Advisory',
    short: 'Red Sea',
    where: 'Bab-el-Mandeb · listed area',
    place: 'babElMandeb',
    detail:
      'Joint maritime advisory upgraded for the southern Red Sea. War-risk premiums are up 0.7% of hull value and the carrier is weighing a diversion. Transit through Bab-el-Mandeb is not assured.',
    ratePerDay: 2300,
    options: [
      {
        id: 'cape',
        title: 'Reroute via Cape of Good Hope',
        summary:
          'Stay on MV Konkan Meridian and divert around Africa. No war-risk surcharge and lower insurance, but about eleven extra days and more bunker fuel.',
        steps: ['Accept carrier diversion', 'Update buyer ETA', 'Extend LC validity'],
        costUsd: 1850,
        confidence: 0.94,
        recommended: true,
      },
      {
        id: 'seaair',
        title: 'Sea-air via Jebel Ali → AMS',
        summary:
          'Feeder to Jebel Ali, then a DWC–Schiphol freighter and road to Duisburg. It arrives more than a week early but costs much more in emissions.',
        steps: ['Book feeder & ULD space', 'Transhipment at Jebel Ali', 'Road from AMS'],
        costUsd: 6400,
        confidence: 0.79,
      },
    ],
  },
};

// --- Port congestion --------------------------------------------------------------

export interface PortCongestion {
  id: string;
  name: string;
  code: string;
  at: LatLon;
  /** Container dwell time in days. Drives pillar height. */
  dwellDays: number;
  yardUtil: number;
  berthWaitH: number;
  trend: number;
}

export const PORTS: PortCongestion[] = [
  { id: 'jnpt', name: 'JNPT', code: 'INNSA', at: PLACES.jnpt.at, dwellDays: 2.6, yardUtil: 0.78, berthWaitH: 14, trend: 0.3 },
  { id: 'jebelAli', name: 'Jebel Ali', code: 'AEJEA', at: PLACES.jebelAli.at, dwellDays: 1.4, yardUtil: 0.61, berthWaitH: 5, trend: -0.1 },
  { id: 'suez', name: 'Suez Canal', code: 'EGSUZ', at: PLACES.suez.at, dwellDays: 1.1, yardUtil: 0.55, berthWaitH: 18, trend: 0.2 },
  { id: 'rotterdam', name: 'Rotterdam', code: 'NLRTM', at: PLACES.rotterdam.at, dwellDays: 3.4, yardUtil: 0.87, berthWaitH: 22, trend: 0.6 },
  { id: 'mundra', name: 'Mundra', code: 'INMUN', at: PLACES.mundra.at, dwellDays: 2.1, yardUtil: 0.66, berthWaitH: 9, trend: 0.1 },
];

// --- ULIP / API connectors -----------------------------------------------------------

export type UlipId = 'fastag' | 'icegate' | 'vahan' | 'portgate' | 'ewaybill';

export interface UlipConnector {
  id: UlipId;
  name: string;
  system: string;
  feeds: string;
  at: LatLon;
  latencyMs: number;
  messages: string[];
}

export const ULIP: UlipConnector[] = [
  {
    id: 'fastag',
    name: 'FASTag',
    system: 'NETC · NPCI',
    feeds: 'Toll reads → truck position',
    at: [18.8296, 73.2865],
    latencyMs: 38,
    messages: [
      'Toll read · Talegaon plaza · MH12 TX 4471',
      'Toll read · Khalapur plaza · lane 7',
      'Speed band 52 km/h · corridor nominal',
    ],
  },
  {
    id: 'icegate',
    name: 'ICEGATE',
    system: 'CBIC Customs',
    feeds: 'Shipping Bill · RMS · LEO',
    at: [18.9534, 72.9381],
    latencyMs: 124,
    messages: [
      'SB 4471823 · status FILED · assessment queue',
      'RMS lane: facilitation · no examination',
      'Duty drawback scroll generated',
    ],
  },
  {
    id: 'vahan',
    name: 'VAHAN',
    system: 'MoRTH · NIC',
    feeds: 'Vehicle RC · permit · fitness',
    at: [18.5308, 73.8475],
    latencyMs: 61,
    messages: [
      'MH12 TX 4471 · RC valid · national permit OK',
      'Fitness valid to 14 Mar 2027',
      'Driver DL verified via SARATHI',
    ],
  },
  {
    id: 'portgate',
    name: 'Port Gate',
    system: 'JNPA PCS',
    feeds: 'Pre-gate token · OCR gate-in',
    at: [18.9455, 72.9612],
    latencyMs: 29,
    messages: [
      'Pre-gate token PG-0482 · Gate 4 · slot 16:00',
      'Yard block 3B allocated · row 12',
      'Gate OCR lane 4 online',
    ],
  },
  {
    id: 'ewaybill',
    name: 'e-Way Bill',
    system: 'GSTN · NIC',
    feeds: 'EWB validity · Part-B vehicle',
    at: [18.6987, 74.0201],
    latencyMs: 72,
    messages: [
      'EWB 3718 4462 0915 · valid to 27 Nov 23:59 · Part-B MH12 TX 4471',
      'EWB distance check 148 km · validity 1 day',
      'EWB 2419 8834 1170 · closed at Mundra gate',
    ],
  },
];

// --- Carbon (GLEC-style well-to-wheel factors, kg CO2e per tonne-km) -------------------

export const CO2_FACTOR: Record<Mode, number> = {
  road: 0.089,
  rail: 0.024,
  sea: 0.0091,
  air: 0.602,
};

// --- Seed activity -----------------------------------------------------------------------

export interface SeedFeed {
  h: number;
  source: Role | UlipId;
  text: string;
  tone: Tone;
}

export const SEED_FEED: SeedFeed[] = [
  { h: -46, source: 'exporter', text: 'Commercial Invoice DPC/EXP/26-27/0482 issued', tone: 'cobalt' },
  { h: -40, source: 'forwarder', text: 'Booking AGL-047W-0482 confirmed on MV Konkan Meridian', tone: 'cobalt' },
  { h: -8, source: 'exporter', text: `Container ${CONTAINER} stuffed · e-seal ES-8842117`, tone: 'emerald' },
  { h: -7, source: 'transporter', text: 'e-Way Bill 3718 4462 0915 generated', tone: 'emerald' },
  { h: -6, source: 'icegate', text: 'Shipping Bill 4471823 filed on ICEGATE', tone: 'emerald' },
  { h: -0.3, source: 'vahan', text: 'MH12 TX 4471 departed Chakan · VAHAN verified', tone: 'emerald' },
  { h: -0.1, source: 'fastag', text: 'FASTag read · Chakan–Talegaon plaza', tone: 'cobalt' },
];
