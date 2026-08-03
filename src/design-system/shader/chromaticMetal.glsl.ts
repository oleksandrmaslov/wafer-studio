/**
 * Wafer Chromatic Metal.
 *
 * An independently developed real-time material inspired by iridescent metals,
 * thin-film interference, and contemporary generative shader aesthetics. It is
 * not affiliated with or derived from Figma's proprietary Chromatic metal
 * implementation; the parameter names match so tuning transfers by eye, but the
 * algorithm here is our own.
 *
 * The layers, in order:
 *
 *   Shape field      rounded rectangle, or a signed-distance mask for the logo
 *   Height field     dome plus FBM dents, domain-warped
 *   Normals          from screen-space derivatives of that height
 *   Anisotropy       stretched banding along a chosen angle
 *   Gradient         a COLOUR ramp, tiled by `repeats`
 *   RGB separation   red and blue sampled either side of green
 *   Specular         sharp and broad Blinn-Phong lobes
 *   Fresnel rim      colour and brightness at the silhouette
 *   Grain            micro-roughness
 *
 * The gradient carrying real colour is the point. Deriving hue purely from
 * channel separation on a grey ramp gives brushed steel; the vivid blue, pink,
 * and yellow bands of the reference come from the ramp itself, and the split
 * then fringes them further.
 */

export const METAL_VERT = /* glsl */ `#version 300 es

precision highp float;

out vec2 vUv;

void main() {
  // Fullscreen triangle, no vertex buffer.
  vec2 position = vec2(
    float((gl_VertexID << 1) & 2),
    float(gl_VertexID & 2)
  );

  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}

`;

