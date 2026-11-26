/**
 * Precomputes the land silhouettes the globe paints into its surface textures.
 *
 * Output is SVG path data in equirectangular pixel space, so the browser can paint it
 * with `new Path2D(d)` - no d3-geo, topojson or point-in-polygon work at runtime.
 *
 *   global : Natural Earth 50m land, whole planet, at a 4096 x 2048 reference size.
 *   detail : Natural Earth 10m land clipped to two Western India patches (the Konkan
 *            coast, and Mumbai to Pune), 2048 px wide each. This is where the Customs
 *            Broker and Transporter camera zones sit, close enough that the global
 *            texture alone would smear JNPT and Thane Creek into one blob.
 *
 * Rings are simplified with Ramer-Douglas-Peucker at sub-pixel tolerance and written
 * as relative, quantised path commands, which keeps the whole file under 90 KB.
 *
 *   node scripts/gen-land-paths.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoEquirectangular, geoIdentity, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const load = (name) => {
  const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/${name}`), 'utf8'));
  return feature(topo, topo.objects.land);
};

/**
 * Ramer-Douglas-Peucker on a projected ring. Detail below one texel is invisible in
 * the texture, so simplifying at sub-pixel tolerance cuts the payload by an order of
 * magnitude without moving any coastline by a visible amount.
 */
