/**
 * Landed logistics cost per shipment, and the invoices that are not escrow payouts.
 *
 * Amounts are USD unless a string says otherwise. Rupee amounts convert at a fixed
 * demo rate. Every invoice number and payee is fictional.
 */
import type { ShipmentId } from './shipment';

/** Fixed demo exchange rate, ₹ per US$. */
export const INR_PER_USD = 88;

export type CostCategory = 'freight' | 'customs' | 'inland' | 'port' | 'insurance';

export const COST_LABEL: Record<CostCategory, string> = {
  freight: 'Freight',
  customs: 'Customs & CHA',
  inland: 'Inland haulage',
  port: 'Port & THC',
  insurance: 'Insurance',
};

/** Quoted cost lines per shipment, USD. Freight for live shipments follows the assigned partner's bid. */
export const COSTS: Record<string, Record<CostCategory, number>> = {
  'SHP-2611-0482': { freight: 3640, customs: 410, inland: 520, port: 380, insurance: 190 },
  'SHP-2611-0519': { freight: 4480, customs: 180, inland: 240, port: 160, insurance: 620 },
  'SHP-2611-0494': { freight: 1180, customs: 210, inland: 360, port: 240, insurance: 110 },
  'SHP-2611-0466': { freight: 2950, customs: 520, inland: 230, port: 410, insurance: 260 },
  'SHP-2611-0507': { freight: 3320, customs: 290, inland: 140, port: 350, insurance: 170 },
  'SHP-2611-0531': { freight: 1840, customs: 260, inland: 90, port: 220, insurance: 120 },
};

/** Demurrage and detention already invoiced, USD. Live exposure is added on top. */
export const BOOKED_DEMURRAGE: Record<string, number> = {
  'SHP-2611-0507': 1240,
};

/** Ground rent at Mundra while SHP-2611-0494 sits in the examination yard, USD per day. */
export const MUNDRA_HOLD_RATE = 260;

/** Monthly demurrage budget the exposure gauge is measured against, USD. */
export const DEMURRAGE_BUDGET = 25000;

export type StaticStatus = 'settled' | 'pending' | 'disputed';

export interface StaticInvoice {
  id: string;
  shipment: string;
  payee: string;
  category: CostCategory | 'demurrage';
  amountUsd: number;
  /** Hours relative to app load. */
  dueH: number;
  status: StaticStatus;
}

export const STATIC_INVOICES: StaticInvoice[] = [
  { id: 'INV-AGL-0466-01', shipment: 'SHP-2611-0466', payee: 'Arabian Gateway Logistics', category: 'freight', amountUsd: 2950, dueH: -120, status: 'settled' },
  { id: 'INV-NSP-0466-02', shipment: 'SHP-2611-0466', payee: 'Nhava Sheva terminal (THC)', category: 'port', amountUsd: 410, dueH: 78, status: 'pending' },
  { id: 'INV-AGL-0507-01', shipment: 'SHP-2611-0507', payee: 'Arabian Gateway Logistics', category: 'freight', amountUsd: 3320, dueH: -150, status: 'settled' },
  { id: 'INV-CMB-0507-02', shipment: 'SHP-2611-0507', payee: 'Colombo transhipment terminal', category: 'demurrage', amountUsd: 1240, dueH: 40, status: 'disputed' },
  { id: 'INV-FXT-0507-03', shipment: 'SHP-2611-0507', payee: 'Haven Gateway Haulage', category: 'inland', amountUsd: 140, dueH: 310, status: 'pending' },
  { id: 'INV-AGL-0531-01', shipment: 'SHP-2611-0531', payee: 'Arabian Gateway Logistics', category: 'freight', amountUsd: 1840, dueH: -190, status: 'settled' },
  { id: 'INV-MSA-0531-02', shipment: 'SHP-2611-0531', payee: 'Changamwe ICD', category: 'port', amountUsd: 220, dueH: -30, status: 'settled' },
];

/** "₹18,500" or "$2,140" → USD. */
export function moneyToUsd(amount: string): number {
  const n = Number(amount.replace(/[^0-9.]/g, ''));
  return amount.trim().startsWith('₹') ? n / INR_PER_USD : n;
}

export const LIVE_IDS: ShipmentId[] = ['SHP-2611-0482', 'SHP-2611-0519', 'SHP-2611-0494'];
