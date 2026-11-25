import { Vector3 } from 'three';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
export const EARTH_RADIUS_KM = 6371;

export type LatLon = readonly [lat: number, lon: number];

/**
 * Geographic coordinates to a point on a sphere of the given radius.
 *
 * Longitude 0 lands on +X and 90W on +Z with this mapping. It matches three's
 * SphereGeometry UV layout, so a standard equirectangular image (north up, 180W at the
 * left edge) wraps onto the globe without any offset.
 */
export function latLonToVector3(lat: number, lon: number, radius = 1, out = new Vector3()): Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  return out.set(
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  );
}

/** Inverse of latLonToVector3. */
export function vector3ToLatLon(v: Vector3): [number, number] {
  const r = v.length() || 1;
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * RAD2DEG;
  let lon = Math.atan2(v.z, -v.x) * RAD2DEG - 180;
  if (lon < -180) lon += 360;
  return [lat, lon];
}

/** Great-circle distance in km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = (b[0] - a[0]) * DEG2RAD;
  const dLon = (b[1] - a[1]) * DEG2RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * DEG2RAD) * Math.cos(b[0] * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Point a fraction of the way along the great circle from a to b. */
export function slerpLatLon(a: LatLon, b: LatLon, t: number): [number, number] {
  const va = latLonToVector3(a[0], a[1]);
  const vb = latLonToVector3(b[0], b[1]);
  const omega = va.angleTo(vb);
  if (omega < 1e-9) return [a[0], a[1]];
  const s = Math.sin(omega);
  const out = va
    .multiplyScalar(Math.sin((1 - t) * omega) / s)
    .add(vb.multiplyScalar(Math.sin(t * omega) / s));
  return vector3ToLatLon(out);
}

/**
 * Densify a waypoint polyline along great circles so no step exceeds `stepKm`.
 * Returns the points plus cumulative ground distance at each.
 */
export function densify(
  waypoints: readonly LatLon[],
  stepKm: number,
): { points: [number, number][]; km: number[] } {
  const points: [number, number][] = [[waypoints[0][0], waypoints[0][1]]];
  const km: number[] = [0];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const d = haversineKm(a, b);
    const n = Math.max(1, Math.ceil(d / stepKm));
    for (let j = 1; j <= n; j++) {
      points.push(slerpLatLon(a, b, j / n));
      km.push(km[km.length - 1] + d / n);
    }
  }
  return { points, km };
}

/** Unit surface normal for a coordinate (the point itself on a unit sphere). */
export function surfaceNormal(lat: number, lon: number, out = new Vector3()): Vector3 {
  return latLonToVector3(lat, lon, 1, out);
}

/** Local north tangent at a coordinate, used to tilt the camera "from the south". */
export function northTangent(lat: number, lon: number, out = new Vector3()): Vector3 {
  const n = latLonToVector3(lat, lon, 1);
  const up = new Vector3(0, 1, 0);
  return out.copy(up).sub(n.clone().multiplyScalar(up.dot(n))).normalize();
}

export function formatLatLon(lat: number, lon: number, dp = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}°${ns} ${Math.abs(lon).toFixed(dp)}°${ew}`;
}