function simplify(points, tol) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let best = -1;
    let bestD = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d2 = ex * ex + ey * ey;
      if (d2 > bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function area(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return a / 2;
}

/** geoPath context that records rings, then emits compact simplified SVG path data. */
function pathData(projection, geo, tol, dp, minArea = 0) {
  const rings = [];
  let ring = null;
  const ctx = {
    moveTo(x, y) {
      ring = [[x, y]];
      rings.push(ring);
    },
    lineTo(x, y) {
      ring.push([x, y]);
    },
    closePath() {},
    arc() {},
  };
  geoPath(projection, ctx)(geo);
  const f = (n) => {
    const v = n.toFixed(dp);
    return dp ? v.replace(/\.?0+$/, '') : v;
  };
  // Relative commands on a quantised grid: most steps become one- or two-digit
  // deltas. Quantising first and accumulating the rounded deltas keeps the error from
  // drifting along a long coastline.
  const q = 10 ** dp;
  let d = '';
  for (const r of rings) {
    const pts = simplify(r, tol);
    if (pts.length < 3 || Math.abs(area(pts)) < minArea) continue;
    let px = Math.round(pts[0][0] * q);
    let py = Math.round(pts[0][1] * q);
    let seg = `M${f(px / q)} ${f(py / q)}l`;
    let first = true;
    let steps = 0;
    for (let i = 1; i < pts.length; i++) {
      const x = Math.round(pts[i][0] * q);
      const y = Math.round(pts[i][1] * q);
      if (x === px && y === py) continue;
      const dx = f((x - px) / q);
      const dy = f((y - py) / q);
      seg += `${first || dx.startsWith('-') ? '' : ' '}${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
      first = false;
      steps++;
      px = x;
      py = y;
    }
    // An empty 'l' would make Path2D reject the rest of the string, so degenerate
    // rings are dropped rather than emitted.
    if (steps >= 2) d += `${seg}z`;
  }
  return d;
}

// --- Global -----------------------------------------------------------------
const GW = 4096;
const GH = 2048;
const globalProj = geoEquirectangular()
  .scale(GW / (2 * Math.PI))
  .translate([GW / 2, GH / 2])
  .precision(0);
const globalD = pathData(globalProj, load('land-50m.json'), 0.6, 0, 3);

// --- Detail regions --------------------------------------------------------
/**
 * Each region is a planar equirectangular patch. Planar mapping is exact for a patch
 * this small, and geoIdentity's clipExtent trims the 10m coastline to the patch
 * without any antimeridian handling.
 */
function region(bounds, width, tol) {
  const s = width / (bounds.lon1 - bounds.lon0);
  const height = Math.round((width * (bounds.lat1 - bounds.lat0)) / (bounds.lon1 - bounds.lon0));
  const proj = geoIdentity()
    .reflectY(true)
    .scale(s)
    .translate([-bounds.lon0 * s, bounds.lat1 * s])
    .clipExtent([
      [-2, -2],
      [width + 2, height + 2],
    ]);
  return { width, height, bounds, d: pathData(proj, land10, tol, 1, 1) };
}

const land10 = load('land-10m.json');

/**
 * Detail patches, each a planar equirectangular tile of Natural Earth 10m land. They sit
 * under the camera zones and the port dioramas, where the 50m global texture would smear
 * harbours into blobs. Widths are chosen so each patch is roughly 1:1 with the screen
 * at the zoom where it matters.
 */
const DETAIL = [
  // Western India: Konkan coast up to the Gulf of Kutch (JNPT, Surat, Mundra).
  { id: 'westIndia', bounds: { lat0: 15.5, lat1: 24.0, lon0: 67.5, lon1: 76.5 }, width: 2048 },
  // Mumbai-Pune: the Transporter's inland leg, close enough to read Thane Creek and JNPT.
  { id: 'mumbaiPune', bounds: { lat0: 17.9, lat1: 20.1, lon0: 72.3, lon1: 74.5 }, width: 2048 },
  { id: 'mundra', bounds: { lat0: 22.45, lat1: 23.05, lon0: 69.3, lon1: 70.1 }, width: 1024 },
  { id: 'rotterdam', bounds: { lat0: 51.65, lat1: 52.25, lon0: 3.7, lon1: 4.7 }, width: 1024 },
  { id: 'jebelAli', bounds: { lat0: 24.75, lat1: 25.3, lon0: 54.75, lon1: 55.45 }, width: 1024 },
  { id: 'suez', bounds: { lat0: 29.75, lat1: 31.45, lon0: 31.95, lon1: 32.75 }, width: 512 },
];
const details = DETAIL.map((r) => ({ id: r.id, ...region(r.bounds, r.width, 0.35) }));

const out = {
  meta: {
    note: 'Land silhouettes for the globe textures, precomputed by scripts/gen-land-paths.mjs.',
    source: 'Natural Earth 50m (global) and 10m (detail) land via the world-atlas package.',
    format: 'SVG path data in equirectangular pixel space; paint with Path2D.',
  },
  global: { width: GW, height: GH, d: globalD },
  detail: details,
};

const target = new URL('../src/data/land-paths.json', import.meta.url);
writeFileSync(target, JSON.stringify(out));
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`global ${kb(globalD.length)}; detail ${details.map((r) => `${r.id} ${kb(r.d.length)}`).join(', ')}`);

// --- Vector coastlines and borders ---------------------------------------------
/**
 * Crisp line layers drawn over the textures as the camera closes in. Coordinates are
 * quantised to integers and shipped as base64 typed arrays: 50m lines at 0.01 degrees
 * (Int16), 10m detail coastlines at 0.00001 degrees (Int32).
 */
import('topojson-client').then(({ mesh }) => {
  const topo = (name) => JSON.parse(readFileSync(require.resolve(`world-atlas/${name}`), 'utf8'));
  const land50 = topo('land-50m.json');
  const countries50 = topo('countries-50m.json');
  const land10t = topo('land-10m.json');

  const lines = (geom) => (geom.type === 'MultiLineString' ? geom.coordinates : [geom.coordinates]);
  const simplifyLine = (line, tol) => simplify(line, tol);

  const encode = (polylines, scale, Arr) => {
    const lens = [];
    const flat = [];
    for (const l of polylines) {
      if (l.length < 2) continue;
      lens.push(l.length);
      for (const [lon, lat] of l) flat.push(Math.round(lat * scale), Math.round(lon * scale));
    }
    const arr = Arr.from(flat);
    return { scale, lens, data: Buffer.from(arr.buffer).toString('base64') };
  };

  // Islets smaller than ~15 km across vanish below the zoom where this layer appears.
  const extent = (l) => {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const [x, y] of l) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
    return Math.max(b - a, d - c);
  };
  const coast = lines(mesh(land50, land50.objects.land))
    .filter((l) => extent(l) > 0.14)
    .map((l) => simplifyLine(l, 0.03));
  const borders = lines(mesh(countries50, countries50.objects.countries, (a, b) => a !== b)).map((l) =>
    simplifyLine(l, 0.02),
  );

  // 10m coastline, clipped to the detail patches.
  const coast10 = lines(mesh(land10t, land10t.objects.land));
  const detail = [];
  for (const r of DETAIL) {
    const { lat0, lat1, lon0, lon1 } = r.bounds;
    const inside = ([lon, lat]) => lon >= lon0 && lon <= lon1 && lat >= lat0 && lat <= lat1;
    for (const l of coast10) {
      let run = [];
      for (const p of l) {
        if (inside(p)) run.push(p);
        else {
          if (run.length > 1) detail.push(simplifyLine(run, 0.0012));
          run = [];
        }
      }
      if (run.length > 1) detail.push(simplifyLine(run, 0.0012));
    }
  }

  const vectors = {
    meta: { note: 'Vector coastlines and borders, precomputed by scripts/gen-land-paths.mjs.', format: 'base64 [lat, lon] pairs / scale' },
    coast: encode(coast, 100, Int16Array),
    borders: encode(borders, 100, Int16Array),
    detailCoast: encode(detail, 1e5, Int32Array),
  };
  writeFileSync(new URL('../src/data/vectors.json', import.meta.url), JSON.stringify(vectors));
  const pts = (e) => e.lens.reduce((a, b) => a + b, 0);
  console.log(
    `vectors: coast ${pts(vectors.coast)} pts, borders ${pts(vectors.borders)} pts, detail ${pts(vectors.detailCoast)} pts, ${kb(JSON.stringify(vectors).length)}`,
  );
});
