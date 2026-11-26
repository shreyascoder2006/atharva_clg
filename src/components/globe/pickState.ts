import type { ShipmentId } from '@/data/shipment';

/** The shipment whose route is under the pointer, written by RoutePicker, read by the arcs. */
export const pick = { hovered: null as ShipmentId | null };
