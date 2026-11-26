import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three';

import landPaths from '@/data/land-paths.json';

/**
 * Land masks for the globe surface, painted at runtime from precomputed SVG paths.
 *
 * Channels are data, not colour:
 *   R  land coverage
 *   G  coastline stroke
 *   B  coastal shelf: a soft band either side of the coast, built from stacked strokes,
 *      which the shader reads offshore as shallow-water bathymetry tint
 *
 * The globe shader composes ocean, shelf, land and coast colours from them, so the
 * palette can change without repainting, and edges stay anti-aliased.
 */
export interface DetailMask {
  id: string;
  texture: CanvasTexture;
  /** lon0, lon1, lat0, lat1 in degrees. */
  bounds: [number, number, number, number];
}

export interface LandMasks {
  global: CanvasTexture;
  details: DetailMask[];
}

/** Shelf band widths in degrees, painted widest first; overlapping strokes add up near the coast. */
const SHELF_DEG = [1.1, 0.7, 0.4, 0.18];

function paint(width: number, height: number, d: string, refWidth: number, coastPx: number, pxPerDeg: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const scale = width / refWidth;
  ctx.scale(scale, scale);
  const path = new Path2D(d);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = '#ff0000';
  ctx.fill(path);

  // Additive from here, so each stroke lands in its own channel without touching R.
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(0, 0, 255, 0.25)';
  for (const deg of SHELF_DEG) {
    ctx.lineWidth = (deg * pxPerDeg) / scale;
    ctx.stroke(path);
  }
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = coastPx / scale;
  ctx.stroke(path);
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement, anisotropy: number): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

let cache: LandMasks | null = null;

export function getLandMasks(anisotropy: number, maxTextureSize: number): LandMasks {
  if (cache) return cache;

  // Phones get a 2k surface; everything else gets 4k. The detail patches keep their
  // size because they are what makes the close-up zones and port dioramas legible.
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || maxTextureSize < 8192;
  const gw = small ? 2048 : 4096;
  const g = landPaths.global;

  cache = {
    global: toTexture(paint(gw, gw / 2, g.d, g.width, small ? 1.1 : 1.6, gw / 360), anisotropy),
    details: landPaths.detail.map((r) => ({
      id: r.id,
      texture: toTexture(paint(r.width, r.height, r.d, r.width, 2.2, r.width / (r.bounds.lon1 - r.bounds.lon0)), anisotropy),
      bounds: [r.bounds.lon0, r.bounds.lon1, r.bounds.lat0, r.bounds.lat1],
    })),
  };
  return cache;
}
