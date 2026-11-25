import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three';

import { latLonToVector3 } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { useShipment, type Sonar } from '@/store/shipment';
import { pxAt } from './frame';

const TONE = {
  emerald: PALETTE.emerald,
  crimson: PALETTE.crimson,
  cobalt: PALETTE.cobalt,
  amber: PALETTE.amber,
} as const;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/**
 * Three concentric shockwaves expanding across the surface, plus a bright flash at
 * the epicentre. Laid flat on the ground: an event belongs to a place, not the camera.
 */
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAge;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = 0.0;
    for (int i = 0; i < 3; i++) {
      float p = clamp((uAge - float(i) * 0.32) / 2.1, 0.0, 1.0);
      float ease = 1.0 - pow(1.0 - p, 3.0);
      float ring = exp(-pow((d - ease) * 16.0, 2.0));
      a += ring * (1.0 - p) * step(0.001, p);
    }
    float flash = (1.0 - smoothstep(0.0, 0.14, d)) * exp(-uAge * 2.2);
    float disc = (1.0 - smoothstep(0.0, 1.0, d)) * 0.12 * exp(-uAge * 1.2);
    gl_FragColor = vec4(uColor, clamp(a * 0.9 + flash + disc, 0.0, 1.0));
  }
`;

function Ripple({ sonar }: { sonar: Sonar }) {
  const ref = useRef<Mesh>(null);
  const { position, material } = useMemo(() => {
    const position = latLonToVector3(sonar.at[0], sonar.at[1], 1.0015);
    const material = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(TONE[sonar.tone]) }, uAge: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    return { position, material };
  }, [sonar]);

  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    material.uniforms.uAge.value = (performance.now() - sonar.born) / 1000;
    // Screen-scaled so a ripple is legible from orbit and doesn't flood the port view.
    m.scale.setScalar(pxAt(camera, position) * 150);
  });

  return (
    <mesh
      ref={ref}
      position={position}
      material={material}
      onUpdate={(self) => self.lookAt(position.clone().multiplyScalar(2))}
      raycast={() => null}
      renderOrder={5}
    >
      <circleGeometry args={[1, 64]} />
    </mesh>
  );
}

export function SonarField() {
  const sonars = useShipment((s) => s.sonars);
  return (
    <group>
      {sonars.map((s) => (
        <Ripple key={s.id} sonar={s} />
      ))}
    </group>
  );
}

export const SURFACE_UP = new Vector3(0, 1, 0);
