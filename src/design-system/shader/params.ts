/**
 * Wafer chromatic metal — parameter model.
 *
 * The names follow the reference material's vocabulary so that a value read off
 * a design tool lands here without translation. The schema is the single source
 * of truth: the inspector is generated from it, presets are validated against
 * it, and the WebGL runtime reads its uniform names from it.
 */

export interface MetalParamSpec {
  readonly uniform: string;
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly group: "shape" | "surface" | "bands" | "finish";
  /** Shown in the numeric field. Percent matches the reference tooling. */
  readonly unit?: "percent" | "degrees" | "plain";
}

export const METAL_PARAMS = {
  rounding: {
    uniform: "uRounding",
    label: "Rounding",
    hint: "Corner radius, and how softly the dome falls to the edge.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "shape",
    unit: "percent",
  },
  depth: {
    uniform: "uDepth",
    label: "Depth",
    hint: "How far the surface inflates. Low values stay flat.",
    min: 0,
    max: 2,
    step: 0.01,
    group: "shape",
    unit: "percent",
  },
  roughness: {
    uniform: "uRoughness",
    label: "Roughness",
    hint: "Mirror to matte. Also softens the specular highlight.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "surface",
    unit: "percent",
  },
  scale: {
    uniform: "uScale",
    label: "Scale",
    hint: "Size of the reflected forms. Higher is larger.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "surface",
    unit: "percent",
  },
  stretch: {
    uniform: "uStretch",
    label: "Stretch",
    hint: "Smears reflections into anisotropic streaks.",
    min: 0.25,
    max: 6,
    step: 0.01,
    group: "surface",
    unit: "percent",
  },
  angle: {
    uniform: "uAngle",
    label: "Angle",
    hint: "Direction the streaks and the light run.",
    min: -180,
    max: 180,
    step: 1,
    group: "surface",
    unit: "degrees",
  },
  evolution: {
    uniform: "uEvolution",
    label: "Evolution",
    hint: "Reseeds the surface. Same value gives the same frame.",
    min: 0,
    max: 10,
    step: 0.01,
    group: "surface",
    unit: "plain",
  },
  repeats: {
    uniform: "uRepeats",
    label: "Repeats",
    hint: "How many times the reflection ramp cycles across the form.",
    min: 0.25,
    max: 8,
    step: 0.05,
    group: "bands",
    unit: "plain",
  },
  rgbSplit: {
    uniform: "uRgbSplit",
    label: "RGB split",
    hint: "Offsets the channels across the ramp. This is where colour comes from.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "bands",
    unit: "percent",
  },
  offset: {
    uniform: "uOffset",
    label: "Offset",
    hint: "Slides the whole ramp along the form.",
    min: -1,
    max: 1,
    step: 0.01,
    group: "bands",
    unit: "percent",
  },
  phase: {
    uniform: "uPhase",
    label: "Phase",
    hint: "Fine adjustment of where the bands land.",
    min: -1,
    max: 1,
    step: 0.01,
    group: "bands",
    unit: "percent",
  },
  contrast: {
    uniform: "uContrast",
    label: "Contrast",
    hint: "Separation between the lit and unlit sides.",
    min: 0.3,
    max: 2.2,
    step: 0.01,
    group: "finish",
    unit: "percent",
  },
  grain: {
    uniform: "uGrain",
    label: "Grain",
    hint: "Sensor noise. A little stops the bands from banding.",
    min: 0,
    max: 0.4,
    step: 0.005,
    group: "finish",
    unit: "percent",
  },
  opacity: {
    uniform: "uOpacity",
    label: "Opacity",
    hint: "Strength of the material over the surface beneath it.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "finish",
    unit: "percent",
  },
} as const satisfies Record<string, MetalParamSpec>;

export type MetalParamKey = keyof typeof METAL_PARAMS;
export type MetalParams = Record<MetalParamKey, number>;

export const METAL_PARAM_KEYS = Object.keys(METAL_PARAMS) as MetalParamKey[];

