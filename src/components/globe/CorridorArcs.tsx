import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Color, Mesh, TubeGeometry } from 'three';

import type { RouteId } from '@/data/shipment';
import { MODE_HEX, PALETTE } from '@/lib/palette';
import { arcAt, getRoute } from '@/lib/route';
import { carbonIntensity, cargoAt, type LegSchedule } from '@/lib/schedule';
import { useSchedule, useShipment, viewHourOf, type Lens } from '@/store/shipment';
import { frame } from './frame';
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

const REVEAL_MS = 1700;

interface LegProps {
  leg: LegSchedule;
  index: number;
  /** Fades and removes a superseded route after a reroute. */
  ghostBorn?: number;
  onGone?: () => void;
}

function ArcLeg({ leg, index, ghostBorn, onGone }: LegProps) {
  const route = getRoute(leg.routeId);
  const geometry = tubeFor(leg.routeId);
  const coreRef = useRef<Mesh>(null);
  const ground = leg.mode === 'road' || leg.mode === 'rail';

  const { core, halo, depth, uniforms } = useMemo(() => {
    const u = makeTubeUniforms(ground ? 1.35 : 1.6, 0.000015);
    const haloU = { ...u, uPx: { value: ground ? 5 : 6.5 } };
    u.uColor.value.set(MODE_HEX[leg.mode]);
    u.uDone.value.copy(DONE);
    u.uAlertColor.value.copy(ALERT);
    u.uRiskColor.value.copy(RISK);
    u.uCarbonColor.value.copy(CARBON_LO).lerp(CARBON_HI, carbonIntensity(leg.mode));
    u.uDash.value = leg.mode === 'rail' ? Math.max(40, worldLength(leg.routeId) * 3500) : 0;
    u.uComets.value = Math.max(2, Math.round(worldLength(leg.routeId) / 0.2));
    return { core: makeCoreMaterial(u), halo: makeHaloMaterial(haloU), depth: makeTubeDepthMaterial(u), uniforms: u };
  }, [leg.mode, leg.routeId, ground]);

  useEffect(
    () => () => {
      core.dispose();
      halo.dispose();
      depth.dispose();
    },
    [core, halo, depth],
  );

  useFrame(({ camera, clock }) => {
    const st = useShipment.getState();
    const u = uniforms;
    const schedule = frame.schedule;
    if (!schedule) return;
    camera.getWorldPosition(u.uCam.value);
    u.uWorldPerPx.value = frame.worldPerPx;
    u.uTime.value = clock.elapsedTime;

    // Travelled fraction, from the smoothed cargo position so fill and marker agree.
    let progress = 0;
    if (frame.legIndex > index) progress = 1;
    else if (frame.legIndex === index) progress = arcAt(route, frame.f);
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
      u.uRisk.value.set(
        arcAt(route, a.from),
        arcAt(route, a.to),
        b ? arcAt(route, b.from) : -1,
        b ? arcAt(route, b.to) : -1,
      );
      u.uRiskOn.value = 1;
    } else u.uRiskOn.value = 0;

    const k = 0.12;
    u.uCarbon.value += ((lens === 'carbon' ? 1 : 0) - u.uCarbon.value) * k;
    u.uDim.value += ((lens === 'ulip' ? 1 : lens === 'risk' ? 0.35 : 0) - u.uDim.value) * k;

    const born = st.rerouteMs[leg.id];
    if (ghostBorn) {
      const t = (performance.now() - ghostBorn) / 1300;
      u.uOpacity.value = Math.max(0, 1 - t) * 0.55;
      u.uReveal.value = 1;
      if (t >= 1) onGone?.();
    } else {
      const t = born ? (performance.now() - born) / REVEAL_MS : 1;
      u.uReveal.value = t >= 1 ? 1.001 : 1 - (1 - Math.min(1, t)) ** 3;
      u.uOpacity.value = 1;
    }
  });

  return (
    <group>
      <mesh geometry={geometry} material={halo} frustumCulled={false} raycast={() => null} renderOrder={2} />
      <mesh
        ref={coreRef}
        geometry={geometry}
        material={core}
        customDepthMaterial={depth}
        castShadow={!ghostBorn}
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

export function CorridorArcs() {
  const schedule = useSchedule();
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prev = useRef<Map<string, { leg: LegSchedule; index: number }>>(new Map());

  // When a recovery reroutes a leg, the old geometry lingers briefly and fades while
  // the new one draws on, so the change reads as a reroute rather than a cut.
  useEffect(() => {
    const next = new Map(schedule.legs.map((l, i) => [l.id, { leg: l, index: i }]));
    const born = performance.now();
    const added: Ghost[] = [];
    for (const [id, old] of prev.current) {
      const now = next.get(id);
      if (!now || now.leg.routeId !== old.leg.routeId) {
        added.push({ key: `${id}:${old.leg.routeId}:${born}`, leg: old.leg, index: old.index, born });
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
        <ArcLeg key={`${leg.id}:${leg.routeId}`} leg={leg} index={i} />
      ))}
      {ghosts.map((g) => (
        <ArcLeg
          key={g.key}
          leg={g.leg}
          index={g.index}
          ghostBorn={g.born}
          onGone={() => setGhosts((all) => all.filter((x) => x.key !== g.key))}
        />
      ))}
    </group>
  );
}
