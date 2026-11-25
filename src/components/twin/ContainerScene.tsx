import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { PALETTE } from '@/lib/palette';
import { BOX, PALLET, SENSORS, STATUS_COLOR, palletPositions, type PalletStatus } from './containerModel';
import { telemetry } from './telemetry';

const dummy = new Object3D();
const tint = new Color();

function Pallets({ statuses, onHover }: { statuses: PalletStatus[]; onHover: (i: number | null, x?: number, y?: number) => void }) {
  const cargo = useRef<InstancedMesh>(null);
  const bases = useRef<InstancedMesh>(null);
  const positions = useMemo(() => palletPositions(), []);
  const count = positions.length;

  const edges = useMemo(() => {
    const unit = new EdgesGeometry(new BoxGeometry(PALLET.l - 0.04, PALLET.cargo, PALLET.w - 0.04));
    const src = unit.getAttribute('position').array as Float32Array;
    const out = new Float32Array(src.length * count);
    positions.forEach((p, i) => {
      for (let k = 0; k < src.length; k += 3) {
        out[i * src.length + k] = src[k] + p.x;
        out[i * src.length + k + 1] = src[k + 1] + p.y + PALLET.base + PALLET.cargo / 2;
        out[i * src.length + k + 2] = src[k + 2] + p.z;
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    return g;
  }, [positions, count]);

  useLayoutEffect(() => {
    const c = cargo.current;
    const b = bases.current;
    if (!c || !b) return;
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.y + PALLET.base + PALLET.cargo / 2, p.z);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, p.y + PALLET.base / 2, p.z);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
      // Cargo reads as a tinted glass block; the status colour is softened towards white.
      tint.set(STATUS_COLOR[statuses[i]]).lerp(new Color('#ffffff'), statuses[i] === 'cleared' ? 0.55 : 0.35);
      c.setColorAt(i, tint);
    });
    c.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
  }, [positions, statuses]);

  return (
    <group>
      <instancedMesh
        ref={cargo}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(e.instanceId ?? null, e.nativeEvent.clientX, e.nativeEvent.clientY);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[PALLET.l - 0.04, PALLET.cargo, PALLET.w - 0.04]} />
        <meshStandardMaterial roughness={0.55} metalness={0.02} transparent opacity={0.92} />
      </instancedMesh>
      <instancedMesh ref={bases} args={[undefined, undefined, count]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[PALLET.l, PALLET.base, PALLET.w]} />
        <meshStandardMaterial color="#d8c9ad" roughness={0.9} />
      </instancedMesh>
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color={PALETTE.ink} transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}

