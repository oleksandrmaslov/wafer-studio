import { useId, useMemo } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  ABERRATION_GROUPS,
  ABERRATION_PARAMS,
  ABERRATION_PARAM_KEYS,
  ABERRATION_PRESETS,
  ABERRATION_PRESET_LIST,
  matchPreset,
  type AberrationParamKey,
  type AberrationParams,
  type AberrationPresetId,
} from "./params.ts";

/**
 * The shader inspector.
 *
 * Every control here is generated from the parameter schema, so the panel can
 * never drift out of sync with the shader. Presets are the entry point and the
 * sliders are the escape hatch — the same shape as a Figma effect panel, where
 * you pick a style and then open it up.
 */

interface SliderRowProps {
  paramKey: AberrationParamKey;
  value: number;
  onChange: (value: number) => void;
}

function SliderRow({ paramKey, value, onChange }: SliderRowProps) {
  const spec = ABERRATION_PARAMS[paramKey];
  const id = useId();
  const hintId = `${id}-hint`;

  // Percentage along the track, used to paint the filled portion.
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
        <input
          type="number"
          aria-label={`${spec.label} value`}
          value={Number(value.toFixed(3))}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="w-16 rounded border border-line-subtle bg-raised/50 px-1.5 py-0.5 text-right font-mono text-[0.6875rem] tabular-nums text-muted outline-none focus-visible:border-focus"
        />
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

export interface AberrationControlsProps {
  params: AberrationParams;
  onChange: (params: AberrationParams) => void;
  onPreset: (preset: AberrationPresetId) => void;
  /** Rendered above the presets — usually the live preview. */
  preview?: React.ReactNode;
  copied?: boolean;
  onCopy?: () => void;
}

export function AberrationControls({
  params,
  onChange,
  onPreset,
  preview,
  copied = false,
  onCopy,
}: AberrationControlsProps) {
  const activePreset = useMemo(() => matchPreset(params), [params]);

  const setParam = (key: AberrationParamKey) => (value: number) => {
    const spec = ABERRATION_PARAMS[key];
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
            {ABERRATION_PRESET_LIST.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activePreset === preset.id}
                onClick={() => onPreset(preset.id)}
                data-selected={activePreset === preset.id}
                className="wafer-action-row wafer-dispersive"
              >
                <span className="wafer-action-row__icon">
                  <span
                    aria-hidden="true"
                    className="size-3.5 rounded-full"
                    style={{
                      background: `conic-gradient(from -55deg, rgb(var(--spectral-azure)), rgb(var(--spectral-violet)) 20%, rgb(var(--spectral-coral)) 42%, rgb(var(--spectral-amber)) 58%, rgb(var(--spectral-violet)) 78%, rgb(var(--spectral-azure)))`,
                      opacity:
                        0.25 + ABERRATION_PRESETS[preset.id].dispersion * 0.35,
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
            {activePreset
              ? `${activePreset} preset active`
              : "Custom material settings"}
          </p>
        </section>

        {ABERRATION_GROUPS.map((group) => (
          <section key={group.id} className="grid">
            <h3 className="border-b border-line-subtle pb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-tertiary">
              {group.label}
            </h3>
            <div className="divide-y divide-line-subtle/60">
              {ABERRATION_PARAM_KEYS.filter(
                (key) => ABERRATION_PARAMS[key].group === group.id
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
          className="wafer-button wafer-dispersive flex-1"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset
        </button>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="wafer-button wafer-dispersive flex-1"
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
