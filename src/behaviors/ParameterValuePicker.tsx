import { BehaviorParameterValueDescription } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { useId } from "react";
import { VisualHidUsagePicker } from "./VisualHidUsagePicker";

export interface ParameterValuePickerProps {
  label?: string;
  value?: number;
  values: BehaviorParameterValueDescription[];
  layers: { id: number; name: string }[];
  onValueChanged: (value?: number) => void;
}

export const ParameterValuePicker = ({
  label,
  value,
  values,
  layers,
  onValueChanged,
}: ParameterValuePickerProps) => {
  const rangeId = useId();

  if (values.length == 0) {
    return <></>;
  } else if (values.every((v) => v.constant !== undefined)) {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium">
          {label || "Choose an option"}
        </legend>
        <div className="grid grid-cols-2 gap-1.5">
          {values.map((option) => {
            const isSelected = value === option.constant;

            return (
              <button
                key={`${option.name}-${option.constant}`}
                type="button"
                aria-pressed={isSelected}
                className="min-h-10 rounded-[var(--radius-control)] bg-hover/35 px-2.5 py-1.5 text-left text-xs font-medium leading-tight text-ink outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-selected aria-pressed:text-accent-foreground aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-wafer/30"
                onClick={() => onValueChanged(option.constant)}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  } else if (values.every((v) => v.layerId !== undefined)) {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium">
          {label || values[0]?.name || "Layer"}
        </legend>
        <div className="grid grid-cols-2 gap-1.5">
          {layers.map(({ name, id }) => {
            const isSelected = value === id;

            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                className="min-h-10 rounded-[var(--radius-control)] bg-hover/35 px-2.5 py-1.5 text-left text-xs font-medium text-ink outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-selected aria-pressed:text-accent-foreground aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-wafer/30"
                onClick={() => onValueChanged(id)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  } else if (values.length == 1) {
    if (values[0].range) {
      const { min, max } = values[0].range;
      const rangeValue = Math.min(max, Math.max(min, value ?? min));

      return (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor={rangeId}>
              {label || values[0].name}
            </label>
            <input
              aria-label={`${label || values[0].name} value`}
              type="number"
              className="min-h-10 w-20 rounded-[var(--radius-control)] border border-line bg-overlay px-2 text-right font-mono text-xs tabular-nums text-ink outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
              min={min}
              max={max}
              value={rangeValue}
              onChange={(event) => {
                const nextValue = event.currentTarget.valueAsNumber;
                if (!Number.isNaN(nextValue)) {
                  onValueChanged(Math.min(max, Math.max(min, nextValue)));
                }
              }}
            />
          </div>
          <input
            id={rangeId}
            aria-label={label || values[0].name}
            type="range"
            className="h-10 w-full accent-primary"
            min={min}
            max={max}
            value={rangeValue}
            onChange={(event) =>
              onValueChanged(event.currentTarget.valueAsNumber)
            }
          />
          <div className="flex justify-between font-mono text-[0.625rem] tabular-nums text-tertiary">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    } else if (values[0].hidUsage) {
      return (
        <VisualHidUsagePicker
          onValueChanged={onValueChanged}
          label={label || values[0].name}
          value={value}
          usagePages={[
            { id: 7, min: 4, max: values[0].hidUsage.keyboardMax },
            { id: 12, max: values[0].hidUsage.consumerMax },
          ]}
        />
      );
    }
  } else {
    return (
      <div className="rounded-[var(--radius-surface)] border border-warning/25 bg-warning/10 p-2.5 text-sm">
        <p className="font-semibold text-warning">Advanced parameter shape</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          This firmware reports multiple parameter variants. Raw editing for
          this shape is not available in the current preview.
        </p>
      </div>
    );
  }

  return <></>;
};
