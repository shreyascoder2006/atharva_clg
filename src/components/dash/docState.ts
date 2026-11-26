import { FLAGSHIP, type DocMeta, type ShipmentId } from '@/data/shipment';
import type { Tone } from '@/lib/palette';
import type { ShipmentState } from '@/store/shipment';

/** Where each document stands, derived from live shipment state. */
export interface DocState {
  label: string;
  tone: Tone;
  pulse?: boolean;
}

export function docState(id: ShipmentId, doc: DocMeta, s: ShipmentState, statuses: Record<string, string>): DocState {
  const done = (m: string) => statuses[m] === 'done';
  if (id === FLAGSHIP) {
    switch (doc.id) {
      case 'ci':
        return s.docsVerified ? { label: 'Amended · verified', tone: 'emerald' } : { label: 'Weight mismatch', tone: 'crimson', pulse: true };
      case 'pl':
        return { label: 'Verified', tone: 'emerald' };
      case 'ebl':
        return s.actuals.ebl !== undefined ? { label: 'Issued · anchored', tone: 'emerald' } : s.docsVerified ? { label: 'Draft · re-synced', tone: 'cobalt' } : { label: 'Draft · blocked', tone: 'amber' };
      case 'sb':
        return s.customs === 'active' ? { label: 'RMS examination', tone: 'crimson', pulse: true } : s.actuals.leo !== undefined ? { label: 'LEO granted', tone: 'emerald' } : { label: 'Filed · assessing', tone: 'cobalt' };
      case 'ewb':
        return s.actuals.gateIn !== undefined ? { label: 'Closed at gate', tone: 'emerald' } : { label: 'Active · in transit', tone: 'cobalt' };
      case 'vgm':
        return s.actuals.vgm !== undefined ? { label: 'Submitted', tone: 'emerald' } : { label: 'Awaiting weighbridge', tone: 'slate' };
      case 'eir':
        return s.actuals.gateIn !== undefined ? { label: 'Issued at Gate 4', tone: 'emerald' } : { label: 'Awaiting gate-in', tone: 'slate' };
      default:
        return { label: 'Verified', tone: 'emerald' };
    }
  }
  if (id === 'SHP-2611-0494') {
    if (doc.id === 'sb') return s.hold0494 === 'active' ? { label: 'RMS examination', tone: 'crimson', pulse: true } : { label: 'LEO granted', tone: 'emerald' };
    if (doc.id === 'ebl') return done('loaded') ? { label: 'Issued · anchored', tone: 'emerald' } : s.hold0494 === 'active' ? { label: 'Draft · held', tone: 'amber' } : { label: 'Draft · ready', tone: 'cobalt' };
    if (doc.id === 'ewb') return { label: 'Closed at gate', tone: 'emerald' };
    return { label: 'Verified', tone: 'emerald' };
  }
  if (doc.id === 'awb') return { label: 'Issued · e-AWB', tone: 'emerald' };
  if (doc.id === 'temp') return { label: 'Streaming · 4.6 °C', tone: 'emerald' };
  if (doc.id === 'sb') return { label: 'LEO granted', tone: 'emerald' };
  return { label: 'Verified', tone: 'emerald' };
}

