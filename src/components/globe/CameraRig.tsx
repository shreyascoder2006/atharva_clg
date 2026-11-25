import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';

import type { Role } from '@/data/shipment';
import { latLonToVector3, type LatLon } from '@/lib/geo';
import { useShipment } from '@/store/shipment';
import { frame } from './frame';

const { ACTION } = CameraControlsImpl;

/**
 * Camera zones, one per stakeholder lens.
 *
 * Global zones orbit the planet's centre. Port-scale zones orbit a point on the
 * surface, looking in from the south at an oblique angle so pillars and arcs read as
 * 3D objects rather than a map.
 */
interface Zone {
  cam: LatLon;
  camR: number;
  /** Surface target; null orbits the centre. */
  target: LatLon | null;
}

const ZONES: Record<Role, Zone> = {
  exporter: { cam: [27, 38], camR: 3.55, target: null },
  forwarder: { cam: [16, 57], camR: 2.25, target: null },
  broker: { cam: [18.47, 72.985], camR: 1.0068, target: [18.952, 72.97] },
  transporter: { cam: [17.55, 73.38], camR: 1.024, target: [18.84, 73.38] },
};

const INTRO: Zone = { cam: [14, 62], camR: 4.6, target: null };

interface Flight {
  p0: Vector3;
  p1: Vector3;
  t0: Vector3;
  t1: Vector3;
  rc: number;
  elapsed: number;
  duration: number;
  surface: boolean;
  onDone?: () => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function zonePose(z: Zone): { pos: Vector3; target: Vector3 } {
  return {
    pos: latLonToVector3(z.cam[0], z.cam[1], z.camR),
    target: z.target ? latLonToVector3(z.target[0], z.target[1], 1) : new Vector3(),
  };
}

export function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const flight = useRef<Flight | null>(null);
  const idle = useRef({ since: 0, sway: 0, active: false });
  const camera = useThree((s) => s.camera);

  const role = useShipment((s) => s.role);
  const nonce = useShipment((s) => s.flightNonce);
  const twin = useShipment((s) => s.twin);

  const fly = (pos: Vector3, target: Vector3, surface: boolean, onDone?: () => void, minDuration = 1.5) => {
    const c = controlsRef.current;
    if (!c) return;
    const p0 = c.getPosition(new Vector3());
    const t0 = c.getTarget(new Vector3());
    const angle = p0.clone().normalize().angleTo(pos.clone().normalize());
    const r0 = p0.length();
    const r1 = pos.length();
    // Lift mid-flight in proportion to how far round the planet the camera travels,
    // so a long hop arcs over the globe instead of skimming its surface.
    const rc = Math.min(3.4, Math.max((r0 + r1) / 2, 1 + angle * 1.25, Math.min(r0, r1) + angle * 0.6));

    // Relax constraints for the flight; the destination zone sets its own.
    c.minDistance = 0.004;
    c.maxDistance = 12;
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI;
    c.minAzimuthAngle = -Infinity;
    c.maxAzimuthAngle = Infinity;

    flight.current = {
      p0,
      p1: pos,
      t0,
      t1: target,
      rc,
      elapsed: 0,
      duration: Math.min(2.6, minDuration + angle * 1.1 + Math.abs(Math.log(r1 / r0)) * 0.25),
      surface,
      onDone,
    };
    idle.current.active = false;
  };

  const settle = (surface: boolean) => {
    const c = controlsRef.current;
    if (!c) return;
    if (surface) {
      const d = c.distance;
      c.minDistance = d * 0.25;
      c.maxDistance = d * 6;
      // Keep the camera well above the local horizon when orbiting a surface point.
      const p = c.polarAngle;
      const a = c.azimuthAngle;
      c.minPolarAngle = Math.max(0.02, p - 0.42);
      c.maxPolarAngle = Math.min(Math.PI - 0.02, p + 0.42);
      c.minAzimuthAngle = a - 0.55;
      c.maxAzimuthAngle = a + 0.55;
    } else {
      c.minDistance = 1.32;
      c.maxDistance = 6;
      c.minPolarAngle = 0.05;
      c.maxPolarAngle = Math.PI - 0.05;
      c.minAzimuthAngle = -Infinity;
      c.maxAzimuthAngle = Infinity;
    }
    idle.current = { since: performance.now(), sway: 0, active: !surface };
  };

