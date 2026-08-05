import { GripVertical, Minus, Pencil, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  DropIndicator,
  Label,
  ListBox,
  ListBoxItem,
  Selection,
  useDragAndDrop,
} from "react-aria-components";
import { useModalRef } from "../misc/useModalRef";
import { GenericModal } from "../GenericModal";

interface Layer {
  id: number;
  name?: string;
}

export type LayerClickCallback = (index: number) => void;
export type LayerMovedCallback = (index: number, destination: number) => void;

interface LayerPickerProps {
  layers: Array<Layer>;
  selectedLayerIndex: number;
  orientation?: "vertical" | "horizontal";
  canAdd?: boolean;
  canRemove?: boolean;
  isStructureDisabled?: boolean;

  onLayerClicked?: LayerClickCallback;
  onLayerMoved?: LayerMovedCallback;
  onAddClicked?: () => void | Promise<void>;
  onRemoveClicked?: () => void | Promise<void>;
  onLayerNameChanged?: (
    id: number,
    oldName: string,
    newName: string,
  ) => void | Promise<void>;
}

interface EditLabelData {
  id: number;
  name: string;
}

const EditLabelModal = ({
  open,
  onClose,
  editLabelData,
  handleSaveNewLabel,
}: {
  open: boolean;
  onClose: () => void;
  editLabelData: EditLabelData;
  handleSaveNewLabel: (
    id: number,
    oldName: string,
    newName: string | null,
  ) => void;
}) => {
  const ref = useModalRef(open);
  const [newLabelName, setNewLabelName] = useState(editLabelData.name);

  const handleSave = () => {
    handleSaveNewLabel(editLabelData.id, editLabelData.name, newLabelName);
    onClose();
  };

  return (
    <GenericModal
      ref={ref}
      onClose={onClose}
      className="flex w-[min(28rem,calc(100vw-2rem))] min-w-min flex-col"
    >
      <span className="mb-1 text-lg font-semibold">Rename layer</span>
      <p className="mb-4 text-sm text-muted">
        Use a short name that makes the layer easy to recognize on the canvas.
      </p>
      <label htmlFor="layer-name" className="mb-1 text-sm font-medium">
        Layer name
      </label>
      <input
        id="layer-name"
        className="min-h-10 rounded-[var(--radius-control)] border border-line bg-overlay px-3 text-ink outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
        type="text"
        defaultValue={editLabelData.name}
        autoFocus
        onChange={(e) => setNewLabelName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
      />
      <div className="mt-5 flex justify-end gap-2">
        <button
          className="min-h-10 rounded-[var(--radius-control)] px-4 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="min-h-10 rounded-[var(--radius-control)] wafer-accent px-4 text-sm font-semibold transition-colors"
          type="button"
          onClick={() => {
            handleSave();
          }}
        >
          Save
        </button>
      </div>
    </GenericModal>
  );
};

export const LayerPicker = ({
  layers,
  selectedLayerIndex,
  orientation = "vertical",
  canAdd,
  canRemove,
  isStructureDisabled,
  onLayerClicked,
  onLayerMoved,
  onAddClicked,
  onRemoveClicked,
  onLayerNameChanged,
  ...props
}: LayerPickerProps) => {
  const [editLabelData, setEditLabelData] = useState<EditLabelData | null>(
    null,
  );

  const layer_items = useMemo(() => {
    return layers.map((l, i) => ({
      name: l.name || i.toLocaleString(),
      id: l.id,
      index: i,
      selected: i === selectedLayerIndex,
    }));
  }, [layers, selectedLayerIndex]);

  const selectionChanged = useCallback(
    (s: Selection) => {
      if (s === "all") {
        return;
      }

      onLayerClicked?.(layer_items.findIndex((l) => s.has(l.id)));
    },
    [onLayerClicked, layer_items],
  );

  const { dragAndDropHooks } = useDragAndDrop({
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className={"data-[drop-target]:outline outline-1 outline-accent"}
        />
      );
    },
    getItems: (keys) =>
      [...keys].map((key) => ({ "text/plain": key.toLocaleString() })),
    onReorder(e) {
      if (isStructureDisabled) return;
      const startIndex = layer_items.findIndex((l) => e.keys.has(l.id));
      const endIndex = layer_items.findIndex((l) => l.id === e.target.key);
      onLayerMoved?.(startIndex, endIndex);
    },
  });

  const handleSaveNewLabel = useCallback(
    (id: number, oldName: string, newName: string | null) => {
      if (newName !== null) {
        onLayerNameChanged?.(id, oldName, newName);
      }
    },
    [onLayerNameChanged],
  );

  return (
    // `min-h-0 flex-1` so the *list* scrolls rather than the rail around it —
    // but only at `xl`, where the rail is a full-height column with a bounded
    // height to scroll within. Below that the rail is a short auto-height card
    // in a stacked page, and claiming flex there gave the list a height of
    // nothing to scroll inside.
    <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
      <div className="mb-1.5 flex items-center gap-0.5">
        <Label className="min-w-0 flex-1 truncate px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary">
          Layers
        </Label>
        {onRemoveClicked && (
          <button
            type="button"
            aria-label="Remove selected layer"
            title="Remove selected layer"
            className="grid size-9 place-items-center rounded-control text-tertiary outline-none transition-colors enabled:hover:bg-hover enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-focus"
            disabled={!canRemove || isStructureDisabled}
            onClick={onRemoveClicked}
          >
            <Minus className="size-4" />
          </button>
        )}
        {onAddClicked && (
          <button
            type="button"
            aria-label="Add layer"
            title={
              isStructureDisabled
                ? "Apply or discard the key draft first"
                : canAdd
                  ? "Add layer"
                  : "No reserved layers available"
            }
            disabled={!canAdd || isStructureDisabled}
            className="grid size-9 place-items-center rounded-control text-tertiary outline-none transition-colors enabled:hover:bg-hover enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onAddClicked}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {editLabelData !== null && (
        <EditLabelModal
          open={editLabelData !== null}
          onClose={() => setEditLabelData(null)}
          editLabelData={editLabelData}
          handleSaveNewLabel={handleSaveNewLabel}
        />
      )}
      <ListBox
        aria-label="Keymap Layer"
        selectionMode="single"
        items={layer_items}
        disallowEmptySelection={true}
        selectedKeys={
          layer_items[selectedLayerIndex]
            ? [layer_items[selectedLayerIndex].id]
            : []
        }
        className={
          orientation === "horizontal"
            ? "grid cursor-pointer auto-cols-[minmax(7.25rem,8.75rem)] grid-flow-col gap-0.5 overflow-x-auto pb-1"
            : // Below `md` this is a horizontal strip of chips, so a *vertical*
              // overflow rule here put a second, useless scrollbar on a row
              // that scrolls sideways. The vertical scroller belongs only to
              // the `xl` rail, which is the only place the list is a column
              // inside a bounded height.
              "grid cursor-pointer gap-0.5 max-md:auto-cols-[minmax(8rem,1fr)] max-md:grid-flow-col max-md:overflow-x-auto max-md:pb-1 xl:min-h-0 xl:flex-1 xl:auto-rows-min xl:overflow-y-auto"
        }
        onSelectionChange={selectionChanged}
        dragAndDropHooks={dragAndDropHooks}
        {...props}
      >
        {(layer_item) => (
          <ListBoxItem
            textValue={layer_item.name}
            // Dispersive, so the layer you are editing carries the same
            // spectral edge as the key you are editing. Selection had gone
            // colourless when the accent became achromatic, which left the
            // active layer marked only by a slightly different grey.
            className="wafer-dispersive group grid min-h-10 grid-cols-[auto_auto_1fr_auto] items-center gap-1 rounded-[var(--radius-control)] px-1 text-sm outline-none transition-colors hover:bg-hover rac-focus-visible:ring-2 rac-focus-visible:ring-focus rac-selected:bg-selected/80 rac-selected:text-accent-foreground"
          >
            <GripVertical
              aria-hidden="true"
              className="size-3.5 text-tertiary/55"
            />
            <span className="grid size-5 place-items-center font-mono text-[0.625rem] text-tertiary">
              {layer_item.index}
            </span>
            <span className="truncate font-medium">{layer_item.name}</span>
            <button
              type="button"
              aria-label={`Rename ${layer_item.name}`}
              disabled={isStructureDisabled}
              className="grid size-8 place-items-center rounded-control text-tertiary opacity-0 transition-[color,background-color,opacity] hover:bg-hover hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                setEditLabelData({
                  id: layer_item.id,
                  name: layer_item.name,
                });
              }}
            >
              <Pencil aria-hidden="true" className="size-3.5" />
            </button>
          </ListBoxItem>
        )}
      </ListBox>
    </div>
  );
};
