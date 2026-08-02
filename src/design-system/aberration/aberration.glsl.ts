/**
 * Wafer aberration shader.
 *
 * A procedural metal surface lit by the application's single shared light. The
 * law is the same one the CSS edge layer obeys, so the shader and the chrome
 * around it never disagree:
 *
 *   distance from the light  ->  how bright the surface is
 *   bearing from the light   ->  which part of the spectrum it disperses into
 *   steepness of the surface ->  how much spectrum appears at all
 *
 * That third term is what keeps this from being a rainbow gradient. Flat areas
 * stay achromatic no matter how high `dispersion` goes; colour only survives
 * where the surface turns away, which is exactly where it appears on the mark.
 */

export const ABERRATION_VERT = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const ABERRATION_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uLight;

uniform vec3  uSpectrumA;
uniform vec3  uSpectrumB;
uniform vec3  uSpectrumC;
uniform vec3  uSpectrumD;
// The metal's own value range, from --metal-shadow and --metal-specular. Using
// the substrate as the dark end would mean that on light paper the surface can
// only ever get brighter than the page, and it washes out to white.
uniform vec3  uMetalLow;
uniform vec3  uMetalHigh;

uniform float uScale;
uniform float uDetail;
uniform float uWarp;
uniform float uRelief;
uniform float uFlow;
uniform float uMetalness;
uniform float uSpecular;
uniform float uSpread;
uniform float uExposure;
uniform float uDispersion;
uniform float uBias;
uniform float uSaturation;
uniform float uRotation;
uniform float uContrast;
uniform float uGrain;
uniform float uVignette;
uniform float uOpacity;

const float TAU = 6.28318530718;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

// Ashima simplex noise, 2D.
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractional octaves: uDetail fades the last octave in rather than popping it.
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 5; i++) {
    float w = clamp(uDetail - float(i), 0.0, 1.0);
    sum += snoise(p * freq) * amp * w;
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

// Domain-warped height field. The warp is what makes it pour like metal
// instead of reading as noise.
float height(vec2 p) {
  vec2 drift = vec2(uTime * uFlow * 0.05, uTime * uFlow * -0.032);
  vec2 q = p + drift;
  vec2 w = vec2(fbm(q + 1.7), fbm(q + 9.2));
  return fbm(q + w * uWarp);
}

// The environment the metal reflects. A bright upper field over a dark lower
// one, with the key light burning a hot core into it — the studio a chrome
// object needs in order to read as chrome. The hard-ish horizon is what the
// surface undulations break up into chrome's signature banding.
// lightP arrives centred and aspect-corrected, in the reflected direction's
// own space.
float environment(vec2 dir, vec2 lightP) {
  float horizon = smoothstep(-0.30, 0.34, dir.y - lightP.y * 0.45);
  float body = mix(0.07, 0.78, horizon);
  float d = distance(dir, lightP);
  float core = exp(-d * d * uSpread) * uSpecular * 0.55;
  return body + core;
}

vec3 spectrum(float t) {
  t = fract(t);
  if (t < 0.25) return mix(uSpectrumA, uSpectrumB, t * 4.0);
  if (t < 0.5)  return mix(uSpectrumB, uSpectrumC, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(uSpectrumC, uSpectrumD, (t - 0.5) * 4.0);
  return mix(uSpectrumD, uSpectrumA, (t - 0.75) * 4.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 lightP = (uLight - 0.5) * vec2(aspect, 1.0);

  vec2 q = p * uScale;

  // True surface gradient, then a normal whose steepness is set by uRelief.
  // Dividing by eps matters: without it the normal is dominated by its xy term
  // at every pixel, slope saturates everywhere, and the gate below — the whole
  // reason this reads as metal rather than as marble — stops gating.
  float eps = 0.004;
  float h  = height(q);
  float dx = (height(q + vec2(eps, 0.0)) - h) / eps;
  float dy = (height(q + vec2(0.0, eps)) - h) / eps;
  vec3 n = normalize(vec3(-dx * uRelief, -dy * uRelief, 1.0));

  // Steepness. This is the gate that keeps flat regions achromatic no matter
  // how far dispersion is pushed.
  float slope = clamp(length(n.xy), 0.0, 1.0);

  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 refl = reflect(-view, n);

  float env = environment(refl.xy, lightP);
  float matte = 0.30 + h * 0.10;
  float lum = mix(matte, env, uMetalness) * uExposure;

  // Hue has two terms. Bearing from the light is the global one — the same law
  // the CSS conic field obeys, so a small control and the field behind it cast
  // the same colour. The reflected direction is the local one, and it is what
  // draws the spectrum *across* a ridge instead of flooding it: without it a
  // 36px mark sits at a single bearing and comes out one flat colour.
  vec2 toFragment = p - lightP;
  float bearing = atan(toFragment.y, toFragment.x) / TAU;
  float hue = bearing + uRotation + refl.x * 0.85 + refl.y * 0.35;

  // Dispersion survives only on steep ground; uBias sets how steep is steep.
  float disp = pow(slope, uBias) * uDispersion;

  vec3 col = mix(uMetalLow, uMetalHigh, clamp(lum, 0.0, 1.0));

  // Chroma only. Subtracting the sample's own luminance means dispersion tints
  // the metal without brightening it, so the value structure of the surface
  // survives at any saturation.
  vec3 spec = spectrum(hue);
  vec3 chroma = spec - vec3(dot(spec, vec3(0.2126, 0.7152, 0.0722)));
  col += chroma * disp * uSaturation;

  col = (col - 0.5) * uContrast + 0.5;

  float vig = 1.0 - uVignette * dot(p, p) * 0.9;
  col *= clamp(vig, 0.0, 1.0);

  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), uOpacity);
}
`;
