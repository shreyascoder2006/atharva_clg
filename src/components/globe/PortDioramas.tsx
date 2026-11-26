import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Vector3,
} from 'three';

import { latLonToVector3, northTangent } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { useShipment } from '@/store/shipment';
import { anchor } from './anchors';
import { facing, frame } from './frame';
import { DIORAMAS, dioramaState, type DioramaDef } from './dioramaData';
import { makeShip } from './vehicleModels';

/**
 * Port terminal micro-dioramas, faded in only below the close-zoom threshold.
 *
 * Each is a small architectural model anchored to the surface in a local frame: x runs
 * along the quay, +z points out over the water, y is up. One local unit is about 2.2 km.
 * Cranes and boxes are exaggerated so they read from tens of kilometres up, which is
 * the scale of a model, not of a survey.
 */
/** World units per local unit. */
const S = 0.00034;
const FADE_FAR = 0.075;
const FADE_NEAR = 0.032;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const BOX_COLORS = [PALETTE.cobalt, PALETTE.emerald, PALETTE.amber, '#F8FAFC', PALETTE.crimson, '#64748B', '#0EA5E9', PALETTE.cobalt];
const SHIP_GEOMETRY = makeShip();
const UNIT = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

/** A small container-yard: instanced boxes in blocks behind the quay. */
function Yard({ material }: { material: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null);
  const slots = useMemo(() => {
    const out: { x: number; z: number; tier: number; color: string }[] = [];
    let k = 7;
    const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let block = 0; block < 6; block++) {
      const bx = -1.95 + block * 0.62;
      for (let bay = 0; bay < 4; bay++) {
        for (let row = 0; row < 5; row++) {
          const tiers = 1 + Math.floor(rnd() * 3);
          for (let tier = 0; tier < tiers; tier++) {
            out.push({ x: bx + bay * 0.135, z: -0.62 - row * 0.085, tier, color: BOX_COLORS[Math.floor(rnd() * BOX_COLORS.length)] });
          }
        }
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    const c = new Color();
    slots.forEach((s, i) => {
      o.position.set(s.x, 0.012 + s.tier * 0.046, s.z);
      o.scale.set(0.125, 0.044, 0.07);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(s.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [slots]);

  return <instancedMesh ref={ref} args={[UNIT, material, slots.length]} castShadow receiveShadow raycast={() => null} />;
}

/** Ship-to-shore gantry crane: legs, portal beams, boom over the water, moving trolley. */
function Crane({ x, material, accent, phase }: { x: number; material: MeshStandardMaterial; accent: MeshStandardMaterial; phase: number }) {
  const trolley = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (trolley.current) trolley.current.position.z = 0.15 + (Math.sin(clock.elapsedTime * 0.6 + phase) * 0.5 + 0.5) * 0.55 - 0.3;
  });
  const leg = (lx: number, lz: number) => (
    <mesh position={[x + lx, 0, lz]} geometry={UNIT} scale={[0.02, 0.34, 0.02]} material={material} castShadow />
  );
  return (
    <group>
      {leg(-0.07, -0.2)}
      {leg(0.07, -0.2)}
      {leg(-0.07, 0.05)}
      {leg(0.07, 0.05)}
      {/* Portal beams and the boom reaching out over the berth. */}
      <mesh position={[x, 0.33, -0.075]} geometry={UNIT} scale={[0.17, 0.025, 0.27]} material={material} castShadow />
      <mesh position={[x, 0.37, 0.22]} geometry={UNIT} scale={[0.05, 0.022, 1.05]} material={accent} castShadow />
      <mesh position={[x, 0.36, -0.12]} geometry={UNIT} scale={[0.07, 0.05, 0.08]} material={accent} castShadow />
      <mesh ref={trolley} position={[x, 0.345, 0.2]} geometry={UNIT} scale={[0.06, 0.02, 0.05]} material={material} />
    </group>
  );
}

const rippleMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new Color(PALETTE.cobalt) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = 0.0;
        for (int i = 0; i < 3; i++) {
          float p = fract(uTime * 0.18 + float(i) / 3.0);
          a += exp(-pow((d - p) * 22.0, 2.0)) * (1.0 - p);
        }
        gl_FragColor = vec4(uColor, a * 0.35 * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

function Terminal({ def, mats, ripple }: { def: DioramaDef; mats: Mats; ripple: ShaderMaterial }) {
  return (
    <group>
      {/* Model base: a land plate for the terminal and a water plate for the harbour. */}
      <mesh position={[0, 0.002, -1.05]} rotation-x={-Math.PI / 2} material={mats.land} receiveShadow>
        <planeGeometry args={[4.6, 2.1]} />
      </mesh>
      <mesh position={[0, 0.0015, 0.75]} rotation-x={-Math.PI / 2} material={mats.water}>
        <planeGeometry args={[4.6, 1.5]} />
      </mesh>
      {/* Quay apron, its yellow edge, and two finger piers out into the basin. */}
      <mesh position={[0, 0.004, -0.27]} geometry={UNIT} scale={[4.1, 0.012, 0.54]} material={mats.concrete} receiveShadow />
      <mesh position={[0, 0.016, 0.0]} geometry={UNIT} scale={[4.1, 0.004, 0.018]} material={mats.edge} />
      <mesh position={[-1.75, 0.004, 0.42]} geometry={UNIT} scale={[0.16, 0.012, 0.84]} material={mats.concrete} receiveShadow />
      <mesh position={[1.75, 0.004, 0.42]} geometry={UNIT} scale={[0.16, 0.012, 0.84]} material={mats.concrete} receiveShadow />
      <Yard material={mats.boxes} />
      {[-1.2, -0.6, 0, 0.6, 1.2].map((x, i) => (
        <Crane key={x} x={x} material={mats.crane} accent={mats.craneAccent} phase={i * 1.3} />
      ))}
      {/* The berthed vessel. */}
      <mesh position={[0.1, 0.0, 0.24]} rotation-y={Math.PI / 2} scale={1.7} geometry={SHIP_GEOMETRY} material={mats.ship} castShadow />
      {/* Customs inspection yard: an outlined pad with a few boxes pulled for examination. */}
      <mesh position={[-1.6, 0.006, -1.62]} geometry={UNIT} scale={[0.62, 0.006, 0.36]} material={mats.customs} receiveShadow />
      {[-1.75, -1.6, -1.45].map((x) => (
        <mesh key={x} position={[x, 0.012, -1.62]} geometry={UNIT} scale={[0.12, 0.044, 0.07]} material={mats.flagged} castShadow />
      ))}
      {/* Gate-in lanes and canopy at the back of the terminal. */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[1.78 + i * 0.09, 0.006, -1.72]} geometry={UNIT} scale={[0.05, 0.004, 0.34]} material={mats.lane} />
      ))}
      <mesh position={[1.92, 0.09, -1.72]} geometry={UNIT} scale={[0.44, 0.015, 0.12]} material={mats.canopy} castShadow />
      <mesh position={[0, 0.003, 1.05]} rotation-x={-Math.PI / 2} material={ripple}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      <DioramaLabels def={def} />
    </group>
  );
}

/** Suez: the canal itself, its banks, a bypass channel and a northbound convoy. */
function Canal({ def, mats, ripple }: { def: DioramaDef; mats: Mats; ripple: ShaderMaterial }) {
  const convoy = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = convoy.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      c.position.x = ((clock.elapsedTime * 0.05 + i * 0.32) % 1) * 4.6 - 2.3;
    });
  });
  return (
    <group>
      <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2} material={mats.sand} receiveShadow>
        <planeGeometry args={[4.8, 2.8]} />
      </mesh>
      <mesh position={[0, 0.004, 0]} geometry={UNIT} scale={[4.8, 0.002, 0.22]} material={mats.water} />
      <mesh position={[-0.2, 0.004, 0.75]} geometry={UNIT} scale={[2.2, 0.002, 0.16]} material={mats.water} />
      {[-0.12, 0.12].map((z) => (
        <mesh key={z} position={[0, 0.007, z]} geometry={UNIT} scale={[4.8, 0.004, 0.01]} material={mats.edge} />
      ))}
      {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.006, 0]} geometry={UNIT} scale={[0.25, 0.002, 0.008]} material={mats.lane} />
      ))}
      <group ref={convoy}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.005, 0]} rotation-y={Math.PI / 2} scale={0.75} geometry={SHIP_GEOMETRY} material={mats.ship} castShadow />
        ))}
      </group>
      <mesh position={[0, 0.003, 0]} rotation-x={-Math.PI / 2} material={ripple}>
        <planeGeometry args={[1.6, 1.6]} />
      </mesh>
      <DioramaLabels def={def} />
    </group>
  );
}

