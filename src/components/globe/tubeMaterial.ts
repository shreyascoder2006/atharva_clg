import { Color, MeshDepthMaterial, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';

/**
 * Screen-space tubes.
 *
 * TubeGeometry normals are the radial directions, so the centreline can be recovered
 * as `position - normal * buildRadius` and the tube re-inflated in the vertex shader to
 * a width in pixels. A route then reads as the same crisp 3px line from orbit and at
 * the JNPT gate, instead of vanishing or ballooning to the width of a district.
 *
 * The camera position is a uniform rather than `cameraPosition` because the shadow
 * pass renders from the light: the shadow must match the tube the viewer sees.
 */
export const TUBE_BUILD_RADIUS = 0.001;

const inflate = /* glsl */ `
  uniform float uBuild;
  uniform float uPx;
  uniform float uWorldPerPx;
  uniform float uMinWorld;
  uniform vec3 uCam;

  vec3 inflateTube(vec3 pos, vec3 nrm) {
    vec3 center = pos - nrm * uBuild;
    vec3 worldC = (modelMatrix * vec4(center, 1.0)).xyz;
    float r = max(uPx * uWorldPerPx * distance(uCam, worldC), uMinWorld);
    return center + nrm * r;
  }
`;

const vertex = /* glsl */ `
  ${inflate}
  varying float vU;
  varying float vFacing;

  void main() {
    vec3 p = inflateTube(position, normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
    vU = uv.x;
    gl_Position = projectionMatrix * mv;
  }
`;

const coreFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDone;
  uniform vec3 uAlertColor;
  uniform vec3 uRiskColor;
  uniform vec3 uCarbonColor;
  uniform float uProgress;
  uniform float uLive;
  uniform float uFuture;
  uniform vec2 uAlert;
  uniform float uAlertOn;
  uniform vec4 uRisk;
  uniform float uRiskOn;
  uniform float uCarbon;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uDash;
  uniform float uReveal;
  uniform float uComets;
  uniform float uDim;
  varying float vU;
  varying float vFacing;

  float band(vec2 r, float u) { return step(r.x, u) * step(u, r.y); }

  void main() {
    if (vU > uReveal) discard;
    float done = step(vU, uProgress);
    vec3 col = mix(uColor, uDone, done);
    float a = 0.94;

    // Not yet travelled: rail is dashed, everything else is drawn a touch lighter.
    if (done < 0.5) {
      a = 0.82;
      if (uDash > 0.0 && fract(vU * uDash) > 0.58) a = 0.16;
    }
    // Scrubbed into the forecast: the projected travel is a paler emerald.
    if (uFuture > 0.5 && vU > uLive && done > 0.5) col = mix(uDone, vec3(1.0), 0.42);

    float risk = uRiskOn * max(band(uRisk.xy, vU), band(uRisk.zw, vU));
    col = mix(col, uRiskColor, risk);

    float alert = uAlertOn * band(uAlert, vU);
    float beat = 0.5 + 0.5 * sin(uTime * 6.0);
    col = mix(col, uAlertColor, alert * (0.82 + 0.18 * beat));
    a = max(a, alert);

    col = mix(col, uCarbonColor, uCarbon);

    // Tracer comets running in the direction of travel.
    float k = fract(vU * uComets - uTime * 0.32);
    float comet = smoothstep(0.8, 0.975, k) * (1.0 - smoothstep(0.975, 1.0, k));
    col = mix(col, vec3(1.0), comet * 0.7);
    a = max(a, comet);

    // Round the tube: lit core, slightly darker edges.
    col *= 0.8 + 0.2 * vFacing;

    // Draw-on reroute: a bright leading edge.
    float lead = (1.0 - smoothstep(0.0, 0.025, uReveal - vU)) * step(uReveal, 0.999);
    col = mix(col, vec3(1.0), lead * 0.85);

    gl_FragColor = vec4(col, a * uOpacity * (1.0 - 0.72 * uDim));
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDone;
  uniform vec3 uAlertColor;
  uniform vec3 uCarbonColor;
  uniform float uProgress;
  uniform vec2 uAlert;
  uniform float uAlertOn;
  uniform float uCarbon;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uDim;
  varying float vU;
  varying float vFacing;

  void main() {
    if (vU > uReveal) discard;
    float done = step(vU, uProgress);
    vec3 col = mix(uColor, uDone, done);
    float alert = uAlertOn * step(uAlert.x, vU) * step(vU, uAlert.y);
    col = mix(col, uAlertColor, alert);
    col = mix(col, uCarbonColor, uCarbon);
    float glow = pow(vFacing, 2.2);
    float beat = 1.0 + alert * 0.8 * (0.5 + 0.5 * sin(uTime * 6.0));
    gl_FragColor = vec4(col, glow * 0.17 * beat * uOpacity * (1.0 - 0.8 * uDim));
  }
`;

export function makeTubeUniforms(px: number, minWorld: number) {
  return {
    uBuild: { value: TUBE_BUILD_RADIUS },
    uPx: { value: px },
    uWorldPerPx: { value: 0.001 },
    uMinWorld: { value: minWorld },
    uCam: { value: new Vector3() },
    uColor: { value: new Color() },
    uDone: { value: new Color() },
    uAlertColor: { value: new Color() },
    uRiskColor: { value: new Color() },
    uCarbonColor: { value: new Color() },
    uProgress: { value: 0 },
    uLive: { value: 0 },
    uFuture: { value: 0 },
    uAlert: { value: new Vector2(-1, -1) },
    uAlertOn: { value: 0 },
    uRisk: { value: new Vector4(-1, -1, -1, -1) },
    uRiskOn: { value: 0 },
    uCarbon: { value: 0 },
    uTime: { value: 0 },
    uOpacity: { value: 1 },
    uDash: { value: 0 },
    uReveal: { value: 1 },
    uComets: { value: 3 },
    uDim: { value: 0 },
  };
}

export type TubeUniforms = ReturnType<typeof makeTubeUniforms>;

export function makeCoreMaterial(u: TubeUniforms) {
  return new ShaderMaterial({
    uniforms: u,
    vertexShader: vertex,
    fragmentShader: coreFragment,
    transparent: true,
    depthWrite: true,
  });
}

export function makeHaloMaterial(u: TubeUniforms) {
  return new ShaderMaterial({
    uniforms: u,
    vertexShader: vertex,
    fragmentShader: haloFragment,
    transparent: true,
    depthWrite: false,
  });
}

/** Depth material for the shadow pass, inflated exactly like the visible tube. */
export function makeTubeDepthMaterial(u: TubeUniforms) {
  const m = new MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBuild = u.uBuild;
    shader.uniforms.uPx = u.uPx;
    shader.uniforms.uWorldPerPx = u.uWorldPerPx;
    shader.uniforms.uMinWorld = u.uMinWorld;
    shader.uniforms.uCam = u.uCam;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${inflate}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = inflateTube(position, normal);');
  };
  return m;
}
