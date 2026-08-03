/**
 * Wafer Chromatic Metal - parameter model.
 *
 * The numeric control set matches the reference material's, in the same order,
 * so tuning transfers by eye. The schema is the single source of truth: the
 * inspector is generated from it, presets are validated against it, and the
 * WebGL runtime reads its uniform names from it.
 *
 * The gradient is deliberately NOT part of the numeric schema. It is a list of
 * colour stops, and it is where the material's colour actually lives.
 */

export interface MetalParamSpec {
  readonly uniform: string;
  readonly label: string;
  /** One line, shown under the control. Say what it does physically. */
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Rendered as a percentage in the inspector rather than a raw number. */
  readonly percent?: boolean;
  readonly group: "surface" | "reflection" | "gradient" | "finish";
}

export const METAL_PARAMS = {
  rounding: {
    uniform: "uRounding",
    label: "Rounding",
    hint: "Corner radius of the form, and how softly the dome falls to its edge.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "surface",
  },
  depth: {
    uniform: "uDepth",
    label: "Depth",
    hint: "Strength of the bulges and dents. This is what bends the reflection.",
    min: 0,
    max: 2,
    step: 0.01,
    percent: true,
    group: "surface",
  },
  roughness: {
    uniform: "uRoughness",
    label: "Roughness",
    hint: "Mirror through to matte. Widens the highlight and adds grain.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "surface",
  },
  scale: {
    uniform: "uScale",
    label: "Scale",
    hint: "Size of the reflected forms. Higher is larger.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "reflection",
  },
  stretch: {
    uniform: "uStretch",
    label: "Stretch",
    hint: "Anisotropy. Draws the reflections out along one axis.",
    min: 0.25,
    max: 4,
    step: 0.01,
    percent: true,
    group: "reflection",
  },
  angle: {
    uniform: "uAngle",
    label: "Angle",
    hint: "Direction of the stretch and of the light.",
    min: -180,
    max: 180,
    step: 1,
    group: "reflection",
  },
  rgbSplit: {
    uniform: "uRgbSplit",
    label: "RGB split",
    hint: "Offsets red and blue either side of green. Fringes every band edge.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "gradient",
  },
  repeats: {
    uniform: "uRepeats",
    label: "Repeats",
    hint: "How many times the colour ramp tiles across the surface.",
    min: 1,
    max: 8,
    step: 0.1,
    group: "gradient",
  },
  offset: {
    uniform: "uOffset",
    label: "Offset",
    hint: "Slides the ramp across the form.",
    min: -1,
    max: 1,
    step: 0.01,
    percent: true,
    group: "gradient",
  },
  phase: {
    uniform: "uPhase",
    label: "Phase",
    hint: "Slides the ramp within each repeat.",
    min: -1,
    max: 1,
    step: 0.01,
    percent: true,
    group: "gradient",
  },
  evolution: {
    uniform: "uEvolution",
    label: "Evolution",
    hint: "Advances the noise to a different variation. Still at zero.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "finish",
  },
  opacity: {
    uniform: "uOpacity",
    label: "Opacity",
    hint: "Strength of the whole surface.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "finish",
  },
} as const satisfies Record<string, MetalParamSpec>;

export type MetalParamKey = keyof typeof METAL_PARAMS;
export const METAL_PARAM_KEYS = Object.keys(METAL_PARAMS) as MetalParamKey[];

export const METAL_GROUPS = [
  { id: "surface", label: "Surface" },
  { id: "reflection", label: "Reflection" },
  { id: "gradient", label: "Gradient" },
  { id: "finish", label: "Finish" },
] as const;

export interface GradientStop {
  /** Linear-ish sRGB, 0..1 per channel. */
  readonly color: readonly [number, number, number];
  /** 0..1 along the ramp. */
  readonly position: number;
}

export type MetalParams = Record<MetalParamKey, number> & {
  readonly gradient: readonly GradientStop[];
};

/** Max stops the shader carries. Keep in sync with `uGradient[8]`. */
export const MAX_GRADIENT_STOPS = 8;

/**
 * The spectral ramp: white, into cyan, into deep blue, into magenta, out to
 * warm yellow. This is where the material's colour comes from.
 */
const SPECTRAL: readonly GradientStop[] = [
  // Chrome, not an oil film. The difference is entirely in how the ramp spends
  // its length: a long white plateau, a THIN rainbow transition, then straight
  // into near-black and a long climb back. Giving every hue equal area is what
  // makes a surface look like petrol on water; here colour occupies under a
  // fifth of the ramp and the rest is value.
  { color: [1.0, 1.0, 1.0], position: 0.0 },
  { color: [0.94, 0.96, 0.98], position: 0.28 },
  { color: [0.42, 0.78, 1.0], position: 0.36 },
  { color: [0.12, 0.3, 1.0], position: 0.43 },
  { color: [0.81, 0.21, 0.92], position: 0.49 },
  { color: [1.0, 0.71, 0.27], position: 0.55 },
  { color: [0.06, 0.08, 0.1], position: 0.64 },
  { color: [1.0, 1.0, 1.0], position: 1.0 },
];

/**
 * Monochrome silver. No hue, so it is the ramp to use when a surface has to
 * carry text or when the user has asked for high contrast.
 */
const SILVER: readonly GradientStop[] = [
  // Same value structure with the colour removed, and the dark end lifted to
  // #8F9AA4 so near-black ink clears AA against the worst point of the fill.
  { color: [1.0, 1.0, 1.0], position: 0.0 },
  { color: [0.97, 0.98, 0.99], position: 0.3 },
  { color: [0.8, 0.84, 0.88], position: 0.46 },
  { color: [0.56, 0.6, 0.64], position: 0.62 },
  { color: [0.85, 0.88, 0.91], position: 0.82 },
  { color: [1.0, 1.0, 1.0], position: 1.0 },
];

