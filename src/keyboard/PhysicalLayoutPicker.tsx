import {
  Button,
  Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
} from "react-aria-components";
import { PhysicalLayout, type KeyPosition } from "./PhysicalLayout";
import { useCallback } from "react";
import { ChevronDown } from "lucide-react";

export interface PhysicalLayoutItem {
  name: string;
  keys: Array<Omit<KeyPosition, "id">>;
}

export type PhysicalLayoutClickCallback = (index: number) => void;

export interface PhysicalLayoutPickerProps {
  layouts: Array<PhysicalLayoutItem>;

  selectedPhysicalLayoutIndex: number;

  isDisabled?: boolean;

  onPhysicalLayoutClicked?: PhysicalLayoutClickCallback;
}

export const PhysicalLayoutPicker = ({
  layouts,
  selectedPhysicalLayoutIndex,
  isDisabled,
  onPhysicalLayoutClicked,
}: PhysicalLayoutPickerProps) => {
  const selectionChanged = useCallback(
    (e: Key) => {
      onPhysicalLayoutClicked?.(layouts.findIndex((l) => l.name === e));
    },
    [layouts, onPhysicalLayoutClicked],
  );

  return (
    <Select
      onSelectionChange={selectionChanged}
      className="flex min-w-0 flex-col gap-2"
      selectedKey={layouts[selectedPhysicalLayoutIndex].name}
      isDisabled={isDisabled}
    >
      <Label className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-base-content/55">
        Physical layout
      </Label>
      <Button className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-left text-sm outline-none transition hover:border-base-content/30 rac-disabled:cursor-not-allowed rac-disabled:opacity-45 rac-focus-visible:ring-2 rac-focus-visible:ring-focus">
        <SelectValue<PhysicalLayoutItem>>
          {(v) => {
            return (
              <span className="min-w-0 flex-1 truncate font-medium">
                {v.selectedItem?.name}
              </span>
            );
          }}
        </SelectValue>
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-base-content/45"
        />
      </Button>
      <Popover className="max-h-[min(28rem,var(--available-height))] min-w-[var(--trigger-width)] overflow-auto rounded-xl border border-line bg-raised p-1 text-base-content shadow-xl outline-none">
        <ListBox items={layouts} className="grid gap-1 outline-none">
          {(l) => (
            <ListBoxItem
              id={l.name}
              textValue={l.name}
              className="cursor-pointer rounded-lg p-2 outline-none hover:bg-base-300 rac-focus-visible:ring-2 rac-focus-visible:ring-focus rac-selected:bg-primary/10 rac-selected:text-primary"
            >
              <Text slot="label" className="text-sm font-semibold">
                {l.name}
              </Text>
              <div className="flex justify-center overflow-hidden p-2">
                <PhysicalLayout
                  oneU={15}
                  hoverZoom={false}
                  positions={l.keys.map(
                    ({ x, y, width, height, r, rx, ry }, i) => ({
                      id: `${l.name}-${i}`,
                      x: x / 100.0,
                      y: y / 100.0,
                      width: width / 100.0,
                      height: height / 100.0,
                      r: (r || 0) / 100.0,
                      rx: (rx || 0) / 100.0,
                      ry: (ry || 0) / 100.0,
                    }),
                  )}
                />
              </div>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};
