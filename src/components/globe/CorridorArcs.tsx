import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Color, Mesh, TubeGeometry } from 'three';

import { AMBIENT_ROUTES } from '@/data/fleet';
import { LANE_BY_ID } from '@/data/lanes';
import { FLAGSHIP, SHIPMENT_IDS, type RouteId, type ShipmentId } from '@/data/shipment';
import { MODE_HEX, PALETTE } from '@/lib/palette';
import { arcAt, BASE_ALT, getRoute } from '@/lib/route';
import { carbonIntensity, cargoAt, type LegSchedule } from '@/lib/schedule';
import { useScheduleFor, useShipment, viewHourOf, type Lens } from '@/store/shipment';
import { frame } from './frame';
import { pick } from './pickState';
import {
  makeCoreMaterial,
  makeHaloMaterial,
  makeTubeDepthMaterial,
  makeTubeUniforms,
  TUBE_BUILD_RADIUS,
} from './tubeMaterial';

const geometryCache = new Map<RouteId, TubeGeometry>();

function tubeFor(routeId: RouteId): TubeGeometry {
  let g = geometryCache.get(routeId);
  if (!g) {
    const route = getRoute(routeId);
    const curve = new CatmullRomCurve3(route.points, false, 'centripetal');
    const segments = Math.min(1400, Math.max(96, route.points.length * 3));
    g = new TubeGeometry(curve, segments, TUBE_BUILD_RADIUS, 8, false);
    geometryCache.set(routeId, g);
  }
  return g;
}

/** Arc-length of the route in world units; sets how many comets fit on it. */
function worldLength(routeId: RouteId): number {
  const pts = getRoute(routeId).points;
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
  return L;
}

const DONE = new Color(PALETTE.emerald);
const ALERT = new Color(PALETTE.crimson);
const RISK = new Color(PALETTE.amber);
const CARBON_LO = new Color(PALETTE.emerald);
const CARBON_HI = new Color(PALETTE.amber);
const AMBIENT = new Color('#4F6FA8');
const FOCUSED = new Color('#2563EB');
const BOOKED = new Color('#3B6FE6');

const REVEAL_MS = 1700;
/** Opacity of a shipment that is on the network but not in focus. */
const BACKGROUND_OPACITY = 0.35;
/** Ambient network corridors: other trade, drawn quieter still. */
const AMBIENT_OPACITY = 0.28;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lensDim = (lens: Lens) => (lens === 'ulip' ? 1 : lens === 'risk' ? 0.35 : 0);

/** Ground legs are built a few km up; shrink them onto the surface as the camera closes in. */
function groundScale(mesh: Mesh | null, mode: LegSchedule['mode']) {
  if (!mesh) return;
  const ground = mode === 'road' || mode === 'rail';
  mesh.scale.setScalar(ground ? (1 + frame.groundLift) / (1 + BASE_ALT[mode]) : 1);
}

interface LegProps {
  shipmentId: ShipmentId;
  leg: LegSchedule;
  index: number;
  /** Fades and removes a superseded route after a reroute. */
  ghostBorn?: number;
  onGone?: () => void;
}

