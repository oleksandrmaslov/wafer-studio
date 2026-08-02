import React, {
  SetStateAction,
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
  validateBindingParameters,
  validateValue,
} from "../behaviors/parameters";
import { describeHidUsage } from "../behaviors/actionCatalog";
import { produce } from "immer";
import { LockStateContext } from "../rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { deserializeLayoutZoom, LayoutZoom } from "./layoutZoom";
import { useLocalStorageState } from "../misc/useLocalStorageState";
import { Cable, Maximize2, MousePointer2, ShieldCheck } from "lucide-react";
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
    (binding: BehaviorBinding) => {
      if (
        !deviceKeymap ||
        !keymap ||
        selectedKeyPosition === undefined ||
        isApplyingDraft
      ) {
        console.error(
          "Can't update binding without a selected key position and loaded keymap",
        );
        return;
      }

      const layer = selectedLayerIndex;
      const layerId = keymap.layers[layer].id;
      const keyPosition = selectedKeyPosition;
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
    <div className="grid min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(32rem,1fr)_auto] overflow-auto bg-base-300 xl:grid-cols-[minmax(0,1fr)_26rem] xl:grid-rows-1 xl:overflow-hidden">
      <main className="grid min-h-[32rem] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-base-300 xl:min-h-0">
        <div className="grid gap-4 border-b border-line bg-base-200 px-4 py-3 lg:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)_auto] lg:items-end">
          {layouts && (
            <PhysicalLayoutPicker
              layouts={layouts}
              selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
              isDisabled={countDraftBindings(draftBindings) > 0}
              onPhysicalLayoutClicked={doSelectPhysicalLayout}
            />
          )}

          {keymap && (
            <LayerPicker
              orientation="horizontal"
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

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label="Fit keyboard to viewport"
              title="Fit keyboard to viewport"
              onClick={() => setKeymapScale("auto")}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-line bg-raised text-base-content transition hover:border-base-content/30 hover:bg-base-100"
            >
              <Maximize2 aria-hidden="true" className="size-4" />
            </button>
            <label className="sr-only" htmlFor="keymap-zoom">
              Keyboard zoom
            </label>
            <select
              id="keymap-zoom"
              className="min-h-11 rounded-lg border border-line bg-raised px-3 text-sm text-base-content"
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
          {countDraftBindings(draftBindings) > 0 && (
            <p className="text-xs leading-relaxed text-base-content/55 lg:col-span-3">
              Layer structure and physical layout stay locked until this key
              draft is applied or discarded.
            </p>
          )}
        </div>

        <section
          aria-label="Keyboard layout"
          className="relative grid min-h-0 min-w-0 place-items-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.64),transparent_62%)] p-4 md:p-8"
        >
          {layouts && keymap && behaviors ? (
            <KeymapComp
              keymap={keymap}
              layout={layouts[selectedPhysicalLayoutIndex]}
              behaviors={behaviors}
              scale={keymapScale}
              selectedLayerIndex={selectedLayerIndex}
              selectedKeyPosition={selectedKeyPosition}
              onKeyPositionClicked={setSelectedKeyPosition}
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

        <div className="flex min-h-11 items-center gap-2 border-t border-line bg-base-200 px-4 text-xs text-base-content/60">
          <MousePointer2 aria-hidden="true" className="size-3.5" />
          Select a key, then choose what it should do. Nothing is sent until you
          review the draft.
        </div>
      </main>

      <aside className="border-t border-line bg-base-200 xl:col-start-2 xl:row-start-1 xl:flex xl:min-h-0 xl:flex-col xl:border-l xl:border-t-0">
        <div className="flex min-h-14 items-center justify-between border-b border-line px-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-base-content/50">
              {selectedKeyPosition === undefined
                ? "Assignment library"
                : keymap?.layers[selectedLayerIndex]?.name ||
                  `Layer ${selectedLayerIndex}`}
            </p>
            <h2 className="font-semibold">
              {selectedKeyPosition === undefined
                ? "Choose a key"
                : `Assign key ${selectedKeyPosition + 1}`}
            </h2>
          </div>
          {selectedKeyPosition !== undefined && (
            <span className="rounded-full border border-line bg-base-100 px-2 py-1 font-mono text-[0.6875rem] text-base-content/60">
              K{String(selectedKeyPosition).padStart(2, "0")}
            </span>
          )}
        </div>

        {keymap && selectedBinding ? (
          <div className="grid gap-4 overflow-y-auto p-4">
            <div className="flex items-center gap-2 text-xs text-base-content/60">
              <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
              Changes stay local until Review.
            </div>

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
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center p-6 text-center">
            <div className="max-w-[15rem]">
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-line bg-base-100 text-base-content/55">
                <MousePointer2 aria-hidden="true" className="size-5" />
              </div>
              <p className="font-semibold">Choose a key</p>
              <p className="mt-1 text-sm leading-relaxed text-base-content/60">
                Select any key on the layout to assign a key press, shortcut,
                layer, or device action.
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
