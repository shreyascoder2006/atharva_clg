import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
} from 'three';

import { FLEET } from '@/data/fleet';
import { PLACES, SHIPMENT_IDS, type ShipmentId } from '@/data/shipment';
import { latLonToVector3 } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { isDoneAt } from '@/lib/schedule';
import { useShipment } from '@/store/shipment';
import { anchor } from './anchors';
import { facing, frame, pxAt } from './frame';
import { dioramaState } from './dioramaData';
import { makeAircraft, makeContrail, makeShip, makeTruck, makeWake } from './vehicleModels';

const SHIP = makeShip();
const AIRCRAFT = makeAircraft();
const TRUCK = makeTruck();
const WAKE = makeWake();
const CONTRAIL = makeContrail();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const billboardVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const pulseMaterial = () =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color(PALETTE.cobalt) }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: billboardVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = 0.0;
        for (int i = 0; i < 2; i++) {
          float p = fract(uTime * 0.55 + float(i) * 0.5);
          a += exp(-pow((d - p) * 9.0, 2.0)) * (1.0 - p) * 0.55;
        }
        a += (1.0 - smoothstep(0.0, 0.32, d)) * 0.16;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

/** Wake and contrail share a shader: a ribbon fading with distance behind the vehicle. */
const trailMaterial = (color: string, power: number, ripples: number) =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: billboardVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float t = vUv.x;
        float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float ripple = mix(1.0, 0.62 + 0.38 * sin(t * 30.0 - uTime * 5.0), ${ripples.toFixed(2)});
        float a = pow(1.0 - t, ${power.toFixed(2)}) * smoothstep(0.0, 0.6, edge) * ripple * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

const up = new Vector3();
const fwd = new Vector3();
const right = new Vector3();
const up2 = new Vector3();
const basis = new Matrix4();
const UP_Y = new Vector3(0, 1, 0);
const surf = new Vector3();