function ArcLeg({ shipmentId, leg, index, ghostBorn, onGone }: LegProps) {
  const route = getRoute(leg.routeId);
  const geometry = tubeFor(leg.routeId);
  const coreRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const ground = leg.mode === 'road' || leg.mode === 'rail';
  const emphasis = useRef(shipmentId === useShipment.getState().selected ? 1 : 0);

  const { core, halo, depth, uniforms, haloUniforms } = useMemo(() => {
    const u = makeTubeUniforms(ground ? 1.35 : 1.6, 0.000015);
    const haloU = { ...u, uPx: { value: ground ? 5 : 6.5 }, uOpacity: { value: 1 } };
    u.uColor.value.set(MODE_HEX[leg.mode]);
    u.uDone.value.copy(DONE);
    u.uAlertColor.value.copy(ALERT);
    u.uRiskColor.value.copy(RISK);
    u.uCarbonColor.value.copy(CARBON_LO).lerp(CARBON_HI, carbonIntensity(leg.mode));
    u.uDash.value = leg.mode === 'rail' ? Math.max(40, worldLength(leg.routeId) * 3500) : 0;
    u.uComets.value = Math.max(2, Math.round(worldLength(leg.routeId) / 0.2));
    return {
      core: makeCoreMaterial(u),
      halo: makeHaloMaterial(haloU),
      depth: makeTubeDepthMaterial(u),
      uniforms: u,
      haloUniforms: haloU,
    };
  }, [leg.mode, leg.routeId, ground]);

  useEffect(
    () => () => {
      core.dispose();
      halo.dispose();
      depth.dispose();
    },
    [core, halo, depth],
  );

  useFrame(({ camera, clock }, dt) => {
    const st = useShipment.getState();
    const track = frame.tracks[shipmentId];
    if (!track) return;
    const schedule = track.schedule;
    const u = uniforms;
    camera.getWorldPosition(u.uCam.value);
    u.uWorldPerPx.value = frame.worldPerPx;
    u.uTime.value = clock.elapsedTime;

    // Selection crossfades over ~300 ms rather than snapping; hovering a route on the
    // globe lifts it part-way, as a hint that it can be clicked.
    const goal = st.selected === shipmentId ? 1 : pick.hovered === shipmentId ? 0.55 : 0;
    const e = (emphasis.current += (goal - emphasis.current) * (1 - Math.exp(-dt * 8)));
    const thin = lerp(1, 0.62, frame.lod.thin);
    u.uPx.value = lerp(0.8, ground ? 1.35 : 1.6, e) * thin;
    haloUniforms.uPx.value = (ground ? 5 : 6.5) * thin;
    u.uCometGain.value = lerp(0.45, 1, e);

    // Travelled fraction, from the smoothed cargo position so fill and marker agree.
    let progress = 0;
    if (track.legIndex > index) progress = 1;
    else if (track.legIndex === index) progress = arcAt(route, track.f);
    u.uProgress.value = ghostBorn ? 0 : progress;

    const live = cargoAt(schedule, st.nowH);
    u.uLive.value = live.legIndex > index ? 1 : live.legIndex === index ? arcAt(route, live.f) : 0;
    u.uFuture.value = viewHourOf(st) > st.nowH + 1e-3 ? 1 : 0;

    const alert = schedule.alert;
    if (alert && alert.legId === leg.id && !ghostBorn) {
      u.uAlert.value.set(arcAt(route, Math.max(0, alert.from)), arcAt(route, Math.min(1, alert.to)));
      u.uAlertOn.value = 1;
    } else u.uAlertOn.value = 0;

    const lens: Lens = st.lens;
    const risks = schedule.risks.filter((r) => r.legId === leg.id);
    if (lens === 'risk' && risks.length) {
      const [a, b] = risks;
      u.uRisk.value.set(arcAt(route, a.from), arcAt(route, a.to), b ? arcAt(route, b.from) : -1, b ? arcAt(route, b.to) : -1);
      u.uRiskOn.value = 1;
    } else u.uRiskOn.value = 0;

    const k = 0.12;
    u.uCarbon.value += ((lens === 'carbon' && st.selected === shipmentId ? 1 : 0) - u.uCarbon.value) * k;
    u.uDim.value += (lensDim(lens) - u.uDim.value) * k;

    const born = shipmentId === FLAGSHIP ? st.rerouteMs[leg.id] : undefined;
    let opacity: number;
    if (ghostBorn) {
      const t = (performance.now() - ghostBorn) / 1300;
      opacity = Math.max(0, 1 - t) * 0.55;
      u.uReveal.value = 1;
      if (t >= 1) onGone?.();
    } else {
      const t = born ? (performance.now() - born) / REVEAL_MS : 1;
      u.uReveal.value = t >= 1 ? 1.001 : 1 - (1 - Math.min(1, t)) ** 3;
      opacity = 1;
    }
    u.uOpacity.value = opacity * lerp(BACKGROUND_OPACITY, 1, e);
    haloUniforms.uOpacity.value = opacity * e;

    groundScale(coreRef.current, leg.mode);
    groundScale(haloRef.current, leg.mode);
    if (coreRef.current) {
      coreRef.current.castShadow = !ghostBorn && e > 0.5;
      coreRef.current.renderOrder = e > 0.5 ? 3 : 1;
    }
    if (haloRef.current) haloRef.current.visible = e > 0.02;
  });

  return (
    <group>
      <mesh ref={haloRef} geometry={geometry} material={halo} frustumCulled={false} raycast={() => null} renderOrder={2} />
      <mesh
        ref={coreRef}
        geometry={geometry}
        material={core}
        customDepthMaterial={depth}
        frustumCulled={false}
        raycast={() => null}
        renderOrder={3}
      />
    </group>
  );
}

interface Ghost {
  key: string;
  leg: LegSchedule;
  index: number;
  born: number;
}

