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
import { frame } from './frame';
import { getLandMasks } from './landTexture';

export const GLOBE_RADIUS = 1;

const camWorld = new Vector3();

/* ---------------------------------------------------------------------------------
 * GlobeCore: the porcelain planet.
 *
 * The original was an unlit near-black sphere that hid the far-side dots. It is now a
 * lit MeshStandardMaterial so the studio key light and the arc shadows read on it, with
 * the surface composed in the shader:
 *
 *  - land masks (global 50m plus six 10m patches under the close-up zones and ports),
 *    giving off-white land, an ice-blue ocean, a lighter coastal shelf and a slate coast;
 *  - roughness from the land mask, so oceans take a soft daylight sheen while land
 *    stays matte;
 *  - bump-mapped relief on land and a wave shimmer on the ocean, both procedural and
 *    faded in by camera altitude, so they add texture up close and never alias in orbit.
 *
 * The relief is stylised (simplex noise), not an elevation model.
 * ------------------------------------------------------------------------------- */

/** 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT). */
const SIMPLEX = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

export function GlobeCore() {
  const gl = useThree((s) => s.gl);

  const { material, uniforms, patches } = useMemo(() => {
    // 8x anisotropy is indistinguishable from 16x at the limb and costs far less.
    const masks = getLandMasks(Math.min(8, gl.capabilities.getMaxAnisotropy()), gl.capabilities.maxTextureSize);
    const uniforms: Record<string, { value: unknown }> = {
      uOcean: { value: new Color(PALETTE.ocean) },
      uOceanDeep: { value: new Color(PALETTE.oceanDeep) },
      uShelf: { value: new Color('#E1EDF9') },
      uLand: { value: new Color(PALETTE.land) },
      uCoast: { value: new Color(PALETTE.coast) },
      uRim: { value: new Color(PALETTE.rim) },
      uTime: { value: 0 },
      uRelief: { value: 1 },
      uReliefFine: { value: 0 },
      uWave: { value: 0 },
    };
    masks.details.forEach((d, i) => {
      uniforms[`uD${i}`] = { value: d.texture };
      uniforms[`uB${i}`] = { value: new Vector4(...d.bounds) };
      uniforms[`uDw${i}`] = { value: 0 };
    });
    // Each patch's centre and angular radius, to skip the ones on the far side.
    const patches = masks.details.map((d, i) => {
      const [lon0, lon1, lat0, lat1] = d.bounds;
      const centre = latLonToVector3((lat0 + lat1) / 2, (lon0 + lon1) / 2);
      return { centre, radius: centre.angleTo(latLonToVector3(lat0, lon0)), weight: uniforms[`uDw${i}`] };
    });
    const n = masks.details.length;
    const decl = masks.details.map((_, i) => `uniform sampler2D uD${i};\nuniform vec4 uB${i};\nuniform float uDw${i};`).join('\n');
    // The branch reads only a uniform, so control flow stays uniform and the fetch
    // inside keeps valid derivatives for mip selection.
    const blend = masks.details.map((_, i) => `if (uDw${i} > 0.0) mask = detail(mask, uD${i}, uB${i}, ll, uDw${i});`).join('\n');

    const m = new MeshStandardMaterial({ map: masks.global, roughness: 0.94, metalness: 0 });

    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSphere;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSphere = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform vec3 uOcean, uOceanDeep, uShelf, uLand, uCoast, uRim;
          uniform float uTime, uRelief, uReliefFine, uWave;
          varying vec3 vSphere;
          ${decl}
          ${SIMPLEX}

          // Blend a detail patch over the global mask, feathered at its border so the
          // resolution change never shows as a seam. Within a patch the fetch is
          // unconditional: one inside a per-pixel branch would break mip selection at
          // the edge. Whole patches are switched by a uniform weight instead.
          vec4 detail(vec4 base, sampler2D tex, vec4 b, vec2 ll, float w) {
            vec2 uv = vec2((ll.x - b.x) / (b.y - b.x), (ll.y - b.z) / (b.w - b.z));
            float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
            return mix(base, texture2D(tex, clamp(uv, 0.0, 1.0)), smoothstep(0.0, 0.06, edge) * w);
          }

          // Normal perturbation from a screen-space height gradient (as three's bump map).
          vec3 perturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
            vec3 sx = dFdx(surfPos);
            vec3 sy = dFdy(surfPos);
            vec3 r1 = cross(sy, surfNorm);
            vec3 r2 = cross(surfNorm, sx);
            float det = dot(sx, r1) * faceDir;
            vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
            return normalize(abs(det) * surfNorm - grad);
          }`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          vec4 mask = texture2D(map, vMapUv);
          vec2 ll = vec2(vMapUv.x * 360.0 - 180.0, vMapUv.y * 180.0 - 90.0);
          ${n ? blend : ''}
          float landMask = mask.r;
          float shelf = mask.b * (1.0 - landMask);
          // Oceans deepen towards the poles and away from coasts; shelves read lighter.
          vec3 ocean = mix(uOcean, uOceanDeep, smoothstep(20.0, 75.0, abs(ll.y)) * 0.6);
          ocean = mix(ocean * 0.985, uShelf, shelf * 0.9);
          vec3 surface = mix(ocean, uLand, landMask);
          surface = mix(surface, uCoast, mask.g * 0.7);
          diffuseColor.rgb *= surface;
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          // Silky daylight ocean against matte porcelain land.
          roughnessFactor = mix(0.3, 0.92, landMask);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
          // Relief on land: two broad octaves always, a fine one as the camera closes in.
          float hLand = 0.0;
          if (uRelief > 0.0) {
            hLand = snoise(vSphere * 14.0) * 0.65 + snoise(vSphere * 47.0) * 0.35;
            if (uReliefFine > 0.0) hLand += snoise(vSphere * 220.0) * 0.22 * uReliefFine;
            hLand *= landMask * uRelief;
          }
          // Wave shimmer on open water, only near the surface.
          float hWave = 0.0;
          if (uWave > 0.0) {
            vec3 q = vSphere * 2600.0;
            hWave = snoise(q + vec3(uTime * 0.25, 0.0, uTime * 0.18)) * 0.6 + snoise(q * 2.3 - vec3(0.0, uTime * 0.3, 0.0)) * 0.4;
            hWave *= (1.0 - landMask) * uWave;
          }
          // Amplitudes in world units (globe radii): a few hundred metres of relief, tens
          // of metres of swell. Enough to catch the key light, not enough to look crumpled.
          float hTotal = hLand * 0.00042 + hWave * 0.000009;
          normal = perturb(-vViewPosition, normal, vec2(dFdx(hTotal), dFdy(hTotal)), faceDirection);`,
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          // Atmospheric limb: the edge of the sphere lifts towards white, like daylight
          // scattering, so the globe sits in the studio instead of being cut out of it.
          float facing = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
          float limb = pow(1.0 - facing, 2.6);
          outgoingLight = mix(outgoingLight, uRim, limb * 0.72);
          #include <opaque_fragment>`,
        );
    };
    return { material: m, uniforms, patches };
  }, [gl]);

  useFrame(({ clock, camera }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uReliefFine.value = frame.lod.reliefFine;
    uniforms.uWave.value = frame.lod.waves;
    // A patch is drawn only when the camera is low enough to need it and the patch is
    // on the visible cap (inside the horizon, padded by its own radius).
    const d = camera.getWorldPosition(camWorld).length();
    const horizon = Math.acos(Math.min(1, 1 / Math.max(d, 1)));
    const w = frame.lod.detailMask;
    for (const p of patches) p.weight.value = w > 0 && camWorld.angleTo(p.centre) < horizon + p.radius + 0.05 ? w : 0;
  });

  return (
    <mesh material={material} receiveShadow>
      <sphereGeometry args={[GLOBE_RADIUS, 160, 120]} />
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