  // Input bindings: rotate and dolly only. Truck would drag the orbit centre off the
  // globe and there is no good way back from that.
  useLayoutEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.mouseButtons.right = ACTION.NONE;
    c.mouseButtons.middle = ACTION.DOLLY;
    c.touches.two = ACTION.TOUCH_DOLLY;
    c.touches.three = ACTION.NONE;
    c.dollyToCursor = false;

    // Open from deep space and fly in, so the first frame already has motion in it.
    const intro = zonePose(INTRO);
    c.setLookAt(intro.pos.x, intro.pos.y, intro.pos.z, 0, 0, 0, false);

    const cancel = () => {
      if (flight.current && !flight.current.onDone) {
        flight.current = null;
        settle(c.getTarget(new Vector3()).lengthSq() > 0.25);
      }
      idle.current.active = false;
    };
    c.addEventListener('controlstart', cancel);
    return () => c.removeEventListener('controlstart', cancel);
  }, []);

  // Role lens -> fly to that stakeholder's zone.
  useEffect(() => {
    if (useShipment.getState().twin !== 'closed') return;
    const z = ZONES[role];
    const { pos, target } = zonePose(z);
    fly(pos, target, z.target !== null, undefined, nonce === 0 ? 2.2 : 1.5);
  }, [role, nonce]);

  // Orbital-to-container dive: fall onto the cargo marker, then hand over to the twin.
  useEffect(() => {
    if (twin !== 'diving') return;
    const p = frame.position.clone();
    const n = p.clone().normalize();
    const south = new Vector3(0, -1, 0).sub(n.clone().multiplyScalar(-n.y)).normalize();
    const pos = p.clone().addScaledVector(n, 0.012).addScaledVector(south, 0.006);
    fly(pos, p, true, () => useShipment.getState().finishDive(), 1.1);
  }, [twin]);

  useFrame((_, dt) => {
    const c = controlsRef.current;
    const f = flight.current;
    if (!c) return;

    if (f) {
      // Wall-clock based, so a slow device lands on time rather than in slow motion.
      f.elapsed += Math.min(dt, 0.25);
      const t = Math.min(1, f.elapsed / f.duration);
      const e = ease(t);
      const dir = f.p0.clone().normalize();
      const d1 = f.p1.clone().normalize();
      // Slerp the camera's direction from the planet centre, so it travels along a
      // great circle and never cuts through the globe.
      const omega = dir.angleTo(d1);
      if (omega > 1e-5) {
        const s = Math.sin(omega);
        dir.multiplyScalar(Math.sin((1 - e) * omega) / s).addScaledVector(d1, Math.sin(e * omega) / s);
      }
      const r0 = f.p0.length();
      const r1 = f.p1.length();
      const r = (1 - e) * (1 - e) * r0 + 2 * e * (1 - e) * f.rc + e * e * r1;
      const pos = dir.multiplyScalar(r);
      const tgt = f.t0.clone().lerp(f.t1, ease(Math.min(1, t * 1.08)));
      c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false);
      if (t >= 1) {
        flight.current = null;
        settle(f.surface);
        f.onDone?.();
      }
      return;
    }

    // Idle sway on the global zones: a slow breath, never a spin, so the corridor
    // stays framed while the scene still feels alive.
    const i = idle.current;
    if (i.active && performance.now() - i.since > 2500) {
      const t = (performance.now() - i.since - 2500) / 1000;
      const target = Math.sin((t / 46) * Math.PI * 2) * 0.09;
      c.rotate(target - i.sway, 0, false);
      i.sway = target;
    }
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      camera={camera as PerspectiveCamera}
      smoothTime={0.28}
      draggingSmoothTime={0.12}
      dollySpeed={0.45}
      azimuthRotateSpeed={0.6}
      polarRotateSpeed={0.6}
    />
  );
}