function ShipmentMarker({ id }: { id: ShipmentId }) {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const pulse = useRef<Mesh>(null);
  const stem = useRef<Mesh>(null);
  const model = useRef<Group>(null);
  const ship = useRef<Mesh>(null);
  const plane = useRef<Mesh>(null);
  const truck = useRef<Mesh>(null);
  const wake = useRef<Mesh>(null);
  const contrail = useRef<Mesh>(null);
  const emphasis = useRef(id === useShipment.getState().selected ? 1 : 0);

  const mats = useMemo(
    () => ({
      pulse: pulseMaterial(),
      body: new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, flatShading: true, transparent: true }),
      core: new MeshStandardMaterial({ color: PALETTE.cobalt, roughness: 0.35, emissive: PALETTE.cobalt, emissiveIntensity: 0.35, transparent: true }),
      ring: new MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, depthWrite: false }),
      wake: trailMaterial('#ffffff', 1.6, 1),
      contrail: trailMaterial('#dbe4f0', 1.1, 0),
    }),
    [],
  );

  useFrame(({ camera, clock }, dt) => {
    const g = group.current;
    const t = frame.tracks[id];
    if (!g || !t) return;
    const st = useShipment.getState();
    const selected = st.selected === id;
    const e = (emphasis.current += ((selected ? 1 : 0) - emphasis.current) * (1 - Math.exp(-dt * 8)));

    g.position.copy(t.position);
    surf.copy(t.position).setLength(1);
    const vis = Math.max(0, Math.min(1, (facing(camera, surf) + 0.05) / 0.15));
    g.visible = vis > 0 && st.twin !== 'open';
    if (!g.visible) {
      if (selected) anchor('cargo').opacity = 0;
      return;
    }
    const px = pxAt(camera, t.position);
    const lv = frame.lod.vehicles;
    const alt = frame.altitude;

    // Orbit: a dot. Mid and close: the vehicle. They crossfade on altitude.
    const dot = (1 - lv) * lerp(0.55, 1, e);
    core.current?.scale.setScalar(Math.max(1e-6, px * 6.5 * dot));
    ring.current?.scale.setScalar(Math.max(1e-6, px * 9 * dot));
    ring.current?.lookAt(camera.position);
    mats.core.opacity = vis;
    mats.ring.opacity = vis * 0.95;

    const schedule = t.schedule;
    const alert = schedule.alert;
    const inAlert =
      (!!alert && t.leg.id === alert.legId && t.f >= alert.from - 0.02 && t.f <= alert.to + 0.02) ||
      (id === 'SHP-2611-0494' && st.hold0494 === 'active' && t.phase === 'port') ||
      (id === 'SHP-2611-0482' && st.customs === 'active' && t.phase !== 'main');
    mats.pulse.uniforms.uColor.value.set(inAlert ? PALETTE.crimson : PALETTE.cobalt);
    mats.pulse.uniforms.uTime.value = clock.elapsedTime;
    mats.pulse.uniforms.uOpacity.value = e * vis;
    if (pulse.current) {
      pulse.current.visible = e > 0.02;
      pulse.current.scale.setScalar(px * lerp(64, 46, lv));
      pulse.current.lookAt(camera.position);
    }

    // Vehicle: oriented along the route tangent. Ships and trucks stay level on the
    // surface; aircraft keep the arc's pitch so they visibly climb and descend.
    const m = model.current;
    if (m) {
      m.visible = lv > 0.01;
      up.copy(t.position).normalize();
      fwd.copy(t.tangent);
      if (t.mode !== 'air') fwd.addScaledVector(up, -fwd.dot(up));
      if (fwd.lengthSq() < 1e-12) fwd.set(0, 0, 1);
      fwd.normalize();
      right.crossVectors(up, fwd).normalize();
      up2.crossVectors(fwd, right);
      basis.makeBasis(right, up2, fwd);
      m.quaternion.setFromRotationMatrix(basis);
      const lengthPx = lerp(32, 54, smooth(0.35, 0.008, alt)) * lerp(0.62, 1, e);
      m.scale.setScalar(Math.max(1e-6, px * lengthPx));
      // Docked at a port whose diorama is showing, the berthed model stands in for it.
      let docked = 0;
      surf.copy(t.position).normalize();
      for (const d of dioramaState) if (d.fade > 0 && surf.distanceTo(d.position) < 0.004) docked = Math.max(docked, d.fade);
      mats.body.opacity = lv * lerp(0.5, 1, e) * vis * (1 - docked);
      mats.body.depthWrite = mats.body.opacity > 0.9;
      if (ship.current) ship.current.visible = t.mode === 'sea';
      if (plane.current) plane.current.visible = t.mode === 'air';
      if (truck.current) truck.current.visible = t.mode === 'road' || t.mode === 'rail';
      for (const v of [ship.current, plane.current, truck.current]) if (v) v.castShadow = selected && lv > 0.5;

      // Wakes and contrails only appear closer in, and only when the vehicle is moving.
      const trail = lv * lerp(0.35, 1, e) * vis * (t.moving ? 1 : 0);
      mats.wake.uniforms.uTime.value = clock.elapsedTime;
      mats.wake.uniforms.uOpacity.value = trail * smooth(1.3, 0.4, alt) * 0.85;
      mats.contrail.uniforms.uOpacity.value = trail * 0.75;
      if (wake.current) wake.current.visible = t.mode === 'sea' && mats.wake.uniforms.uOpacity.value > 0.01;
      if (contrail.current) contrail.current.visible = t.mode === 'air' && mats.contrail.uniforms.uOpacity.value > 0.01;
    }

    // Stem from the surface up to an aircraft, so its altitude reads.
    if (stem.current) {
      const h = t.position.length() - 1;
      stem.current.visible = selected && t.mode === 'air' && h > 0.004;
      if (stem.current.visible) {
        stem.current.position.copy(up).multiplyScalar(-h / 2);
        stem.current.quaternion.setFromUnitVectors(UP_Y, up);
        stem.current.scale.set(px * 0.8, h, px * 0.8);
      }
    }

    if (selected) {
      const pin = anchor('cargo');
      pin.position.copy(t.position);
      pin.opacity = st.twin !== 'closed' ? 0 : Math.max(0, Math.min(1, (facing(camera, surf) - 0.05) / 0.2));
    }
  });

  return (
    <group ref={group}>
      <mesh ref={pulse} raycast={() => null} renderOrder={6} material={mats.pulse}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={ring} raycast={() => null} renderOrder={7} material={mats.ring}>
        <circleGeometry args={[1, 32]} />
      </mesh>
      <mesh ref={core} raycast={() => null} renderOrder={8} material={mats.core}>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      <mesh ref={stem} raycast={() => null}>
        <cylinderGeometry args={[1, 1, 1, 6, 1, true]} />
        <meshBasicMaterial color={PALETTE.cobalt} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <group ref={model}>
        <mesh ref={ship} geometry={SHIP} material={mats.body} raycast={() => null} renderOrder={9} />
        <mesh ref={plane} geometry={AIRCRAFT} material={mats.body} raycast={() => null} renderOrder={9} />
        <mesh ref={truck} geometry={TRUCK} material={mats.body} raycast={() => null} renderOrder={9} />
        <mesh ref={wake} geometry={WAKE} material={mats.wake} raycast={() => null} renderOrder={5} />
        <mesh ref={contrail} geometry={CONTRAIL} material={mats.contrail} raycast={() => null} renderOrder={5} />
      </group>
    </group>
  );
}

/* --- Waypoint rings ---------------------------------------------------------------- */

