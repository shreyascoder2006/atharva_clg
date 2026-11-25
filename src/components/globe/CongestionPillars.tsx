import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three';

import { PORTS, type PortCongestion } from '@/data/shipment';
import { latLonToVector3 } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { useShipment, type ShipmentState } from '@/store/shipment';
import { anchor } from './anchors';
import { facing, pxAt } from './frame';

/** Live congestion reading, nudged by whatever disruption is in play. */
export function portReading(p: PortCongestion, st: Pick<ShipmentState, 'customs' | 'redSea'>, t: number) {
  let dwell = p.dwellDays;
  let util = p.yardUtil;
  if (p.id === 'jnpt' && st.customs === 'active') {
    dwell += 1.3;
    util += 0.08;
  }
  if (p.id === 'suez' && st.redSea === 'active') dwell += 0.9;
  if (p.id === 'jebelAli' && st.redSea === 'seaair') {
    dwell += 0.4;
    util += 0.06;
  }
  // A slow, deterministic breath per port so the column feels live.
  const phase = p.at[0] * 0.37 + p.at[1] * 0.11;
  dwell *= 1 + Math.sin(t * 0.21 + phase) * 0.035;
  util = Math.min(0.99, util * (1 + Math.sin(t * 0.17 + phase * 2) * 0.015));
  const score = 0.55 * util + 0.45 * Math.min(1, dwell / 4);
  const tone = score >= 0.75 ? 'crimson' : score >= 0.58 ? 'amber' : 'emerald';
  return { dwell, util, score, tone } as const;
}

const toneHex = { crimson: PALETTE.crimson, amber: PALETTE.amber, emerald: PALETTE.emerald } as const;

const vertexShader = /* glsl */ `
  varying float vH;
  varying float vFacing;
  void main() {
    vH = position.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying float vH;
  varying float vFacing;
  void main() {
    float body = mix(0.42, 0.05, pow(vH, 0.8));
    float rim = pow(1.0 - vFacing, 2.2) * (1.0 - vH * 0.55) * 0.7;
    float band = exp(-pow((fract(vH * 2.5 - uTime * 0.28) - 0.5) * 12.0, 2.0)) * 0.22 * (1.0 - vH);
    vec3 col = mix(uColor, vec3(1.0), 0.12 + band * 0.6);
    gl_FragColor = vec4(col, (body + rim + band) * uOpacity);
  }
`;

const capFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float ring = smoothstep(0.78, 0.86, d) * (1.0 - smoothstep(0.92, 1.0, d));
    float fill = (1.0 - smoothstep(0.0, 0.9, d)) * 0.28;
    gl_FragColor = vec4(uColor, (ring * 0.95 + fill) * uOpacity);
  }
`;

const UP = new Vector3(0, 1, 0);

/** Open cylinder with its base at the origin, so scale.y is the column height. */
const columnGeometry = new CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
const discGeometry = new CircleGeometry(1, 48).rotateX(-Math.PI / 2);

const capVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const discMaterial = () =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uOpacity: { value: 1 } },
    vertexShader: capVertex,
    fragmentShader: capFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

function Pillar({ port }: { port: PortCongestion }) {
  const group = useRef<Group>(null);
  const column = useRef<Mesh>(null);
  const cap = useRef<Mesh>(null);
  const base = useRef<Mesh>(null);
  const anim = useRef({ h: 0, op: 0 });

  const { position, normal, quaternion, colMat, capMat, baseMat } = useMemo(() => {
    const position = latLonToVector3(port.at[0], port.at[1], 1.0006);
    const normal = position.clone().normalize();
    const quaternion = new Quaternion().setFromUnitVectors(UP, normal);
    const colMat = new ShaderMaterial({
      uniforms: { uColor: { value: new Color() }, uTime: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    return { position, normal, quaternion, colMat, capMat: discMaterial(), baseMat: discMaterial() };
  }, [port]);

  useFrame(({ camera, clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const st = useShipment.getState();
    const r = portReading(port, st, performance.now() / 1000);
    const color = toneHex[r.tone];
    colMat.uniforms.uColor.value.set(color);
    capMat.uniforms.uColor.value.set(color);
    baseMat.uniforms.uColor.value.set(color);
    colMat.uniforms.uTime.value = clock.elapsedTime;

    // The Risk lens raises the columns to full height; Operations keeps them as a quiet cue.
    const lensK = st.lens === 'risk' ? 1 : st.lens === 'operations' ? 0.42 : 0;
    const a = anim.current;
    const k = 1 - Math.exp(-dt * 4);
    a.h += (r.dwell * 30 * lensK - a.h) * k;
    a.op += ((st.lens === 'risk' ? 1 : lensK > 0 ? 0.7 : 0) - a.op) * k;

    // Screen-scaled: the same column reads from orbit and at the port gate.
    const px = pxAt(camera, position);
    const vis = Math.max(0, Math.min(1, (facing(camera, position) - 0.02) / 0.15));
    const height = Math.max(1e-5, a.h * px);
    const radius = px * 6.5;

    g.visible = a.op > 0.01 && vis > 0;
    colMat.uniforms.uOpacity.value = a.op * vis;
    capMat.uniforms.uOpacity.value = a.op * vis;
    baseMat.uniforms.uOpacity.value = a.op * vis * 0.8;

    column.current?.scale.set(radius, height, radius);
    if (cap.current) {
      cap.current.position.set(0, height, 0);
      cap.current.scale.setScalar(radius * 1.05);
    }
    base.current?.scale.setScalar(radius * 2.6);
    const tag = anchor(`port:${port.id}`);
    tag.position.copy(position).addScaledVector(normal, height + px * 10);
    tag.opacity = st.lens === 'risk' ? Math.max(0, (vis - 0.4) / 0.6) * a.op : 0;
  });

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh ref={column} geometry={columnGeometry} material={colMat} castShadow raycast={() => null} renderOrder={4} />
      <mesh ref={cap} geometry={discGeometry} material={capMat} raycast={() => null} renderOrder={4} />
      <mesh ref={base} geometry={discGeometry} material={baseMat} raycast={() => null} renderOrder={4} />
    </group>
  );
}

export function CongestionPillars() {
  return (
    <group>
      {PORTS.map((p) => (
        <Pillar key={p.id} port={p} />
      ))}
    </group>
  );
}