export const METAL_GROUPS = [
  { id: "shape", label: "Shape" },
  { id: "surface", label: "Surface" },
  { id: "bands", label: "Bands" },
  { id: "finish", label: "Finish" },
] as const;

/**
 * Presets are the finish levels, expressed as material state. Contrast is held
 * high enough in all of them that ink laid over the material still clears AA.
 */
export const METAL_PRESETS = {
  precision: {
    rounding: 0.8,
    depth: 0.85,
    roughness: 0.46,
    scale: 0.5,
    stretch: 2.6,
    angle: -118,
    evolution: 0,
    repeats: 1.8,
    rgbSplit: 0.26,
    offset: 0,
    phase: -0.37,
    contrast: 1,
    grain: 0.03,
    opacity: 0.85,
  },
  alloy: {
    rounding: 0.8,
    depth: 1.14,
    roughness: 0.33,
    scale: 0.42,
    stretch: 3.25,
    angle: -118,
    evolution: 0,
    repeats: 3,
    rgbSplit: 0.58,
    offset: 0,
    phase: -0.37,
    contrast: 1.08,
    grain: 0.045,
    opacity: 1,
  },
  prism: {
    rounding: 0.8,
    depth: 1.45,
    roughness: 0.22,
    scale: 0.38,
    stretch: 4.2,
    angle: -118,
    evolution: 0,
    repeats: 4.4,
    rgbSplit: 0.82,
    offset: 0,
    phase: -0.37,
    contrast: 1.18,
    grain: 0.06,
    opacity: 1,
  },
  /** The mark's own material, tuned from the app icon. */
  mark: {
    rounding: 0.62,
    depth: 1.28,
    roughness: 0.29,
    scale: 0.74,
    stretch: 1.29,
    angle: 116,
    evolution: 0,
    repeats: 2,
    rgbSplit: 0.46,
    offset: 0,
    phase: 0,
    contrast: 1.12,
    grain: 0.05,
    opacity: 1,
  },
} as const satisfies Record<string, MetalParams>;

export type MetalPresetId = keyof typeof METAL_PRESETS;

export const METAL_PRESET_LIST = [
  {
    id: "precision",
    label: "Precision",
    description: "Restrained. Broad bands, little channel separation.",
  },
  {
    id: "alloy",
    label: "Alloy",
    description: "The reference material. Balanced streaks and spectrum.",
  },
  {
    id: "prism",
    label: "Prism",
    description: "Tight bands and a wide split across every edge.",
  },
  {
    id: "mark",
    label: "Mark",
    description: "The app icon's material, for hero surfaces.",
  },
] as const satisfies readonly {
  id: MetalPresetId;
  label: string;
  description: string;
}[];

export function clampParams(params: MetalParams): MetalParams {
  const next = { ...params };
  for (const key of METAL_PARAM_KEYS) {
    const spec = METAL_PARAMS[key];
    const value = Number(next[key]);
    next[key] = Number.isFinite(value)
      ? Math.min(Math.max(value, spec.min), spec.max)
      : METAL_PRESETS.alloy[key];
  }
  return next;
}

export function paramsEqual(a: MetalParams, b: MetalParams): boolean {
  return METAL_PARAM_KEYS.every((key) => Math.abs(a[key] - b[key]) < 1e-6);
}

export function matchPreset(params: MetalParams): MetalPresetId | null {
  for (const preset of METAL_PRESET_LIST) {
    if (paramsEqual(params, METAL_PRESETS[preset.id])) return preset.id;
  }
  return null;
}

/** Formats a value the way the inspector's numeric field shows it. */
export function formatParam(key: MetalParamKey, value: number): string {
  const spec = METAL_PARAMS[key];
  if (spec.unit === "degrees") return `${Math.round(value)}`;
  if (spec.unit === "percent") return `${Math.round(value * 100)}`;
  return `${Number(value.toFixed(2))}`;
}
