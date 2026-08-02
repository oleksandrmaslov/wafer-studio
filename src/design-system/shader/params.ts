/**
 * Chromatic metal - parameter model.
 *
 * The control set mirrors Figma's shader of the same name, in the same order,
 * so tuning transfers between the two by eye. The schema is the single source
 * of truth: the inspector is generated from it, presets are validated against
 * it, and the WebGL runtime reads its uniform names from it.
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
  readonly group: "shape" | "ramp" | "finish";
}

export const METAL_PARAMS = {
  rounding: {
    uniform: "uRounding",
    label: "Rounding",
    hint: "Corner radius of the height field. Rounder corners bend the bands around them.",
    min: 0,
    max: 200,
    step: 1,
    group: "shape",
  },
  depth: {
    uniform: "uDepth",
    label: "Depth",
    hint: "How steeply the bevel turns. This is what catches the ramp.",
    min: 0,
    max: 3,
    step: 0.01,
    percent: true,
    group: "shape",
  },
  roughness: {
    uniform: "uRoughness",
    label: "Roughness",
    hint: "Scatters the normal. Breaks clean bands into grain.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "shape",
  },
  rgbSplit: {
    uniform: "uRgbSplit",
    label: "RGB split",
    hint: "Offset between the red, green, and blue ramp samples. All colour comes from here.",
    min: 0,
    max: 1.5,
    step: 0.01,
    percent: true,
    group: "ramp",
  },
  scale: {
    uniform: "uScale",
    label: "Scale",
    hint: "Size of the reflected bands.",
    min: 0.05,
    max: 3,
    step: 0.01,
    percent: true,
    group: "ramp",
  },
  stretch: {
    uniform: "uStretch",
    label: "Stretch",
    hint: "Elongates the bands along one axis.",
    min: 0.1,
    max: 5,
    step: 0.01,
    percent: true,
    group: "ramp",
  },
  angle: {
    uniform: "uAngle",
    label: "Angle",
    hint: "Direction the ramp is sampled along.",
    min: -180,
    max: 180,
    step: 1,
    group: "ramp",
  },
  repeats: {
    uniform: "uRepeats",
    label: "Repeats",
    hint: "How many times the ramp tiles across the surface.",
    min: 1,
    max: 8,
    step: 1,
    group: "ramp",
  },
  offset: {
    uniform: "uOffset",
    label: "Offset",
    hint: "Slides the ramp before it tiles.",
    min: -1,
    max: 1,
    step: 0.01,
    percent: true,
    group: "ramp",
  },
  phase: {
    uniform: "uPhase",
    label: "Phase",
    hint: "Slides the ramp within each repeat.",
    min: -1,
    max: 1,
    step: 0.01,
    percent: true,
    group: "ramp",
  },
  evolution: {
    uniform: "uEvolution",
    label: "Evolution",
    hint: "Advances the roughness pattern. Still at zero.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    group: "finish",
  },
  floor: {
    uniform: "uFloor",
    label: "Floor",
    hint: "Lifts the ramp's dark end. Raise it when the surface carries text.",
    min: 0,
    max: 0.9,
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
export type MetalParams = Record<MetalParamKey, number>;

export const METAL_PARAM_KEYS = Object.keys(METAL_PARAMS) as MetalParamKey[];

export const METAL_GROUPS = [
  { id: "shape", label: "Shape" },
  { id: "ramp", label: "Gradient" },
  { id: "finish", label: "Finish" },
] as const;

/**
 * Presets are roles, not moods. Each one exists because a different surface in
 * the product needs the material to behave differently.
 */
export const METAL_PRESETS = {
  /** Text-bearing fills. Floor is high so dark ink always clears AA. */
  action: {
    rounding: 26,
    depth: 1.14,
    roughness: 0.24,
    rgbSplit: 0.58,
    scale: 0.42,
    stretch: 3.25,
    angle: -118,
    repeats: 3,
    offset: 0.26,
    phase: -0.37,
    evolution: 0,
    floor: 0.46,
    opacity: 1,
  },
  /** Selection edges and small chrome. Tighter, quieter. */
  edge: {
    rounding: 10,
    depth: 1.4,
    roughness: 0.18,
    rgbSplit: 0.72,
    scale: 0.62,
    stretch: 1.3,
    angle: 116,
    repeats: 2,
    offset: 0,
    phase: 0,
    evolution: 0,
    floor: 0.1,
    opacity: 1,
  },
  /** The mark's own material: deep, grainy, heavily split. */
  mark: {
    rounding: 44,
    depth: 1.28,
    roughness: 0.29,
    rgbSplit: 0.46,
    scale: 0.74,
    stretch: 1.29,
    angle: 116,
    repeats: 2,
    offset: 0,
    phase: 0,
    evolution: 0,
    floor: 0.06,
    opacity: 1,
  },
  /** Full-bleed hero surfaces. Broad bands, full contrast, no lifted floor. */
  panel: {
    rounding: 60,
    depth: 1,
    roughness: 0.22,
    rgbSplit: 0.85,
    scale: 0.55,
    stretch: 2.2,
    angle: -150,
    repeats: 3,
    offset: 0,
    phase: 0,
    evolution: 0,
    floor: 0.04,
    opacity: 1,
  },
} as const satisfies Record<string, MetalParams>;

export type MetalPresetId = keyof typeof METAL_PRESETS;

export const METAL_PRESET_LIST = [
  {
    id: "action",
    label: "Action",
    description: "Text-bearing fills. Lifted floor keeps labels legible.",
  },
  {
    id: "edge",
    label: "Edge",
    description: "Selection rings and small chrome.",
  },
  { id: "mark", label: "Mark", description: "The logo's material." },
  { id: "panel", label: "Panel", description: "Broad bands for hero surfaces." },
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
      : METAL_PRESETS.action[key];
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
