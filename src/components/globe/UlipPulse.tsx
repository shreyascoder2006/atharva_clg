import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Group, Mesh, QuadraticBezierCurve3, Vector3 } from 'three';
import type { Line2 } from 'three-stdlib';

import { ULIP, type UlipConnector } from '@/data/shipment';
import { latLonToVector3 } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { useShipment } from '@/store/shipment';
import { anchor } from './anchors';
import { facing, frame, pxAt } from './frame';

/** The platform hub floats over the Deccan, where every connector beams into it. */
const HUB = latLonToVector3(23.5, 70.5, 1.2);


function Beam({ c, index }: { c: UlipConnector; index: number }) {
  const line = useRef<Line2>(null);
  const node = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const packets = useRef<(Mesh | null)[]>([]);
  const flash = useRef(0);
  const lastSeen = useRef(0);

  const { curve, points, base } = useMemo(() => {
    const base = latLonToVector3(c.at[0], c.at[1], 1.001);
    const mid = base.clone().add(HUB).multiplyScalar(0.5).setLength(1.22);
    const curve = new QuadraticBezierCurve3(base, mid, HUB);
    return { curve, points: curve.getPoints(48), base };
  }, [c]);

  useFrame(({ camera, clock }, dt) => {
    const st = useShipment.getState();
    const on = st.lens === 'ulip';
    const latest = st.ulipLog.find((e) => e.connector === c.id);
    if (latest && latest.id !== lastSeen.current) {
      lastSeen.current = latest.id;
      flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - dt * 0.9);

    const vis = Math.max(0, Math.min(1, (facing(camera, base) + 0.1) / 0.25));
    const op = on ? vis : 0;
    if (line.current) {
      const m = line.current.material;
      m.opacity += (op * (0.35 + flash.current * 0.6) - m.opacity) * 0.15;
      line.current.visible = m.opacity > 0.01;
    }
    const px = pxAt(camera, base);
    if (node.current) {
      node.current.visible = op > 0.01;
      node.current.scale.setScalar(px * (4 + flash.current * 3));
    }
    if (ring.current) {
      ring.current.visible = op > 0.01;
      const p = (clock.elapsedTime * 0.6 + index * 0.25) % 1;
      ring.current.scale.setScalar(px * (6 + p * 18));
      (ring.current.material as { opacity: number }).opacity = (1 - p) * 0.5 * op;
      ring.current.lookAt(camera.position);
    }
    packets.current.forEach((m, i) => {
      if (!m) return;
      const speed = 0.22 + i * 0.07 + index * 0.02;
      const t = (clock.elapsedTime * speed + i / 3 + index * 0.17) % 1;
      curve.getPoint(t, m.position);
      m.scale.setScalar(pxAt(camera, m.position) * (2.4 + flash.current * 2.2));
      m.visible = op > 0.05;
    });
    const tag = anchor(`ulip:${c.id}`);
    tag.position.copy(base);
    tag.opacity = op;
  });

  return (
    <group>
      <Line ref={line} points={points} color={PALETTE.sky} lineWidth={1.4} transparent opacity={0} depthWrite={false} />
      <mesh ref={node} position={base} raycast={() => null}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={PALETTE.sky} />
      </mesh>
      <mesh ref={ring} position={base} raycast={() => null}>
        <ringGeometry args={[0.86, 1, 40]} />
        <meshBasicMaterial color={PALETTE.sky} transparent opacity={0} depthWrite={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (packets.current[i] = m)} raycast={() => null}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={i === 0 ? '#ffffff' : PALETTE.sky} />
        </mesh>
      ))}
    </group>
  );
}

/** Beam from the hub down to wherever the box is right now. */
function CargoBeam() {
  const line = useRef<Line2>(null);
  const tmpMid = useMemo(() => new Vector3(), []);
  const pts = useMemo(() => new Float32Array(33 * 3), []);
  const curve = useMemo(() => new QuadraticBezierCurve3(new Vector3(), new Vector3(), HUB.clone()), []);

  useFrame(() => {
    const l = line.current;
    if (!l) return;
    const on = useShipment.getState().lens === 'ulip';
    const m = l.material;
    m.opacity += ((on ? 0.6 : 0) - m.opacity) * 0.12;
    l.visible = m.opacity > 0.01;
    if (!l.visible) return;
    curve.v0.copy(frame.position);
    tmpMid.copy(frame.position).add(HUB).multiplyScalar(0.5).setLength(Math.max(1.2, tmpMid.length()));
    curve.v1.copy(tmpMid);
    for (let i = 0; i <= 32; i++) {
      const p = curve.getPoint(i / 32);
      pts[i * 3] = p.x;
      pts[i * 3 + 1] = p.y;
      pts[i * 3 + 2] = p.z;
    }
    l.geometry.setPositions(pts);
    l.computeLineDistances();
  });

  const initial = useMemo(() => curve.getPoints(32), [curve]);
  return <Line ref={line} points={initial} color={PALETTE.cobalt} lineWidth={1.2} dashed dashSize={0.01} gapSize={0.008} transparent opacity={0} />;
}

export function UlipPulse() {
  const hub = useRef<Group>(null);
  const hubRing = useRef<Mesh>(null);

  useFrame(({ camera, clock }) => {
    const on = useShipment.getState().lens === 'ulip';
    if (hub.current) hub.current.visible = on;
    if (hubRing.current) {
      const px = pxAt(camera, HUB);
      hubRing.current.scale.setScalar(px * (14 + Math.sin(clock.elapsedTime * 2) * 1.5));
      hubRing.current.lookAt(camera.position);
    }
    const tag = anchor('hub');
    tag.position.copy(HUB);
    tag.opacity = on ? Math.max(0, Math.min(1, (facing(camera, HUB.clone().setLength(1)) + 0.2) / 0.3)) : 0;
  });

  return (
    <group>
      {ULIP.map((c, i) => (
        <Beam key={c.id} c={c} index={i} />
      ))}
      <CargoBeam />
      <group ref={hub} position={HUB} visible={false}>
        <mesh ref={hubRing} raycast={() => null}>
          <ringGeometry args={[0.7, 1, 48]} />
          <meshBasicMaterial color={PALETTE.cobalt} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
