import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, NormalBlending, ShaderMaterial, Vector3 } from 'three';

import { PALETTE } from '@/lib/palette';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Rim glow. Rendered on the inside of a slightly larger sphere so it sits behind the
 * planet's silhouette rather than washing over its face.
 *
 * On a dark background this was additive. Here it is a normal-blended cobalt haze
 * whose alpha falls to zero at the shell's own silhouette, so there is no hard outer
 * edge against the porcelain backdrop.
 */
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uFade;
  varying vec3 vNormal;

  void main() {
    float z = clamp(-vNormal.z, 0.0, 1.0);
    float rim = pow(smoothstep(0.0, 0.62, z), uPower) * (1.0 - smoothstep(0.62, 1.0, z));
    gl_FragColor = vec4(uColor, rim * uIntensity * uFade);
  }
`;

const cam = new Vector3();

export function Atmosphere({
  radius = 1.12,
  color = PALETTE.halo,
  intensity = 0.42,
  power = 1.7,
}: {
  radius?: number;
  color?: string;
  intensity?: number;
  power?: number;
}) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(color) },
          uIntensity: { value: intensity },
          uPower: { value: power },
          uFade: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        blending: NormalBlending,
        side: BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [color, intensity, power],
  );

  useFrame(({ camera }) => {
    // Inside the shell (port-scale zones) the haze would fill the screen.
    const d = camera.getWorldPosition(cam).length();
    material.uniforms.uFade.value = Math.min(1, Math.max(0, (d - radius - 0.08) / 0.5));
  });

  return (
    <mesh material={material} raycast={() => null} renderOrder={-1}>
      <sphereGeometry args={[radius, 96, 64]} />
    </mesh>
  );
}
