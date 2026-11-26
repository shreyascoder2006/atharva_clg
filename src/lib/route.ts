import { Vector3 } from 'three';

import { ROUTES, type Mode, type RouteDef, type RouteId } from '@/data/shipment';
import { EARTH_RADIUS_KM, haversineKm, latLonToVector3, slerpLatLon } from '@/lib/geo';

/** Surface clearance per mode, in globe radii. Ground legs hug the land; sea and air lift. */
export const BASE_ALT: Record<Mode, number> = {
  road: 0.0007,
  rail: 0.0009,
  sea: 0.0012,
  air: 0.0016,
};

const STEP_KM: Record<Mode, number> = { road: 1.2, rail: 1.2, sea: 35, air: 50 };

/** How high an elevated hop rises, as a function of the hop's angular length. */
function hopLift(mode: Mode, angle: number): number {
  if (mode === 'air') return Math.min(0.17, 0.32 * angle);
  if (mode === 'sea') return Math.min(0.085, 0.2 * angle);
  return 0;
}

export interface RouteGeom {
  id: RouteId;
  mode: Mode;
  label: string;
  /** Dense samples. lat/lon in degrees, r in globe radii. */
  lat: Float64Array;
  lon: Float64Array;
  r: Float64Array;
  /** Cumulative ground fraction (0..1) at each sample. */
  f: Float64Array;
  /** Cumulative 3D arc-length fraction (0..1) at each sample: what TubeGeometry uv.x is. */
  arc: Float64Array;
  /** Ground distance including road and rail windiness, km. */
  km: number;
  /** Great-circle distance through the waypoints, km. Shared prefixes match on this. */
  rawKm: number;
  /** Ground fraction at each original waypoint, for placing events on the route. */
  waypointF: number[];
  points: Vector3[];
}

function build(def: RouteDef): RouteGeom {
  const step = STEP_KM[def.mode];
  const lat: number[] = [def.waypoints[0][0]];
  const lon: number[] = [def.waypoints[0][1]];
  const km: number[] = [0];
  const waypointKm: number[] = [0];

  for (let i = 0; i < def.waypoints.length - 1; i++) {
    const a = def.waypoints[i];
    const b = def.waypoints[i + 1];
    const d = haversineKm(a, b);
    const n = Math.max(1, Math.ceil(d / step));
    for (let j = 1; j <= n; j++) {
      const p = slerpLatLon(a, b, j / n);
      lat.push(p[0]);
      lon.push(p[1]);
      km.push(km[km.length - 1] + d / n);
    }
    waypointKm.push(km[km.length - 1]);
  }

  const total = km[km.length - 1] || 1;
  const n = lat.length;
  const r = new Float64Array(n);
  const touch = def.touchdowns ?? [0, def.waypoints.length - 1];
  const base = BASE_ALT[def.mode];

  for (let i = 0; i < n; i++) {
    const s = km[i];
    let lift = 0;
    for (let h = 0; h < touch.length - 1; h++) {
      const a = waypointKm[touch[h]];
      const b = waypointKm[touch[h + 1]];
      if (s >= a && s <= b && b > a) {
        const u = (s - a) / (b - a);
        lift = hopLift(def.mode, (b - a) / EARTH_RADIUS_KM) * (def.liftScale ?? 1) * Math.sin(Math.PI * u);
        break;
      }
    }
    r[i] = 1 + base + lift;
  }

  const points = Array.from({ length: n }, (_, i) => latLonToVector3(lat[i], lon[i], r[i]));
  const arc = new Float64Array(n);
  for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + points[i].distanceTo(points[i - 1]);
  const arcTotal = arc[n - 1] || 1;
  for (let i = 0; i < n; i++) arc[i] /= arcTotal;

  return {
    id: def.id as RouteId,
    mode: def.mode,
    label: def.label,
    lat: Float64Array.from(lat),
    lon: Float64Array.from(lon),
    r,
    f: Float64Array.from(km, (k) => k / total),
    arc,
    km: total * def.windiness,
    rawKm: total,
    waypointF: waypointKm.map((k) => k / total),
    points,
  };
}

const cache = new Map<RouteId, RouteGeom>();

export function getRoute(id: RouteId): RouteGeom {
  let g = cache.get(id);
  if (!g) {
    g = build(ROUTES[id]);
    cache.set(id, g);
  }
  return g;
}

/** Index of the sample at or just before ground fraction `f`. */
function seek(arr: Float64Array, f: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= f) lo = mid;
    else hi = mid;
  }
  return lo;
}

export interface RoutePoint {
  lat: number;
  lon: number;
  r: number;
}

/** Position at a ground fraction, interpolated between samples. */
export function pointAt(g: RouteGeom, f: number, out: RoutePoint = { lat: 0, lon: 0, r: 1 }): RoutePoint {
  const t = Math.max(0, Math.min(1, f));
  const i = seek(g.f, t);
  const j = Math.min(g.f.length - 1, i + 1);
  const span = g.f[j] - g.f[i];
  const u = span > 0 ? (t - g.f[i]) / span : 0;
  out.lat = g.lat[i] + (g.lat[j] - g.lat[i]) * u;
  // Routes never cross the antimeridian, so plain interpolation is safe.
  out.lon = g.lon[i] + (g.lon[j] - g.lon[i]) * u;
  out.r = g.r[i] + (g.r[j] - g.r[i]) * u;
  return out;
}

/** World-space position at a ground fraction. */
export function vectorAt(g: RouteGeom, f: number, out = new Vector3()): Vector3 {
  const t = Math.max(0, Math.min(1, f));
  const i = seek(g.f, t);
  const j = Math.min(g.points.length - 1, i + 1);
  const span = g.f[j] - g.f[i];
  const u = span > 0 ? (t - g.f[i]) / span : 0;
  return out.copy(g.points[i]).lerp(g.points[j], u);
}

/** Converts a ground fraction to the tube's arc-length fraction, which is what shaders see. */
export function arcAt(g: RouteGeom, f: number): number {
  const t = Math.max(0, Math.min(1, f));
  const i = seek(g.f, t);
  const j = Math.min(g.f.length - 1, i + 1);
  const span = g.f[j] - g.f[i];
  const u = span > 0 ? (t - g.f[i]) / span : 0;
  return g.arc[i] + (g.arc[j] - g.arc[i]) * u;
}

/** Ground fraction of the sample nearest a coordinate. Used to place events on a route. */
export function nearestF(g: RouteGeom, lat: number, lon: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < g.lat.length; i++) {
    const d = (g.lat[i] - lat) ** 2 + (g.lon[i] - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return g.f[best];
}
