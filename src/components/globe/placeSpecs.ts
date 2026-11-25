import { useMemo } from 'react';

import { PLACES, type Place } from '@/data/shipment';
import { useSchedule } from '@/store/shipment';

export interface LabelSpec {
  id: string;
  place: Place;
  /** Camera distance from the globe centre at which the label is shown. */
  range: [number, number];
  align?: 'left' | 'right' | 'below';
  strong?: boolean;
}

const GLOBAL = 1.5;
const LOCAL = 1.12;

/** Hub labels for the current routing, shared by the 3D driver and the DOM overlay. */
export function usePlaceSpecs(): LabelSpec[] {
  const schedule = useSchedule();
  return useMemo(() => {
    const routes = new Set(schedule.legs.map((l) => l.routeId));
    const g = (place: Place, extra: Partial<LabelSpec> = {}): LabelSpec => ({
      id: `g:${place.id}`,
      place,
      range: [GLOBAL, 99],
      ...extra,
    });
    const l = (place: Place, extra: Partial<LabelSpec> = {}): LabelSpec => ({
      id: `l:${place.id}`,
      place,
      range: [0, LOCAL],
      ...extra,
    });
    const out: LabelSpec[] = [
      g(PLACES.jnpt, { strong: true, align: 'below' }),
      g(PLACES.rotterdam, { strong: true, align: 'left' }),
      g(PLACES.suez),
      g(PLACES.babElMandeb, { align: 'left' }),
      g(PLACES.gibraltar, { align: 'left' }),
      g(PLACES.jebelAli),
      l(PLACES.chakan, { strong: true }),
      l(PLACES.talegaon),
      l(PLACES.lonavala),
      l(PLACES.khandala, { align: 'left' }),
      l(PLACES.panvel),
      l(PLACES.mumbai, { align: 'left' }),
      l({ ...PLACES.jnpt, name: 'JNPT · Gate 4' }, { strong: true }),
    ];
    if (routes.has('seaCape')) out.push(g(PLACES.cape, { align: 'left' }));
    if (routes.has('airDwcAms')) out.push(g(PLACES.schiphol));
    return out;
  }, [schedule]);
}
