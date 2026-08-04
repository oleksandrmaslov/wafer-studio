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

import {
  validateBindingParameters,
  validateValue,
} from "../behaviors/parameters";
import { describeHidUsage } from "../behaviors/actionCatalog";
import { produce } from "immer";
import { LockStateContext } from "../rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { deserializeLayoutZoom, LayoutZoom } from "./layoutZoom";
import { useLocalStorageState } from "../misc/useLocalStorageState";
import { Cable, Keyboard as Keyboard2, Maximize2, X } from "lucide-react";
import {
  bindingEquals,
  countDraftBindings,
  DraftApplyResult,
  DraftBindingOverrides,
  DraftValidationResult,
  KeymapDraftController,
  materializeDraftKeymap,
  planDraftBindings,
  rebaseDraftBindings,
  updateDraftBinding,
} from "./keymapDraft";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

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

  const paintIsHoldTap = useMemo(() => {
    if (!paint) return false;
    const behavior = behaviors[paint.binding.behaviorId];
    return behavior ? isMultiBehavior(behavior) : false;
  }, [behaviors, paint]);

  const onKeyPositionClicked = useCallback(
    (position: number) => {
      if (!paint || !keymap) {
        setSelectedKeyPosition(position);
        return;
      }

      const existing = keymap.layers[selectedLayerIndex]?.bindings[position];
      const existingBehavior = existing
        ? behaviors[existing.behaviorId]
        : undefined;
      const keepsTap =
        paint.keepTap &&
        existingBehavior !== undefined &&
        isCanonicalKeyPress(existingBehavior);

      doUpdateBinding(
        keepsTap
          ? { ...paint.binding, param2: existing.param1 }
          : paint.binding,
        position,
      );
    },
    [behaviors, doUpdateBinding, keymap, paint, selectedLayerIndex],
  );

  // ---- Type-through -------------------------------------------------------
  const [isTyping, setIsTyping] = useState(false);

  const keyPressBehaviorId = useMemo(() => {
    const match = Object.values(behaviors).find(isCanonicalKeyPress);
    return match?.id;
  }, [behaviors]);

  const order = useMemo(() => {
    const layout = layouts?.[selectedPhysicalLayoutIndex];
    return layout ? readingOrder(layout) : [];
  }, [layouts, selectedPhysicalLayoutIndex]);

  const canTypeThrough = keyPressBehaviorId !== undefined && order.length > 0;

  useEffect(() => {
    if (!isTyping || keyPressBehaviorId === undefined) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // A chord is a command; a bare press is a binding. Checking the code
      // rather than only the modifier flags matters because pressing Control
      // on its own already reports ctrlKey — and that press has to stay
      // bindable, or the mode cannot bind modifiers at all.
      const chord =
        (event.ctrlKey || event.metaKey || event.altKey) &&
        !isModifierCode(event.code);

      if (event.key === "Escape") {
        event.preventDefault();
        setIsTyping(false);
        return;
      }

      if (chord) {
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
      const target = selectedKeyPosition ?? order[0];
      if (target === undefined) return;

      doUpdateBinding(
        { behaviorId: keyPressBehaviorId, param1: usage >>> 0, param2: 0 },
        target,
      );
      setSelectedKeyPosition(stepPosition(order, target, 1));
    };

    // Capture, so the binding is taken before any focused control in the page
    // can consume the key as ordinary text input.
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
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

    async function doRemove(layerIndex: number) {
      if (!conn.conn) {
        throw new Error("Not connected");
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { removeLayer: { layerIndex } },
      });

      console.log(resp);
      if (resp.keymap?.removeLayer?.ok) {
        setDeviceKeymap((current) =>
          current == null
            ? current
            : produce(current, (draft) => {
                draft.layers.splice(layerIndex, 1);
                draft.availableLayers++;
              }),
        );
      } else {
        console.error("Remove error", resp.keymap?.removeLayer?.err);
        throw new Error(
          "Failed to remove layer:" + resp.keymap?.removeLayer?.err,
        );
      }
    }

    undoRedo?.(async () => {
      const index = await doAdd();
      return () => doRemove(index);
    });
  }, [conn, keymap, undoRedo]);

  const removeLayer = useCallback(() => {
    async function doRemove(layerIndex: number): Promise<void> {
      if (!conn.conn || !keymap) {
        throw new Error("Not connected");
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { removeLayer: { layerIndex } },
      });

      if (resp.keymap?.removeLayer?.ok) {
        if (layerIndex == keymap.layers.length - 1) {
          setSelectedLayerIndex(layerIndex - 1);
        }
        setDeviceKeymap((current) =>
          current == null
            ? current
            : produce(current, (draft) => {
                draft.layers.splice(layerIndex, 1);
                draft.availableLayers++;
              }),
        );
      } else {
        console.error("Remove error", resp.keymap?.removeLayer?.err);
        throw new Error(
          "Failed to remove layer:" + resp.keymap?.removeLayer?.err,
        );
      }
    }

    async function doRestore(layerId: number, atIndex: number) {
      if (!conn.conn) {
        throw new Error("Not connected");
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { restoreLayer: { layerId, atIndex } },
      });

      console.log(resp);
      if (resp.keymap?.restoreLayer?.ok) {
        const restoredLayer = resp.keymap.restoreLayer.ok;
        setDeviceKeymap((current) =>
          current == null
            ? current
            : produce(current, (draft) => {
                draft.layers.splice(atIndex, 0, restoredLayer);
                draft.availableLayers--;
              }),
        );
        setSelectedLayerIndex(atIndex);
      } else {
        console.error("Remove error", resp.keymap?.restoreLayer?.err);
        throw new Error(
          "Failed to restore layer:" + resp.keymap?.restoreLayer?.err,
        );
      }
    }

    if (!keymap) {
      throw new Error("No keymap loaded");
    }

    const index = selectedLayerIndex;
    const layerId = keymap.layers[index].id;
    undoRedo?.(async () => {
      await doRemove(index);
      return () => doRestore(layerId, index);
    });
  }, [conn, keymap, selectedLayerIndex, undoRedo]);

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

  useEffect(() => {
    if (!keymap?.layers) return;

    const layers = keymap.layers.length - 1;

    if (selectedLayerIndex > layers) {
      setSelectedLayerIndex(layers);
    }
  }, [keymap, selectedLayerIndex]);

  return (
    // One continuous plane. The cluster row sits directly on the substrate
    // rather than inside a panel band, so the only horizontal division above
    // the canvas is the app header.
    //
    // `main` is the grid itself rather than a `display: contents` wrapper —
    // that value has a history of dropping elements out of the accessibility
    // tree, and this is a landmark.
    // Three panes. Setup lives on the left, the board owns the middle, and what
    // a key can become lives on the right.
    //
    // The board is wide and short, so its binding constraint is width — but the
    // thing that actually broke the previous layout was *height*: a top band
    // plus a bottom sheet cropped the board between them. Rails cost width
    // once and give the canvas its full height back, which is the trade that
    // suits this shape.
    //
    // `main` is the grid itself rather than a `display: contents` wrapper —
    // that value has a history of dropping elements out of the accessibility
    // tree, and this is a landmark.
    <main
      className={`grid min-h-0 min-w-0 grid-rows-[minmax(24rem,1fr)_auto] overflow-auto bg-base-300 xl:grid-rows-1 xl:overflow-hidden ${columns}`}
    >
      <aside
        aria-label="Keyboard setup"
        hidden={isTyping}
        className="order-1 flex min-h-0 flex-col gap-4 overflow-y-auto border-line-subtle p-3 xl:order-none xl:col-start-1 xl:row-start-1 xl:border-r"
      >
        {layouts && (
          <PhysicalLayoutPicker
            layouts={layouts}
            selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
            isDisabled={countDraftBindings(draftBindings) > 0}
            onPhysicalLayoutClicked={doSelectPhysicalLayout}
          />
        )}

        {/* Vertical, so a layer named "Navigation" reads as "Navigation"
            rather than as "Navi…". Horizontal chips truncated every name past
            about six characters, which made the picker useless for exactly the
            layers people bother to name. */}
        {keymap && (
          <LayerPicker
            layers={keymap.layers}
            selectedLayerIndex={selectedLayerIndex}
            onLayerClicked={setSelectedLayerIndex}
            onLayerMoved={moveLayer}
            canAdd={(keymap.availableLayers || 0) > 0}
            canRemove={(keymap.layers?.length || 0) > 1}
            isStructureDisabled={countDraftBindings(draftBindings) > 0}
            onAddClicked={addLayer}
            onRemoveClicked={removeLayer}
            onLayerNameChanged={changeLayerName}
          />
        )}

        {countDraftBindings(draftBindings) > 0 && (
          <p className="text-xs leading-relaxed text-tertiary">
            Layer structure and physical layout stay locked until this key draft
            is applied or discarded.
          </p>
        )}

        {canTypeThrough && (
          <button
            type="button"
            onClick={() => {
              setSelectedKeyPosition((current) => current ?? order[0]);
              setIsTyping(true);
            }}
            disabled={isApplyingDraft}
            className="flex min-h-9 items-center gap-2 rounded-control px-1 text-left text-sm text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40"
          >
            <Keyboard2 aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">Type through</span>
          </button>
        )}

        {/* Corner anchor: zoom is pinned to the foot of the rail, not stacked
            under the layers. The two clusters hold opposite corners and the
            space between them stays empty, so the rail reads as a frame around
            the canvas rather than as a column of controls. */}
        <div className="mt-auto flex items-center gap-1 pt-2">
          <button
            type="button"
            aria-label="Fit keyboard to viewport"
            title="Fit keyboard to viewport"
            onClick={() => setKeymapScale("auto")}
            className="grid min-h-9 min-w-9 place-items-center rounded-control text-tertiary outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Maximize2 aria-hidden="true" className="size-4" />
          </button>
          <label className="sr-only" htmlFor="keymap-zoom">
            Keyboard zoom
          </label>
          <select
            id="keymap-zoom"
            className="min-h-9 rounded-control bg-transparent px-1 text-sm text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            value={keymapScale}
            onChange={(e) => {
              const value = deserializeLayoutZoom(e.target.value);
              setKeymapScale(value);
            }}
          >
            <option value="auto">Fit</option>
            <option value={0.25}>25%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </div>
      </aside>

      {/* The canvas catches the application's shared light rather than a
          fixed white glow, which was a bright blob in dark mode. */}
      <div className="relative order-none min-h-0 min-w-0 xl:col-start-2 xl:row-start-1">
        <section
          aria-label="Keyboard layout"
          className="wafer-substrate grid h-full min-h-0 min-w-0 place-items-center overflow-auto p-4 md:p-6"
        >
          {layouts && keymap && behaviors ? (
            <KeymapComp
              keymap={keymap}
              layout={layouts[selectedPhysicalLayoutIndex]}
              behaviors={behaviors}
              scale={keymapScale}
              selectedLayerIndex={selectedLayerIndex}
              selectedKeyPosition={selectedKeyPosition}
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

        {/* Teaching text rather than chrome: it reserves no layout, and it
            disappears once a key is selected and the rail says it instead. */}
        {!shelfOpen && !isTyping && layouts && keymap && behaviors && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 px-4 text-center text-xs text-tertiary">
            Select a key to bind it. Nothing reaches the keyboard until you
            review the draft.
          </p>
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
              press a key to bind it · ⌘/Ctrl + ← → to skip · Esc to finish
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
            className="wafer-dispersive absolute inset-x-0 bottom-4 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-panel border border-line-subtle bg-panel/95 px-3 py-2 text-xs shadow-[var(--elevation-popover)]"
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

      <aside
        aria-label="Key assignment"
        hidden={!shelfOpen || isTyping}
        className="order-2 flex min-h-0 flex-col border-line-subtle xl:order-none xl:col-start-3 xl:row-start-1 xl:border-l"
      >
        {shelfOpen && (
          <>
            <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-line-subtle px-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary">
                  {keymap?.layers[selectedLayerIndex]?.name ||
                    `Layer ${selectedLayerIndex}`}
                </p>
                <h2 className="truncate font-semibold text-ink">
                  Bind key {(selectedKeyPosition ?? 0) + 1}
                </h2>
                {selectedBindingDescription && (
                  <p className="truncate text-xs text-muted">
                    {selectedBindingDescription}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-line-subtle px-2 py-1 font-mono text-[0.6875rem] text-muted">
                  K{String(selectedKeyPosition ?? 0).padStart(2, "0")}
                </span>
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
                  className="min-h-8 rounded-control px-2 text-xs font-semibold text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Repeat on keys
                </button>
                <button
                  type="button"
                  aria-label="Clear key selection"
                  title="Clear selection (Esc)"
                  onClick={() => setSelectedKeyPosition(undefined)}
                  className="grid size-10 place-items-center rounded-control text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                  onBindingChanged={doUpdateBinding}
                />
              )}
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
