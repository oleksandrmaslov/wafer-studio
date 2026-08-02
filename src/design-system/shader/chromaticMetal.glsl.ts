/**
 * Chromatic metal.
 *
 * Modelled on Figma's shader of the same name, which is shape-driven rather
 * than texture-driven:
 *
 *   1. Bevel the shape. A signed distance field gives the distance to the edge;
 *      `rounding` sets how wide the bevel is and `depth` how steep.
 *   2. Take the normal of that bevel.
 *   3. Project the normal onto a direction (`angle`, `scale`, `stretch`) to get
 *      one coordinate, and look that up in a GRAYSCALE gradient ramp, tiled
 *      `repeats` times. This is what produces chrome's banding.
 *   4. Sample the ramp three times at slightly different positions, once per
 *      channel. That offset is `rgbSplit`, and it is the entire source of
 *      colour here.
 *
 * Point 4 is the thing worth understanding: the ramp has no hue in it at all.
 * Colour appears only where the ramp changes fastest, because that is where the
 * three channel samples disagree most. Flat regions of the ramp stay perfectly
 * achromatic no matter how high the split goes, so the rainbows land in tight
 * bands along the bevel exactly as they do on the mark.
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
uniform float uRadius;      // corner radius, device px
uniform float uTime;

uniform float uRounding;    // bevel width, device px
uniform float uDepth;
uniform float uRoughness;
uniform float uRgbSplit;
uniform float uScale;
uniform float uStretch;
uniform float uAngle;       // degrees
uniform float uRepeats;
uniform float uOffset;
uniform float uPhase;
uniform float uEvolution;
uniform float uFloor;       // lifts the ramp's dark end so text stays legible
uniform float uOpacity;

const float PI = 3.14159265359;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise, used only to roughen the normal.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

/**
 * Height field: a pillow that rolls off over uRounding pixels at each edge.
 *
 * Built as a product of two independent axis falloffs rather than from the
 * distance field. A rounded-box SDF folds along its medial axis, and that fold
 * shows up as a hard diagonal crease running out of every corner. The product
 * is smooth everywhere, so the rim rounds into the corners with nothing to see.
 */
float bevel(vec2 q, vec2 half_, float roll) {
  float r = max(roll, 1.0);
  float ex = clamp((half_.x - abs(q.x)) / r, 0.0, 1.0);
  float ey = clamp((half_.y - abs(q.y)) / r, 0.0, 1.0);
  float e = ex * ey;
  float inv = 1.0 - e;
  return sqrt(max(1.0 - inv * inv, 0.0));
}

/**
 * The gradient ramp. Grayscale by definition: bright, into a hard dark band,
 * back to bright. The steep walls on either side of the dark band are where
 * the channel split becomes visible.
 */
float ramp(float u) {
  u = fract(u);
  if (u < 0.30) return mix(1.00, 0.60, u / 0.30);
  if (u < 0.46) return mix(0.60, 0.03, (u - 0.30) / 0.16);
  if (u < 0.60) return mix(0.03, 0.52, (u - 0.46) / 0.14);
  return mix(0.52, 1.00, (u - 0.60) / 0.40);
}

void main() {
  vec2 p = vUv * uResolution;
  vec2 half_ = uResolution * 0.5;
  vec2 q = p - half_;

  // The visible shape is masked to the element's own corner radius; the height
  // field uses uRounding, which is the shader's own corner control.
  float d = sdRoundBox(q, half_, uRadius);
  float extent = min(half_.x, half_.y);

  // The roll is capped to the short half-side, so a small mark becomes all rim
  // rather than clipping to a flat plate.
  float roll = min(max(uRounding, 1.0), extent);

  // Central differences, divided by the step and rescaled by the roll, so the
  // normal is the same whether this is a 36px mark or a 1400px panel.
  float eps = max(roll * 0.08, 0.75);
  float hx = (bevel(q + vec2(eps, 0.0), half_, roll)
            - bevel(q - vec2(eps, 0.0), half_, roll)) / (2.0 * eps) * roll;
  float hy = (bevel(q + vec2(0.0, eps), half_, roll)
            - bevel(q - vec2(0.0, eps), half_, roll)) / (2.0 * eps) * roll;

  vec3 n = normalize(vec3(-hx * uDepth, -hy * uDepth, 1.0));

  // Roughness perturbs the normal. The noise has to be spatially COHERENT: at
  // per-pixel frequency each fragment lands on an unrelated part of the ramp
  // and the whole surface collapses into white static.
  if (uRoughness > 0.001) {
    float ev = uEvolution * 6.0 + uTime;
    float freq = 5.0 / max(extent, 1.0);
    vec2 jitter = vec2(
      noise(p * freq + ev),
      noise(p * freq + 31.7 - ev)
    ) - 0.5;
    // Small on purpose. The dome's gradient has to stay the dominant term or
    // the bands dissolve into blobs of noise.
    n.xy += jitter * uRoughness * 0.4;
    n = normalize(n);
  }

  /*
   * The ramp coordinate has two terms, and both matter.
   *
   *   base  a linear sweep across the shape. This is what makes the bands run
   *         straight through the flat interior.
   *   bend  the bevel refracting that sweep. This is what makes them compress
   *         and fan out around the rim.
   *
   * Using the normal alone gives contour rings parallel to the outline, with
   * seams where the distance field folds at the corners. Using position alone
   * gives a flat striped gradient with no metal in it. It is the sum that reads
   * as a reflection.
   */
  float a = uAngle * PI / 180.0;
  vec2 dir = vec2(cos(a), sin(a));
  vec2 uvp = q / max(extent, 1.0);

  float base = dot(uvp, dir) / max(uStretch, 0.05);
  float bend = dot(n.xy, dir) * 2.6;

  float t = (base + bend) * uScale + uOffset;
  float u = t * uRepeats + uPhase;

  // The only source of colour: one ramp, three sample positions.
  float s = uRgbSplit * 0.075;
  vec3 col = vec3(ramp(u + s), ramp(u), ramp(u - s));

  // Lift the dark end. Text-bearing surfaces raise this so contrast holds.
  col = uFloor + col * (1.0 - uFloor);

  // A little sensor grain keeps the bands from banding.
  col += (hash(p + fract(uTime) * 57.3) - 0.5) * uRoughness * 0.14;

  float mask = 1.0 - smoothstep(-1.0, 1.0, d);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), mask * uOpacity);
}
`;
