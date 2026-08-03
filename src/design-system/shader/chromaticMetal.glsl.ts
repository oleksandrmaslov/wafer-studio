/**
 * Wafer chromatic metal.
 *
 * An independent implementation of an inflated, anisotropic metal material. It
 * is not derived from, and does not reproduce, Figma's proprietary Chromatic
 * metal source; it reaches a similar look from the physics the look implies.
 *
 * The central mechanism, and the thing that makes this read as metal rather
 * than as a rainbow:
 *
 *   The reflection ramp is ACHROMATIC. Colour is never sampled from a palette.
 *   The three colour channels sample that one greyscale ramp at three slightly
 *   different positions, so a steep luminance transition splits into spectrum
 *   and a flat region stays silver. That is chromatic aberration, and it is why
 *   the spectrum appears exactly where the surface turns hardest.
 *
 * Shape:      a rounded-box distance field, inflated into a dome by Depth.
 * Surface:    stretched anisotropic noise, scaled by Roughness.
 * Bands:      surface slope along the light axis, repeated by Repeats.
 * Dispersion: RGB split across those bands.
 */

export const METAL_VERT = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const METAL_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2  uResolution;
uniform vec2  uLight;

uniform vec3  uMetalLow;
uniform vec3  uMetalHigh;

uniform float uRounding;
uniform float uDepth;
uniform float uRoughness;
uniform float uRgbSplit;
uniform float uScale;
uniform float uStretch;
uniform float uAngle;
uniform float uRepeats;
uniform float uOffset;
uniform float uPhase;
uniform float uEvolution;
uniform float uContrast;
uniform float uGrain;
uniform float uOpacity;
// 0 fills the whole canvas, 1 cuts a rounded box out of it.
uniform float uShape;

const float TAU = 6.28318530718;

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;

  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise(p);
    p = rot(0.53) * p * 2.03 + vec2(7.1, 3.4);
    amp *= 0.5;
  }

  return sum;
}

float sdRoundBox(vec2 p, vec2 half_, float r) {
  vec2 q = abs(p) - half_ + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 aspectPoint(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  return p;
}

// Positive inside the shape.
float shapeField(vec2 uv) {
  vec2 p = aspectPoint(uv);
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 half_ = vec2(aspect, 1.0) * 0.985;
  float maxR = min(half_.x, half_.y) * 0.98;
  float r = min(mix(0.02, 0.55, clamp(uRounding, 0.0, 1.0)), maxR);

  float box = -sdRoundBox(p, half_, r);

  // uShape = 0 keeps the field flat and positive so the canvas fills.
  return mix(1.0, box, clamp(uShape, 0.0, 1.0));
}

// Stretch first, then rotate: the streaks run along the rotated axis, which is
// what Stretch and Angle do together in the reference material.
vec2 patternCoord(vec2 uv) {
  vec2 p = aspectPoint(uv);
  float freq = mix(7.5, 1.35, clamp(uScale, 0.0, 1.0));
  vec2 stretched = p * vec2(max(uStretch, 0.05), 1.0);
  return rot(uAngle) * stretched * freq
    + vec2(uEvolution * 0.31, -uEvolution * 0.23);
}

float heightAt(vec2 uv) {
  float field = shapeField(uv);
  float inside = clamp(field * 3.0, 0.0, 1.0);

  // The inflation. Rounding decides how quickly the dome falls to the edge.
  float dome = pow(
    clamp(field * 1.6, 0.0, 1.0),
    mix(0.35, 0.85, clamp(uRounding, 0.0, 1.0))
  ) * uDepth;

  vec2 q = patternCoord(uv);
  float macro = fbm(q * 0.7);
  float warped = fbm(q * 1.2 + vec2(macro * 2.2, -macro * 1.6));

  float detail = (warped - 0.5) * mix(0.03, 0.16, clamp(uRoughness, 0.0, 1.0));

  return inside * (dome + detail);
}

// The achromatic reflection ramp. Steep shoulders are deliberate: they are what
// the channel split tears into spectrum.
float ramp(float t) {
  float v = 0.5 - 0.5 * cos(fract(t) * TAU);
  return smoothstep(0.06, 0.94, v);
}

void main() {
  float field = shapeField(vUv);

  // Antialias the shape edge in screen space.
  float px = 2.0 / max(uResolution.y, 1.0);
  float alpha = clamp(field / px, 0.0, 1.0);
  alpha = mix(1.0, alpha, clamp(uShape, 0.0, 1.0));

  if (alpha <= 0.002) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Normals by explicit sampling rather than derivatives, so this runs on
  // WebGL1 without the OES_standard_derivatives extension.
  vec2 e = vec2(1.6 / max(uResolution.x, 1.0), 1.6 / max(uResolution.y, 1.0));
  float h = heightAt(vUv);
  float hx = heightAt(vUv + vec2(e.x, 0.0));
  float hy = heightAt(vUv + vec2(0.0, e.y));

  float relief = 1.4;
  vec3 n = normalize(vec3((h - hx) * relief / e.x * 0.01,
                          (h - hy) * relief / e.y * 0.01,
                          1.0));

  vec2 lightAxis = normalize(vec2(cos(uAngle), sin(uAngle)));
  vec3 lightDir = normalize(vec3((uLight - 0.5) * 1.4, 0.85));
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + view);

  // Slope along the light axis drives the band coordinate. On a dome this
  // bunches the bands toward the rim, which is the material's signature.
  float slope = dot(n.xy, lightAxis);
  float t = slope * 1.6 + 0.5;
  t = t * max(uRepeats, 0.25) + uOffset + uPhase;

  // Chromatic aberration: one ramp, three sample positions.
  float split = clamp(uRgbSplit, 0.0, 1.0) * 0.19;
  vec3 bands = vec3(ramp(t + split), ramp(t), ramp(t - split));

  vec3 color = mix(uMetalLow, uMetalHigh, bands);

  float nDotH = max(dot(n, halfDir), 0.0);
  float specular = pow(nDotH, mix(160.0, 12.0, clamp(uRoughness, 0.0, 1.0)));
  float sheen = pow(nDotH, mix(12.0, 2.5, clamp(uRoughness, 0.0, 1.0)));

  color += vec3(specular) * mix(0.9, 0.45, uRoughness);
  color += vec3(sheen) * 0.14;

  // Rim: brighter where the surface turns away, which also puts the widest
  // channel separation on the edge.
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5);
  color += vec3(rim) * 0.3;

  color = (color - 0.5) * uContrast + 0.5;

  color += (hash21(gl_FragCoord.xy + fract(uEvolution) * 91.7) - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha * uOpacity);
}
`;
