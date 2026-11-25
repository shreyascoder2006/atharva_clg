import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  Vector4,
  type WebGLProgramParametersWithUniforms,
} from 'three';

import dotsData from '@/data/globe-dots.json';
import { latLonToVector3 } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { getLandMasks } from './landTexture';

export const GLOBE_RADIUS = 1;

const camWorld = new Vector3();

/* ---------------------------------------------------------------------------------
 * GlobeCore: the matte porcelain sphere.
 *
 * The original was an unlit near-black sphere that hid the far-side dots. It is now a
 * lit MeshStandardMaterial so the studio key light and the arc shadows read on it,
 * with the land masks composed in the shader: ice-blue ocean, off-white land, a slate
 * coastline, and a high-resolution patch over Western India for the close-up zones.
 * ------------------------------------------------------------------------------- */
export function GlobeCore() {
  const gl = useThree((s) => s.gl);

  const material = useMemo(() => {
    const masks = getLandMasks(gl.capabilities.getMaxAnisotropy(), gl.capabilities.maxTextureSize);
    const [a, b] = masks.details;
    const uniforms = {
      uOcean: { value: new Color(PALETTE.ocean) },
      uOceanDeep: { value: new Color(PALETTE.oceanDeep) },
      uLand: { value: new Color(PALETTE.land) },
      uCoast: { value: new Color(PALETTE.coast) },
      uRim: { value: new Color(PALETTE.rim) },
      uDetailA: { value: a.texture },
      uDetailB: { value: b.texture },
      uBoundsA: { value: new Vector4(...a.bounds) },
      uBoundsB: { value: new Vector4(...b.bounds) },
    };

    const m = new MeshStandardMaterial({
      map: masks.global,
      roughness: 0.94,
      metalness: 0,
    });

    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform vec3 uOcean, uOceanDeep, uLand, uCoast, uRim;
          uniform sampler2D uDetailA, uDetailB;
          uniform vec4 uBoundsA, uBoundsB;

          // Blend a detail patch over the global mask, feathered at its border so the
          // resolution change never shows as a seam.
          vec4 detail(vec4 base, sampler2D tex, vec4 b, vec2 ll) {
            vec2 uv = vec2((ll.x - b.x) / (b.y - b.x), (ll.y - b.z) / (b.w - b.z));
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return base;
            float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
            return mix(base, texture2D(tex, uv), smoothstep(0.0, 0.06, edge));
          }`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          vec4 mask = texture2D(map, vMapUv);
          vec2 ll = vec2(vMapUv.x * 360.0 - 180.0, vMapUv.y * 180.0 - 90.0);
          mask = detail(mask, uDetailA, uBoundsA, ll);
          mask = detail(mask, uDetailB, uBoundsB, ll);
          // A whisper of depth: oceans deepen slightly towards the poles.
          vec3 ocean = mix(uOcean, uOceanDeep, smoothstep(20.0, 75.0, abs(ll.y)) * 0.6);
          vec3 surface = mix(ocean, uLand, mask.r);
          surface = mix(surface, uCoast, mask.g * 0.7);
          diffuseColor.rgb *= surface;
          `,
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          // Atmospheric limb: the edge of the sphere lifts towards white, like daylight
          // scattering, so the globe sits in the studio instead of being cut out of it.
          float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float limb = pow(1.0 - facing, 2.6);
          outgoingLight = mix(outgoingLight, uRim, limb * 0.72);
          #include <opaque_fragment>`,
        );
    };
    return m;
  }, [gl]);

  return (
    <mesh material={material} receiveShadow>
      <sphereGeometry args={[GLOBE_RADIUS, 128, 96]} />
    </mesh>
  );
}

/* ---------------------------------------------------------------------------------
 * Graticule: a clean 15-degree cage, drawn as true parallels and meridians. The
 * original wireframe sphere showed triangle diagonals, which read as noise on white.
 * ------------------------------------------------------------------------------- */
