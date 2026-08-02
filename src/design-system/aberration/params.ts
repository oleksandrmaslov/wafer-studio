/**
 * Dispersion aberration shader - parameter model.
 *
 * NOTE: this is the earlier "one shared light" material, kept intact and
 * self-contained so it can be lifted into another project whole. It is not used
 * by Wafer Studio, which now uses the chromatic metal in `../shader/`.
 *
 * The schema is the single source of truth: the control panel is generated from
 * it, presets are validated against it, and the WebGL runtime reads uniform
 * names from it.
 */

export interface AberrationParamSpec {
  readonly uniform: string;
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly group: "surface" | "light" | "dispersion" | "finish";
}

export const ABERRATION_PARAMS = {
  scale: {
    uniform: "uScale",
    label: "Scale",
    hint: "Size of the metal's grain structure.",
    min: 0.5,
    max: 12,
    step: 0.1,
    group: "surface",
  },
  detail: {
    uniform: "uDetail",
    label: "Detail",
    hint: "How many octaves of structure the surface carries.",
    min: 1,
    max: 5,
    step: 0.05,
    group: "surface",
  },
  warp: {
    uniform: "uWarp",
    label: "Warp",
    hint: "Domain distortion. Higher values pour the metal.",
    min: 0,
    max: 1.6,
    step: 0.01,
    group: "surface",
  },
  relief: {
    uniform: "uRelief",
    label: "Relief",
    hint: "How deeply the surface is formed. Low values stay a mirror.",
    min: 0.01,
    max: 0.8,
    step: 0.005,
    group: "surface",
  },
  flow: {
    uniform: "uFlow",
    label: "Flow",
    hint: "Speed the surface drifts at. Zero freezes it.",
    min: 0,
    max: 2,
    step: 0.01,
    group: "surface",
  },
  metalness: {
    uniform: "uMetalness",
    label: "Metalness",
    hint: "Mirror versus matte. Low values read as anodised.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "light",
  },
  specular: {
    uniform: "uSpecular",
    label: "Specular",
    hint: "Intensity of the highlight under the light source.",
    min: 0,
    max: 2.5,
    step: 0.01,
    group: "light",
  },
  spread: {
    uniform: "uSpread",
    label: "Spread",
    hint: "How tightly the highlight focuses.",
    min: 0.4,
    max: 8,
    step: 0.05,
    group: "light",
  },
  exposure: {
    uniform: "uExposure",
    label: "Exposure",
    hint: "Overall brightness of the reflected environment.",
    min: 0,
    max: 2,
    step: 0.01,
    group: "light",
  },
  dispersion: {
    uniform: "uDispersion",
    label: "Dispersion",
    hint: "How far the spectrum splits where the surface turns.",
    min: 0,
    max: 2.5,
    step: 0.01,
    group: "dispersion",
  },
  bias: {
    uniform: "uBias",
    label: "Edge bias",
    hint: "Confines colour to steep edges. High values keep fills neutral.",
    min: 0.2,
    max: 6,
    step: 0.05,
    group: "dispersion",
  },
  saturation: {
    uniform: "uSaturation",
    label: "Chroma",
    hint: "Saturation of the split, before it meets the substrate.",
    min: 0,
    max: 2,
    step: 0.01,
    group: "dispersion",
  },
  rotation: {
    uniform: "uRotation",
    label: "Rotation",
    hint: "Rotates the spectrum around the light.",
    min: 0,
    max: 1,
    step: 0.005,
    group: "dispersion",
  },
  contrast: {
    uniform: "uContrast",
    label: "Contrast",
    hint: "Separation between the lit and unlit sides.",
    min: 0.2,
    max: 2.5,
    step: 0.01,
    group: "finish",
  },
  grain: {
    uniform: "uGrain",
    label: "Grain",
    hint: "Sensor noise. A little keeps gradients from banding.",
    min: 0,
    max: 0.35,
    step: 0.005,
    group: "finish",
  },
  vignette: {
    uniform: "uVignette",
    label: "Vignette",
    hint: "Falloff toward the edges of the field.",
    min: 0,
    max: 1.5,
    step: 0.01,
    group: "finish",
  },
  opacity: {
    uniform: "uOpacity",
    label: "Opacity",
    hint: "Strength of the whole field over the substrate.",
    min: 0,
    max: 1,
    step: 0.01,
    group: "finish",
  },
} as const satisfies Record<string, AberrationParamSpec>;

