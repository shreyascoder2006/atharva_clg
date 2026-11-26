import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, type Camera } from 'three';

import { SHIPMENT_IDS, type ShipmentId } from '@/data/shipment';
import { BASE_ALT, getRoute } from '@/lib/route';
import { useShipment } from '@/store/shipment';
import { frame } from './frame';
import { pick } from './pickState';

/**
 * Click a shipment's route on the globe to select it; click the selected shipment's
 * vehicle to dive into its container.
 *
 * The tubes are inflated to a pixel width in the vertex shader, so their CPU geometry
 * is far thinner than what is on screen and raycasting it would miss. Instead, route
 * samples are projected to screen space and the pointer's pixel distance to each
 * segment is measured, skipping anything behind the globe.
 */

const ROUTE_HIT_PX = 11;
const VEHICLE_HIT_PX = 20;

const a = new Vector3();
const b = new Vector3();
const cam = new Vector3();

/** True when the straight line from the camera to `p` passes through the globe first. */
function occluded(p: Vector3): boolean {
  const dx = p.x - cam.x;
  const dy = p.y - cam.y;
  const dz = p.z - cam.z;
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (cam.x * dx + cam.y * dy + cam.z * dz);
  const C = cam.lengthSq() - 0.9999;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return false;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t > 0 && t < 0.999;
}

function toScreen(p: Vector3, camera: Camera, w: number, h: number, out: { x: number; y: number }) {
  a.copy(p).project(camera);
  out.x = ((a.x + 1) / 2) * w;
  out.y = ((1 - a.y) / 2) * h;
  return a.z < 1;
}

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
}

interface Hit {
  id: ShipmentId;
  vehicle: boolean;
  distance: number;
}

function hitTest(mx: number, my: number, camera: Camera, w: number, h: number): Hit | null {
  camera.updateMatrixWorld();
  camera.getWorldPosition(cam);
  const s1 = { x: 0, y: 0 };
  const s2 = { x: 0, y: 0 };
  let best: Hit | null = null;

  for (const id of SHIPMENT_IDS) {
    const track = frame.tracks[id];
    if (!track) continue;

    // The vehicle first: it sits on top of the route.
    if (!occluded(track.position) && toScreen(track.position, camera, w, h, s1)) {
      const d = Math.hypot(s1.x - mx, s1.y - my);
      if (d < VEHICLE_HIT_PX && (!best || d < best.distance)) best = { id, vehicle: true, distance: d };
    }

    for (const leg of track.schedule.legs) {
      const route = getRoute(leg.routeId);
      const ground = leg.mode === 'road' || leg.mode === 'rail';
      const scale = ground ? (1 + frame.groundLift) / (1 + BASE_ALT[leg.mode]) : 1;
      const step = Math.max(1, Math.floor(route.points.length / 160));
      let prevOk = false;
      for (let i = 0; i < route.points.length; i += step) {
        b.copy(route.points[i]).multiplyScalar(scale);
        const ok = !occluded(b) && toScreen(b, camera, w, h, s2);
        if (ok && prevOk) {
          const d = segDist(mx, my, s1.x, s1.y, s2.x, s2.y);
          if (d < ROUTE_HIT_PX && (!best || (!best.vehicle && d < best.distance))) best = { id, vehicle: false, distance: d };
        }
        s1.x = s2.x;
        s1.y = s2.y;
        prevOk = ok;
      }
    }
  }
  return best;
}

export function RoutePicker() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    let raf = 0;
    let last: PointerEvent | null = null;

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };

    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      // A drag is an orbit, not a click.
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
      const p = local(e);
      const hit = hitTest(p.x, p.y, camera, p.w, p.h);
      if (!hit) return;
      const st = useShipment.getState();
      if (hit.id !== st.selected) st.selectShipment(hit.id);
      else if (hit.vehicle) st.startDive();
    };

    const hover = () => {
      raf = 0;
      if (!last || last.buttons) return;
      const p = local(last);
      const hit = hitTest(p.x, p.y, camera, p.w, p.h);
      pick.hovered = hit?.id ?? null;
      el.style.cursor = hit ? 'pointer' : '';
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(hover);
    };
    const onLeave = () => {
      pick.hovered = null;
      el.style.cursor = '';
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    // Dev-only: lets the smoke test click a route the way a person would.
    if (import.meta.env.DEV) {
      (window as unknown as { __routePoint: unknown }).__routePoint = (id: ShipmentId, at = 0.5) => {
        const track = frame.tracks[id];
        const leg = track?.schedule.legs.reduce((x, y) => (y.km > x.km ? y : x));
        if (!leg) return null;
        const pts = getRoute(leg.routeId).points;
        const r = el.getBoundingClientRect();
        camera.getWorldPosition(cam);
        for (let k = 0; k < 40; k++) {
          const i = Math.floor(pts.length * Math.min(0.98, Math.max(0.02, at + (k % 2 ? 1 : -1) * k * 0.01)));
          if (occluded(pts[i])) continue;
          const out = { x: 0, y: 0 };
          if (toScreen(pts[i], camera, r.width, r.height, out) && out.x > 0 && out.y > 0 && out.x < r.width && out.y < r.height)
            return { x: out.x + r.left, y: out.y + r.top };
        }
        return null;
      };
    }

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [gl, camera]);

  return null;
}