/** The box itself: an architectural wireframe with the near wall and roof cut away. */
function ContainerShell() {
  const { outline, ribs } = useMemo(() => {
    const outline = new EdgesGeometry(new BoxGeometry(BOX.L, BOX.H, BOX.W));
    // Corrugation ribs on the far long wall and the front end wall.
    const pts: number[] = [];
    for (let x = -BOX.L / 2 + 0.14; x < BOX.L / 2; x += 0.28) {
      pts.push(x, -BOX.H / 2, -BOX.W / 2, x, BOX.H / 2, -BOX.W / 2);
    }
    for (let z = -BOX.W / 2 + 0.14; z < BOX.W / 2; z += 0.28) {
      pts.push(-BOX.L / 2, -BOX.H / 2, z, -BOX.L / 2, BOX.H / 2, z);
    }
    // Door locking bars at the far end.
    for (const z of [-0.85, -0.35, 0.35, 0.85]) pts.push(BOX.L / 2, -BOX.H / 2 + 0.1, z, BOX.L / 2, BOX.H / 2 - 0.1, z);
    const ribs = new BufferGeometry();
    ribs.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return { outline, ribs };
  }, []);

  return (
    <group position={[0, BOX.H / 2, 0]}>
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={PALETTE.ink} transparent opacity={0.7} />
      </lineSegments>
      <lineSegments geometry={ribs}>
        <lineBasicMaterial color={PALETTE.cobalt} transparent opacity={0.22} />
      </lineSegments>
      {/* Far wall and end wall: frosted panels, so the cutaway still reads as a box. */}
      <mesh position={[0, 0, -BOX.W / 2]} receiveShadow>
        <planeGeometry args={[BOX.L, BOX.H]} />
        <meshStandardMaterial color="#dbe7fe" transparent opacity={0.35} roughness={0.8} />
      </mesh>
      <mesh position={[-BOX.L / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[BOX.W, BOX.H]} />
        <meshStandardMaterial color="#dbe7fe" transparent opacity={0.4} roughness={0.8} />
      </mesh>
      {/* Timber floor. */}
      <mesh position={[0, -BOX.H / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BOX.L, BOX.W]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.95} />
      </mesh>
    </group>
  );
}


function Sensors() {
  const rings = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock, camera }) => {
    rings.current.forEach((m, i) => {
      if (!m) return;
      const p = (clock.elapsedTime * 0.8 + i * 0.33) % 1;
      m.scale.setScalar(0.12 + p * 0.5);
      (m.material as { opacity: number }).opacity = (1 - p) * 0.55;
      m.lookAt(camera.position);
    });
  });
  return (
    <group>
      {SENSORS.map((s, i) => (
        <group key={s.id} position={s.at}>
          <mesh>
            <sphereGeometry args={[0.075, 20, 14]} />
            <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.5} />
          </mesh>
          <mesh ref={(m) => void (rings.current[i] = m)}>
            <ringGeometry args={[0.8, 1, 40]} />
            <meshBasicMaterial color={s.color} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Orbit target sits right of the box so it frames clear of the telemetry panel. */
const TARGET = new Vector3(2.6, 0.9, 0);
const INTRO_FROM = new Vector3(4, 34, 8);
const INTRO_TO = new Vector3(13.5, 9.5, 17.5);

export function ContainerScene({
  statuses,
  onHover,
}: {
  statuses: PalletStatus[];
  onHover: (i: number | null, x?: number, y?: number) => void;
}) {
  const sway = useRef<Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const intro = useRef(0);

  useFrame(({ camera }, dt) => {
    // The camera falls in from above, continuing the orbital dive.
    if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + dt / 1.6);
      const e = 1 - (1 - intro.current) ** 3;
      camera.position.lerpVectors(INTRO_FROM, INTRO_TO, e);
      camera.lookAt(TARGET);
      controls.current?.update();
    }
    // Road shock shows up as a faint sway of the box.
    if (sway.current) {
      const t = telemetry.latest();
      sway.current.rotation.z = Math.sin(performance.now() / 260) * t.shock * 0.004;
      sway.current.rotation.x = (t.tilt - 1.2) * 0.003;
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#c8d4e4', 1.6]} />
      <directionalLight
        position={[-8, 14, 9]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-radius={4}
        shadow-intensity={0.45}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[10, 4, -6]} intensity={0.5} color="#e0e9ff" />

      <group ref={sway}>
        <ContainerShell />
        <Pallets statuses={statuses} onHover={onHover} />
        <Sensors />
      </group>

      {/* Shadow catcher. It must not write depth: 1 mm under the grid is below depth
          precision at this camera distance, and it would z-fight the grid away. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow renderOrder={-1}>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial opacity={0.12} depthWrite={false} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={0.5}
        cellThickness={0.7}
        cellColor="#c2cede"
        sectionSize={2.5}
        sectionThickness={1.2}
        sectionColor="#8fa1b8"
        fadeDistance={48}
        fadeStrength={1.2}
        infiniteGrid
        side={DoubleSide}
      />
      <OrbitControls
        ref={controls}
        target={[TARGET.x, TARGET.y, TARGET.z]}
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.08}
        autoRotate
        autoRotateSpeed={0.35}
        enablePan={false}
      />
    </>
  );
}
