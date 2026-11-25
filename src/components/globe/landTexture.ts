import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three';

import landPaths from '@/data/land-paths.json';

/**
 * Land masks for the globe surface, painted at runtime from precomputed SVG paths.
 *
 * Channels are data, not colour: R is land coverage and G is the coastline stroke. The
 * globe shader composes ocean, land and coast colours from them, so the palette can
 * change without repainting, and edges stay anti-aliased.
 */
export interface DetailMask {
  texture: CanvasTexture;
  /** lon0, lon1, lat0, lat1 in degrees. */
  bounds: [number, number, number, number];
}

export interface LandMasks {
  global: CanvasTexture;
  details: DetailMask[];
}

function paint(width: number, height: number, d: string, refWidth: number, coastPx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const scale = width / refWidth;
  ctx.scale(scale, scale);
  const path = new Path2D(d);

  ctx.fillStyle = '#ff0000';
  ctx.fill(path);

  // Additive so the stroke lands in G without touching the land coverage in R.
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#00ff00';
  ctx.lineJoin = 'round';
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

  // Phones get a 2k surface; everything else gets 4k. The detail patches stay 2k
  // because they are what makes the close-up camera zones legible.
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || maxTextureSize < 8192;
  const gw = small ? 2048 : 4096;
  const g = landPaths.global;

  cache = {
    global: toTexture(paint(gw, gw / 2, g.d, g.width, small ? 1.1 : 1.6), anisotropy),
    details: landPaths.detail.map((r) => ({
      texture: toTexture(paint(r.width, r.height, r.d, r.width, 2.2), anisotropy),
      bounds: [r.bounds.lon0, r.bounds.lon1, r.bounds.lat0, r.bounds.lat1],
    })),
  };
  return cache;
}
