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
  /** Ambient network ports: hidden with the network layer. */
  ambient?: boolean;
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

      // SHP-2611-0519 and SHP-2611-0494.
      g(PLACES.blr, { strong: true, align: 'below' }),
      g(PLACES.fra, { strong: true }),
      g(PLACES.mundra, { strong: true, align: 'left' }),
      g(PLACES.surat),
      l(PLACES.ecity, { strong: true }),
      l(PLACES.blr, { strong: true, align: 'left' }),
      l({ ...PLACES.mundra, name: 'Mundra · MICT' }, { strong: true, align: 'left' }),
      l(PLACES.surat, { strong: true }),

      // Ambient network ports, from mid zoom down.
      ...[PLACES.shanghai, PLACES.singapore, PLACES.colombo, PLACES.felixstowe, PLACES.newark, PLACES.mombasa].map((p) =>
        // Felixstowe sits due west of Rotterdam, whose label runs left: drop it below.
        g(p, { id: `a:${p.id}`, range: [1.15, 3.3], ambient: true, align: p.id === 'felixstowe' ? 'below' : undefined }),
      ),
    ];
    if (routes.has('seaCape')) out.push(g(PLACES.cape, { align: 'left' }));
    if (routes.has('airDwcAms')) out.push(g(PLACES.schiphol));
    return out;
  }, [schedule]);
}
