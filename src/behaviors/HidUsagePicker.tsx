import {
  Button,
  Checkbox,
  CheckboxGroup,
  Collection,
  ComboBox,
  Header,
  Input,
  Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Section,
} from "react-aria-components";
import {
  hid_usage_from_page_and_id,
  hid_usage_page_get_ids,
} from "../hid-usages";
import { useCallback, useId, useMemo } from "react";
import { ChevronDown } from "lucide-react";

export interface HidUsagePage {
  id: number;
  min?: number;
  max?: number;
}

export interface HidUsagePickerProps {
  label?: string;
  value?: number;
  usagePages: HidUsagePage[];
  onValueChanged: (value?: number) => void;
}

type UsageSectionProps = HidUsagePage;

const UsageSection = ({ id, min, max }: UsageSectionProps) => {
  const info = hid_usage_page_get_ids(id);
  let usages = info?.UsageIds || [];
  if (max !== undefined || min !== undefined) {
    usages = usages.filter(
      (usage) =>
        usage.Id <= (max ?? Number.MAX_SAFE_INTEGER) && usage.Id >= (min ?? 0),
    );
  }

  return (
    <Section id={id}>
      <Header className="text-base-content/50">{info?.Name}</Header>
      <Collection items={usages}>
        {(i) => (
          <ListBoxItem
            className="rac-hover:bg-base-300 pl-3 relative rac-focus:bg-base-300 cursor-default select-none rac-selected:before:content-['✔'] before:absolute before:left-[0] before:top-[0]"
            id={hid_usage_from_page_and_id(id, i.Id)}
          >
            {i.Name}
          </ListBoxItem>
        )}
      </Collection>
    </Section>
  );
};

enum Mods {
  LeftControl = 0x01,
  LeftShift = 0x02,
  LeftAlt = 0x04,
  LeftGUI = 0x08,
  RightControl = 0x10,
  RightShift = 0x20,
  RightAlt = 0x40,
  RightGUI = 0x80,
}

const mod_labels: Record<Mods, string> = {
  [Mods.LeftControl]: "L Ctrl",
  [Mods.LeftShift]: "L Shift",
  [Mods.LeftAlt]: "L Alt",
  [Mods.LeftGUI]: "L GUI",
  [Mods.RightControl]: "R Ctrl",
  [Mods.RightShift]: "R Shift",
  [Mods.RightAlt]: "R Alt",
  [Mods.RightGUI]: "R GUI",
};

const all_mods = [
  Mods.LeftControl,
  Mods.LeftShift,
  Mods.LeftAlt,
  Mods.LeftGUI,
  Mods.RightControl,
  Mods.RightShift,
  Mods.RightAlt,
  Mods.RightGUI,
];

function mods_to_flags(mods: Mods[]): number {
  return mods.reduce((a, v) => a + v, 0);
}

function mask_mods(value: number) {
  return value & ~(mods_to_flags(all_mods) << 24);
}

export const HidUsagePicker = ({
  label,
  value,
  usagePages,
  onValueChanged,
}: HidUsagePickerProps) => {
  const labelId = useId();
  const mods = useMemo(() => {
    const flags = value ? value >> 24 : 0;

    return all_mods.filter((m) => m & flags).map((m) => m.toLocaleString());
  }, [value]);

  const selectionChanged = useCallback(
    (e: Key | null) => {
      let value = typeof e == "number" ? e : undefined;
      if (value !== undefined) {
        const mod_flags = mods_to_flags(mods.map((m) => parseInt(m)));
        value = value | (mod_flags << 24);
      }

      onValueChanged(value);
    },
    [onValueChanged, mods],
  );

  const modifiersChanged = useCallback(
    (m: string[]) => {
      if (!value) {
        return;
      }

      const mod_flags = mods_to_flags(m.map((m) => parseInt(m)));
      const new_value = mask_mods(value) | (mod_flags << 24);
      onValueChanged(new_value);
    },
    [onValueChanged, value],
  );

  return (
    <div className="grid gap-3">
      {label && (
        <Label id={labelId} className="text-sm font-semibold">
          {label}
        </Label>
      )}
      <ComboBox
        className="min-w-0"
        selectedKey={value ? mask_mods(value) : null}
        onSelectionChange={selectionChanged}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : "HID usage"}
      >
        <div className="flex min-w-0">
          <Input className="min-h-11 min-w-0 flex-1 rounded-l-lg border border-r-0 border-line bg-raised px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-focus" />
          <Button className="flex min-h-11 min-w-11 items-center justify-center rounded-r-lg border border-line bg-raised text-base-content transition hover:bg-base-300 rac-focus-visible:ring-2 rac-focus-visible:ring-focus">
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {/* The popover is the scrollport. It used to clip with overflow-hidden
            while the list inside carried its own max-height and scroll, which
            lets the list end up taller than the box that is clipping it — a
            menu whose last entries cannot be reached. */}
        <Popover className="max-h-[min(28rem,var(--available-height))] w-[var(--trigger-width)] overflow-y-auto overflow-x-hidden rounded-xl border border-line bg-raised text-base-content shadow-xl outline-none">
          <ListBox
            items={usagePages}
            className="block min-h-[unset] p-2 outline-none"
            selectionMode="single"
          >
            {({ id, min, max }) => <UsageSection id={id} min={min} max={max} />}
          </ListBox>
        </Popover>
      </ComboBox>
      <CheckboxGroup
        aria-label="Implicit Modifiers"
        className="grid grid-cols-4 gap-1"
        value={mods}
        onChange={modifiersChanged}
      >
        {all_mods.map((m) => (
          <Checkbox
            key={m}
            value={m.toLocaleString()}
            className="grid min-h-9 cursor-pointer place-items-center rounded-md border border-line bg-base-100 px-1 text-center text-[0.625rem] font-semibold text-base-content/60 outline-none transition hover:bg-base-300 rac-focus-visible:ring-2 rac-focus-visible:ring-focus rac-selected:border-line-strong rac-selected:bg-selected rac-selected:text-ink"
          >
            {mod_labels[m]}
          </Checkbox>
        ))}
      </CheckboxGroup>
    </div>
  );
};
