import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

import { PORTS } from '@/data/shipment';
import { latLonToVector3 } from '@/lib/geo';
import { useShipment } from '@/store/shipment';
import { anchor } from './anchors';
import { facing } from './frame';
import { usePlaceSpecs } from './placeSpecs';

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
