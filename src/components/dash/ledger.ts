import type { Role } from '@/data/shipment';
import type { Tone } from '@/lib/palette';

export type LedgerStatus = 'In escrow' | 'Settled' | 'On hold' | 'Pending' | 'Disputed';

export interface LedgerRow {
  id: string;
  shipment: string;
  payee: string;
  role: Role | null;
  category: string;
  usd: number;
  /** As invoiced: "₹18,500" or "$2,140". */
  original: string;
  dueH: number;
  status: LedgerStatus;
  billTo: string;
  /** Escrow rows: the milestone that releases the payment. */
  trigger?: string;
}

export const STATUS_TONE: Record<LedgerStatus, Tone> = { 'In escrow': 'cobalt', Settled: 'emerald', 'On hold': 'crimson', Pending: 'amber', Disputed: 'crimson' };
