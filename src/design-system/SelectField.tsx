import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  type Key,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";

/**
 * A select whose menu is a real, scrollable popover.
 *
 * The native `<select>` was the last piece of unstyled OS chrome in the app,
 * and on a long list it drops an operating-system menu that ignores every rule
 * this design system has — no dispersion, no radius, no dark scheme, and on
 * some platforms no usable scrolling at all. This is the same react-aria Select
 * the layout picker already used, extracted so there is one of them.
 *
 * The scroll container is the popover itself rather than the list inside it.
 * Putting `overflow` on the inner list while the popover clips with
 * `overflow: hidden` gives a menu that can be taller than its own scrollport,
 * which is how a list ends up unscrollable at the bottom.
 */

export interface SelectFieldOption {
  id: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  /** Hide the label visually; it stays available to screen readers. */
  hideLabel?: boolean;
  options: readonly SelectFieldOption[];
  /** Omit for an action-style select that never shows a persistent value. */
  value?: string | null;
  placeholder?: string;
  isDisabled?: boolean;
  onChange: (id: string) => void;
}

export function SelectField({
  label,
  hideLabel = false,
  options,
  value = null,
  placeholder,
  isDisabled,
  onChange,
}: SelectFieldProps) {
  return (
    <Select
      className="flex min-w-0 flex-col gap-1"
      selectedKey={value}
      isDisabled={isDisabled}
      aria-label={hideLabel ? label : undefined}
      onSelectionChange={(key: Key) => onChange(String(key))}
    >
      <Label
        className={
          hideLabel
            ? "sr-only"
            : "px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary"
        }
      >
        {label}
      </Label>

      <Button className="flex min-h-9 min-w-0 items-center gap-2 rounded-control px-1 text-left text-sm text-muted outline-none transition-colors hover:bg-hover hover:text-ink rac-disabled:cursor-not-allowed rac-disabled:opacity-40 rac-focus-visible:ring-2 rac-focus-visible:ring-focus">
        <SelectValue className="min-w-0 flex-1 truncate">
          {({ selectedText }) => selectedText ?? placeholder ?? label}
        </SelectValue>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 opacity-60"
        />
      </Button>

      <Popover className="max-h-[min(24rem,var(--available-height))] min-w-[max(var(--trigger-width),9rem)] overflow-y-auto overflow-x-hidden rounded-panel border border-line-subtle bg-overlay p-1 text-base-content shadow-[var(--elevation-popover)] outline-none">
        <ListBox items={options} className="grid gap-0.5 outline-none">
          {(option) => (
            <ListBoxItem
              id={option.id}
              textValue={option.label}
              className="wafer-dispersive cursor-pointer truncate rounded-control px-2 py-1.5 text-sm outline-none rac-focus-visible:ring-2 rac-focus-visible:ring-focus rac-focused:bg-hover rac-selected:bg-selected rac-selected:text-accent-foreground"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}
