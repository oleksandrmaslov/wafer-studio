import { useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  METAL_GROUPS,
  METAL_PARAMS,
  METAL_PARAM_KEYS,
  METAL_PRESET_LIST,
  matchPreset,
  type MetalParamKey,
  type MetalParams,
  type MetalParamSpec,
  type MetalPresetId,
} from "./params.ts";

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
                    style={{ backgroundImage: "var(--metal-ramp)" }}
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
          onClick={() => onPreset("panel")}
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
