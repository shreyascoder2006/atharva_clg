import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Vector3, type Camera } from 'three';

import { getRoute, vectorAt } from '@/lib/route';
import { cargoAt, locateS, type LegSchedule, type Phase, type Schedule } from '@/lib/schedule';
import { getSchedule, useShipment, viewHourOf } from '@/store/shipment';

/**
 * Per-frame derived state, shared by every globe layer.
 *
 * The cargo position is smoothed here, once, so the marker, the emerald "travelled"
 * fill on the arcs and the telemetry pin can never drift apart. It is a module-level
 * object read inside useFrame, never React state: it changes sixty times a second.
 */
export const frame = {
  ready: false,
  schedule: null as Schedule | null,
  viewH: 0,
  nowH: 0,
  /** Smoothed cumulative distance along the journey, km. */
  s: 0,
  leg: null as LegSchedule | null,
  legIndex: 0,
  f: 0,
  phase: 'origin' as Phase,
  moving: false,
  position: new Vector3(),
  /** World units per CSS pixel at unit distance; multiply by distance to the camera. */
  worldPerPx: 0.001,
  cameraDistance: 3,
};

export function FrameDriver() {
  useFrame(({ camera, size }, dt) => {
    const st = useShipment.getState();
    const schedule = getSchedule();
    const h = viewHourOf(st);
    const target = cargoAt(schedule, h);

    if (!frame.ready) {
      frame.s = target.s;
      frame.ready = true;
    }
    // The driver's "arrived" confirmation plays out as a visible drive to the gate;
    // scrubbing should feel immediate.
    const tau = st.driving ? 0.7 : 0.11;
    frame.s += (target.s - frame.s) * (1 - Math.exp(-Math.min(dt, 0.1) / tau));

    const loc = locateS(schedule, frame.s);
    frame.schedule = schedule;
    frame.viewH = h;
    frame.nowH = st.nowH;
    frame.leg = loc.leg;
    frame.legIndex = schedule.legs.indexOf(loc.leg);
    frame.f = loc.f;
    frame.phase = target.phase;
    frame.moving = target.moving || Math.abs(target.s - frame.s) > 0.5;
    vectorAt(getRoute(loc.leg.routeId), loc.f, frame.position);

    const cam = camera as PerspectiveCamera;
    // With a view offset the frustum spans the virtual full height, not the canvas.
    const fullH = cam.view?.enabled ? cam.view.fullHeight : size.height;
    frame.worldPerPx = (2 * Math.tan(((cam.fov ?? 40) * Math.PI) / 360)) / Math.max(1, fullH);
    frame.cameraDistance = camera.position.length();
  }, -1);
  return null;
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