export const METAL_FRAG = /* glsl */ `#version 300 es

precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;

uniform float uRoughness;
uniform float uDepth;
uniform float uRgbSplit;
uniform float uScale;
uniform float uStretch;
uniform float uAngle;

uniform float uRepeats;
uniform float uOffset;
uniform float uPhase;
uniform float uEvolution;
uniform float uRounding;
uniform float uOpacity;

// Up to eight colour stops. rgb is linear-ish sRGB, a is the position 0..1.
// Eight rather than five so the ramp can carry white anchors between the
// colour bands; without them the surface reads as an oil slick, not chrome.
uniform vec4 uGradient[8];
uniform int uGradientCount;

uniform sampler2D uSdfMask;
uniform bool uUseSdfMask;

// Fills the whole canvas instead of cutting a rounded rectangle. Used when
// baking the material to a texture: a dome would tile as a vignette.
uniform bool uFullBleed;

const float TAU = 6.283185307179586;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;

  for (int octave = 0; octave < 4; octave++) {
    sum += amplitude * valueNoise(p);
    p = rotate2d(0.53) * p * 2.03 + vec2(7.1, 3.4);
    amplitude *= 0.5;
  }

  return sum;
}

float sdRoundBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float shapeField(vec2 uv) {
  if (uFullBleed) {
    return 1.0;
  }

  if (uUseSdfMask) {
    return (texture(uSdfMask, uv).r - 0.5) * 2.0;
  }

  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;

  vec2 halfSize = vec2(aspect * 0.92, 0.86);
  float maxRadius = min(halfSize.x, halfSize.y) * 0.95;
  float radius = min(mix(0.025, 0.46, clamp(uRounding, 0.0, 1.0)), maxRadius);

  // Positive inside.
  return -sdRoundBox(p, halfSize, radius);
}

/**
 * Coordinates for the NOISE: the dents, the micro-surface, the domain warp.
 * These want to be high frequency, several cycles across the form.
 */
vec2 patternCoordinates(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;

  // Higher Scale means larger forms, matching the reference control.
  float frequency = mix(8.0, 1.45, clamp(uScale, 0.0, 1.0));

  // Stretch DIVIDES: elongating a reflection means fewer cycles along that
  // axis, not more.
  vec2 stretched = p / vec2(max(uStretch, 0.05), 1.0);
  vec2 rotated = rotate2d(uAngle) * stretched;

  return rotated * frequency
    + vec2(uEvolution * 0.31, -uEvolution * 0.23);
}

/**
 * Coordinates for the BANDS, on their own much lower frequency.
 *
 * Deriving these from the noise coordinates is what turns the surface into a
 * fine stripey mess: the noise wants roughly eight cycles across the form and
 * the colour ramp wants roughly one, and repeats then multiplies whatever it
 * is given. They have to be separate.
 */
vec2 bandCoordinates(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;

  float frequency = mix(1.5, 0.26, clamp(uScale, 0.0, 1.0));

  vec2 stretched = p / vec2(max(uStretch, 0.05), 1.0);
  return rotate2d(uAngle) * stretched * frequency;
}

float heightField(vec2 uv) {
  float field = shapeField(uv);

  float aa = max(fwidth(field) * 1.5, 0.0015);
  float inside = smoothstep(-aa, aa, field);

  vec2 q = patternCoordinates(uv);

  float macroNoise = fbm(q * 0.68);
  float warpedNoise = fbm(
    q * 1.15
    + vec2(macroNoise * 2.4, -macroNoise * 1.7)
    + uEvolution
  );

  float normalizedDistance = clamp(field * 2.1, 0.0, 1.0);
  float dome = pow(normalizedDistance, mix(0.42, 0.72, uRounding));

  float dents = (macroNoise - 0.5) * 0.085 * uDepth;
  float microSurface = (warpedNoise - 0.5) * mix(0.025, 0.105, uRoughness);

  return inside * (dome + dents + microSurface);
}

vec3 sampleGradient(float t) {
  t = clamp(t, 0.0, 1.0);

  vec4 previous = uGradient[0];

  for (int index = 1; index < 8; index++) {
    if (index >= uGradientCount) {
      break;
    }

    vec4 nextStop = uGradient[index];

    if (t <= nextStop.a) {
      float range = max(nextStop.a - previous.a, 0.0001);
      float localT = clamp((t - previous.a) / range, 0.0, 1.0);
      return mix(previous.rgb, nextStop.rgb, localT);
    }

    previous = nextStop;
  }

  return previous.rgb;
}

vec3 srgbToLinear(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(2.2));
}

vec3 linearToSrgb(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
}

void main() {
  float field = shapeField(vUv);
  float aa = max(fwidth(field) * 1.5, 0.0015);
  float alpha = smoothstep(-aa, aa, field);

  if (alpha <= 0.001) {
    outColor = vec4(0.0);
    return;
  }

  float height = heightField(vUv);

  // Screen-space derivatives are cheaper than resampling the height field.
  float resolutionScale = min(uResolution.x, uResolution.y);
  float normalStrength = 0.006 * resolutionScale * max(uDepth, 0.01);

  vec3 normal = normalize(vec3(
    -dFdx(height) * normalStrength,
    -dFdy(height) * normalStrength,
    1.0
  ));

  vec2 lightAxis = vec2(cos(uAngle), sin(uAngle));
  vec3 lightDirection = normalize(vec3(lightAxis * 0.52, 0.82));
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 halfDirection = normalize(lightDirection + viewDirection);

  float nDotL = max(dot(normal, lightDirection), 0.0);
  float nDotH = max(dot(normal, halfDirection), 0.0);

  float specularExponent = mix(180.0, 9.0, clamp(uRoughness, 0.0, 1.0));
  float sharpSpecular = pow(nDotH, specularExponent);
  float broadSpecular = pow(nDotH, mix(14.0, 2.2, uRoughness));

  float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 3.0);

  vec2 q = patternCoordinates(vUv);

  float domainWarp = fbm(
    q * 0.72 + vec2(uEvolution * 0.4, -uEvolution * 0.25)
  );

  vec2 b = bandCoordinates(vUv);

  float anisotropicBands = 0.5 + 0.5 * sin(
    (b.x + b.y * 0.16 + (domainWarp - 0.5) * 0.22) * TAU
  );

  // Deliberately NOT steepened. Pushing this toward a square wave collapses it
  // to 0 and 1, and with an an integer repeats value both ends land on the same ramp
  // position, so the whole surface floods with one colour and the gradient is
  // only ever seen in the transitions. The hard edges belong in the gradient's
  // stops, not here.

  float normalBand = 0.5 + 0.5 * dot(normal.xy, normalize(lightAxis));

  float gradientCoordinate = mix(anisotropicBands, normalBand, 0.24);

  gradientCoordinate = fract(
    gradientCoordinate * max(uRepeats, 1.0) + uOffset + uPhase
  );

  float rgbDelta = clamp(uRgbSplit, 0.0, 1.0) * 0.058;

  vec3 centerColor = sampleGradient(gradientCoordinate);

  vec3 splitColor = vec3(
    sampleGradient(fract(gradientCoordinate + rgbDelta)).r,
    centerColor.g,
    sampleGradient(fract(gradientCoordinate - rgbDelta)).b
  );

  vec3 environment = srgbToLinear(splitColor);

  /*
   * Metal is not a lit surface. It has no meaningful diffuse term: what you
   * see is the environment, reflected. Multiplying the ramp by a diffuse
   * factor and adding specular on top is what flattens this into pastel mush,
   * so the environment goes through essentially untouched and only three
   * things act on it.
   */

  // Fresnel drives the silhouette to white, the way a mirror does at grazing
  // angles. This is where chrome gets its bright rim.
  float rim = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.4);

  vec3 color = environment;
  color = mix(color, vec3(1.0), rim * 0.26 * (1.0 - uRoughness * 0.5));

  // A tight lobe blows the hottest reflections past white.
  color += vec3(sharpSpecular) * mix(1.3, 0.5, uRoughness);
  color += vec3(broadSpecular) * mix(0.07, 0.18, uRoughness);

  // Shadowed facets go genuinely dark. Without this the darks sit at mid grey
  // and nothing reads as polished.
  color *= mix(0.72, 1.1, nDotL);

  float grain = hash21(
    gl_FragCoord.xy + vec2(uEvolution * 191.17, uEvolution * 73.41)
  ) - 0.5;

  color *= 1.0 + grain * mix(0.025, 0.16, uRoughness);

  color = linearToSrgb(color);

  // Final contrast. Polished metal lives at the ends of the range.
  color = (color - 0.5) * 1.16 + 0.5;
  color = clamp(color, 0.0, 1.0);

  outColor = vec4(color, alpha * uOpacity);
}

`;
