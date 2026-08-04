import { ChevronDown, ChevronUp, Keyboard } from "lucide-react";
import { useMemo, useState } from "react";

import {
  describeHidUsage,
  filterHidActionCatalogForUsagePages,
} from "./actionCatalog";
import { HidUsageGrid } from "./HidUsageGrid";
import { HidUsagePicker, type HidUsagePage } from "./HidUsagePicker";

export interface VisualHidUsagePickerProps {
  label?: string;
  value?: number;
  usagePages: HidUsagePage[];
  onValueChanged: (value?: number) => void;
}

export function VisualHidUsagePicker({
  label,
  value,
  usagePages,
  onValueChanged,
}: VisualHidUsagePickerProps) {
  const [expanded, setExpanded] = useState(value === undefined);
  const catalogItems = useMemo(
    () => filterHidActionCatalogForUsagePages(usagePages),
    [usagePages],
  );
  const description =
    value === undefined
      ? "Choose a key"
      : describeHidUsage(value, catalogItems);

  return (
    <div className="grid gap-2">
      {label && <p className="text-sm font-semibold">{label}</p>}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-raised px-3 text-left outline-none transition hover:border-line-strong hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-base-300 text-base-content/60">
          <Keyboard aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {description}
          </span>
          <span className="block text-[0.6875rem] text-base-content/50">
            {value === undefined ? "Required" : "Key or shortcut"}
          </span>
        </span>
        {expanded ? (
          <ChevronUp
            aria-hidden="true"
            className="size-4 text-base-content/45"
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-base-content/45"
          />
        )}
      </button>

      {expanded && (
        <div className="grid gap-4 rounded-xl border border-line bg-base-200 p-3">
          <HidUsageGrid
            value={value}
            items={catalogItems}
            onValueChange={onValueChanged}
            ariaLabel={label || "Choose a key or shortcut"}
          />

          <details className="rounded-lg border border-line bg-base-100">
            <summary className="flex min-h-10 cursor-pointer list-none items-center px-3 text-xs font-semibold text-base-content/60 [&::-webkit-details-marker]:hidden">
              More firmware-supported usages
            </summary>
            <div className="border-t border-line p-3">
              <HidUsagePicker
                label={label}
                value={value}
                usagePages={usagePages}
                onValueChanged={onValueChanged}
              />
            </div>
          </details>

          <button
            type="button"
            disabled={value === undefined}
            onClick={() => setExpanded(false)}
            className="min-h-11 rounded-xl wafer-accent px-4 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:bg-base-300 disabled:text-base-content/35 focus-visible:ring-2 focus-visible:ring-focus"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