function ShipmentArcs({ id }: { id: ShipmentId }) {
  const schedule = useScheduleFor(id);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prev = useRef<Map<string, { leg: LegSchedule; index: number }>>(new Map());

  // When a recovery reroutes a leg, the old geometry lingers briefly and fades while
  // the new one draws on, so the change reads as a reroute rather than a cut.
  useEffect(() => {
    const next = new Map(schedule.legs.map((l, i) => [l.id, { leg: l, index: i }]));
    const born = performance.now();
    const added: Ghost[] = [];
    for (const [legId, old] of prev.current) {
      const now = next.get(legId);
      if (!now || now.leg.routeId !== old.leg.routeId) {
        added.push({ key: `${legId}:${old.leg.routeId}:${born}`, leg: old.leg, index: old.index, born });
      }
    }
    prev.current = next;
    if (added.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a geometry change, once per reroute
      setGhosts((g) => [...g, ...added]);
    }
  }, [schedule]);

  return (
    <group>
      {schedule.legs.map((leg, i) => (
        <ArcLeg key={`${leg.id}:${leg.routeId}`} shipmentId={id} leg={leg} index={i} />
      ))}
      {ghosts.map((g) => (
        <ArcLeg
          key={g.key}
          shipmentId={id}
          leg={g.leg}
          index={g.index}
          ghostBorn={g.born}
          onGone={() => setGhosts((all) => all.filter((x) => x.key !== g.key))}
        />
      ))}
    </group>
  );
}

/**
 * Other trade on the network: thin translucent lanes with slow micro-pulses, low over
 * the sea so they read as background to the three shipments.
 */
/**
 * A corridor that is not one of the three live workflows: the ambient network, or a
 * lane booked from the Shipments dashboard (`booked`), which is drawn bolder in cobalt
 * and draws itself in the first time it is on screen.
 */
function AmbientArc({ routeId, seed, booked = false }: { routeId: RouteId; seed: number; booked?: boolean }) {
  const geometry = tubeFor(routeId);
  const material = useMemo(() => {
    const u = makeTubeUniforms(0.7, 0.000012);
    u.uColor.value.copy(booked ? BOOKED : AMBIENT);
    u.uDone.value.copy(booked ? BOOKED : AMBIENT);
    u.uComets.value = Math.max(4, Math.round(worldLength(routeId) / 0.09));
    u.uSpeed.value = 0.07 + seed * 0.013;
    u.uPhase.value = seed * 0.37;
    u.uCometGain.value = 0.55;
    return makeCoreMaterial(u);
  }, [routeId, seed, booked]);
  const shown = useRef(1);
  // Lit up while a watch-list shipment on this corridor is being tracked.
  const lit = useRef(0);
  const bornAt = useRef<number | null>(null);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }, dt) => {
    const st = useShipment.getState();
    const u = material.uniforms;
    camera.getWorldPosition(u.uCam.value);
    u.uWorldPerPx.value = frame.worldPerPx;
    u.uTime.value = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 6);
    lit.current += ((st.focus?.routeId === routeId ? 1 : 0) - lit.current) * k;
    u.uPx.value = lerp(booked ? 1.1 : 0.72, 1.5, lit.current) * lerp(1, 0.6, frame.lod.thin);
    u.uColor.value.copy(booked ? BOOKED : AMBIENT).lerp(FOCUSED, lit.current);
    u.uCometGain.value = lerp(booked ? 1.0 : 0.55, 1.4, lit.current);
    if (booked) {
      // Draw on from the origin, starting the first frame the globe is rendering.
      if (bornAt.current === null) bornAt.current = clock.elapsedTime;
      const t = (clock.elapsedTime - bornAt.current) / 2.2;
      u.uReveal.value = t >= 1 ? 1.001 : 1 - (1 - t) ** 3;
      u.uOpacity.value = lerp(0.72, 0.95, lit.current);
      return;
    }
    shown.current += ((st.showNetwork ? 1 : 0) - shown.current) * k;
    u.uOpacity.value = lerp(AMBIENT_OPACITY, 0.95, lit.current) * shown.current;
    u.uDim.value += (lensDim(st.lens) - u.uDim.value) * 0.12;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => null} renderOrder={0} />;
}

/** Lanes booked from the Shipments dashboard; one arc per lane however many bookings. */
function BookedArcs() {
  const booked = useShipment((s) => s.customShipments);
  const lanes = [...new Set(booked.map((c) => c.laneId))];
  return (
    <>
      {lanes.map((l, i) => (
        <AmbientArc key={l} routeId={LANE_BY_ID[l].route.id as RouteId} seed={i + 5} booked />
      ))}
    </>
  );
}

export function CorridorArcs() {
  return (
    <group>
      {AMBIENT_ROUTES.map((r, i) => (
        <AmbientArc key={r.routeId} routeId={r.routeId} seed={i + 1} />
      ))}
      <BookedArcs />
      {SHIPMENT_IDS.map((id) => (
        <ShipmentArcs key={id} id={id} />
      ))}
    </group>
  );
}
