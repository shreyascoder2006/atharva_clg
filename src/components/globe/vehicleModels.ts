import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { PALETTE } from '@/lib/palette';

/**
 * Stylised low-poly vehicles, one merged geometry each with vertex colours, so every
 * vehicle is a single draw call.
 *
 * Model space: +Z is forward, +Y is up, overall length is about 1. The globe layer
 * scales them to a constant size on screen.
 */

const tint = new Color();

/** Bake a flat colour into a part and drop attributes mergeGeometries can't reconcile. */
function part(g: BufferGeometry, hex: string): BufferGeometry {
  const geom = g.index ? g.toNonIndexed() : g;
  geom.deleteAttribute('uv');
  tint.set(hex);
  const n = geom.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geom;
}

const box = (w: number, h: number, l: number, x: number, y: number, z: number, hex: string) =>
  part(new BoxGeometry(w, h, l).translate(x, y, z), hex);

/** Extrude a top-view outline (x across, y along, bow at negative y) upwards by `height`. */
function plan(points: [number, number][], height: number, hex: string, y0 = 0): BufferGeometry {
  const s = new Shape(points.map(([x, y]) => ({ x, y }) as never));
  const g = new ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
  // Shape y -> model -Z, extrusion -> model +Y.
  g.rotateX(-Math.PI / 2).translate(0, y0, 0);
  return part(g, hex);
}

const CONTAINER_COLORS = [PALETTE.cobalt, PALETTE.emerald, PALETTE.amber, '#F8FAFC', PALETTE.crimson, '#64748B', '#0EA5E9'];

export function makeShip(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Hull with a pointed bow, and a darker boot-top band under it.
  const outline: [number, number][] = [
    [-0.085, 0.5],
    [0.085, 0.5],
    [0.09, -0.26],
    [0, -0.5],
    [-0.09, -0.26],
  ];
  parts.push(plan(outline, 0.025, '#7F1D1D', 0));
  parts.push(plan(outline, 0.045, '#1E2A44', 0.025));
  // Container stacks: bays along the deck, rows across, two tiers.
  let k = 0;
  for (let bay = 0; bay < 7; bay++) {
    for (let row = 0; row < 3; row++) {
      for (let tier = 0; tier < 2; tier++) {
        const hex = CONTAINER_COLORS[(bay * 5 + row * 3 + tier * 7 + k++) % CONTAINER_COLORS.length];
        parts.push(box(0.048, 0.034, 0.09, (row - 1) * 0.052, 0.087 + tier * 0.036, -0.29 + bay * 0.098, hex));
      }
    }
  }
  // Accommodation block and funnel at the stern.
  parts.push(box(0.15, 0.11, 0.075, 0, 0.125, -0.41, '#F8FAFC'));
  parts.push(box(0.17, 0.012, 0.085, 0, 0.186, -0.41, '#CBD5E1'));
  parts.push(box(0.035, 0.06, 0.035, 0, 0.2, -0.46, PALETTE.cobalt));
  return mergeGeometries(parts, false);
}

export function makeAircraft(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const white = '#F8FAFC';
  const fus = new CylinderGeometry(0.055, 0.055, 0.82, 12).rotateX(Math.PI / 2);
  parts.push(part(fus, white));
  parts.push(part(new ConeGeometry(0.055, 0.14, 12).rotateX(Math.PI / 2).translate(0, 0, 0.48), white));
  parts.push(part(new ConeGeometry(0.055, 0.2, 12).rotateX(-Math.PI / 2).translate(0, 0.012, -0.51), white));
  // Cobalt cheatline along the fuselage.
  parts.push(box(0.112, 0.012, 0.8, 0, 0.012, 0, PALETTE.cobalt));
  // Swept wings, mirrored.
  for (const side of [1, -1]) {
    const pts: [number, number][] = [
      [0, -0.09],
      [0.55 * side, 0.12],
      [0.55 * side, 0.18],
      [0, 0.08],
    ];
    parts.push(plan(side > 0 ? pts : [...pts].reverse(), 0.012, '#E2E8F0', -0.02));
    // Two engines under each wing.
    for (const x of [0.17, 0.33]) {
      const z = 0.06 - x * 0.38;
      parts.push(part(new CylinderGeometry(0.024, 0.02, 0.1, 10).rotateX(Math.PI / 2).translate(x * side, -0.05, z), '#64748B'));
    }
    // Horizontal stabiliser.
    const tail: [number, number][] = [
      [0, 0.38],
      [0.2 * side, 0.48],
      [0.2 * side, 0.52],
      [0, 0.47],
    ];
    parts.push(plan(side > 0 ? tail : [...tail].reverse(), 0.01, '#E2E8F0', 0.01));
  }
  // Vertical fin in the livery colour, swept back. Drawn directly in (z, y); the
  // rotation maps shape x onto model z and the extrusion onto model -x.
  const fin = new Shape([
    { x: -0.3, y: 0 },
    { x: -0.52, y: 0 },
    { x: -0.57, y: 0.2 },
    { x: -0.47, y: 0.2 },
  ] as never);
  const finGeom = new ExtrudeGeometry(fin, { depth: 0.012, bevelEnabled: false });
  finGeom.rotateY(-Math.PI / 2).translate(0.006, 0.04, 0);
  parts.push(part(finGeom, PALETTE.cobalt));
  return mergeGeometries(parts, false);
}

export function makeTruck(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Cab, windscreen and roof fairing.
  parts.push(box(0.17, 0.16, 0.17, 0, 0.115, 0.39, PALETTE.violet));
  parts.push(box(0.15, 0.06, 0.012, 0, 0.15, 0.478, '#1E293B'));
  parts.push(box(0.16, 0.04, 0.12, 0, 0.215, 0.37, '#A78BFA'));
  // Chassis and the box on it.
  parts.push(box(0.15, 0.03, 0.72, 0, 0.045, -0.03, '#334155'));
  parts.push(box(0.17, 0.17, 0.6, 0, 0.15, -0.08, PALETTE.cobalt));
  for (let i = 0; i < 8; i++) parts.push(box(0.172, 0.15, 0.008, 0, 0.15, -0.36 + i * 0.08, '#1D4ED8'));
  // Wheels.
  for (const z of [0.36, -0.2, -0.3]) {
    for (const x of [0.085, -0.085]) {
      parts.push(part(new CylinderGeometry(0.035, 0.035, 0.03, 10).rotateZ(Math.PI / 2).translate(x, 0.035, z), '#0F172A'));
    }
  }
  return mergeGeometries(parts, false);
}

/**
 * Ship wake: two arms spreading out behind the stern plus a foam centre line, as one
 * flat strip mesh. uv.x runs 0 at the stern to 1 at the tail; uv.y runs across.
 */
export function makeWake(): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const N = 24;
  const arm = (side: number, spread: number, width: number) => {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = -0.48 - t * 2.4;
      const cx = side * (0.06 + t * spread);
      const w = width * (0.4 + t);
      pos.push(cx - w, 0.004, z, cx + w, 0.004, z);
      uv.push(t, 0, t, 1);
      if (i < N) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  };
  arm(1, 0.62, 0.025);
  arm(-1, 0.62, 0.025);
  arm(0, 0, 0.04);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Aircraft contrails: two long thin ribbons from the outboard engines. */
export function makeContrail(): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const N = 30;
  for (const x of [0.33, -0.33]) {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = -0.05 - t * 5.5;
      const w = 0.012 + t * 0.05;
      pos.push(x - w, -0.04, z, x + w, -0.04, z);
      uv.push(t, 0, t, 1);
      if (i < N) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
