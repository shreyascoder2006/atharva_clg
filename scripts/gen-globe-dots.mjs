/**
 * Precomputes the globe's land dot matrix.
 *
 * Samples a Fibonacci sphere (uniform density, unlike a lat/lon grid which bunches at
 * the poles), keeps the points that fall on land, and writes them as a flat lat/lon
 * array. Doing this at build time keeps ~1.5s of point-in-polygon work out of startup.
 *
 *   node scripts/gen-globe-dots.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);

const SAMPLES = 34000; // ~9.8k land dots at ~29% land coverage
const OUT = new URL('../src/data/globe-dots.json', import.meta.url);

const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-110m.json'), 'utf8'));
const land = feature(topo, topo.objects.land);

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const lats = [];
const lons = [];

for (let i = 0; i < SAMPLES; i++) {
  // y from 1 to -1, uniform in sin(latitude) => uniform area density
  const y = 1 - (i / (SAMPLES - 1)) * 2;
  const lat = (Math.asin(y) * 180) / Math.PI;
  let lon = ((GOLDEN * i * 180) / Math.PI) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  if (!geoContains(land, [lon, lat])) continue;
  lats.push(Math.round(lat * 100) / 100);
  lons.push(Math.round(lon * 100) / 100);
}

const flat = [];
for (let i = 0; i < lats.length; i++) flat.push(lats[i], lons[i]);

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    meta: {
      note: 'Land dot positions for the globe, precomputed by scripts/gen-globe-dots.mjs.',
      source: 'Natural Earth 110m land via the world-atlas package.',
      sampling: `Fibonacci sphere, ${SAMPLES} samples, land points retained.`,
      format: 'Flat array of [lat, lon, lat, lon, ...] in degrees.',
      count: lats.length,
    },
    dots: flat,
  }),
);

const kb = (JSON.stringify(flat).length / 1024).toFixed(0);
console.log(`land dots: ${lats.length} of ${SAMPLES} samples  (~${kb} KB)`);