const labelLocal = new Vector3();
const labelWorld = new Vector3();

/** Positions the DOM micro-labels; their opacity is the diorama's fade. */
function DioramaLabels({ def }: { def: DioramaDef }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const state = dioramaState.find((d) => d.id === def.id)!;
    def.labels.forEach((l, i) => {
      labelLocal.set(l.at[0], 0.42, l.at[1]);
      labelWorld.copy(labelLocal);
      g.localToWorld(labelWorld);
      const a = anchor(`dio:${def.id}:${i}`);
      a.position.copy(labelWorld);
      // Labels only appear once the model has fully resolved, below the threshold.
      a.opacity = smooth(0.6, 1, state.fade);
    });
  });
  return <group ref={group} />;
}

type Mats = ReturnType<typeof makeMats>;

function makeMats() {
  const std = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
    new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02, transparent: true, opacity: 0, ...extra });
  return {
    land: std('#F7F9FC', { roughness: 0.95 }),
    water: std('#CFE1F5', { roughness: 0.35 }),
    sand: std('#F1EADC', { roughness: 0.95 }),
    concrete: std('#E3E8EF'),
    edge: std(PALETTE.amber, { roughness: 0.5 }),
    lane: std('#FFFFFF', { roughness: 0.6 }),
    canopy: std('#F8FAFC'),
    crane: std('#3D5A8F', { roughness: 0.5, metalness: 0.15 }),
    craneAccent: std('#F8FAFC', { roughness: 0.45 }),
    boxes: std('#ffffff', { roughness: 0.55 }),
    ship: new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true, transparent: true, opacity: 0 }),
    customs: std(PALETTE.amber, { roughness: 0.8 }),
    flagged: std(PALETTE.crimson, { roughness: 0.55 }),
  };
}

