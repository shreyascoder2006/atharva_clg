import { useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

/**
 * 3D-anchored HTML without a React root per label.
 *
 * drei's <Html> mounts a separate React root for every label and unmounts it
 * synchronously in a layout-effect cleanup, which React 19 reports as an error (and
 * StrictMode triggers on every mount). Here the overlay elements live in the normal
 * DOM tree, register themselves by id, and a single projector inside the Canvas writes
 * their screen transform and opacity each frame.
 *
 * 3D layers own `position` and `opacity`; DOM components own the content.
 */
export interface Anchor {
  position: Vector3;
  opacity: number;
  el: HTMLElement | null;
  /** Last values written to the DOM, so unchanged frames cost nothing. */
  lastX: number;
  lastY: number;
  lastO: number;
}

const registry = new Map<string, Anchor>();

export function anchor(id: string): Anchor {
  let a = registry.get(id);
  if (!a) {
    a = { position: new Vector3(), opacity: 0, el: null, lastX: NaN, lastY: NaN, lastO: NaN };
    registry.set(id, a);
  }
  return a;
}

/** Callback ref for a DOM overlay element anchored to `id`. */
export function useAnchorRef(id: string) {
  return useCallback(
    (el: HTMLElement | null) => {
      const a = anchor(id);
      a.el = el;
      a.lastX = a.lastY = a.lastO = NaN;
      if (el) {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = '0';
        el.style.willChange = 'transform, opacity';
        el.style.opacity = '0';
      }
    },
    [id],
  );
}

const ndc = new Vector3();

/**
 * Mount last in the Canvas: same-priority frame callbacks run in mount order, so this
 * sees the camera and every anchor after they have moved this frame. (A positive
 * priority would take over R3F's render loop, so ordering is by position instead.)
 */
export function AnchorProjector() {
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    for (const a of registry.values()) {
      const el = a.el;
      if (!el) continue;
      ndc.copy(a.position).project(camera);
      const behind = ndc.z > 1;
      const o = behind ? 0 : Math.round(a.opacity * 100) / 100;
      const x = Math.round(((ndc.x + 1) / 2) * size.width * 2) / 2;
      const y = Math.round(((1 - ndc.y) / 2) * size.height * 2) / 2;
      if (o !== a.lastO) {
        el.style.opacity = String(o);
        el.style.visibility = o <= 0.01 ? 'hidden' : 'visible';
        a.lastO = o;
      }
      if (o > 0.01 && (x !== a.lastX || y !== a.lastY)) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        a.lastX = x;
        a.lastY = y;
      }
    }
  });
  return null;
}
