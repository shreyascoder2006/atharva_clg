import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

import { globeShadow } from './shadowRef';

const centre = new Vector3();
const rim = new Vector3();

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * A soft contact shadow under the planet, as if it rested just above a studio floor.
 *
 * It is a blurred DOM ellipse behind the transparent canvas, placed each frame from
 * the globe's projected silhouette (centre and screen radius), so it follows camera
 * flights and view offsets. It fades out once the globe is larger than the screen.
 */
export function GlobeShadowDriver() {
  const size = useThree((s) => s.size);
  const last = useRef('');

  useFrame(({ camera }) => {
    const el = globeShadow.current;
    if (!el) return;
    const d = camera.position.length();
    const opacity = smooth(1.3, 2.4, d);
    if (opacity < 0.01) {
      if (last.current !== 'hidden') el.style.opacity = '0';
      last.current = 'hidden';
      return;
    }
    // The silhouette circle sits 1/d towards the camera, with radius sqrt(1 - 1/d²).
    centre.copy(camera.position).normalize().multiplyScalar(1 / d);
    rim.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(Math.sqrt(1 - 1 / (d * d))).add(centre);
    centre.project(camera);
    rim.project(camera);
    const cx = ((centre.x + 1) / 2) * size.width;
    const cy = ((1 - centre.y) / 2) * size.height;
    const r = Math.hypot(((rim.x - centre.x) / 2) * size.width, ((rim.y - centre.y) / 2) * size.height);
    const w = r * 1.75;
    const h = r * 0.26;
    const key = `${cx.toFixed(1)}|${cy.toFixed(1)}|${r.toFixed(1)}|${opacity.toFixed(2)}`;
    if (key === last.current) return;
    last.current = key;
    el.style.opacity = String(opacity);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = `translate3d(${cx - w / 2}px, ${cy + r * 0.97 - h / 2}px, 0)`;
  });

  return null;
}
