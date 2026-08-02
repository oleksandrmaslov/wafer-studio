import { BehaviorParameterValueDescription } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { HidUsagePicker } from "./HidUsagePicker";

export interface ParameterValuePickerProps {
  value?: number;
  values: BehaviorParameterValueDescription[];
  layers: { id: number; name: string }[];
  onValueChanged: (value?: number) => void;
}

export const ParameterValuePicker = ({
  value,
  values,
  layers,
  onValueChanged,
}: ParameterValuePickerProps) => {
  if (values.length == 0) {
    return <></>;
  } else if (values.every((v) => v.constant !== undefined)) {
    return (
      <div className="grid gap-1.5">
        <label className="text-sm font-semibold">Value</label>
        <select
          value={value}
          className="min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-sm text-base-content outline-none transition hover:border-base-content/30 focus-visible:ring-2 focus-visible:ring-focus"
          onChange={(e) => onValueChanged(parseInt(e.target.value))}
        >
          {values.map((v) => (
            <option key={`${v.name}-${v.constant}`} value={v.constant}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    );
  } else if (values.length == 1) {
    if (values[0].range) {
      return (
        <div className="grid gap-1.5">
          <label className="text-sm font-semibold">{values[0].name}</label>
          <input
            type="number"
            className="min-h-11 w-full rounded-lg border border-line bg-raised px-3 font-mono text-sm tabular-nums text-base-content outline-none transition hover:border-base-content/30 focus-visible:ring-2 focus-visible:ring-focus"
            min={values[0].range.min}
            max={values[0].range.max}
            value={value}
            onChange={(e) => onValueChanged(parseInt(e.target.value))}
          />
        </div>
      );
    } else if (values[0].hidUsage) {
      return (
        <HidUsagePicker
          onValueChanged={onValueChanged}
          label={values[0].name}
          value={value}
          usagePages={[
            { id: 7, min: 4, max: values[0].hidUsage.keyboardMax },
            { id: 12, max: values[0].hidUsage.consumerMax },
          ]}
        />
      );
    } else if (values[0].layerId) {
      return (
        <div className="grid gap-1.5">
          <label className="text-sm font-semibold">{values[0].name}</label>
          <select
            value={value}
            className="min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-sm text-base-content outline-none transition hover:border-base-content/30 focus-visible:ring-2 focus-visible:ring-focus"
            onChange={(e) => onValueChanged(parseInt(e.target.value))}
          >
            {layers.map(({ name, id }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      );
    }
  } else {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
        <p className="font-semibold text-warning">Advanced parameter shape</p>
        <p className="mt-1 text-xs leading-relaxed text-base-content/65">
          This firmware reports multiple parameter variants. Raw editing for
          this shape is not available in the current preview.
        </p>
      </div>
    );
  }

  return <></>;
};
