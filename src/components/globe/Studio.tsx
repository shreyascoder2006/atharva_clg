import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControlsImpl } from '@react-three/drei';
import { DirectionalLight, Object3D, PerspectiveCamera, Vector3 } from 'three';

import { useShipment } from '@/store/shipment';

const KEY_DIR = new Vector3(-0.62, 0.72, 0.88).normalize();
const FILL_DIR = new Vector3(0.8, -0.25, 0.6).normalize();
const v = new Vector3();
const focus = new Vector3();

/**
 * Daylight studio rig.
 *
 * The key light is fixed relative to the camera (upper left, slightly in front), so
 * whatever face of the planet a role flies to is lit like a product shot. Its shadow
 * frustum shrinks around the orbit target at port scale, which keeps the arc and pillar
 * shadows crisp from orbital distance down to the JNPT gate.
 */
export function StudioLights() {
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as CameraControlsImpl | null;
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    scene.add(target);
    if (key.current) key.current.target = target;
    if (fill.current) fill.current.target = target;
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);

  useFrame(() => {
    const k = key.current;
    if (!k) return;
    if (controls) controls.getTarget(focus);
    else focus.set(0, 0, 0);

    const dist = camera.position.distanceTo(focus);
    v.copy(KEY_DIR).applyQuaternion(camera.quaternion);
    k.position.copy(focus).addScaledVector(v, 4);
    target.position.copy(focus);

    const size = Math.min(1.25, Math.max(0.05, dist * 0.85));
    const cam = k.shadow.camera;
    if (Math.abs(cam.right - size) > 1e-4) {
      cam.left = -size;
      cam.right = size;
      cam.top = size;
      cam.bottom = -size;
      cam.updateProjectionMatrix();
      // Bias in world units has to scale with the frustum or the tiny port-scale
      // frustum would detach every shadow from its caster.
      k.shadow.normalBias = size * 0.006;
      k.shadow.bias = -0.0004;
    }

    if (fill.current) {
      v.copy(FILL_DIR).applyQuaternion(camera.quaternion);
      fill.current.position.copy(focus).addScaledVector(v, 4);
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#b7c6da', 1.55]} />
      <directionalLight
        ref={key}
        intensity={2.1}
        color="#fffdf8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={9}
        shadow-radius={3.5}
        shadow-intensity={0.55}
      />
      <directionalLight ref={fill} intensity={0.45} color="#dfe9ff" />
    </>
  );
}

/**
 * Shifts the projection centre so the globe sits in the space the HUD leaves free:
 * left of the workspace panel and above the timeline. Done in screen space with
 * setViewOffset, so it holds at every zoom level without touching the orbit.
 */
export function ViewOffset() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const panelOpen = useShipment((s) => s.panelOpen);
  const current = useRef({ x: 0, y: 0 });

  const target = useMemo(() => {
    const wide = size.width >= 1100;
    const right = wide && panelOpen ? 404 : 0;
    // The left column (shipment card, lens dock and card) is ~372px wide.
    const left = wide ? 340 : 0;
    const top = 70;
    const bottom = size.width >= 760 ? 200 : 120;
    return { x: (right - left) / 2, y: (bottom - top) / 2 };
  }, [size.width, panelOpen]);

  useFrame((_, dt) => {
    const c = current.current;
    const k = 1 - Math.exp(-dt * 6);
    c.x += (target.x - c.x) * k;
    c.y += (target.y - c.y) * k;
    const fullW = size.width + 2 * Math.abs(c.x);
    const fullH = size.height + 2 * Math.abs(c.y);
    const ox = c.x > 0 ? 2 * c.x : 0;
    const oy = c.y > 0 ? 2 * c.y : 0;
    camera.aspect = fullW / fullH;
    camera.setViewOffset(fullW, fullH, ox, oy, size.width, size.height);
    camera.updateProjectionMatrix();
  });

  return null;
}
