import { DISRUPTIONS, FLAGSHIP, type ShipmentId } from '@/data/shipment';
import type { Tone } from '@/lib/palette';
import { cargoAt, type Schedule } from '@/lib/schedule';
import { useShipment } from '@/store/shipment';

export interface ShipmentStatus {
  tone: Tone;
  label: string;
  /** Pulsing dot: something needs attention. */
  alert: boolean;
}

/** One status line per shipment, shared by the shipment card and the Shipments tab. */
export function useShipmentStatus(id: ShipmentId, schedule: Schedule, plan: Schedule): ShipmentStatus {
  const docsVerified = useShipment((s) => s.docsVerified);
  const disruption = useShipment((s) => s.disruption);
  const hold = useShipment((s) => s.hold0494);
  const nowH = useShipment((s) => s.nowH);
  const delta = schedule.deliveredH - plan.deliveredH;

  if (id === FLAGSHIP) {
    if (disruption) return { tone: 'crimson', label: DISRUPTIONS[disruption.kind].short, alert: true };
    if (!docsVerified) return { tone: 'amber', label: 'Doc mismatch', alert: true };
  }
  if (id === 'SHP-2611-0494' && hold === 'active') return { tone: 'crimson', label: 'Customs hold', alert: true };
  if (Math.abs(delta) > 1) return { tone: delta > 0 ? 'amber' : 'emerald', label: 'Re-planned', alert: false };

  const c = cargoAt(schedule, nowH);
  if (c.phase === 'delivered') return { tone: 'emerald', label: 'Delivered', alert: false };
  if (c.moving && c.leg.mode === 'air') return { tone: 'sky', label: 'In flight', alert: false };
  if (c.moving && c.leg.mode === 'sea') return { tone: 'cobalt', label: 'At sea', alert: false };
  return { tone: 'emerald', label: 'On track', alert: false };
}
