import { useId, useMemo } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  METAL_GROUPS,
  METAL_PARAMS,
  METAL_PARAM_KEYS,
  METAL_PRESET_LIST,
  formatParam,
  matchPreset,
  type MetalParamKey,
  type MetalParams,
  type MetalPresetId,
} from "./params.ts";

/**
 * The material inspector.
 *
 * Generated from the parameter schema, so the panel can never drift out of sync
 * with the shader. Presets are the entry point and the sliders are the escape
 * hatch.
 */

/** Converts a displayed value back to the value the shader wants. */
function fromDisplay(key: MetalParamKey, raw: number): number {
  const spec = METAL_PARAMS[key];
  return spec.unit === "percent" ? raw / 100 : raw;
}

function displayStep(key: MetalParamKey): number {
  const spec = METAL_PARAMS[key];
  return spec.unit === "percent" ? 1 : spec.step;
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
  const suffix =
    spec.unit === "percent" ? "%" : spec.unit === "degrees" ? "°" : "";

  return (
    <div className="grid gap-1.5 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[0.6875rem] font-semibold tracking-wide text-ink"
        >
          {spec.label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            aria-label={`${spec.label} value`}
            value={formatParam(paramKey, value)}
            min={fromDisplay(paramKey, spec.min)}
            max={fromDisplay(paramKey, spec.max)}
            step={displayStep(paramKey)}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (Number.isFinite(next)) onChange(fromDisplay(paramKey, next));
            }}
            className="w-14 rounded border border-line-subtle bg-raised/50 px-1.5 py-0.5 text-right font-mono text-[0.6875rem] tabular-nums text-muted outline-none focus-visible:border-focus"
          />
          <span className="w-2 font-mono text-[0.625rem] text-tertiary">
            {suffix}
          </span>
        </div>
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
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
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
  preview?: React.ReactNode;
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
    onChange({
      ...params,
      [key]: Math.min(Math.max(value, spec.min), spec.max),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {preview ? <div className="shrink-0">{preview}</div> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <section className="grid gap-2">
          <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-tertiary">
            Material
          </h3>
          <div className="grid gap-1">
            {METAL_PRESET_LIST.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activePreset === preset.id}
                onClick={() => onPreset(preset.id)}
                data-selected={activePreset === preset.id}
                className="wafer-action-row wafer-metal-edge"
              >
                <span className="wafer-action-row__icon">
                  <span
                    aria-hidden="true"
                    className="wafer-metal-chip size-4 rounded-full"
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
            {activePreset
              ? `${activePreset} material active`
              : "Custom material settings"}
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
          onClick={() => onPreset("alloy")}
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
