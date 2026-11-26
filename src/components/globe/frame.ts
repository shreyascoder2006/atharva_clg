import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Vector3, type Camera } from 'three';

import { SHIPMENT_IDS, type Mode, type ShipmentId } from '@/data/shipment';
import { vector3ToLatLon } from '@/lib/geo';
import { getRoute, vectorAt } from '@/lib/route';
import { cargoAt, locateS, type LegSchedule, type Phase, type Schedule } from '@/lib/schedule';
import { getScheduleFor, useShipment, viewHourOf } from '@/store/shipment';

/** One shipment's smoothed position on the globe this frame. */
export interface Track {
  id: ShipmentId;
  ready: boolean;
  schedule: Schedule;
  /** Smoothed cumulative distance along the journey, km. */
  s: number;
  leg: LegSchedule;
  legIndex: number;
  f: number;
  phase: Phase;
  moving: boolean;
  /** The vehicle to draw: the leg's mode, or the next leg's while dwelling at a port. */
  mode: Mode;
  position: Vector3;
  /** Unit direction of travel (3D, so aircraft pitch with the arc). */
  tangent: Vector3;
}

/**
 * Per-frame derived state, shared by every globe layer.
 *
 * Each shipment's position is smoothed here, once, so its vehicle, the emerald
 * "travelled" fill on its arc and the telemetry pin can never drift apart. It is a
 * module-level object read inside useFrame, never React state: it changes sixty times
 * a second.
 *
 * The top-level fields mirror the selected shipment's track, for layers that only
 * care about the shipment in focus.
 */
