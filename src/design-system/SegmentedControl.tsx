export interface SegmentedControlOption<T extends string> {
  id: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedControlOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  disabled = false,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="wafer-segmented">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          disabled={disabled || option.disabled}
          onClick={() => onChange(option.id)}
          className="wafer-segmented__item"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
