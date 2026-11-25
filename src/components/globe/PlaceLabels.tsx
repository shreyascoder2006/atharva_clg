import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

import { PLACES, PORTS, type Place } from '@/data/shipment';
import { latLonToVector3 } from '@/lib/geo';
import { useSchedule, useShipment } from '@/store/shipment';
import { anchor } from './anchors';
import { facing } from './frame';

export interface LabelSpec {
  id: string;
  place: Place;
  /** Camera distance from the globe centre at which the label is shown. */
  range: [number, number];
  align?: 'left' | 'right';
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
      g(PLACES.jnpt, { strong: true }),
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

const cam = new Vector3();
const PORT_IDS = new Set(PORTS.map((p) => p.id));

export function PlaceLabels() {
  const specs = usePlaceSpecs();
  const points = useMemo(
    () => specs.map((s) => ({ spec: s, position: latLonToVector3(s.place.at[0], s.place.at[1], 1.002) })),
    [specs],
  );

  useFrame(({ camera }) => {
    const d = camera.getWorldPosition(cam).length();
    // In the Risk lens the port congestion tags already name these hubs.
    const riskLens = useShipment.getState().lens === 'risk';
    for (const { spec, position } of points) {
      const a = anchor(`place:${spec.id}`);
      a.position.copy(position);
      const [lo, hi] = spec.range;
      // Fade across the range boundary rather than popping.
      const edge = Math.min(1, Math.max(0, Math.min((d - lo) / 0.06, (hi - d) / 0.06)));
      const yield_ = riskLens && spec.range[0] > 0 && PORT_IDS.has(spec.place.id) ? 0 : 1;
      a.opacity = yield_ * edge * Math.max(0, Math.min(1, (facing(camera, position) - 0.08) / 0.2));
    }
  });

  return null;
}