export const frame = {
  ready: false,
  selected: SHIPMENT_IDS[0] as ShipmentId,
  tracks: {} as Record<ShipmentId, Track>,
  schedule: null as Schedule | null,
  viewH: 0,
  nowH: 0,
  leg: null as LegSchedule | null,
  legIndex: 0,
  f: 0,
  phase: 'origin' as Phase,
  moving: false,
  position: new Vector3(),
  /** World units per CSS pixel at unit distance; multiply by distance to the camera. */
  worldPerPx: 0.001,
  cameraDistance: 3,
  /** Camera height above the surface, in globe radii. */
  altitude: 2,
  /**
   * Radius offset for ground-hugging layers (roads, rail, vehicles on them). Routes are
   * built a few kilometres up so they read from orbit; close in, that height would
   * show as parallax against the coastline, so it shrinks with the camera.
   */
  groundLift: 0.0007,
  /** Level-of-detail blends, 0 to 1, all driven by camera altitude. */
  lod: { vehicles: 0, coast: 0, borders: 0, detailCoast: 0, detailMask: 0, waves: 0, reliefFine: 0, thin: 0 },
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const p0 = new Vector3();
const p1 = new Vector3();

function updateTrack(id: ShipmentId, h: number, dt: number, driving: boolean) {
  const schedule = getScheduleFor(id);
  const target = cargoAt(schedule, h);
  let t = frame.tracks[id];
  if (!t) {
    t = {
      id,
      ready: false,
      schedule,
      s: target.s,
      leg: target.leg,
      legIndex: 0,
      f: 0,
      phase: target.phase,
      moving: false,
      mode: target.leg.mode,
      position: new Vector3(),
      tangent: new Vector3(0, 0, 1),
    };
    frame.tracks[id] = t;
  }
  if (!t.ready) {
    t.s = target.s;
    t.ready = true;
  }
  // The driver's "arrived" confirmation plays out as a visible drive to the gate;
  // scrubbing should feel immediate.
  const tau = driving ? 0.7 : 0.11;
  t.s += (target.s - t.s) * (1 - Math.exp(-Math.min(dt, 0.1) / tau));

  const loc = locateS(schedule, t.s);
  t.schedule = schedule;
  t.leg = loc.leg;
  t.legIndex = schedule.legs.indexOf(loc.leg);
  t.f = loc.f;
  t.phase = target.phase;
  t.moving = target.moving || Math.abs(target.s - t.s) > 0.5;

  // Dwelling at a port, the box is waiting for its next leg: draw that leg's vehicle
  // berthed at the start of it.
  let leg = loc.leg;
  let f = loc.f;
  const next = schedule.legs[t.legIndex + 1];
  if (f >= 0.999 && next && (t.phase === 'port' || t.phase === 'hub')) {
    leg = next;
    f = 0;
  }
  t.mode = leg.mode;
  const route = getRoute(leg.routeId);
  vectorAt(route, f, t.position);
  const ground = leg.mode === 'road' || leg.mode === 'rail';
  if (ground) t.position.setLength(1 + frame.groundLift);
  // Ships ride the elevated arc from orbit, so they sit on the line with its tracers.
  // Closer in, that arc is hundreds of kilometres up, so the ship settles onto the water.
  if (leg.mode === 'sea') {
    const settle = smooth(0.6, 0.12, frame.altitude);
    t.position.setLength(t.position.length() + (1 + frame.groundLift - t.position.length()) * settle);
  }

  // Heading from a short chord around the current point, about three kilometres.
  const d = Math.min(0.01, 3 / Math.max(1, leg.km));
  vectorAt(route, Math.min(1, f + d), p1);
  vectorAt(route, Math.max(0, f - d), p0);
  p1.sub(p0);
  if (p1.lengthSq() > 1e-14) t.tangent.copy(p1).normalize();
}

export function FrameDriver() {
  useFrame(({ camera, size }, dt) => {
    const st = useShipment.getState();
    const h = viewHourOf(st);

    const cam = camera as PerspectiveCamera;
    // With a view offset the frustum spans the virtual full height, not the canvas.
    const fullH = cam.view?.enabled ? cam.view.fullHeight : size.height;
    frame.worldPerPx = (2 * Math.tan(((cam.fov ?? 40) * Math.PI) / 360)) / Math.max(1, fullH);
    frame.cameraDistance = camera.position.length();
    const alt = Math.max(0, frame.cameraDistance - 1);
    frame.altitude = alt;
    frame.groundLift = Math.min(0.0007, Math.max(0.00003, alt * 0.00022));

    const l = frame.lod;
    l.vehicles = smooth(1.9, 1.3, alt);
    l.coast = 0.28 + 0.6 * smooth(2.4, 0.5, alt);
    l.borders = 0.14 + 0.42 * smooth(2.0, 0.35, alt);
    l.detailCoast = smooth(0.14, 0.045, alt);
    // The high-resolution land patches only out-resolve the global mask below this
    // height; above it they would cost seven anisotropic fetches a pixel for nothing.
    l.detailMask = smooth(1.0, 0.7, alt);
    // Each detail octave only fades in once its wavelength spans several pixels;
    // earlier, its screen-space derivatives alias into blotches.
    l.waves = smooth(0.05, 0.009, alt);
    l.reliefFine = smooth(0.22, 0.03, alt);
    // Lines thin out as the camera closes in, so routes stay hairline-crisp at port scale.
    l.thin = smooth(1.2, 0.01, alt);

    for (const id of SHIPMENT_IDS) updateTrack(id, h, dt, id === 'SHP-2611-0482' && st.driving);

    const sel = frame.tracks[st.selected];
    frame.selected = st.selected;
    frame.schedule = sel.schedule;
    frame.viewH = h;
    frame.nowH = st.nowH;
    frame.leg = sel.leg;
    frame.legIndex = sel.legIndex;
    frame.f = sel.f;
    frame.phase = sel.phase;
    frame.moving = sel.moving;
    frame.position.copy(sel.position);
    frame.ready = true;
  }, -1);
  return null;
}

// Dev-only: where a shipment's vehicle is right now, for the smoke test.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __frame: unknown }).__frame = frame;
  (window as unknown as { __trackLatLon: unknown }).__trackLatLon = (id: ShipmentId) => {
    const t = frame.tracks[id];
    if (!t) return null;
    return vector3ToLatLon(t.position);
  };
}

const tmp = new Vector3();

/** World size of one CSS pixel at a world-space point. */
export function pxAt(camera: Camera, point: Vector3): number {
  return frame.worldPerPx * camera.getWorldPosition(tmp).distanceTo(point);
}

/** 1 when a surface point faces the camera, 0 past the horizon. */
export function facing(camera: Camera, point: Vector3): number {
  const cam = camera.getWorldPosition(tmp);
  const n = point.clone().normalize();
  const toCam = cam.sub(point).normalize();
  return n.dot(toCam);
}
