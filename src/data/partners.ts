/**
 * Partner marketplace: forwarders bidding for the selected shipment.
 *
 * The four company names are real logistics brands, used only to make the
 * marketplace legible. Every quote, score, contact name and statistic below is
 * invented demo data and says nothing about how those companies actually perform.
 */
import type { ShipmentId } from './shipment';

export type PartnerId = 'maersk' | 'bluedart' | 'allcargo' | 'dhl';
export type CarbonGrade = 'A' | 'B' | 'C' | 'D';

export interface Partner {
  id: PartnerId;
  name: string;
  /** Short form for escrow payees, ledgers and chat bylines. */
  short: string;
  kind: string;
  monogram: string;
  accent: string;
  contact: { person: string; title: string };
  /** On-time performance over the last 90 days, 0–1. */
  otp: number;
  /** Average customs clearance at origin, hours. */
  customsHrs: number;
  /** Share of boxes that incurred demurrage in the last 90 days, 0–1. */
  demurrageRate: number;
  carbon: CarbonGrade;
  /** g CO2e per tonne-km, well-to-wheel, blended across the partner's network. */
  gPerTkm: number;
  rating: number;
  /** Shipments handled on the platform in the last 90 days. */
  volume90d: number;
}

export interface Quote {
  partner: PartnerId;
  priceUsd: number;
  transitDays: number;
  /** Hours the bid stays open. */
  validH: number;
  includes: string[];
}

export const PARTNERS: Record<PartnerId, Partner> = {
  maersk: {
    id: 'maersk',
    name: 'Maersk India',
    short: 'Maersk India',
    kind: 'Ocean carrier · integrated logistics',
    monogram: 'MI',
    accent: '#0EA5E9',
    contact: { person: 'Nikhil Rao', title: 'Key Account Lead · Mumbai' },
    otp: 0.94,
    customsHrs: 7.6,
    demurrageRate: 0.031,
    carbon: 'A',
    gPerTkm: 9.4,
    rating: 4.7,
    volume90d: 412,
  },
  bluedart: {
    id: 'bluedart',
    name: 'BlueDart Global',
    short: 'BlueDart Global',
    kind: 'Express & air freight',
    monogram: 'BD',
    accent: '#2563EB',
    contact: { person: 'Kavya Menon', title: 'Global Accounts · Bengaluru' },
    otp: 0.97,
    customsHrs: 4.2,
    demurrageRate: 0.012,
    carbon: 'C',
    gPerTkm: 36.1,
    rating: 4.6,
    volume90d: 268,
  },
  allcargo: {
    id: 'allcargo',
    name: 'Allcargo Multimodal',
    short: 'Allcargo',
    kind: 'Multimodal · CFS & rail',
    monogram: 'AC',
    accent: '#059669',
    contact: { person: 'Rohit Bhosale', title: 'Multimodal Desk · Navi Mumbai' },
    otp: 0.91,
    customsHrs: 6.1,
    demurrageRate: 0.044,
    carbon: 'A',
    gPerTkm: 8.7,
    rating: 4.4,
    volume90d: 356,
  },
  dhl: {
    id: 'dhl',
    name: 'DHL Global Forwarding',
    short: 'DHL Global Fwd',
    kind: 'Ocean, air & customs brokerage',
    monogram: 'DG',
    accent: '#D97706',
    contact: { person: 'Sara Fernandes', title: 'Trade Lane Manager · Mumbai' },
    otp: 0.95,
    customsHrs: 3.4,
    demurrageRate: 0.022,
    carbon: 'B',
    gPerTkm: 14.8,
    rating: 4.8,
    volume90d: 509,
  },
};

export const PARTNER_IDS = Object.keys(PARTNERS) as PartnerId[];

/** The forwarder on every shipment before anyone is reassigned. */
export const INCUMBENT = { org: 'Arabian Gateway Logistics', short: 'Arabian Gateway' };

const ocean = ['Door pickup', 'Export customs', 'Ocean freight', 'Destination THC'];
const air = ['Pickup in reefer', 'Air cargo LEO', 'PMC ULD build', 'Cold-chain monitoring'];

/** Live bids per shipment, in USD for the whole move. */
export const QUOTES: Record<ShipmentId, Quote[]> = {
  'SHP-2611-0482': [
    { partner: 'maersk', priceUsd: 3480, transitDays: 24, validH: 30, includes: ocean },
    { partner: 'bluedart', priceUsd: 4920, transitDays: 21, validH: 18, includes: [...ocean.slice(0, 3), 'Priority stowage'] },
    { partner: 'allcargo', priceUsd: 3120, transitDays: 26, validH: 40, includes: ['ICD rail haul', ...ocean.slice(1)] },
    { partner: 'dhl', priceUsd: 3890, transitDays: 23, validH: 22, includes: [...ocean, 'Customs brokerage'] },
  ],
  'SHP-2611-0519': [
    { partner: 'maersk', priceUsd: 4610, transitDays: 3, validH: 12, includes: air.slice(0, 3) },
    { partner: 'bluedart', priceUsd: 4180, transitDays: 2, validH: 10, includes: air },
    { partner: 'allcargo', priceUsd: 4390, transitDays: 3, validH: 16, includes: air.slice(0, 3) },
    { partner: 'dhl', priceUsd: 4520, transitDays: 2, validH: 8, includes: [...air, 'EU import pre-alert'] },
  ],
  'SHP-2611-0494': [
    { partner: 'maersk', priceUsd: 1260, transitDays: 5, validH: 36, includes: ocean },
    { partner: 'bluedart', priceUsd: 1690, transitDays: 4, validH: 20, includes: ocean.slice(0, 3) },
    { partner: 'allcargo', priceUsd: 1090, transitDays: 6, validH: 48, includes: ['Hazira CFS stuffing', ...ocean.slice(1)] },
    { partner: 'dhl', priceUsd: 1340, transitDays: 5, validH: 26, includes: [...ocean, 'RMS query support'] },
  ],
};

export type Badge = 'Best Value' | 'Fastest Customs' | 'Lowest Carbon' | 'Most Reliable';

/** Highlight badges for a shipment's bids: each one goes to the single best partner. */
export function quoteBadges(quotes: Quote[]): Partial<Record<PartnerId, Badge[]>> {
  const out: Partial<Record<PartnerId, Badge[]>> = {};
  const give = (id: PartnerId, b: Badge) => (out[id] = [...(out[id] ?? []), b]);
  const best = <T>(xs: T[], key: (x: T) => number) => xs.reduce((a, b) => (key(b) < key(a) ? b : a));
  give(best(quotes, (q) => q.priceUsd).partner, 'Best Value');
  give(best(quotes, (q) => PARTNERS[q.partner].customsHrs).partner, 'Fastest Customs');
  give(best(quotes, (q) => PARTNERS[q.partner].gPerTkm).partner, 'Lowest Carbon');
  give(best(quotes, (q) => -PARTNERS[q.partner].otp).partner, 'Most Reliable');
  return out;
}