const ringMaterial = () =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uTime: { value: 0 }, uOpacity: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: billboardVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPulse;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        float ring = smoothstep(0.52, 0.6, d) * (1.0 - smoothstep(0.68, 0.76, d));
        float dot = 1.0 - smoothstep(0.16, 0.24, d);
        float p = fract(uTime * 0.6);
        float wave = exp(-pow((d - 0.55 - p * 0.45) * 12.0, 2.0)) * (1.0 - p) * uPulse;
        gl_FragColor = vec4(uColor, (ring * 0.95 + dot + wave * 0.8) * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

function HubRing({ id, place, milestone }: { id: ShipmentId; place: keyof typeof PLACES; milestone: string }) {
  const ref = useRef<Mesh>(null);
  const mat = useMemo(() => ringMaterial(), []);
  const base = useMemo(() => latLonToVector3(PLACES[place].at[0], PLACES[place].at[1], 1), [place]);
  const shown = useRef(0);

  useFrame(({ camera, clock }, dt) => {
    const m = ref.current;
    const t = frame.tracks[id];
    if (!m || !t) return;
    const st = useShipment.getState();
    shown.current += ((st.selected === id ? 1 : 0) - shown.current) * (1 - Math.exp(-dt * 6));
    m.visible = shown.current > 0.01;
    if (!m.visible) return;
    m.position.copy(base).setLength(1 + frame.groundLift + 0.00002);
    m.lookAt(m.position.clone().multiplyScalar(2));
    m.scale.setScalar(pxAt(camera, m.position) * 12);

    const ms = t.schedule.byId[milestone];
    const done = ms && isDoneAt(ms, frame.viewH, frame.nowH);
    const held = (id === 'SHP-2611-0494' && place === 'mundra' && st.hold0494 === 'active') || (!!ms?.blocked && !done);
    mat.uniforms.uColor.value.set(held ? PALETTE.crimson : done ? PALETTE.emerald : PALETTE.cobalt);
    mat.uniforms.uPulse.value = held ? 1 : 0.35;
    mat.uniforms.uTime.value = clock.elapsedTime;
    const vis = Math.max(0, Math.min(1, (facing(camera, base) - 0.02) / 0.15));
    mat.uniforms.uOpacity.value = shown.current * vis;
  });

  return (
    <mesh ref={ref} material={mat} raycast={() => null} renderOrder={4}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}


/* --- Radar aura ---------------------------------------------------------------------- */

const radarMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uColor: { value: new Color(PALETTE.cobalt) }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: billboardVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      const float TAU = 6.2831853;
      // Hairline at radius r0, a pixel or so wide whatever the scale.
      float hair(float r, float r0, float w) { return 1.0 - smoothstep(0.0, w * 1.3, abs(r - r0)); }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float w = fwidth(r);
        float a = atan(p.y, p.x);
        float rings = hair(r, 0.97, w) + hair(r, 0.66, w) * 0.7 + hair(r, 0.36, w) * 0.5;
        // Tick marks around the outer ring, every 15 degrees.
        float ticks = step(0.82, fract(a / TAU * 24.0)) * (1.0 - smoothstep(0.86, 0.9, r)) * smoothstep(0.8, 0.84, r) * 0.7;
        // The sweep: a bright leading edge with a tail that fades behind it.
        float behind = mod(uTime * 1.7 - a, TAU);
        float sweep = (1.0 - smoothstep(0.0, 1.5, behind)) * (1.0 - smoothstep(0.55, 1.0, r)) * 0.38;
        float edge = (1.0 - smoothstep(0.0, 0.05, behind)) * (1.0 - smoothstep(0.9, 1.0, r)) * 0.6;
        gl_FragColor = vec4(uColor, (rings * 0.9 + ticks + sweep + edge) * uOpacity);
      }`,
  });

const Z_AXIS = new Vector3(0, 0, 1);
const radarGround = new Vector3();
const radarUp = new Vector3();

/**
 * A rotating radar ring on the surface beneath the selected shipment's vehicle, held
 * at a constant screen size. It marks the hero shipment at every zoom, including an
 * aircraft at cruise altitude, where the stem ties the two together.
 */
function RadarAura() {
  const ref = useRef<Mesh>(null);
  const mat = useMemo(() => radarMaterial(), []);
  const shown = useRef(0);

  useFrame(({ camera, clock }, dt) => {
    const m = ref.current;
    const st = useShipment.getState();
    const t = frame.tracks[st.selected];
    if (!m || !t) return;
    radarUp.copy(t.position).normalize();
    const lift = Math.max(0.00003, frame.altitude * 0.0005);
    radarGround.copy(radarUp).multiplyScalar(1 + lift);
    const vis = Math.max(0, Math.min(1, (facing(camera, radarUp) + 0.02) / 0.15)) * (st.twin === 'closed' ? 1 : 0);
    shown.current += (vis - shown.current) * (1 - Math.exp(-dt * 6));
    m.visible = shown.current > 0.01;
    if (!m.visible) return;
    m.position.copy(radarGround);
    m.quaternion.setFromUnitVectors(Z_AXIS, radarUp);
    m.scale.setScalar(pxAt(camera, radarGround) * lerp(30, 58, frame.lod.vehicles));
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uOpacity.value = shown.current * 0.85;
    mat.uniforms.uColor.value.set(t.schedule.alert ? PALETTE.crimson : PALETTE.cobalt);
  });

  return (
    <mesh ref={ref} material={mat} raycast={() => null} renderOrder={4}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

export function ShipmentMarkers() {
  return (
    <group>
      <RadarAura />
      {SHIPMENT_IDS.flatMap((id) => FLEET[id].hubs.map((h) => <HubRing key={`${id}:${h.place}`} id={id} {...h} />))}
      {SHIPMENT_IDS.map((id) => (
        <ShipmentMarker key={id} id={id} />
      ))}
    </group>
  );
}
