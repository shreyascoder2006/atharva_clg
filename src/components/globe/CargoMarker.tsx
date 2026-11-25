import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, Group, Mesh, ShaderMaterial, Vector3 } from 'three';

import { PALETTE } from '@/lib/palette';
import { useShipment } from '@/store/shipment';
import { anchor } from './anchors';
import { facing, frame, pxAt } from './frame';

const pulseMaterial = () =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color(PALETTE.cobalt) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = 0.0;
        for (int i = 0; i < 2; i++) {
          float p = fract(uTime * 0.55 + float(i) * 0.5);
          a += exp(-pow((d - p) * 9.0, 2.0)) * (1.0 - p) * 0.55;
        }
        a += (1.0 - smoothstep(0.0, 0.32, d)) * 0.16;
        if (d > 1.0) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

const n = new Vector3();
const UP = new Vector3(0, 1, 0);

export function CargoMarker() {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const pulse = useRef<Mesh>(null);
  const stem = useRef<Mesh>(null);
  const hit = useRef<Mesh>(null);
  const pulseMat = useMemo(() => pulseMaterial(), []);
  const startDive = useShipment((s) => s.startDive);

  useFrame(({ camera, clock }) => {
    const g = group.current;
    if (!g) return;
    const st = useShipment.getState();
    const p = frame.position;
    g.position.copy(p);
    const px = pxAt(camera, p);
    const vis = facing(camera, p.clone().setLength(1));

    core.current?.scale.setScalar(px * 6.5);
    ring.current?.scale.setScalar(px * 9);
    hit.current?.scale.setScalar(px * 18);
    if (pulse.current) {
      pulse.current.scale.setScalar(px * 64);
      pulse.current.lookAt(camera.position);
    }
    ring.current?.lookAt(camera.position);

    // Alert tint when the box is sitting inside a disrupted range.
    const alert = frame.schedule?.alert;
    const inAlert = !!alert && frame.leg?.id === alert.legId && frame.f >= alert.from - 0.02 && frame.f <= alert.to + 0.02;
    const blocked = st.customs === 'active' && frame.phase !== 'main';
    pulseMat.uniforms.uColor.value.set(inAlert || blocked ? PALETTE.crimson : PALETTE.cobalt);
    pulseMat.uniforms.uTime.value = clock.elapsedTime;

    // Stem down to the surface when the box rides an elevated arc.
    if (stem.current) {
      const alt = p.length() - 1;
      stem.current.visible = alt > 0.004;
      if (alt > 0.004) {
        n.copy(p).normalize();
        stem.current.position.copy(n).multiplyScalar(-alt / 2);
        stem.current.quaternion.setFromUnitVectors(UP, n);
        stem.current.scale.set(px * 0.8, alt, px * 0.8);
      }
    }

    g.visible = vis > -0.05 && st.twin !== 'open';
    const pin = anchor('cargo');
    pin.position.copy(p);
    pin.opacity = st.twin !== 'closed' ? 0 : Math.max(0, Math.min(1, (vis - 0.05) / 0.2));
  });

  return (
    <group ref={group}>
      <mesh ref={pulse} raycast={() => null} renderOrder={6}>
        <planeGeometry args={[1, 1]} />
        <primitive object={pulseMat} attach="material" />
      </mesh>
      <mesh ref={ring} raycast={() => null} renderOrder={7}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh ref={core} castShadow renderOrder={8} raycast={() => null}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color={PALETTE.cobalt} roughness={0.35} metalness={0.1} emissive={PALETTE.cobalt} emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={stem} raycast={() => null}>
        <cylinderGeometry args={[1, 1, 1, 6, 1, true]} />
        <meshBasicMaterial color={PALETTE.cobalt} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh
        ref={hit}
        onClick={(e) => {
          e.stopPropagation();
          startDive();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

    </group>
  );
}