export type AberrationParamKey = keyof typeof ABERRATION_PARAMS;
export type AberrationParams = Record<AberrationParamKey, number>;

export const ABERRATION_PARAM_KEYS = Object.keys(
  ABERRATION_PARAMS
) as AberrationParamKey[];

export const ABERRATION_GROUPS = [
  { id: "surface", label: "Surface" },
  { id: "light", label: "Light" },
  { id: "dispersion", label: "Dispersion" },
  { id: "finish", label: "Finish" },
] as const;

export const ABERRATION_PRESETS = {
  precision: {
    scale: 1.3,
    detail: 1.8,
    warp: 0.4,
    relief: 0.12,
    flow: 0.14,
    metalness: 0.74,
    specular: 0.95,
    spread: 2.2,
    exposure: 0.95,
    dispersion: 0.5,
    bias: 2.4,
    saturation: 0.8,
    rotation: 0,
    contrast: 1.05,
    grain: 0.025,
    vignette: 0.4,
    opacity: 0.5,
  },
  alloy: {
    scale: 1.5,
    detail: 2.1,
    warp: 0.6,
    relief: 0.18,
    flow: 0.22,
    metalness: 0.88,
    specular: 1.2,
    spread: 1.9,
    exposure: 1,
    dispersion: 1,
    bias: 2,
    saturation: 1.1,
    rotation: 0,
    contrast: 1.12,
    grain: 0.035,
    vignette: 0.45,
    opacity: 0.8,
  },
  prism: {
    scale: 1.7,
    detail: 2.4,
    warp: 0.8,
    relief: 0.26,
    flow: 0.32,
    metalness: 0.95,
    specular: 1.5,
    spread: 1.5,
    exposure: 1.05,
    dispersion: 1.7,
    bias: 1.6,
    saturation: 1.45,
    rotation: 0,
    contrast: 1.2,
    grain: 0.045,
    vignette: 0.5,
    opacity: 1,
  },
  mark: {
    scale: 1.1,
    detail: 2.3,
    warp: 1,
    relief: 0.36,
    flow: 0.1,
    metalness: 1,
    specular: 1.9,
    spread: 1.1,
    exposure: 1.15,
    dispersion: 2.1,
    bias: 1.3,
    saturation: 1.7,
    rotation: 0.1,
    contrast: 1.3,
    grain: 0.05,
    vignette: 0.15,
    opacity: 1,
  },
} as const satisfies Record<string, AberrationParams>;

export type AberrationPresetId = keyof typeof ABERRATION_PRESETS;

export const ABERRATION_PRESET_LIST = [
  {
    id: "precision",
    label: "Precision",
    description: "Restrained. Colour only where the surface truly turns.",
  },
  {
    id: "alloy",
    label: "Alloy",
    description: "The reference material. Balanced metal and spectrum.",
  },
  {
    id: "prism",
    label: "Prism",
    description: "Full spectral response across a livelier surface.",
  },
  {
    id: "mark",
    label: "Mark",
    description: "The logo's own material, for hero surfaces.",
  },
] as const satisfies readonly {
  id: AberrationPresetId;
  label: string;
  description: string;
}[];

export function clampParams(params: AberrationParams): AberrationParams {
  const next = { ...params };
  for (const key of ABERRATION_PARAM_KEYS) {
    const spec = ABERRATION_PARAMS[key];
    const value = Number(next[key]);
    next[key] = Number.isFinite(value)
      ? Math.min(Math.max(value, spec.min), spec.max)
      : ABERRATION_PRESETS.alloy[key];
  }
  return next;
}

export function paramsEqual(a: AberrationParams, b: AberrationParams): boolean {
  return ABERRATION_PARAM_KEYS.every((key) => Math.abs(a[key] - b[key]) < 1e-6);
}

export function matchPreset(
  params: AberrationParams
): AberrationPresetId | null {
  for (const preset of ABERRATION_PRESET_LIST) {
    if (paramsEqual(params, ABERRATION_PRESETS[preset.id])) return preset.id;
  }
  return null;
}
