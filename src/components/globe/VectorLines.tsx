import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

import { latLonToVector3 } from '@/lib/geo';
import { frame } from './frame';

interface Encoded {
  scale: number;
  lens: number[];
  data: string;
}

function decode(e: Encoded, Arr: Int16ArrayConstructor | Int32ArrayConstructor): Float32Array {
  const bin = atob(e.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const q = new Arr(bytes.buffer);
  const segments = e.lens.reduce((s, n) => s + n - 1, 0);
  const out = new Float32Array(segments * 6);
  const v = new Vector3();
  let k = 0;
  let o = 0;
  for (const n of e.lens) {
    for (let i = 0; i < n; i++) {
      latLonToVector3(q[k] / e.scale, q[k + 1] / e.scale, 1, v);
      k += 2;
      // Each segment is (previous, current); interior points appear in two segments.
      if (i > 0) {
        out[o++] = v.x;
        out[o++] = v.y;
        out[o++] = v.z;
      }
      if (i < n - 1) {
        out[o++] = v.x;
        out[o++] = v.y;
        out[o++] = v.z;
      }
    }
  }
  return out;
}

interface Layer {
  line: LineSegments2;
  material: LineMaterial;
  opacity: () => number;
  /** Radius offset above the surface, in globe radii, given camera altitude. */
  lift: (alt: number) => number;
}

/**
 * Crisp vector coastlines and country borders over the land texture.
 *
 * The texture coast blurs as the camera closes in; these stay one or two pixels wide at
 * every zoom and sharpen in opacity as the camera descends. The 10m detail coast
 * takes over at port scale. Each layer is lifted off the sphere by an amount tied to
 * altitude: far enough in orbit to win the depth test, close enough at port scale that
 * there is no visible parallax against the ground.
 */
export function VectorLines() {
  const size = useThree((s) => s.size);
  const [data, setData] = useState<{ coast: Encoded; borders: Encoded; detailCoast: Encoded } | null>(null);

  useEffect(() => {
    let live = true;
    // A separate chunk: the lines fade in a beat after first paint rather than block it.
    import('@/data/vectors.json').then((m) => live && setData(m.default as never));
    return () => {
      live = false;
    };
  }, []);

  const layers = useMemo<Layer[]>(() => {
    if (!data) return [];
    const make = (positions: Float32Array, color: string, width: number, opacity: Layer['opacity'], lift: Layer['lift']): Layer => {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);
      const material = new LineMaterial({ color, linewidth: width, transparent: true, depthWrite: false, opacity: 0 });
      const line = new LineSegments2(geometry, material);
      line.frustumCulled = false;
      line.renderOrder = 1;
      line.raycast = () => null;
      return { line, material, opacity, lift };
    };
    const orbitLift = (alt: number) => Math.min(0.0009, Math.max(0.000012, alt * 0.00035));
    return [
      make(decode(data.borders, Int16Array), '#A9B6C8', 0.8, () => frame.lod.borders, orbitLift),
      make(decode(data.coast, Int16Array), '#8C9FB8', 1.1, () => frame.lod.coast * (1 - 0.85 * frame.lod.detailCoast), orbitLift),
      make(decode(data.detailCoast, Int32Array), '#7A8EA9', 1.4, () => 0.9 * frame.lod.detailCoast, () => 0.000008),
    ];
  }, [data]);

  useEffect(
    () => () => {
      for (const l of layers) {
        l.line.geometry.dispose();
        l.material.dispose();
      }
    },
    [layers],
  );

  useFrame(() => {
    for (const l of layers) {
      const o = l.opacity();
      l.material.opacity = o;
      l.line.visible = o > 0.01;
      l.line.scale.setScalar(1 + l.lift(frame.altitude));
      l.material.resolution.set(size.width, size.height);
    }
  });

  return (
    <group>
      {layers.map((l, i) => (
        <primitive key={i} object={l.line} />
      ))}
    </group>
  );
}