export function Graticule() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const push = (lat: number, lon: number) => {
      const v = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.0006);
      pts.push(v.x, v.y, v.z);
    };
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 2) {
        push(lat, lon);
        push(lat, lon + 2);
      }
    }
    for (let lon = -180; lon < 180; lon += 15) {
      for (let lat = -80; lat < 80; lat += 2) {
        push(lat, lon);
        push(lat + 2, lon);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color(PALETTE.coast) }, uOpacity: { value: 0.22 } },
        vertexShader: /* glsl */ `
          varying float vFade;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vec3 n = normalize(world.xyz);
            vFade = smoothstep(0.05, 0.45, dot(n, normalize(cameraPosition - world.xyz)));
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vFade;
          void main() { gl_FragColor = vec4(uColor, uOpacity * vFade); }`,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  // A fine survey grid over Western India for the port-scale zones, where the 15-degree
  // cage is far off-screen and the land would otherwise read as blank paper.
  const fine = useMemo(() => {
    const pts: number[] = [];
    const push = (lat: number, lon: number) => {
      const v = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.0002);
      pts.push(v.x, v.y, v.z);
    };
    const step = 0.25;
    for (let lat = 15.5; lat <= 22.5 + 1e-6; lat += step) {
      for (let lon = 69.5; lon < 76.5; lon += 0.1) {
        push(lat, lon);
        push(lat, lon + 0.1);
      }
    }
    for (let lon = 69.5; lon <= 76.5 + 1e-6; lon += step) {
      for (let lat = 15.5; lat < 22.5; lat += 0.1) {
        push(lat, lon);
        push(lat + 0.1, lon);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const fineMaterial = useMemo(() => {
    const m = material.clone();
    m.uniforms.uOpacity.value = 0;
    return m;
  }, [material]);

  useFrame(({ camera }) => {
    // Swap cages with distance: the 15-degree grid fades out on approach and the survey
    // grid fades in at port scale.
    const d = camera.getWorldPosition(camWorld).length();
    material.uniforms.uOpacity.value = 0.22 * Math.min(1, Math.max(0, (d - 1.25) / 0.6));
    fineMaterial.uniforms.uOpacity.value = 0.15 * Math.min(1, Math.max(0, (1.16 - d) / 0.08));
  });

  useEffect(
    () => () => {
      geometry.dispose();
      fine.dispose();
    },
    [geometry, fine],
  );

  return (
    <>
      <lineSegments geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      <lineSegments geometry={fine} material={fineMaterial} frustumCulled={false} raycast={() => null} />
    </>
  );
}

/* ---------------------------------------------------------------------------------
 * LandDots: the original Fibonacci dot matrix, kept as an architectural screen over
 * the land. Normal blending in slate replaces additive blue, which would vanish on a
 * light surface. Dots are clamped in pixel size and fade out at port scale, where the
 * 10m coastline detail takes over.
 * ------------------------------------------------------------------------------- */
const dotVertex = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxPx;
  varying float vFade;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Dots near the limb read as noise, so ease them out. The normal of a point on a
    // unit sphere is its own position.
    vec3 worldNormal = normalize(mat3(modelMatrix) * position);
    vec3 toCamera = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
    vFade = smoothstep(0.0, 0.4, dot(worldNormal, toCamera));

    gl_PointSize = min(uSize * uPixelRatio * (1.0 / -mv.z), uMaxPx * uPixelRatio);
  }
`;

const dotFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float edge = 1.0 - smoothstep(0.3, 0.5, d);
    gl_FragColor = vec4(uColor, edge * uOpacity * vFade);
  }
`;

export function LandDots() {
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const flat = dotsData.dots as number[];
    const count = flat.length / 2;
    const positions = new Float32Array(count * 3);
    const tmp = new Vector3();
    for (let i = 0; i < count; i++) {
      latLonToVector3(flat[i * 2], flat[i * 2 + 1], GLOBE_RADIUS * 1.0004, tmp);
      positions[i * 3] = tmp.x;
      positions[i * 3 + 1] = tmp.y;
      positions[i * 3 + 2] = tmp.z;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uSize: { value: 4.2 },
          uPixelRatio: { value: dpr },
          uMaxPx: { value: 4.5 },
          uColor: { value: new Color('#B4C2D4') },
          uOpacity: { value: 0.9 },
        },
        vertexShader: dotVertex,
        fragmentShader: dotFragment,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    [dpr],
  );

  useFrame(({ camera }) => {
    material.uniforms.uPixelRatio.value = dpr;
    const d = camera.getWorldPosition(camWorld).length();
    material.uniforms.uOpacity.value = 0.9 * Math.min(1, Math.max(0, (d - 1.1) / 0.5));
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