const up = new Vector3();
const north = new Vector3();
const east = new Vector3();
const dir = new Vector3();
const right = new Vector3();
const basis = new Matrix4();
const cam = new Vector3();

function Diorama({ def }: { def: DioramaDef }) {
  const root = useRef<Group>(null);
  const mats = useMemo(() => makeMats(), []);
  const ripple = useMemo(() => rippleMaterial(), []);
  const state = dioramaState.find((d) => d.id === def.id)!;

  // Local frame: x along the quay bearing, y up, z = x × y (the water side).
  const { position, quaternion } = useMemo(() => {
    const position = latLonToVector3(def.at[0], def.at[1], 1);
    up.copy(position).normalize();
    northTangent(def.at[0], def.at[1], north);
    east.crossVectors(north, up);
    const b = (def.bearing * Math.PI) / 180;
    dir.copy(north).multiplyScalar(Math.cos(b)).addScaledVector(east, Math.sin(b)).normalize();
    right.crossVectors(dir, up).normalize();
    basis.makeBasis(dir, up, right);
    const g = new Object3D();
    g.quaternion.setFromRotationMatrix(basis);
    return { position, quaternion: g.quaternion.clone() };
  }, [def]);

  useFrame(({ camera, clock }) => {
    const g = root.current;
    if (!g) return;
    const dist = camera.getWorldPosition(cam).distanceTo(position);
    const vis = Math.max(0, Math.min(1, (facing(camera, position) - 0.02) / 0.1));
    const fade = smooth(FADE_FAR, FADE_NEAR, dist) * vis * (useShipment.getState().twin === 'open' ? 0 : 1);
    state.fade = fade;
    g.visible = fade > 0.01;
    if (!g.visible) return;
    g.position.copy(position).setLength(1 + frame.groundLift * 0.15);
    for (const m of Object.values(mats)) {
      m.opacity = fade * (m === mats.water ? 0.8 : m === mats.land || m === mats.sand ? 0.88 : 1);
      m.depthWrite = fade > 0.95;
    }
    // Mundra's customs pad reads crimson while 0494 is on hold.
    if (def.id === 'mundra') mats.customs.color.set(useShipment.getState().hold0494 === 'active' ? PALETTE.crimson : PALETTE.emerald);
    ripple.uniforms.uTime.value = clock.elapsedTime;
    ripple.uniforms.uOpacity.value = fade;
  });

  return (
    <group ref={root} quaternion={quaternion} scale={S} visible={false}>
      {def.kind === 'terminal' ? <Terminal def={def} mats={mats} ripple={ripple} /> : <Canal def={def} mats={mats} ripple={ripple} />}
    </group>
  );
}

export function PortDioramas() {
  return (
    <group>
      {DIORAMAS.map((d) => (
        <Diorama key={d.id} def={d} />
      ))}
    </group>
  );
}
