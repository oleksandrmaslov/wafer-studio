import { useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  METAL_GROUPS,
  METAL_PARAMS,
  METAL_PARAM_KEYS,
  METAL_PRESETS,
  METAL_PRESET_LIST,
  gradientToCss,
  hexToColor,
  matchPreset,
  stopToHex,
  type MetalParamKey,
  type MetalParams,
  type MetalParamSpec,
  type MetalPresetId,
} from "./params.ts";

/**
 * The gradient editor.
 *
 * Colour comes from these stops, not from the RGB split, so this is the most
 * consequential control in the panel and it gets real editing rather than a
 * preview swatch.
 */
function GradientEditor({
  params,
  onChange,
}: {
  params: MetalParams;
  onChange: (params: MetalParams) => void;
}) {
  return (
    <div className="grid gap-2 py-2">
      <div
        aria-hidden="true"
        className="h-10 rounded-control border border-line-subtle"
        style={{ backgroundImage: gradientToCss(params.gradient) }}
      />
      <div className="flex flex-wrap gap-1.5">
        {params.gradient.map((stop, index) => (
          <label
            key={`${index}-${stop.position}`}
            className="grid gap-1 text-center"
          >
            <span className="sr-only">
              {`Gradient stop ${index + 1} colour`}
            </span>
            <input
              type="color"
              value={stopToHex(stop)}
              onChange={(event) => {
                const next = params.gradient.map((existing, i) =>
                  i === index
                    ? { ...existing, color: hexToColor(event.currentTarget.value) }
                    : existing
                );
                onChange({ ...params, gradient: next });
              }}
              className="h-7 w-9 cursor-pointer rounded border border-line-subtle bg-transparent p-0.5"
            />
            <span className="font-mono text-[0.5625rem] tabular-nums text-tertiary">
              {Math.round(stop.position * 100)}
            </span>
          </label>
        ))}
      </div>
      <p className="text-[0.625rem] leading-snug text-tertiary">
        Stop colours and positions. All of the material's hue comes from here.
      </p>
    </div>
  );
}

/**
 * The material inspector.
 *
 * Generated from the parameter schema, so it can never drift out of sync with
 * the shader. Presets are the entry point and the sliders are the escape hatch,
 * which is the shape of a Figma effect panel.
 */

function format(key: MetalParamKey, value: number): string {
  // Widened: `satisfies` keeps each entry's literal type, so the optional
  // `percent` field is absent from the entries that do not set it.
  const spec: MetalParamSpec = METAL_PARAMS[key];
  if (spec.percent) return `${Math.round(value * 100)}%`;
  return String(Number(value.toFixed(2)));
}

interface SliderRowProps {
  paramKey: MetalParamKey;
  value: number;
  onChange: (value: number) => void;
}

function SliderRow({ paramKey, value, onChange }: SliderRowProps) {
  const spec = METAL_PARAMS[paramKey];
  const id = useId();
  const hintId = `${id}-hint`;
  const progress = ((value - spec.min) / (spec.max - spec.min)) * 100;

  return (
    <div className="grid gap-1.5 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[0.6875rem] font-semibold tracking-wide text-ink"
        >
          {spec.label}
        </label>
        <output
          htmlFor={id}
          className="min-w-14 rounded border border-line-subtle bg-raised/50 px-1.5 py-0.5 text-right font-mono text-[0.6875rem] tabular-nums text-muted"
        >
          {format(paramKey, value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        aria-describedby={hintId}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ "--progress": `${progress}%` } as CSSProperties}
        className="wafer-slider"
      />
      <p id={hintId} className="text-[0.625rem] leading-snug text-tertiary">
        {spec.hint}
      </p>
    </div>
  );
}

export interface MetalControlsProps {
  params: MetalParams;
  onChange: (params: MetalParams) => void;
  onPreset: (preset: MetalPresetId) => void;
  preview?: ReactNode;
  copied?: boolean;
  onCopy?: () => void;
}

export function MetalControls({
  params,
  onChange,
  onPreset,
  preview,
  copied = false,
  onCopy,
}: MetalControlsProps) {
  const activePreset = useMemo(() => matchPreset(params), [params]);

  const setParam = (key: MetalParamKey) => (value: number) => {
    const spec = METAL_PARAMS[key];
    onChange({ ...params, [key]: Math.min(Math.max(value, spec.min), spec.max) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {preview ? <div className="shrink-0">{preview}</div> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <section className="grid gap-2">
          <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-tertiary">
            Role
          </h3>
          <div className="grid gap-1">
            {METAL_PRESET_LIST.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activePreset === preset.id}
                data-selected={activePreset === preset.id}
                onClick={() => onPreset(preset.id)}
                className="wafer-action-row wafer-metal-edge"
              >
                <span className="wafer-action-row__icon">
                  <span
                    aria-hidden="true"
                    className="size-3.5 rounded-full"
                    style={{
                      backgroundImage: gradientToCss(
                        METAL_PRESETS[preset.id].gradient
                      ),
                    }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-tight">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] leading-snug text-muted">
                    {preset.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p aria-live="polite" className="sr-only">
            {activePreset ? `${activePreset} preset active` : "Custom material"}
          </p>
        </section>

        {METAL_GROUPS.map((group) => (
          <section key={group.id} className="grid">
            <h3 className="border-b border-line-subtle pb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-tertiary">
              {group.label}
            </h3>
            <div className="divide-y divide-line-subtle/60">
              {group.id === "gradient" ? (
                <GradientEditor params={params} onChange={onChange} />
              ) : null}
              {METAL_PARAM_KEYS.filter(
                (key) => METAL_PARAMS[key].group === group.id
              ).map((key) => (
                <SliderRow
                  key={key}
                  paramKey={key}
                  value={params[key]}
                  onChange={setParam(key)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-line-subtle p-3">
        <button
          type="button"
          onClick={() => onPreset("button")}
          className="wafer-button wafer-metal-edge flex-1"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset
        </button>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="wafer-button wafer-metal-edge flex-1"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
