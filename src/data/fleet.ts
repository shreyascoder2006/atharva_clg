/**
 * The three interactive shipments on the platform.
 *
 * SHP-2611-0482 is the flagship. It carries the full workflow: Document X-Ray, the
 * disruption simulator and Co-Pilot, and the driver phone. 0519 (air, cold chain) and
 * 0494 (sea, held by customs at Mundra) run on lighter schedules that render on the
 * globe and in the HUD in exactly the same way.
 *
 * As in shipment.ts, coordinates and LOCODEs are real; every company, person, flight,
 * vessel and document number is fictional.
 */
import { containerId } from '@/lib/iso6346';
import type { LatLon } from '@/lib/geo';
import {
  CONTAINER,
  DOCUMENTS,
  ESCROW,
  FLAGSHIP,
  ROLES,
  SHIPMENT,
  type DocMeta,
  type EscrowLine,
  type Mode,
  type PlaceId,
  type Role,
  type ShipmentId,
} from './shipment';

export interface Party {
  org: string;
  person: string;
  title: string;
  initials: string;
}

/** A camera pose for one stakeholder lens. A null target orbits the planet's centre. */
export interface Zone {
  cam: LatLon;
  camR: number;
  target: LatLon | null;
  label: string;
}

export interface FleetShipment {
  id: ShipmentId;
  short: string;
  origin: string;
  destination: string;
  destTz: string;
  modes: Mode[];
  /** Container number, or the air waybill for air freight. */
  unit: { label: 'Container' | 'HAWB'; ref: string; equipment: string };
  cargo: string;
  hsCode: string;
  grossKg: number;
  valueUsd: number;
  incoterm: string;
  carrier: string;
  parties: Record<Role, Party>;
  /** Nodes that get waypoint rings when the shipment is selected, and the milestone that clears each. */
  hubs: { place: PlaceId; milestone: string }[];
  zones: Record<Role, Zone>;
  /** Containerised, so the orbital-to-container twin applies. */
  twin: boolean;
  documents: DocMeta[];
  escrow: EscrowLine[];
  /** Labels for the next stop, by schedule stage. */
  stops: { gateIn: string; atd: string; ata: string; delivered: string };
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const party = (org: string, person: string, title: string): Party => ({ org, person, title, initials: initials(person) });

const FF = party('Arabian Gateway Logistics', 'Farhan Shaikh', 'Ocean & air ops · Navi Mumbai');

export const FLEET: Record<ShipmentId, FleetShipment> = {
  'SHP-2611-0482': {
    id: FLAGSHIP,
    short: '0482',
    origin: 'Chakan',
    destination: 'Duisburg',
    destTz: 'Europe/Berlin',
    modes: ['road', 'sea', 'rail'],
    unit: { label: 'Container', ref: CONTAINER, equipment: SHIPMENT.equipment },
    cargo: SHIPMENT.cargo,
    hsCode: SHIPMENT.hsCode,
    grossKg: SHIPMENT.grossKg,
    valueUsd: SHIPMENT.invoiceValueUsd,
    incoterm: SHIPMENT.incoterm,
    carrier: `${SHIPMENT.vessel} ${SHIPMENT.voyage}`,
    parties: {
      exporter: party(ROLES.exporter.org, ROLES.exporter.person, ROLES.exporter.title),
      forwarder: party(ROLES.forwarder.org, ROLES.forwarder.person, ROLES.forwarder.title),
      broker: party(ROLES.broker.org, ROLES.broker.person, ROLES.broker.title),
      transporter: party(ROLES.transporter.org, ROLES.transporter.person, ROLES.transporter.title),
    },
    hubs: [
      { place: 'chakan', milestone: 'departFactory' },
      { place: 'jnpt', milestone: 'atd' },
      { place: 'suez', milestone: 'transit' },
      { place: 'rotterdam', milestone: 'ata' },
      { place: 'duisburg', milestone: 'delivered' },
    ],
    zones: {
      exporter: { cam: [26, 41], camR: 3.95, target: null, label: 'Global corridor' },
      forwarder: { cam: [16, 57], camR: 2.25, target: null, label: 'Ocean leg · Arabian Sea' },
      broker: { cam: [18.62, 72.985], camR: 1.0048, target: [18.952, 72.965], label: 'JNPT port gate' },
      transporter: { cam: [17.55, 73.38], camR: 1.024, target: [18.84, 73.38], label: 'Pune → JNPT inland leg' },
    },
    twin: true,
    documents: DOCUMENTS,
    escrow: ESCROW,
    stops: { gateIn: 'ETA JNPT Gate 4', atd: 'Vessel departs', ata: 'ETA Rotterdam', delivered: 'ETA Duisburg' },
  },

  'SHP-2611-0519': {
    id: 'SHP-2611-0519',
    short: '0519',
    origin: 'Bengaluru',
    destination: 'Frankfurt',
    destTz: 'Europe/Berlin',
    modes: ['road', 'air'],
    unit: { label: 'HAWB', ref: 'AGL-HAWB-BLR-0519', equipment: '2 × PMC ULD · 2–8 °C' },
    cargo: 'Insulin biosimilar vials · cold chain',
    hsCode: '3004.31',
    grossKg: 1840,
    valueUsd: 412600,
    incoterm: 'CIP Frankfurt',
    carrier: 'Skybridge Cargo SKB 761',
    parties: {
      exporter: party('Kaveri Biologics Pvt Ltd', 'Meera Iyer', 'Export Lead · Bengaluru'),
      forwarder: FF,
      broker: party('Deccan Air Cargo Clearing', 'Sanjay Hegde', 'Licensed CHA · BLR air cargo'),
      transporter: party('Garden City Reefer Logistics', 'Arjun Gowda', 'Driver · KA01 AR 7719'),
    },
    hubs: [
      { place: 'ecity', milestone: 'pickup' },
      { place: 'blr', milestone: 'atd' },
      { place: 'fra', milestone: 'release' },
      { place: 'morfelden', milestone: 'delivered' },
    ],
    zones: {
      exporter: { cam: [30, 47], camR: 3.9, target: null, label: 'BLR → FRA air corridor' },
      forwarder: { cam: [37, 53], camR: 1.8, target: null, label: 'In flight · SKB 761' },
      broker: { cam: [12.86, 77.72], camR: 1.0052, target: [13.198, 77.706], label: 'BLR air cargo terminal' },
      transporter: { cam: [12.42, 77.68], camR: 1.0125, target: [13.02, 77.68], label: 'Electronic City → BLR' },
    },
    twin: false,
    documents: [
      doc('ci', 'Commercial Invoice', 'KBL/EXP/26-27/0519', 'exporter', ['full', 'redacted', 'full', 'none'], 'Commercial pricing is restricted to the Exporter and Customs Broker.'),
      doc('pl', 'Packing List', 'PL-0519 · 2 ULD', 'exporter', ['full', 'full', 'full', 'full']),
      doc('awb', 'House Air Waybill', 'AGL-HAWB-BLR-0519', 'forwarder', ['full', 'full', 'view', 'none'], 'Air waybills stay with the forwarder and its agents.'),
      doc('sb', 'Shipping Bill', 'SB 5508371', 'customs', ['view', 'view', 'full', 'none'], 'Customs declaration, filed by the CHA on ICEGATE.'),
      doc('temp', 'Temperature Data Log', 'TL-0519 · 2–8 °C', 'exporter', ['full', 'full', 'view', 'full']),
      doc('coa', 'Certificate of Analysis', 'CoA-KBL-2611', 'exporter', ['full', 'view', 'full', 'none'], 'Batch release data, for the exporter and customs.'),
    ],
    escrow: [
      { id: 'transporter', party: 'Garden City Reefer', amount: '₹9,800', trigger: 'gateIn', triggerLabel: 'on gate-in' },
      { id: 'broker', party: 'Deccan Air Cargo', amount: '₹7,400', trigger: 'leo', triggerLabel: 'on LEO' },
      { id: 'forwarder', party: 'Arabian Gateway', amount: '$3,860', trigger: 'ata', triggerLabel: 'on FRA arrival' },
      { id: 'exporter', party: 'Kaveri Biologics', amount: '$412,600', trigger: 'delivered', triggerLabel: 'CAD on delivery' },
    ],
    stops: { gateIn: 'ETA BLR cargo', atd: 'Departs BLR', ata: 'ETA Frankfurt', delivered: 'ETA Mörfelden' },
  },

  'SHP-2611-0494': {
    id: 'SHP-2611-0494',
    short: '0494',
    origin: 'Surat',
    destination: 'Jebel Ali',
    destTz: 'Asia/Dubai',
    modes: ['road', 'sea'],
    unit: { label: 'Container', ref: containerId('OSP', 'U', '491207'), equipment: "40' High Cube" },
    cargo: 'Polyester filament yarn (FDY)',
    hsCode: '5402.47',
    grossKg: 24600,
    valueUsd: 96800,
    incoterm: 'CFR Jebel Ali',
    carrier: 'MV Kutch Pioneer 112E',
    parties: {
      exporter: party('Tapi Technical Textiles Ltd', 'Hiren Desai', 'Export Manager · Surat'),
      forwarder: FF,
      broker: party('Kutch Maritime Clearing Agency', 'Hetal Shah', 'Licensed CHA · Mundra'),
      transporter: party('Narmada Freight Carriers', 'Vikram Solanki', 'Driver · GJ05 BX 2207'),
    },
    hubs: [
      { place: 'surat', milestone: 'departFactory' },
      { place: 'mundra', milestone: 'atd' },
      { place: 'jebelAli', milestone: 'delivered' },
    ],
    zones: {
      exporter: { cam: [19.5, 64.5], camR: 2.2, target: null, label: 'Gujarat → Gulf corridor' },
      forwarder: { cam: [21.5, 61.5], camR: 1.6, target: null, label: 'Feeder leg · Arabian Sea' },
      broker: { cam: [22.42, 69.715], camR: 1.0048, target: [22.744, 69.703], label: 'Mundra customs yard' },
      transporter: { cam: [19.9, 71.25], camR: 1.055, target: [22.25, 71.25], label: 'Surat → Mundra road leg' },
    },
    twin: true,
    documents: [
      doc('ci', 'Commercial Invoice', 'TTT/EXP/26-27/0494', 'exporter', ['full', 'redacted', 'full', 'none'], 'Commercial pricing is restricted to the Exporter and Customs Broker.'),
      doc('pl', 'Packing List', 'PL-0494 · 288 bobbin cases', 'exporter', ['full', 'full', 'full', 'full']),
      doc('sb', 'Shipping Bill', 'SB 5512094', 'customs', ['view', 'view', 'full', 'none'], 'Customs declaration, filed by the CHA on ICEGATE.'),
      doc('ebl', 'e-Bill of Lading', 'KPL-112E-0494', 'forwarder', ['full', 'full', 'view', 'none'], 'Title document. The Transporter never holds the e-BL.'),
      doc('ewb', 'e-Way Bill', 'EWB 2419 8834 1170', 'gst', ['full', 'none', 'view', 'full'], 'Domestic GST movement document. Not needed past the port gate.'),
      doc('vgm', 'VGM Declaration', 'VGM-MUN-WB07-1183', 'forwarder', ['view', 'full', 'view', 'view']),
      doc('eir', 'Gate Pass / EIR', 'MICT-G2-0494', 'transporter', ['none', 'view', 'view', 'full'], 'Terminal equipment interchange, for the haulier and forwarder.'),
    ],
    escrow: [
      { id: 'transporter', party: 'Narmada Freight', amount: '₹31,400', trigger: 'gateIn', triggerLabel: 'on gate-in' },
      { id: 'broker', party: 'Kutch Maritime', amount: '₹11,900', trigger: 'leo', triggerLabel: 'on LEO' },
      { id: 'forwarder', party: 'Arabian Gateway', amount: '$1,120', trigger: 'loaded', triggerLabel: 'on shipped-on-board' },
      { id: 'exporter', party: 'Tapi Textiles', amount: '$96,800', trigger: 'delivered', triggerLabel: 'LC on delivery' },
    ],
    stops: { gateIn: 'ETA Mundra gate', atd: 'Vessel departs', ata: 'ETA Jebel Ali', delivered: 'ETA JAFZA release' },
  },
};

function doc(
  id: string,
  name: string,
  ref: string,
  issuer: DocMeta['issuer'],
  [exporter, forwarder, broker, transporter]: DocMeta['access'][Role][],
  restriction?: string,
): DocMeta {
  return { id, name, ref, issuer, access: { exporter, forwarder, broker, transporter }, restriction };
}

export const MODE_LABEL: Record<Mode, string> = { road: 'Road', rail: 'Rail', sea: 'Sea', air: 'Air' };

/** Ambient corridors: other trade on the network, drawn quietly behind the shipments. */
export const AMBIENT_ROUTES = [
  { routeId: 'ambShanghaiJnpt', label: 'Shanghai → Singapore → JNPT' },
  { routeId: 'ambChennaiFelixstowe', label: 'Chennai → Colombo → Felixstowe' },
  { routeId: 'ambRotterdamNewark', label: 'Rotterdam → New York / Newark' },
  { routeId: 'ambJebelAliMombasa', label: 'Jebel Ali → Mombasa' },
] as const;
