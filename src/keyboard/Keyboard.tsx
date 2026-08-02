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
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

import { LayerPicker } from "./LayerPicker";
import { PhysicalLayoutPicker } from "./PhysicalLayoutPicker";
import { Keymap as KeymapComp } from "./Keymap";
import { useConnectedDeviceData } from "../rpc/useConnectedDeviceData";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { UndoRedoContext } from "../undoRedo";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import { produce } from "immer";
import { LockStateContext } from "../rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { deserializeLayoutZoom, LayoutZoom } from "./layoutZoom";
import { useLocalStorageState } from "../misc/useLocalStorageState";
import {
  Boxes,
  Cable,
  Cpu,
  Grid3X3,
  KeyboardIcon,
  Maximize2,
  MousePointer2,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

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

export default function Keyboard() {
  const [
    layouts,
    ,
    selectedPhysicalLayoutIndex,
    setSelectedPhysicalLayoutIndex,
  ] = useLayouts();
  const [keymap, setKeymap] = useConnectedDeviceData<Keymap>(
    { keymap: { getKeymap: true } },
    (keymap) => {
      console.log("Got the keymap!");
      return keymap?.keymap?.getKeymap;
    },
    true,
  );

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
        setKeymap(new_keymap);
      } else {
        console.error(
          "Failed to set the active physical layout err:",
          resp?.keymap?.setActivePhysicalLayout?.err,
        );
      }
    }

    performSetRequest();
  }, [conn.conn, layouts, selectedPhysicalLayoutIndex, setKeymap]);

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
      if (!keymap || selectedKeyPosition === undefined) {
        console.error(
          "Can't update binding without a selected key position and loaded keymap",
        );
        return;
      }

      const layer = selectedLayerIndex;
      const layerId = keymap.layers[layer].id;
      const keyPosition = selectedKeyPosition;
      const oldBinding = keymap.layers[layer].bindings[keyPosition];
      undoRedo?.(async () => {
        if (!conn.conn) {
          throw new Error("Not connected");
        }

        const resp = await call_rpc(conn.conn, {
          keymap: { setLayerBinding: { layerId, keyPosition, binding } },
        });

        if (
          resp.keymap?.setLayerBinding ===
          SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
        ) {
          setKeymap((current) =>
            current == null
              ? current
              : produce(current, (draft) => {
                  draft.layers[layer].bindings[keyPosition] = binding;
                }),
          );
        } else {
          console.error("Failed to set binding", resp.keymap?.setLayerBinding);
        }

        return async () => {
          if (!conn.conn) {
            return;
          }

          const resp = await call_rpc(conn.conn, {
            keymap: {
              setLayerBinding: { layerId, keyPosition, binding: oldBinding },
            },
          });
          if (
            resp.keymap?.setLayerBinding ===
            SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK
          ) {
            setKeymap((current) =>
              current == null
                ? current
                : produce(current, (draft) => {
                    draft.layers[layer].bindings[keyPosition] = oldBinding;
                  }),
            );
          }
        };
      });
    },
    [
      conn,
      keymap,
      selectedKeyPosition,
      selectedLayerIndex,
      setKeymap,
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

  const selectedBehavior = useMemo(
    () => (selectedBinding ? behaviors[selectedBinding.behaviorId] : undefined),
    [behaviors, selectedBinding],
  );

  const selectedLayer = keymap?.layers[selectedLayerIndex];

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
          setKeymap(resp.keymap?.moveLayer?.ok);
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
    [conn.conn, setKeymap, undoRedo],
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
        setKeymap((current) =>
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
        setKeymap((current) =>
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
  }, [conn, keymap, setKeymap, undoRedo]);

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
        setKeymap((current) =>
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
        setKeymap((current) =>
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
  }, [conn, keymap, selectedLayerIndex, setKeymap, undoRedo]);

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
          setKeymap((current) =>
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
    [conn, setKeymap, undoRedo],
  );

  useEffect(() => {
    if (!keymap?.layers) return;

    const layers = keymap.layers.length - 1;

    if (selectedLayerIndex > layers) {
      setSelectedLayerIndex(layers);
    }
  }, [keymap, selectedLayerIndex]);

  return (
    <div className="grid min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(26rem,1fr)_auto] overflow-auto bg-base-300 md:grid-cols-[12rem_minmax(0,1fr)] md:grid-rows-[minmax(24rem,1fr)_auto] xl:grid-cols-[13rem_minmax(0,1fr)_21rem] xl:grid-rows-1 xl:overflow-hidden">
      <aside className="border-b border-line bg-base-200 md:row-span-2 md:border-b-0 md:border-r xl:row-span-1">
        <nav aria-label="Workspace" className="border-b border-line p-3">
          <p className="mb-2 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-base-content/55">
            Workspace
          </p>
          <ul className="grid grid-cols-1 gap-1">
            <li>
              <button
                type="button"
                aria-current="page"
                className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-primary/10 px-2.5 text-left font-medium text-primary ring-1 ring-inset ring-primary/20"
              >
                <KeyboardIcon aria-hidden="true" className="size-4" />
                Keymap
              </button>
            </li>
            {[
              { label: "Actions", icon: Boxes },
              { label: "Smart Press", icon: Sparkles },
              { label: "Device", icon: Cpu },
              { label: "Settings", icon: Settings2 },
            ].map(({ label, icon: Icon }) => (
              <li key={label} className="hidden md:block">
                <button
                  type="button"
                  disabled
                  title={`${label} workspace is coming next`}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-base-content/45"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{label}</span>
                  <span className="ml-auto text-[0.625rem] font-semibold uppercase tracking-wide">
                    Soon
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-5 p-3">
          {layouts && (
            <PhysicalLayoutPicker
              layouts={layouts}
              selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
              onPhysicalLayoutClicked={doSelectPhysicalLayout}
            />
          )}

          {keymap && (
            <LayerPicker
              layers={keymap.layers}
              selectedLayerIndex={selectedLayerIndex}
              onLayerClicked={setSelectedLayerIndex}
              onLayerMoved={moveLayer}
              canAdd={(keymap.availableLayers || 0) > 0}
              canRemove={(keymap.layers?.length || 0) > 1}
              onAddClicked={addLayer}
              onRemoveClicked={removeLayer}
              onLayerNameChanged={changeLayerName}
            />
          )}
        </div>
      </aside>

      <main className="grid min-h-[26rem] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-base-300 md:min-h-0">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line bg-base-200 px-4 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-base-content/50">
              <Grid3X3 aria-hidden="true" className="size-3.5" />
              Active layer
            </div>
            <p className="truncate font-semibold text-base-content">
              {selectedLayer?.name || `Layer ${selectedLayerIndex}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          Select a key to inspect it. Changes are applied for testing and stay
          unsaved until you save them.
        </div>
      </main>

      <aside className="border-t border-line bg-base-200 md:col-start-2 xl:col-start-3 xl:row-start-1 xl:border-l xl:border-t-0">
        <div className="flex min-h-14 items-center justify-between border-b border-line px-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-base-content/50">
              Inspector
            </p>
            <h2 className="font-semibold">
              {selectedKeyPosition === undefined
                ? "No key selected"
                : `Key ${selectedKeyPosition + 1}`}
            </h2>
          </div>
          {selectedKeyPosition !== undefined && (
            <span className="rounded-full border border-line bg-base-100 px-2 py-1 font-mono text-[0.6875rem] text-base-content/60">
              K{String(selectedKeyPosition).padStart(2, "0")}
            </span>
          )}
        </div>

        {keymap && selectedBinding ? (
          <div className="grid gap-5 p-4">
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm text-base-content">
              <p className="font-semibold text-warning">Live testing</p>
              <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                Assignments are sent to the keyboard immediately, but are not
                permanent until you choose Save to keyboard.
              </p>
            </div>

            <BehaviorBindingPicker
              binding={selectedBinding}
              behaviors={Object.values(behaviors)}
              layers={keymap.layers.map(({ id, name }, li) => ({
                id,
                name: name || li.toLocaleString(),
              }))}
              onBindingChanged={doUpdateBinding}
            />

            <details className="group rounded-xl border border-line bg-base-100">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <Search
                  aria-hidden="true"
                  className="size-4 text-base-content/55"
                />
                Advanced ZMK details
                <span className="ml-auto font-mono text-[0.625rem] font-normal uppercase tracking-wide text-base-content/45">
                  Raw
                </span>
              </summary>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t border-line px-3 py-3 text-xs">
                <dt className="text-base-content/55">Display name</dt>
                <dd className="text-right font-medium">
                  {selectedBehavior?.displayName || "Unknown behavior"}
                </dd>
                <dt className="text-base-content/55">Runtime ID</dt>
                <dd className="font-mono tabular-nums">
                  {selectedBinding.behaviorId}
                </dd>
                <dt className="text-base-content/55">Parameter 1</dt>
                <dd className="font-mono tabular-nums">
                  0x{selectedBinding.param1.toString(16).padStart(8, "0")}
                </dd>
                <dt className="text-base-content/55">Parameter 2</dt>
                <dd className="font-mono tabular-nums">
                  0x{selectedBinding.param2.toString(16).padStart(8, "0")}
                </dd>
              </dl>
            </details>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center p-6 text-center">
            <div className="max-w-[15rem]">
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-line bg-base-100 text-base-content/55">
                <MousePointer2 aria-hidden="true" className="size-5" />
              </div>
              <p className="font-semibold">Choose a key</p>
              <p className="mt-1 text-sm leading-relaxed text-base-content/60">
                Select any key on the layout to see its action and available
                parameters.
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