/**
 * Presets are roles, not moods. Each exists because a surface in the product
 * needs the material to behave differently.
 */
export const METAL_PRESETS = {
  /** Primary actions and hero fills. */
  button: {
    roughness: 0.33,
    depth: 1.14,
    rgbSplit: 0.58,
    scale: 0.58,
    stretch: 3.25,
    angle: -118,
    repeats: 2,
    offset: 0.26,
    phase: -0.37,
    evolution: 0,
    rounding: 0.88,
    opacity: 1,
    gradient: SPECTRAL,
  },
  /** Selected keys. Tighter, less stretched, slowly evolving. */
  keycap: {
    roughness: 0.24,
    depth: 1.3,
    rgbSplit: 0.38,
    scale: 0.7,
    stretch: 1.9,
    angle: 108,
    repeats: 1.8,
    offset: 0.08,
    phase: -0.12,
    evolution: 0.15,
    rounding: 0.72,
    opacity: 1,
    gradient: SPECTRAL,
  },
  /** The mark's own material. */
  logo: {
    roughness: 0.29,
    depth: 1.28,
    rgbSplit: 0.46,
    scale: 0.8,
    stretch: 1.5,
    angle: 116,
    repeats: 1.6,
    offset: 0,
    phase: 0,
    evolution: 0,
    rounding: 0.38,
    opacity: 1,
    gradient: SPECTRAL,
  },
  /**
   * Monochrome, low split, high roughness. For high-contrast mode, for
   * text-bearing fills, and for anyone who has asked for less colour.
   */
  silver: {
    roughness: 0.4,
    depth: 0.95,
    rgbSplit: 0.08,
    scale: 0.68,
    stretch: 1.35,
    angle: 120,
    repeats: 1.6,
    offset: 0,
    phase: 0,
    evolution: 0,
    rounding: 0.65,
    opacity: 1,
    gradient: SILVER,
  },
} as const satisfies Record<string, MetalParams>;

export type MetalPresetId = keyof typeof METAL_PRESETS;

export const METAL_PRESET_LIST = [
  {
    id: "button",
    label: "Button",
    description: "Primary actions and hero fills.",
  },
  { id: "keycap", label: "Keycap", description: "Selected keys." },
  { id: "logo", label: "Logo", description: "The mark's own material." },
  {
    id: "silver",
    label: "Silver",
    description: "Monochrome. High contrast and text-bearing fills.",
  },
] as const satisfies readonly {
  id: MetalPresetId;
  label: string;
  description: string;
}[];

export function clampParams(params: MetalParams): MetalParams {
  const next: Record<string, unknown> = { ...params };

  for (const key of METAL_PARAM_KEYS) {
    const spec: MetalParamSpec = METAL_PARAMS[key];
    const value = Number(params[key]);
    next[key] = Number.isFinite(value)
      ? Math.min(Math.max(value, spec.min), spec.max)
      : METAL_PRESETS.button[key];
  }

  const stops = Array.isArray(params.gradient) ? params.gradient : [];
  next.gradient =
    stops.length >= 2
      ? stops.slice(0, MAX_GRADIENT_STOPS)
      : METAL_PRESETS.button.gradient;

  return next as MetalParams;
}

function gradientEquals(
  a: readonly GradientStop[],
  b: readonly GradientStop[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((stop, index) => {
    const other = b[index];
    return (
      Math.abs(stop.position - other.position) < 1e-6 &&
      stop.color.every((c, i) => Math.abs(c - other.color[i]) < 1e-6)
    );
  });
}

export function paramsEqual(a: MetalParams, b: MetalParams): boolean {
  return (
    METAL_PARAM_KEYS.every((key) => Math.abs(a[key] - b[key]) < 1e-6) &&
    gradientEquals(a.gradient, b.gradient)
  );
}

export function matchPreset(params: MetalParams): MetalPresetId | null {
  for (const preset of METAL_PRESET_LIST) {
    if (paramsEqual(params, METAL_PRESETS[preset.id])) return preset.id;
  }
  return null;
}

/** `#rrggbb` for an `<input type="color">`. */
export function stopToHex(stop: GradientStop): string {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(stop.color[0])}${channel(stop.color[1])}${channel(stop.color[2])}`;
}

export function hexToColor(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const read = (start: number) => parseInt(value.slice(start, start + 2), 16) / 255;
  return [read(0), read(2), read(4)];
}

/** A CSS gradient of the same stops, for previews and the no-WebGL fallback. */
export function gradientToCss(
  stops: readonly GradientStop[],
  angleDeg = 116
): string {
  const parts = [...stops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${stopToHex(stop)} ${(stop.position * 100).toFixed(1)}%`);
  return `linear-gradient(${angleDeg}deg, ${parts.join(", ")})`;
}

/**
 * Adapts a preset to the active theme. High contrast drops the split and the
 * hue entirely, because colour must never be the only signal.
 */
export function adaptPresetForTheme(
  params: MetalParams,
  theme: "dark" | "light" | "high-contrast"
): MetalParams {
  switch (theme) {
    case "high-contrast":
      return {
        ...params,
        rgbSplit: Math.min(params.rgbSplit, 0.08),
        roughness: Math.max(params.roughness, 0.42),
        phase: 0,
        evolution: 0,
        gradient: SILVER,
      };
    case "light":
      return {
        ...params,
        roughness: Math.max(params.roughness, 0.36),
        depth: params.depth * 0.9,
        rgbSplit: params.rgbSplit * 0.72,
      };
    default:
      return params;
  }
}
