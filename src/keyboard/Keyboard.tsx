import React, {
  SetStateAction,
  type CSSProperties,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Request } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "../rpc/logging";
import {
  PhysicalLayout,
  Keymap,
  SetLayerBindingResponse,
  SetLayerPropsResponse,
  BehaviorBinding,
  Layer,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type {
  BehaviorParameterValueDescription,
  GetBehaviorDetailsResponse,
} from "@zmkfirmware/zmk-studio-ts-client/behaviors";

import { LayerPicker } from "./LayerPicker";
import { SelectField } from "../design-system/SelectField";
import { useCommands, type Command } from "../design-system/commandRegistry";
import { PhysicalLayoutPicker } from "./PhysicalLayoutPicker";
import { Keymap as KeymapComp } from "./Keymap";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { UndoRedoContext } from "../undoRedo";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import {
  isCanonicalKeyPress,
  isMultiBehavior,
} from "../behaviors/behaviorKinds";
import {
  isModifierCode,
  readingOrder,
  stepPosition,
  usageForCode,
} from "./typeThrough";
import { mirrorPosition, mirrorUsage } from "./mirror";
import {
  ALPHA_LAYOUTS,
  detectAlphaLayout,
  letterForUsageId,
  remapAlphas,
  usageIdForLetter,
  type AlphaLayout,
} from "./alphaLayouts";

import {
  validateBindingParameters,
  validateValue,
} from "../behaviors/parameters";
import {
  describeHidUsage,
  getHidBaseUsage,
  getHidImplicitModifierMask,
  HID_KEYBOARD_USAGE_PAGE,
} from "../behaviors/actionCatalog";
import {
  hid_usage_from_page_and_id,
  hid_usage_page_and_id_from_usage,
} from "../hid-usages";
import { produce } from "immer";
import { LockStateContext } from "../rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { deserializeLayoutZoom, LayoutZoom } from "./layoutZoom";
import { useLocalStorageState } from "../misc/useLocalStorageState";
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import {
  Cable,
  ChevronDown,
  Copy,
  FlipHorizontal,
  Keyboard as Keyboard2,
  Maximize2,
  Minus,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import {
  bindingEquals,
  countDraftBindings,
  draftedPositions as draftedPositionsFor,
  DraftApplyResult,
  DraftBindingOverrides,
  DraftValidationResult,
  KeymapDraftController,
  materializeDraftKeymap,
  planDraftBindings,
  rebaseDraftBindings,
  updateDraftBinding,
} from "./keymapDraft";

const ZOOM_OPTIONS = [
  { id: "auto", label: "Fit" },
  { id: "0.25", label: "25%" },
  { id: "0.5", label: "50%" },
  { id: "0.75", label: "75%" },
  { id: "1", label: "100%" },
  { id: "1.25", label: "125%" },
  { id: "1.5", label: "150%" },
  { id: "2", label: "200%" },
];

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

/**
 * A labelled button on the canvas that opens a short list of choices.
 *
 * The two things this renders — copy another layer's bindings onto this one,
 * and move the alpha block to another layout — are the two features that turn a
 * two-hour keyboard setup into a ten-minute one. They spent a while as standing
 * select fields in the left rail, which is what a *setting* looks like and
 * neither of them is one; both are single edits to the current layer. Folding
 * them into an overflow menu fixed the rail's height and cost more than it
 * saved: the highest-value things in the application became the two nobody
 * could see. So they are plain buttons, on the board they rewrite.
 *
 * Module scope rather than a closure inside `Keyboard`, or every keystroke
 * anywhere in that component would remount the popover.
 */
function CanvasMenuButton({
  label,
  value,
  title,
  isDisabled,
  items,
  onAction,
}: {
  label: string;
  /** Shown after the label when the control has a current state worth naming. */
  value?: string;
  title?: string;
  isDisabled?: boolean;
  items: readonly { id: string; label: string }[];
  onAction: (id: string) => void;
}) {
  return (
    // The tooltip hangs on a wrapper because `Button` filters DOM props and
    // drops `title`; the trigger itself has to stay `MenuTrigger`'s direct
    // child for the press and `aria-expanded` wiring to happen at all.
    <span title={title} className="flex min-w-0">
      <MenuTrigger>
        <Button
          isDisabled={isDisabled}
          className="wafer-dispersive flex min-h-10 min-w-0 items-center gap-1.5 rounded-control px-2 text-left text-sm outline-none transition-colors hover:bg-hover rac-disabled:cursor-not-allowed rac-disabled:opacity-45 rac-focus-visible:ring-2 rac-focus-visible:ring-focus"
        >
          <span className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary">
            {label}
          </span>
          {value && (
            <span className="min-w-0 truncate font-medium">{value}</span>
          )}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-base-content/45"
          />
        </Button>
        <Popover className="w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-line bg-raised p-1 text-base-content shadow-xl outline-none">
          <Menu
            aria-label={label}
            className="max-h-[min(20rem,var(--available-height))] overflow-auto outline-none"
            onAction={(key) => onAction(String(key))}
          >
            {items.map((item) => (
              <MenuItem
                key={item.id}
                id={item.id}
                textValue={item.label}
                className="flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm outline-none hover:bg-base-300 rac-focus:bg-base-300"
              >
                <span className="min-w-0 truncate">{item.label}</span>
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    </span>
  );
}

export interface KeyboardProps {
  onDraftStateChange?: (controller: KeymapDraftController) => void;
}

function describeBinding(
  binding: BehaviorBinding,
  behaviors: BehaviorMap,
  layers: { id: number; name?: string }[],
): string {
  const behavior = behaviors[binding.behaviorId];
  if (!behavior) return "Unavailable action";

  const layerIds = layers.map(({ id }) => id);
  const metadata =
    behavior.metadata.find((set) =>
      validateValue(layerIds, binding.param1, set.param1),
    ) || behavior.metadata[0];

  const describeParameter = (
    value: number,
    descriptions: BehaviorParameterValueDescription[] | undefined,
  ): string | undefined => {
    if (!descriptions || descriptions.length === 0) return undefined;

    const constant = descriptions.find(
      (description) => description.constant === value,
    );
    if (constant) return constant.name;

    if (descriptions.some(({ layerId }) => layerId !== undefined)) {
      return layers.find(({ id }) => id === value)?.name || `Layer ${value}`;
    }

    if (descriptions.some(({ hidUsage }) => hidUsage !== undefined)) {
      return describeHidUsage(value);
    }

    if (descriptions.some(({ range }) => range !== undefined)) {
      return value.toLocaleString();
    }

    return undefined;
  };

  const param1 = describeParameter(binding.param1, metadata?.param1);
  const param2 = describeParameter(binding.param2, metadata?.param2);
  const parameters = [param1, param2].filter((parameter): parameter is string =>
    Boolean(parameter),
  );

  if (
    behavior.displayName.toLocaleLowerCase().replace(/[_-]+/g, " ") ===
      "key press" &&
    param1
  ) {
    return param1;
  }

  return parameters.length > 0
    ? `${behavior.displayName} · ${parameters.join(" / ")}`
    : behavior.displayName;
}

function useBehaviors(): BehaviorMap {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);

  const [behaviors, setBehaviors] = useState<BehaviorMap>({});

  useEffect(() => {
    if (
      !connection.conn ||
      lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    ) {
      setBehaviors({});
      return;
    }

    async function startRequest() {
      setBehaviors({});

      if (!connection.conn) {
        return;
      }

      const get_behaviors: Request = {
        behaviors: { listAllBehaviors: true },
        requestId: 0,
      };

      const behavior_list = await call_rpc(connection.conn, get_behaviors);
      if (!ignore) {
        const behavior_map: BehaviorMap = {};
        for (const behaviorId of behavior_list.behaviors?.listAllBehaviors
          ?.behaviors || []) {
          if (ignore) {
            break;
          }
          const details_req = {
            behaviors: { getBehaviorDetails: { behaviorId } },
            requestId: 0,
          };
          const behavior_details = await call_rpc(connection.conn, details_req);
          const dets: GetBehaviorDetailsResponse | undefined =
            behavior_details?.behaviors?.getBehaviorDetails;

          if (dets) {
            behavior_map[dets.id] = dets;
          }
        }

        if (!ignore) {
          setBehaviors(behavior_map);
        }
      }
    }

    let ignore = false;
    startRequest();

    return () => {
      ignore = true;
    };
  }, [connection, lockState]);

  return behaviors;
}

function useLayouts(): [
  PhysicalLayout[] | undefined,
  React.Dispatch<SetStateAction<PhysicalLayout[] | undefined>>,
  number,
  React.Dispatch<SetStateAction<number>>,
] {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);

  const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
    undefined,
  );
  const [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex] =
    useState<number>(0);

  useEffect(() => {
    if (
      !connection.conn ||
      lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
    ) {
      setLayouts(undefined);
      return;
    }

    async function startRequest() {
      setLayouts(undefined);

      if (!connection.conn) {
        return;
      }

      const response = await call_rpc(connection.conn, {
        keymap: { getPhysicalLayouts: true },
      });

      if (!ignore) {
        setLayouts(response?.keymap?.getPhysicalLayouts?.layouts);
        setSelectedPhysicalLayoutIndex(
          response?.keymap?.getPhysicalLayouts?.activeLayoutIndex || 0,
        );
      }
    }

    let ignore = false;
    startRequest();

    return () => {
      ignore = true;
    };
  }, [connection, lockState]);

  return [
    layouts,
    setLayouts,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ];
}

export default function Keyboard({ onDraftStateChange }: KeyboardProps) {
  const [
    layouts,
    ,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ] = useLayouts();
  const [fetchedKeymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (keymap) => {
      console.log("Got the keymap!");
      return keymap?.keymap?.getKeymap;
    },
    true,
  );
  const [deviceKeymap, setDeviceKeymap] = useState<Keymap>();
  const [draftBindings, setDraftBindings] = useState<DraftBindingOverrides>({});
  const [isApplyingDraft, setIsApplyingDraft] = useState(false);

  const [keymapScale, setKeymapScale] = useLocalStorageState<LayoutZoom>(
    "keymapScale",
    "auto",
    {
      deserialize: deserializeLayoutZoom,
    },
  );

  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);
  const [selectedKeyPosition, setSelectedKeyPosition] = useState<
    number | undefined
  >(undefined);
  const behaviors = useBehaviors();

  const conn = useContext(ConnectionContext);
  const undoRedo = useContext(UndoRedoContext);

  useEffect(() => {
    if (!fetchedKeymap) return;

    setDeviceKeymap(fetchedKeymap);
    setDraftBindings((current) => rebaseDraftBindings(fetchedKeymap, current));
  }, [fetchedKeymap]);

  const keymap = useMemo(
    () =>
      deviceKeymap
        ? materializeDraftKeymap(deviceKeymap, draftBindings)
        : undefined,
    [deviceKeymap, draftBindings],
  );

  const buildDraftPlan = useCallback(
    (base: Keymap, draft: DraftBindingOverrides): DraftValidationResult => {
      const plan = planDraftBindings(
        base,
        draft,
        new Set(Object.keys(behaviors).map(Number)),
      );
      const layerIds = base.layers.map(({ id }) => id);

      for (const change of plan.changes) {
        const behavior = behaviors[change.after.behaviorId];
        if (
          behavior &&
          !validateBindingParameters(
            behavior.metadata,
            layerIds,
            change.after.param1,
            change.after.param2,
          )
        ) {
          plan.errors.push(
            `${change.layerName}, key ${change.keyPosition + 1}: ${behavior.displayName} has invalid parameters.`,
          );
        }
      }

      return plan;
    },
    [behaviors],
  );

  const draftPlan = useMemo(
    () =>
      deviceKeymap
        ? buildDraftPlan(deviceKeymap, draftBindings)
        : { changes: [], errors: [] },
    [buildDraftPlan, deviceKeymap, draftBindings],
  );

  const draftSummaries = useMemo(
    () =>
      draftPlan.changes.map((change) => ({
        ...change,
        beforeLabel: describeBinding(
          change.before,
          behaviors,
          deviceKeymap?.layers || [],
        ),
        afterLabel: describeBinding(
          change.after,
          behaviors,
          deviceKeymap?.layers || [],
        ),
      })),
    [behaviors, deviceKeymap?.layers, draftPlan.changes],
  );

  const discardDraft = useCallback(() => {
    if (isApplyingDraft) return;
    setDraftBindings({});
  }, [isApplyingDraft]);

  const applyDraft = useCallback(async (): Promise<DraftApplyResult> => {
    const capturedDeviceKeymap = deviceKeymap;
    const capturedDraft = draftBindings;
    const capturedPlan = capturedDeviceKeymap
      ? buildDraftPlan(capturedDeviceKeymap, capturedDraft)
      : { changes: [], errors: ["No keyboard snapshot is available."] };

    if (!conn.conn) {
      return {
        ok: false,
        appliedCount: 0,
        remainingCount: countDraftBindings(capturedDraft),
        message: "Reconnect the keyboard to apply this draft.",
      };
    }

    if (capturedPlan.errors.length > 0) {
      return {
        ok: false,
        appliedCount: 0,
        remainingCount: countDraftBindings(capturedDraft),
        message: capturedPlan.errors[0],
      };
    }

    setIsApplyingDraft(true);
    let appliedCount = 0;
    let plannedCount = capturedPlan.changes.length;

    const readDeviceKeymap = async (): Promise<Keymap> => {
      if (!conn.conn) throw new Error("Keyboard disconnected.");
      const response = await call_rpc(conn.conn, {
        keymap: { getKeymap: true },
      });
      const refreshed = response.keymap?.getKeymap;
      if (!refreshed)
        throw new Error("The keyboard did not return its keymap.");
      return refreshed;
    };

    try {
      // Re-read immediately before writing so an external change cannot be
      // overwritten using an old review snapshot.
      const latest = await readDeviceKeymap();
      setDeviceKeymap(latest);
      setDraftBindings((current) => rebaseDraftBindings(latest, current));

      const conflicts = capturedPlan.changes.filter((change) => {
        const layer = latest.layers.find(({ id }) => id === change.layerId);
        const current = layer?.bindings[change.keyPosition];
        return (
          !bindingEquals(current, change.before) &&
          !bindingEquals(current, change.after)
        );
      });

      if (conflicts.length > 0) {
        return {
          ok: false,
          appliedCount: 0,
          remainingCount: countDraftBindings(
            rebaseDraftBindings(latest, capturedDraft),
          ),
          message:
            "The keyboard changed since this draft was created. Review the refreshed diff before applying.",
          conflict: true,
        };
      }

      const rebasedCapturedDraft = rebaseDraftBindings(latest, capturedDraft);
      const readyPlan = buildDraftPlan(latest, rebasedCapturedDraft);
      if (readyPlan.errors.length > 0) {
        return {
          ok: false,
          appliedCount: 0,
          remainingCount: countDraftBindings(rebasedCapturedDraft),
          message: readyPlan.errors[0],
        };
      }

      plannedCount = readyPlan.changes.length;
      for (const change of readyPlan.changes) {
        if (!conn.conn) throw new Error("Keyboard disconnected during Apply.");

        const response = await call_rpc(conn.conn, {
          keymap: {
            setLayerBinding: {
              layerId: change.layerId,
              keyPosition: change.keyPosition,
              binding: change.after,
            },
          },
        });

        if (
          response.keymap?.setLayerBinding !==
          SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
        ) {
          throw new Error(
            `Keyboard rejected ${change.layerName}, key ${change.keyPosition + 1} (response ${response.keymap?.setLayerBinding ?? "missing"}).`,
          );
        }
        appliedCount += 1;
      }

      // Never clear captured intent until a fresh device snapshot proves that
      // every accepted operation is present.
      const refreshed = await readDeviceKeymap();
      const remainingCapturedDraft = rebaseDraftBindings(
        refreshed,
        capturedDraft,
      );
      const remainingPlan = buildDraftPlan(refreshed, remainingCapturedDraft);
      setDeviceKeymap(refreshed);
      setDraftBindings((current) => rebaseDraftBindings(refreshed, current));

      if (
        remainingPlan.errors.length > 0 ||
        countDraftBindings(remainingCapturedDraft) > 0
      ) {
        return {
          ok: false,
          appliedCount,
          remainingCount: countDraftBindings(remainingCapturedDraft),
          message:
            remainingPlan.errors[0] ||
            "The keyboard did not confirm every change. Remaining draft intent was preserved.",
        };
      }

      const unsavedResponse = await call_rpc(conn.conn, {
        keymap: { checkUnsavedChanges: true },
      });
      return {
        ok: true,
        appliedCount,
        deviceUnsaved: unsavedResponse.keymap?.checkUnsavedChanges === true,
      };
    } catch (error) {
      let remainingCount = Math.max(plannedCount - appliedCount, 0);
      let reconciled = false;

      try {
        const refreshed = await readDeviceKeymap();
        const remainingCapturedDraft = rebaseDraftBindings(
          refreshed,
          capturedDraft,
        );
        remainingCount = countDraftBindings(remainingCapturedDraft);
        setDeviceKeymap(refreshed);
        setDraftBindings((current) => rebaseDraftBindings(refreshed, current));
        reconciled = true;
      } catch {
        // The exact device state is unknown, so retain all local intent until a
        // later reconnect/reread can reconcile it.
        remainingCount = countDraftBindings(capturedDraft);
      }

      const cause =
        error instanceof Error
          ? error.message
          : "Apply stopped because the keyboard returned an unknown error.";

      return {
        ok: false,
        appliedCount,
        remainingCount,
        message: reconciled
          ? cause
          : `${cause} The keyboard state could not be verified; all local intent was preserved for reconciliation after reconnect.`,
      };
    } finally {
      setIsApplyingDraft(false);
    }
  }, [buildDraftPlan, conn.conn, deviceKeymap, draftBindings]);

  useEffect(() => {
    onDraftStateChange?.({
      draftCount: countDraftBindings(draftBindings),
      changes: draftSummaries,
      errors: draftPlan.errors,
      isApplying: isApplyingDraft,
      apply: applyDraft,
      discard: discardDraft,
    });
  }, [
    applyDraft,
    discardDraft,
    draftBindings,
    draftPlan.errors,
    draftSummaries,
    isApplyingDraft,
    onDraftStateChange,
  ]);

  useEffect(() => {
    setSelectedLayerIndex(0);
    setSelectedKeyPosition(undefined);
  }, [conn]);

  useEffect(() => {
    async function performSetRequest() {
      if (!conn.conn || !layouts) {
        return;
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { setActivePhysicalLayout: selectedPhysicalLayoutIndex },
      });

      const new_keymap = resp?.keymap?.setActivePhysicalLayout?.ok;
      if (new_keymap) {
        setDeviceKeymap(new_keymap);
      } else {
        console.error(
          "Failed to set the active physical layout err:",
          resp?.keymap?.setActivePhysicalLayout?.err,
        );
      }
    }

    performSetRequest();
  }, [conn.conn, layouts, selectedPhysicalLayoutIndex]);

  const doSelectPhysicalLayout = useCallback(
    (i: number) => {
      const oldLayout = selectedPhysicalLayoutIndex;
      undoRedo?.(async () => {
        setSelectedPhysicalLayoutIndex(i);

        return async () => {
          setSelectedPhysicalLayoutIndex(oldLayout);
        };
      });
    },
    [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex, undoRedo],
  );

  const doUpdateBinding = useCallback(
    // `atPosition` is for type-through, which advances the cursor in the same
    // tick it binds — by the time this runs, the selection is already the
    // *next* key, so the caller has to name the one it meant.
    (binding: BehaviorBinding, atPosition?: number) => {
      const keyPosition = atPosition ?? selectedKeyPosition;
      if (
        !deviceKeymap ||
        !keymap ||
        keyPosition === undefined ||
        isApplyingDraft
      ) {
        console.error(
          "Can't update binding without a selected key position and loaded keymap",
        );
        return;
      }

      const layer = selectedLayerIndex;
      const layerId = keymap.layers[layer].id;
      const oldBinding = keymap.layers[layer].bindings[keyPosition];
      void undoRedo?.(async () => {
        setDraftBindings((current) =>
          updateDraftBinding(
            deviceKeymap,
            current,
            { layerId, keyPosition },
            binding,
          ),
        );

        return async () => {
          setDraftBindings((current) =>
            updateDraftBinding(
              deviceKeymap,
              current,
              { layerId, keyPosition },
              oldBinding,
            ),
          );
        };
      });
    },
    [
      deviceKeymap,
      isApplyingDraft,
      keymap,
      selectedKeyPosition,
      selectedLayerIndex,
      undoRedo,
    ],
  );

  const selectedBinding = useMemo(() => {
    if (
      keymap == null ||
      selectedKeyPosition == null ||
      !keymap.layers[selectedLayerIndex]
    ) {
      return null;
    }

    return keymap.layers[selectedLayerIndex].bindings[selectedKeyPosition];
  }, [keymap, selectedLayerIndex, selectedKeyPosition]);

  const selectedBindingDescription = useMemo(() => {
    if (!keymap || !selectedBinding) return undefined;
    return describeBinding(selectedBinding, behaviors, keymap.layers);
  }, [behaviors, keymap, selectedBinding]);

  const shelfOpen = selectedKeyPosition !== undefined && !!selectedBinding;

  // What the draft has touched on the layer you are looking at, so unsent work
  // is visible on the board instead of only inside the review dialog.
  const draftedOnLayer = useMemo(() => {
    const layerId = keymap?.layers[selectedLayerIndex]?.id;
    return layerId === undefined
      ? undefined
      : draftedPositionsFor(draftBindings, layerId);
  }, [draftBindings, keymap, selectedLayerIndex]);

  /**
   * Copy every binding from another layer onto this one.
   *
   * Nobody builds a symbol or navigation layer from nothing — they start from
   * the base layer and change the dozen keys that differ. Doing that by hand is
   * forty-two round trips through the rail to reproduce a layer that already
   * exists two rows above.
   *
   * The whole copy is one undo entry. Forty-two separate entries would mean
   * forty-two presses of ⌘Z to take back a single mistaken click, which is not
   * an undo history so much as a punishment.
   */
  const copyLayerFrom = useCallback(
    (sourceLayerIndex: number) => {
      if (!deviceKeymap || !keymap || isApplyingDraft) return;

      const source = keymap.layers[sourceLayerIndex];
      const target = keymap.layers[selectedLayerIndex];
      if (!source || !target || source.id === target.id) return;

      const layerId = target.id;
      const restore = target.bindings.map((binding) => ({ ...binding }));
      const incoming = source.bindings.slice(0, target.bindings.length);

      const write = (bindings: BehaviorBinding[]) => {
        setDraftBindings((current) =>
          bindings.reduce(
            (draft, binding, keyPosition) =>
              updateDraftBinding(
                deviceKeymap,
                draft,
                { layerId, keyPosition },
                binding,
              ),
            current,
          ),
        );
      };

      void undoRedo?.(async () => {
        write(incoming);
        return async () => write(restore);
      });
    },
    [deviceKeymap, isApplyingDraft, keymap, selectedLayerIndex, undoRedo],
  );

  /** The key opposite the selected one, when the board has one. */
  const mirrorTarget = useMemo(() => {
    const layout = layouts?.[selectedPhysicalLayoutIndex];
    if (!layout || selectedKeyPosition === undefined) return undefined;
    return mirrorPosition(layout, selectedKeyPosition);
  }, [layouts, selectedPhysicalLayoutIndex, selectedKeyPosition]);

  // ---- Bulk apply ---------------------------------------------------------
  //
  // Setting home-row mods is eight keys that each have to become a mod-tap
  // *keeping the letter already on them* — A stays A on tap and becomes Ctrl on
  // hold. Done one key at a time through the rail that is eight trips of four
  // clicks, and the tap parameter has to be retyped from memory every time.
  //
  // So bulk apply wraps rather than replaces: paint a hold-tap across a row and
  // each key keeps its own usage as the tap. That single rule is the difference
  // between "apply the same binding everywhere", which is rarely what anyone
  // wants for a hold-tap, and home-row mods in eight clicks.
  const [paint, setPaint] = useState<{
    binding: BehaviorBinding;
    keepTap: boolean;
    label: string;
  } | null>(null);

  const order = useMemo(() => {
    const layout = layouts?.[selectedPhysicalLayoutIndex];
    return layout ? readingOrder(layout) : [];
  }, [layouts, selectedPhysicalLayoutIndex]);

  /**
   * Selected keys, always including the primary one.
   *
   * The primary (`selectedKeyPosition`) is the key the inspector describes and
   * the one type-through advances; the set is who an edit actually lands on.
   * Keeping them separate means every existing single-key path keeps working
   * untouched, and multi-select is purely additive.
   */
  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());

  const selectedPositions = useMemo(() => {
    if (selectedKeyPosition === undefined) return new Set<number>();
    return selection.has(selectedKeyPosition)
      ? selection
      : new Set([selectedKeyPosition]);
  }, [selection, selectedKeyPosition]);

  /**
   * Write one binding to a key, preserving that key's own usage as the tap
   * when the incoming behavior is a hold-tap.
   *
   * This is the rule bulk apply was built on — paint mod-tap across the home
   * row and every key keeps its own letter — and multi-select needs exactly the
   * same thing, so it lives in one place rather than two.
   */
  const applyWrapped = useCallback(
    (binding: BehaviorBinding, position: number, keepTap: boolean) => {
      const existing = keymap?.layers[selectedLayerIndex]?.bindings[position];
      const existingBehavior = existing
        ? behaviors[existing.behaviorId]
        : undefined;
      const incoming = behaviors[binding.behaviorId];
      const keeps =
        keepTap &&
        existing !== undefined &&
        existingBehavior !== undefined &&
        incoming !== undefined &&
        isMultiBehavior(incoming) &&
        isCanonicalKeyPress(existingBehavior);

      doUpdateBinding(
        keeps ? { ...binding, param2: existing.param1 } : binding,
        position,
      );
    },
    [behaviors, doUpdateBinding, keymap, selectedLayerIndex],
  );

  /**
   * What the inspector calls. With one key selected this is the old behaviour;
   * with several it fans out, wrapping hold-taps so eight home-row keys each
   * keep their own letter in a single choice.
   */
  const onBindingChanged = useCallback(
    (binding: BehaviorBinding) => {
      if (selectedPositions.size <= 1) {
        doUpdateBinding(binding);
        return;
      }
      for (const position of selectedPositions) {
        applyWrapped(binding, position, true);
      }
    },
    [applyWrapped, doUpdateBinding, selectedPositions],
  );

  /**
   * Mirror every selected key at once.
   *
   * This is what makes the feature worth having: select the four home-row mods
   * on one half, mirror, and the other half gets them with the handedness
   * flipped — which is the single most common symmetric edit on a split board.
   */
  const mirrorSelection = useCallback(() => {
    const layout = layouts?.[selectedPhysicalLayoutIndex];
    if (!layout || !keymap) return;

    const layerIds = keymap.layers.map(({ id }) => id);
    for (const position of selectedPositions) {
      const target = mirrorPosition(layout, position);
      if (target === undefined) continue;

      const binding = keymap.layers[selectedLayerIndex]?.bindings[position];
      if (!binding) continue;

      const behavior = behaviors[binding.behaviorId];
      const set =
        behavior?.metadata.find((candidate) =>
          validateValue(layerIds, binding.param1, candidate.param1),
        ) ?? behavior?.metadata[0];

      doUpdateBinding(
        {
          ...binding,
          param1: set?.param1?.some((v) => v.hidUsage !== undefined)
            ? mirrorUsage(binding.param1)
            : binding.param1,
          param2: set?.param2?.some((v) => v.hidUsage !== undefined)
            ? mirrorUsage(binding.param2)
            : binding.param2,
        },
        target,
      );
    }
  }, [
    behaviors,
    doUpdateBinding,
    keymap,
    layouts,
    selectedLayerIndex,
    selectedPhysicalLayoutIndex,
    selectedPositions,
  ]);

  const paintIsHoldTap = useMemo(() => {
    if (!paint) return false;
    const behavior = behaviors[paint.binding.behaviorId];
    return behavior ? isMultiBehavior(behavior) : false;
  }, [behaviors, paint]);

  const onKeyPositionClicked = useCallback(
    (position: number, event: React.MouseEvent) => {
      if (paint && keymap) {
        applyWrapped(paint.binding, position, paint.keepTap);
        return;
      }

      // Shift extends in *reading* order, not array order — the run you see
      // between two keys, which on a split is not the run the binding array
      // would give you. Ctrl/Cmd toggles one key. A plain click starts over.
      if (event.shiftKey && selectedKeyPosition !== undefined) {
        const from = order.indexOf(selectedKeyPosition);
        const to = order.indexOf(position);
        if (from !== -1 && to !== -1) {
          const [lo, hi] = from <= to ? [from, to] : [to, from];
          setSelection(new Set(order.slice(lo, hi + 1)));
          setSelectedKeyPosition(position);
          return;
        }
      }

      if (event.metaKey || event.ctrlKey) {
        setSelection((current) => {
          const next = new Set(current);
          if (next.has(position) && next.size > 1) next.delete(position);
          else next.add(position);
          return next;
        });
        setSelectedKeyPosition(position);
        return;
      }

      setSelection(new Set([position]));
      setSelectedKeyPosition(position);
    },
    [applyWrapped, keymap, order, paint, selectedKeyPosition],
  );

  // ---- Type-through -------------------------------------------------------
  const [isTyping, setIsTyping] = useState(false);

  const keyPressBehaviorId = useMemo(() => {
    const match = Object.values(behaviors).find(isCanonicalKeyPress);
    return match?.id;
  }, [behaviors]);

  const canTypeThrough = keyPressBehaviorId !== undefined && order.length > 0;

  useEffect(() => {
    if (!isTyping || keyPressBehaviorId === undefined) return;

    /**
     * A modifier is bound on *release*, and only if nothing was pressed while
     * it was held.
     *
     * Binding it on keydown was wrong in a way that made the mode unusable:
     * reaching for Ctrl+Arrow to skip a key wrote Ctrl onto the key you were
     * standing on first, every single time, because the two presses are never
     * simultaneous. Press-and-release binds the modifier; press-and-hold makes
     * it a chord. That is exactly the tap/hold rule these keyboards run on.
     */
    let pendingModifier: { code: string; target: number } | null = null;

    const bind = (usage: number, target: number) => {
      doUpdateBinding(
        { behaviorId: keyPressBehaviorId, param1: usage >>> 0, param2: 0 },
        target,
      );
      setSelectedKeyPosition(stepPosition(order, target, 1));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Auto-repeat would otherwise walk a held key across the whole board.
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        pendingModifier = null;
        setIsTyping(false);
        return;
      }

      const target = selectedKeyPosition ?? order[0];
      if (target === undefined) return;

      if (isModifierCode(event.code)) {
        // Undecided until it is released or something else is pressed.
        pendingModifier = { code: event.code, target };
        event.preventDefault();
        return;
      }

      // Anything else arriving proves a held modifier was a chord after all.
      pendingModifier = null;

      if (event.ctrlKey || event.metaKey || event.altKey) {
        if (event.code === "ArrowRight" || event.code === "Tab") {
          event.preventDefault();
          setSelectedKeyPosition((current) => stepPosition(order, current, 1));
        } else if (event.code === "ArrowLeft") {
          event.preventDefault();
          setSelectedKeyPosition((current) => stepPosition(order, current, -1));
        }
        return;
      }

      const usage = usageForCode(event.code);
      if (usage === undefined) return;

      event.preventDefault();
      bind(usage, target);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!pendingModifier || event.code !== pendingModifier.code) return;
      const { target } = pendingModifier;
      pendingModifier = null;

      const usage = usageForCode(event.code);
      if (usage === undefined) return;
      event.preventDefault();
      bind(usage, target);
    };

    // A modifier still held when the window loses focus never sends its keyup,
    // and would otherwise bind the next time focus came back.
    const onBlur = () => {
      pendingModifier = null;
    };

    // Capture, so the binding is taken before any focused control in the page
    // can consume the key as ordinary text input.
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onBlur);
    };
  }, [
    isTyping,
    keyPressBehaviorId,
    order,
    selectedKeyPosition,
    doUpdateBinding,
  ]);

  // Leaving the mode on a lost connection or a layout swap avoids binding keys
  // on a board that is no longer the one on screen.
  useEffect(() => {
    if (!canTypeThrough) setIsTyping(false);
  }, [canTypeThrough]);

  const typedCount = order.length
    ? order.indexOf(selectedKeyPosition ?? order[0]) + 1
    : 0;

  // The flow decides the layout. Nothing is on screen that the current step
  // does not need: no rail while nothing is selected, and no rails at all
  // while typing through.
  // The rail stays up while painting. Dropping the grid to two columns while
  // the rail was still rendered left it auto-placed into a phantom cell, on
  // top of the canvas — which is what "repeat on keys" looked like breaking.
  // Keeping it is also the better behaviour: you can see what you are painting
  // and retarget without leaving the mode.
  const columns = isTyping
    ? "xl:grid-cols-1"
    : shelfOpen
      ? "xl:grid-cols-[13rem_minmax(0,1fr)_21rem]"
      : "xl:grid-cols-[13rem_minmax(0,1fr)]";

  // The other half of the same rule. Dropping to one column while the canvas
  // still asked for column 2 put it in an *implicit* track: the explicit `1fr`
  // took the free space and the board was squeezed into whatever was left at
  // the right. Template and placement have to move together, so the placement
  // is a sibling of the template above rather than a constant in the markup.
  const canvasPlacement = isTyping ? "" : "xl:col-start-2 xl:row-start-1";

  const moveLayer = useCallback(
    (start: number, end: number) => {
      const doMove = async (startIndex: number, destIndex: number) => {
        if (!conn.conn) {
          return;
        }

        const resp = await call_rpc(conn.conn, {
          keymap: { moveLayer: { startIndex, destIndex } },
        });

        if (resp.keymap?.moveLayer?.ok) {
          setDeviceKeymap(resp.keymap?.moveLayer?.ok);
          setSelectedLayerIndex(destIndex);
        } else {
          console.error("Error moving", resp);
        }
      };

      undoRedo?.(async () => {
        await doMove(start, end);
        return () => doMove(end, start);
      });
    },
    [conn.conn, undoRedo],
  );

  /**
   * Remove a layer on the keyboard and drop it from local state.
   *
   * Hoisted because three call sites need it — the remove action, the undo of
   * "add layer", and the undo of a restore — and they were three copies of the
   * same request. Where the selection lands afterwards is deliberately left to
   * the clamp effect at the foot of this component, so there is one rule for it
   * rather than two that can disagree.
   */
  const removeLayerAt = useCallback(
    async (layerIndex: number) => {
      if (!conn.conn) {
        throw new Error("Not connected");
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { removeLayer: { layerIndex } },
      });

      if (!resp.keymap?.removeLayer?.ok) {
        console.error("Remove error", resp.keymap?.removeLayer?.err);
        throw new Error(
          "Failed to remove layer:" + resp.keymap?.removeLayer?.err,
        );
      }

      setDeviceKeymap((current) =>
        current == null
          ? current
          : produce(current, (draft) => {
              draft.layers.splice(layerIndex, 1);
              draft.availableLayers++;
            }),
      );
    },
    [conn.conn, setDeviceKeymap],
  );

  /** Put a removed layer back, with its bindings, where it used to be. */
  const restoreLayerAt = useCallback(
    async (layerId: number, atIndex: number) => {
      if (!conn.conn) {
        throw new Error("Not connected");
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { restoreLayer: { layerId, atIndex } },
      });

      const restored = resp.keymap?.restoreLayer?.ok;
      if (!restored) {
        console.error("Restore error", resp.keymap?.restoreLayer?.err);
        throw new Error(
          "Failed to restore layer:" + resp.keymap?.restoreLayer?.err,
        );
      }

      setDeviceKeymap((current) =>
        current == null
          ? current
          : produce(current, (draft) => {
              draft.layers.splice(atIndex, 0, restored);
              draft.availableLayers--;
            }),
      );
      setSelectedLayerIndex(atIndex);
    },
    [conn.conn, setDeviceKeymap],
  );

  const addLayer = useCallback(() => {
    async function doAdd(): Promise<number> {
      if (!conn.conn || !keymap) {
        throw new Error("Not connected");
      }

      const resp = await call_rpc(conn.conn, { keymap: { addLayer: {} } });

      if (resp.keymap?.addLayer?.ok) {
        const newSelection = keymap.layers.length;
        const addedLayer = resp.keymap.addLayer.ok.layer;
        if (!addedLayer) {
          throw new Error("Keyboard returned an empty layer response");
        }
        setDeviceKeymap((current) =>
          current == null
            ? current
            : produce(current, (draft) => {
                draft.layers.push(addedLayer);
                draft.availableLayers--;
              }),
        );

        setSelectedLayerIndex(newSelection);

        return resp.keymap.addLayer.ok.index;
      } else {
        console.error("Add error", resp.keymap?.addLayer?.err);
        throw new Error("Failed to add layer:" + resp.keymap?.addLayer?.err);
      }
    }

    void undoRedo?.(async () => {
      const index = await doAdd();
      return () => removeLayerAt(index);
    });
  }, [conn, keymap, removeLayerAt, undoRedo]);

  /**
   * The layer just removed, so it can be put back at the moment it is wanted.
   *
   * `restoreLayer` has been in the protocol from the start and has never had an
   * entry point. ⌘Z reaches it, but only if you know the delete is sitting on
   * the undo stack and that nothing has happened since — which is exactly the
   * knowledge someone who just deleted the wrong layer does not have.
   */
  const [removedLayer, setRemovedLayer] = useState<{
    id: number;
    index: number;
    name: string;
  } | null>(null);

  const removeLayer = useCallback(() => {
    if (!keymap) {
      throw new Error("No keymap loaded");
    }

    const index = selectedLayerIndex;
    const { id, name } = keymap.layers[index];

    void undoRedo?.(async () => {
      await removeLayerAt(index);
      setRemovedLayer({ id, index, name: name || `Layer ${index}` });

      return () => {
        setRemovedLayer(null);
        return restoreLayerAt(id, index);
      };
    });
  }, [keymap, removeLayerAt, restoreLayerAt, selectedLayerIndex, undoRedo]);

  /**
   * Put the just-removed layer back.
   *
   * This goes through the undo stack rather than calling the RPC directly, so
   * remove and restore stay two ordinary reversible operations instead of one
   * operation with a side channel that the history knows nothing about.
   */
  const restoreRemovedLayer = useCallback(() => {
    const removed = removedLayer;
    if (!removed) return;
    setRemovedLayer(null);

    // The offer outlives ⌘Z on purpose — it is a second way in, not the only
    // one — so by the time it is taken the layer may already be back. Asking
    // the keyboard to restore it twice is an error; doing nothing is right.
    if (keymap?.layers.some((layer) => layer.id === removed.id)) return;

    void undoRedo?.(async () => {
      await restoreLayerAt(removed.id, removed.index);
      return () => removeLayerAt(removed.index);
    });
  }, [keymap, removeLayerAt, removedLayer, restoreLayerAt, undoRedo]);

  // Ephemeral, per UX.md: an offer that never expires becomes chrome. Twelve
  // seconds is long enough to read it and reach for it, short enough that it is
  // gone before it starts describing a keyboard that has moved on.
  useEffect(() => {
    if (!removedLayer) return;
    const timer = setTimeout(() => setRemovedLayer(null), 12_000);
    return () => clearTimeout(timer);
  }, [removedLayer]);

  const changeLayerName = useCallback(
    (id: number, oldName: string, newName: string) => {
      async function changeName(layerId: number, name: string) {
        if (!conn.conn) {
          throw new Error("Not connected");
        }

        const resp = await call_rpc(conn.conn, {
          keymap: { setLayerProps: { layerId, name } },
        });

        if (
          resp.keymap?.setLayerProps ==
          SetLayerPropsResponse.SET_LAYER_PROPS_RESP_OK
        ) {
          setDeviceKeymap((current) =>
            current == null
              ? current
              : produce(current, (draft) => {
                  const layer_index = draft.layers.findIndex(
                    (l: Layer) => l.id == layerId,
                  );
                  draft.layers[layer_index].name = name;
                }),
          );
        } else {
          throw new Error(
            "Failed to change layer name:" + resp.keymap?.setLayerProps,
          );
        }
      }

      undoRedo?.(async () => {
        await changeName(id, newName);
        return async () => {
          await changeName(id, oldName);
        };
      });
    },
    [conn, undoRedo],
  );

  /**
   * The alpha block on this layer, if it currently reads as a layout we know.
   *
   * Read rather than guessed. Keys carrying an implicit modifier are skipped —
   * a Ctrl+C key is not part of the alphabet even though its usage is a letter.
   */
  const alphaBlock = useMemo(() => {
    const bindings = keymap?.layers[selectedLayerIndex]?.bindings;
    if (!bindings || keyPressBehaviorId === undefined) return undefined;

    const positions: number[] = [];
    let letters = "";

    for (const position of order) {
      const binding = bindings[position];
      if (!binding || binding.behaviorId !== keyPressBehaviorId) continue;
      if (getHidImplicitModifierMask(binding.param1) !== 0) continue;

      const [page, id] = hid_usage_page_and_id_from_usage(
        getHidBaseUsage(binding.param1),
      );
      if (page !== HID_KEYBOARD_USAGE_PAGE) continue;

      const letter = letterForUsageId(id);
      if (!letter) continue;

      positions.push(position);
      letters += letter;
    }

    const layout = detectAlphaLayout(letters);
    return layout ? { positions, layout } : undefined;
  }, [keymap, keyPressBehaviorId, order, selectedLayerIndex]);

  /**
   * Move the alphas onto another layout, in one undo entry.
   *
   * Only the letters move. Punctuation, thumbs, layer keys and anything with a
   * modifier are left exactly where they are, because those are the parts a
   * user has actually chosen.
   */
  const applyAlphaLayout = useCallback(
    (target: AlphaLayout) => {
      if (!alphaBlock || !deviceKeymap || !keymap || isApplyingDraft) return;
      if (keyPressBehaviorId === undefined) return;

      const layer = keymap.layers[selectedLayerIndex];
      if (!layer) return;

      const changes = remapAlphas(
        alphaBlock.positions,
        alphaBlock.layout,
        target,
      );
      if (changes.size === 0) return;

      const restore = [...changes.keys()].map(
        (position) => [position, { ...layer.bindings[position] }] as const,
      );
      const incoming = [...changes].map(([position, letter]) => {
        const usageId = usageIdForLetter(letter);
        return [
          position,
          {
            behaviorId: keyPressBehaviorId,
            param1:
              usageId === undefined
                ? layer.bindings[position].param1
                : hid_usage_from_page_and_id(
                    HID_KEYBOARD_USAGE_PAGE,
                    usageId,
                  ) >>> 0,
            param2: 0,
          },
        ] as const;
      });

      const write = (
        entries: readonly (readonly [number, BehaviorBinding])[],
      ) =>
        setDraftBindings((current) =>
          entries.reduce(
            (draft, [keyPosition, binding]) =>
              updateDraftBinding(
                deviceKeymap,
                draft,
                { layerId: layer.id, keyPosition },
                binding,
              ),
            current,
          ),
        );

      void undoRedo?.(async () => {
        write(incoming);
        return async () => write(restore);
      });
    },
    [
      alphaBlock,
      deviceKeymap,
      isApplyingDraft,
      keymap,
      keyPressBehaviorId,
      selectedLayerIndex,
      undoRedo,
    ],
  );

  // Registered where the state is, not handed upward. Everything here is
  // reachable from the rails too — the palette exists so that rare actions do
  // not have to earn a permanent button to stay findable.
  const keyboardCommands = useMemo<Command[]>(() => {
    const structureLocked = countDraftBindings(draftBindings) > 0;
    const list: Command[] = [
      {
        id: "kb.typeThrough",
        label: "Type through the board",
        section: "Keymap",
        icon: Keyboard2,
        keywords: "bind fast type listen",
        disabled: !canTypeThrough || isApplyingDraft,
        run: () => {
          setSelectedKeyPosition((current) => current ?? order[0]);
          setIsTyping(true);
        },
      },
      {
        id: "kb.fit",
        label: "Fit keyboard to viewport",
        section: "View",
        icon: Maximize2,
        keywords: "zoom scale",
        run: () => setKeymapScale("auto"),
      },
      {
        id: "kb.addLayer",
        label: "Add layer",
        section: "Layers",
        icon: Plus,
        disabled: (keymap?.availableLayers || 0) === 0 || structureLocked,
        run: () => void addLayer(),
      },
      {
        id: "kb.removeLayer",
        label: "Remove current layer",
        section: "Layers",
        icon: Minus,
        hint: "restorable",
        destructive: true,
        disabled: (keymap?.layers?.length || 0) <= 1 || structureLocked,
        run: () => void removeLayer(),
      },
    ];

    for (const layout of ALPHA_LAYOUTS) {
      if (!alphaBlock || alphaBlock.layout.id === layout.id) continue;
      list.push({
        id: `kb.alpha.${layout.id}`,
        label: `Switch alphas to ${layout.name}`,
        section: "Keymap",
        icon: Keyboard2,
        keywords: `layout alphas ${layout.name} ${alphaBlock.layout.name}`,
        hint: `from ${alphaBlock.layout.name}`,
        disabled: isApplyingDraft,
        run: () => applyAlphaLayout(layout),
      });
    }

    if (mirrorTarget !== undefined && selectedBinding) {
      list.push({
        id: "kb.mirror",
        label: "Mirror key to the opposite side",
        section: "Keymap",
        icon: FlipHorizontal,
        keywords: "symmetry handedness",
        disabled: isApplyingDraft,
        run: mirrorSelection,
      });
    }

    for (const [index, layer] of (keymap?.layers ?? []).entries()) {
      if (index === selectedLayerIndex) continue;
      list.push({
        id: `kb.copyFrom.${layer.id}`,
        label: `Copy bindings from ${layer.name || `Layer ${index}`}`,
        section: "Layers",
        icon: Copy,
        disabled: isApplyingDraft,
        run: () => copyLayerFrom(index),
      });
    }

    return list;
  }, [
    addLayer,
    alphaBlock,
    applyAlphaLayout,
    canTypeThrough,
    copyLayerFrom,
    draftBindings,
    isApplyingDraft,
    keymap,
    mirrorSelection,
    mirrorTarget,
    order,
    removeLayer,
    selectedBinding,
    selectedLayerIndex,
    setKeymapScale,
  ]);

  useCommands(keyboardCommands);

  useEffect(() => {
    if (!keymap?.layers) return;

    const layers = keymap.layers.length - 1;

    if (selectedLayerIndex > layers) {
      setSelectedLayerIndex(layers);
    }
  }, [keymap, selectedLayerIndex]);

  const structureLocked = countDraftBindings(draftBindings) > 0;

  const copySources = (keymap?.layers ?? [])
    .map((layer, index) => ({
      id: `copy:${index}`,
      label: layer.name || `Layer ${index}`,
      index,
    }))
    .filter(({ index }) => index !== selectedLayerIndex);

  const alphaTargets = alphaBlock
    ? ALPHA_LAYOUTS.filter((layout) => layout.id !== alphaBlock.layout.id)
    : [];

  return (
    // Three panes on one continuous plane: which layer on the left, the board
    // in the middle, what a key can become on the right. Nothing is docked into
    // the window edge — each pane is a card floating on the same lit substrate.
    //
    // The board is wide and short, so its binding constraint is width — but the
    // thing that actually broke the previous layout was *height*: a top band
    // plus a bottom sheet cropped the board between them. Rails cost width once
    // and give the canvas its full height back, which is the trade that suits
    // this shape. The controls that belong to the board itself do not sit in
    // either rail; they float in the corners of the canvas.
    //
    // `main` is the grid itself rather than a `display: contents` wrapper —
    // that value has a history of dropping elements out of the accessibility
    // tree, and this is a landmark.
    <main
      // Three rows declared, not two: below `xl` there are three children, and
      // a template of two auto-placed the third into an implicit track. That is
      // the row-axis version of the trap in §4 of AGENTS.md, and it is only
      // benign here because implicit rows happen to size the same way.
      className={`wafer-substrate grid min-h-0 min-w-0 grid-rows-[minmax(22rem,1fr)_auto_auto] gap-2 overflow-auto bg-base-300 p-2 xl:grid-rows-1 xl:overflow-hidden ${columns}`}
    >
      {/* Layers, and nothing else.
          Everything that used to share this rail has moved to where it is
          actually about — the board's own controls float on the board, the
          palette lives in the header, and the two layer edits hide behind the
          layer list's own menu. Eight stacked clusters in a 13rem column meant
          the rail scrolled as a whole, so adding a fifth layer pushed zoom off
          the bottom of the window. What is left is the one control that grows
          without limit, and it now scrolls inside its own list.

          Vertical, so a layer named "Navigation" reads as "Navigation" rather
          than as "Navi…". Horizontal chips truncated every name past about six
          characters, which made the picker useless for exactly the layers
          people bother to name. */}
      {/* Unmounted while typing, not hidden with the `hidden` attribute.
          `hidden` is a UA rule (`[hidden] { display: none }`) and every author
          style beats it — including the `flex` in this very class list. So the
          rail stayed on screen through the whole mode, and because the grid had
          dropped to one column by then, it landed in an implicit track and
          squeezed the board it was supposed to be getting out of the way of.
          Two traps from §4 of AGENTS.md firing at once. Not rendering it is
          unambiguous, and it keeps the template and its children changing
          together. */}
      {!isTyping && (
        <aside
          aria-label="Layers"
          className="wafer-float order-1 flex min-h-0 flex-col p-3 xl:order-none xl:col-start-1 xl:row-start-1"
        >
          {keymap && (
            <LayerPicker
              layers={keymap.layers}
              selectedLayerIndex={selectedLayerIndex}
              onLayerClicked={setSelectedLayerIndex}
              onLayerMoved={moveLayer}
              canAdd={(keymap.availableLayers || 0) > 0}
              canRemove={(keymap.layers?.length || 0) > 1}
              isStructureDisabled={structureLocked}
              onAddClicked={addLayer}
              onRemoveClicked={removeLayer}
              onLayerNameChanged={changeLayerName}
            />
          )}
        </aside>
      )}

      {/* The canvas catches the application's shared light rather than a
          fixed white glow, which was a bright blob in dark mode. */}
      <div className={`relative order-none min-h-0 min-w-0 ${canvasPlacement}`}>
        {/* The vertical padding is load-bearing, not taste: the board controls
            float in the corners of this box, and Fit sizes the board against
            the parent's content box (`PhysicalLayout` subtracts the computed
            padding). Reserving the strip here is what keeps a fitted board from
            sliding underneath them. */}
        <section
          aria-label="Keyboard layout"
          className="grid h-full min-h-0 min-w-0 place-items-center overflow-auto px-4 pb-14 pt-20 md:px-6"
        >
          {layouts && keymap && behaviors ? (
            <KeymapComp
              keymap={keymap}
              layout={layouts[selectedPhysicalLayoutIndex]}
              behaviors={behaviors}
              scale={keymapScale}
              selectedLayerIndex={selectedLayerIndex}
              selectedKeyPosition={selectedKeyPosition}
              draftedPositions={draftedOnLayer}
              selectedPositions={selectedPositions}
              onKeyPositionClicked={onKeyPositionClicked}
            />
          ) : (
            <div className="grid max-w-sm place-items-center gap-3 rounded-2xl border border-line bg-base-200/75 p-8 text-center shadow-sm">
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Cable aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="font-semibold">Reading your keyboard</p>
                <p className="mt-1 text-sm text-base-content/60">
                  Loading geometry, layers, and available behaviors.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ---- The board's own controls ------------------------------------
            Anchored to this wrapper rather than to the scrolling section: an
            absolutely positioned child of an `overflow-auto` element scrolls
            with the content, which sent these away the moment the canvas
            panned.

            Which board and how big it is are questions *about the board*, so
            they are answered on it. In the rail they were two more rows in a
            column that had already run out of height. */}
        {!isTyping && (
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] items-start gap-2">
            {layouts && (
              <div
                title={
                  structureLocked
                    ? "Apply or discard the key draft before changing the physical layout"
                    : undefined
                }
                className="wafer-float min-w-0 max-w-[10rem] px-2 py-1 sm:max-w-[14rem]"
              >
                <PhysicalLayoutPicker
                  layouts={layouts}
                  selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
                  isDisabled={structureLocked}
                  onPhysicalLayoutClicked={doSelectPhysicalLayout}
                />
              </div>
            )}
          </div>
        )}

        {/* A door, not a control: the whole mode is elsewhere. It sits on the
            board because the board is what it takes over. */}
        {!isTyping && canTypeThrough && (
          <button
            type="button"
            onClick={() => {
              setSelectedKeyPosition((current) => current ?? order[0]);
              setIsTyping(true);
            }}
            disabled={isApplyingDraft}
            title="Bind the whole board by typing it — press a key to bind it and advance"
            // Hidden on the narrowest windows, where it and the layout picker
            // want more than the canvas is wide. Nothing is lost: the mode is
            // registered as a command, and typing a board through on a phone
            // is not a thing anyone is doing.
            className="wafer-float wafer-dispersive absolute right-2 top-2 hidden min-h-9 items-center gap-2 px-2.5 text-sm font-medium text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 sm:flex"
          >
            <Keyboard2 aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Type through</span>
          </button>
        )}

        {/* ---- The bottom edge ---------------------------------------------
            One flex row rather than three independently positioned things.
            Absolute corners plus absolutely-centred teaching text is a layout
            that only works at the width you happened to check: at ~54rem the
            left cluster, a 36rem hint and the zoom cluster want 63rem and
            silently overlap. As a row they cannot — the hint takes what is
            left, and drops out entirely when there is not enough of it. */}
        {!isTyping && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-end justify-between gap-2 px-2">
            {/* Copy-from and alphas. Both rewrite the whole layer in a single
                undo entry, so they belong beside the board that is about to
                change — and down here rather than up top, where they crowded
                the picker that says which board this even is. */}
            {copySources.length > 0 || alphaTargets.length > 0 ? (
              <div className="wafer-float pointer-events-auto flex min-w-0 items-center gap-1 p-1">
                {copySources.length > 0 && (
                  <CanvasMenuButton
                    label="Copy from"
                    title="Replace this layer's bindings with another layer's"
                    isDisabled={isApplyingDraft}
                    items={copySources}
                    onAction={(id) =>
                      copyLayerFrom(Number(id.slice("copy:".length)))
                    }
                  />
                )}

                {alphaBlock && alphaTargets.length > 0 && (
                  <CanvasMenuButton
                    label="Alphas"
                    value={alphaBlock.layout.name}
                    title={`Move the letters off ${alphaBlock.layout.name}, leaving punctuation and thumbs alone`}
                    isDisabled={isApplyingDraft}
                    items={alphaTargets.map((layout) => ({
                      id: `alpha:${layout.id}`,
                      label: layout.name,
                    }))}
                    onAction={(id) => {
                      const layout = ALPHA_LAYOUTS.find(
                        (candidate) => `alpha:${candidate.id}` === id,
                      );
                      if (layout) applyAlphaLayout(layout);
                    }}
                  />
                )}
              </div>
            ) : (
              // Holds the corner so `justify-between` still pushes zoom right
              // when this layer has nothing to copy from and no alpha block.
              <span aria-hidden="true" />
            )}

            {/* Teaching text rather than chrome: it reserves no layout of its
                own, and it goes once a key is selected and the rail says it
                instead. Below `lg` there is no room for it between the two
                clusters, so it is not there. */}
            {!shelfOpen && !paint && layouts && keymap && behaviors && (
              <p className="hidden min-w-0 flex-1 px-2 pb-2 text-center text-xs text-tertiary lg:block">
                Select a key to bind it — shift-click for a run, ⌘/Ctrl-click to
                add one. Nothing reaches the keyboard until you review the
                draft.
              </p>
            )}

            <div className="wafer-float pointer-events-auto flex shrink-0 items-center gap-1 p-1">
              <button
                type="button"
                aria-label="Fit keyboard to viewport"
                title="Fit keyboard to viewport"
                onClick={() => setKeymapScale("auto")}
                className="wafer-dispersive grid size-9 place-items-center rounded-control text-tertiary outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Maximize2 aria-hidden="true" className="size-4" />
              </button>
              <SelectField
                label="Keyboard zoom"
                hideLabel
                value={String(keymapScale)}
                options={ZOOM_OPTIONS}
                onChange={(id) => setKeymapScale(deserializeLayoutZoom(id))}
              />
            </div>
          </div>
        )}

        {/* The offer, at the moment it is wanted. `restoreLayer` was in the
            protocol from the first day and had no way in that did not require
            knowing what was on the undo stack. */}
        {removedLayer && !isTyping && (
          <div
            role="status"
            className="wafer-dispersive absolute inset-x-0 bottom-16 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-panel border border-line-subtle bg-panel/95 px-3 py-2 text-xs shadow-[var(--elevation-popover)]"
            style={
              { "--dispersion": "var(--dispersion-committed)" } as CSSProperties
            }
          >
            <span className="min-w-0 truncate">
              <span className="font-semibold text-ink">Removed</span>{" "}
              <span className="text-muted">{removedLayer.name}</span>
            </span>
            <button
              type="button"
              onClick={restoreRemovedLayer}
              className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-control px-2 font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              Restore
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setRemovedLayer(null)}
              className="grid size-8 shrink-0 place-items-center rounded-control text-tertiary outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}

        {/* The mode's entire interface. Everything else is gone, because
            while you are typing the board through, the board is the only
            thing you are looking at. */}
        {isTyping && (
          <div
            role="status"
            className="wafer-dispersive pointer-events-auto absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-3 rounded-panel border border-line-subtle bg-panel/95 px-3 py-2 text-xs shadow-[var(--elevation-popover)]"
            style={
              { "--dispersion": "var(--dispersion-committed)" } as CSSProperties
            }
          >
            <span className="font-semibold text-ink">Type through</span>
            <span className="font-mono tabular-nums text-muted">
              {typedCount}/{order.length}
            </span>
            <span className="hidden text-tertiary sm:inline">
              press a key to bind it · hold ⌘/Ctrl + ← → to skip · Esc to finish
            </span>
            <button
              type="button"
              onClick={() => setIsTyping(false)}
              className="min-h-8 rounded-control px-2 font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            >
              Done
            </button>
          </div>
        )}

        {paint && (
          <div
            role="status"
            // Above the zoom cluster's row, which stays up while painting so
            // the board can be rescaled without leaving the mode.
            className="wafer-dispersive absolute inset-x-0 bottom-16 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-panel border border-line-subtle bg-panel/95 px-3 py-2 text-xs shadow-[var(--elevation-popover)]"
            style={
              { "--dispersion": "var(--dispersion-committed)" } as CSSProperties
            }
          >
            <span className="min-w-0 truncate">
              <span className="font-semibold text-ink">Applying</span>{" "}
              <span className="text-muted">{paint.label}</span>
            </span>

            {/* Only offered for hold-taps, because it is only meaningful there:
                on a plain key press there is no second parameter for the
                existing usage to survive into. */}
            {paintIsHoldTap && (
              <label className="flex shrink-0 items-center gap-1.5 text-tertiary">
                <input
                  type="checkbox"
                  checked={paint.keepTap}
                  onChange={(event) =>
                    setPaint({ ...paint, keepTap: event.target.checked })
                  }
                  className="size-3.5 accent-[rgb(var(--wafer-primary))]"
                />
                keep each key as the tap
              </label>
            )}

            <span className="hidden shrink-0 text-tertiary lg:inline">
              click keys to apply
            </span>
            <button
              type="button"
              onClick={() => setPaint(null)}
              className="min-h-8 shrink-0 rounded-control px-2 font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Same reason as the layers rail: `hidden` lost to the `flex` beside
          it, so the key panel stayed up during type-through — the one mode
          whose entire point is that nothing but the board is on screen. */}
      {shelfOpen && !isTyping && (
        <aside
          aria-label="Key assignment"
          // Opaque, unlike the other floats, and deliberately.
          //
          // `.wafer-float` paints `--surface-panel` at 0.72 over whatever is
          // behind it. That is fine for a card with nothing pinned inside it, but
          // this one has a sticky section bar, and a sticky child *must* be
          // opaque or the list scrolls visibly through it. A 0.95 child over a
          // 0.72 parent composites to ~0.99 — which is why the bar read as a
          // lighter band across the panel. Same token at the same alpha on both
          // is the only way the seam actually disappears.
          //
          // The float's hairline and shadow are untouched, so it still reads as
          // a card; it is only the transparency that goes, exactly as it does
          // under `prefers-reduced-transparency`.
          className="wafer-float order-2 flex min-h-0 flex-col bg-panel xl:order-none xl:col-start-3 xl:row-start-1"
        >
          {/* Below `xl` this is a card in a stacked, page-scrolling layout, so
            the catalogue is laid out at its natural height and the page
            scrolls. It used to keep the rail's `flex-1` scroller here, where
            there is no bounded height to flex against — the catalogue resolved
            to a few pixels and the panel rendered as an empty sliver with a
            scrollbar in it. That is the "broken key menu" on a narrow window. */}
          {
            <>
              {/* Identity on one row, actions on their own.
                These were all crammed into a single flex row, so in a 21rem
                rail the title truncated to "Bin…" while two text buttons and a
                close button fought over what was left. The title is the widest
                thing here and the actions are the ones that must stay legible,
                so they get a row each. */}
              <header className="grid shrink-0 gap-2 border-b border-line-subtle px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary">
                      {keymap?.layers[selectedLayerIndex]?.name ||
                        `Layer ${selectedLayerIndex}`}
                    </p>
                    <h2 className="truncate font-semibold text-ink">
                      {selectedPositions.size > 1
                        ? `Bind ${selectedPositions.size} keys`
                        : `Bind key ${(selectedKeyPosition ?? 0) + 1}`}
                    </h2>
                    {selectedPositions.size > 1 ? (
                      <p className="truncate text-xs text-muted">
                        Applies to every selected key. Hold-taps keep each key's
                        own letter as the tap.
                      </p>
                    ) : (
                      selectedBindingDescription && (
                        <p className="truncate text-xs text-muted">
                          {selectedBindingDescription}
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="rounded-full border border-line-subtle px-2 py-1 font-mono text-[0.6875rem] text-muted">
                      K{String(selectedKeyPosition ?? 0).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      aria-label="Clear key selection"
                      title="Clear selection (Esc)"
                      onClick={() => {
                        setSelectedKeyPosition(undefined);
                        setSelection(new Set());
                      }}
                      className="grid size-9 place-items-center rounded-control text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    title="Apply this binding to other keys"
                    onClick={() =>
                      selectedBinding &&
                      setPaint({
                        binding: selectedBinding,
                        keepTap: true,
                        label: selectedBindingDescription ?? "this binding",
                      })
                    }
                    className="flex min-h-8 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Copy aria-hidden="true" className="size-3.5" />
                    Repeat on keys
                  </button>
                  {/* Only offered when the board actually has an opposite key.
                    On an asymmetric layout, or a centre column, there is
                    nothing to mirror onto and guessing would scribble on a key
                    the user never looked at. */}
                  {mirrorTarget !== undefined && (
                    <button
                      type="button"
                      title={`Copy to key ${mirrorTarget + 1}, swapping left and right modifiers`}
                      onClick={mirrorSelection}
                      disabled={isApplyingDraft}
                      className="flex min-h-8 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40"
                    >
                      <FlipHorizontal aria-hidden="true" className="size-3.5" />
                      Mirror
                    </button>
                  )}
                </div>
              </header>

              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {keymap && selectedBinding && (
                  <BehaviorBindingPicker
                    key={`${selectedLayerIndex}:${selectedKeyPosition}`}
                    binding={selectedBinding}
                    behaviors={Object.values(behaviors)}
                    layers={keymap.layers.map(({ id, name }, li) => ({
                      id,
                      name: name || li.toLocaleString(),
                    }))}
                    isDisabled={isApplyingDraft}
                    onBindingChanged={onBindingChanged}
                  />
                )}
              </div>
            </>
          }
        </aside>
      )}
    </main>
  );
}
