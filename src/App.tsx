// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import { AppHeader } from "./AppHeader";

import { create_rpc_connection } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "./rpc/logging";

import type { Notification } from "@zmkfirmware/zmk-studio-ts-client/studio";
import { ConnectionState, ConnectionContext } from "./rpc/ConnectionContext";
import {
  Dispatch,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Info, Scale, TriangleAlert, Unplug } from "lucide-react";
import { ConnectModal, TransportFactory } from "./ConnectModal";

import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { connect as gatt_connect } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import { connect as serial_connect } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import {
  connect as tauri_ble_connect,
  list_devices as ble_list_devices,
} from "./tauri/ble";
import {
  connect as tauri_serial_connect,
  list_devices as serial_list_devices,
} from "./tauri/serial";
import Keyboard from "./keyboard/Keyboard";
import { UndoRedoContext, useUndoRedo } from "./undoRedo";
import { usePub as getPublisher, useSub } from "./usePubSub";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { LockStateContext } from "./rpc/LockStateContext";
import { UnlockModal } from "./UnlockModal";
import { valueAfter } from "./misc/async";
// Split out of the initial bundle. About carries the full licence and notice
// text plus every sponsor logo, none of which is needed to edit a keymap, and
// it opens only when someone deliberately asks for it.
const AboutModal = lazy(() =>
  import("./AboutModal").then((m) => ({ default: m.AboutModal }))
);
import { LicenseNoticeModal } from "./misc/LicenseNoticeModal";
import { createMockRpcTransport } from "./rpc/mockTransport";
import type {
  DraftApplyResult,
  KeymapDraftController,
} from "./keyboard/keymapDraft";
import { CommandPaletteProvider } from "./design-system/CommandPalette";
import { useCommands, type Command } from "./design-system/commandRegistry";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: object;
  }
}

const TRANSPORTS: TransportFactory[] = [
  navigator.serial && { label: "USB", connect: serial_connect },
  ...(navigator.bluetooth && navigator.userAgent.indexOf("Linux") >= 0
    ? [{ label: "BLE", connect: gatt_connect }]
    : []),
  ...(window.__TAURI_INTERNALS__
    ? [
        {
          label: "BLE",
          isWireless: true,
          pick_and_connect: {
            connect: tauri_ble_connect,
            list: ble_list_devices,
          },
        },
      ]
    : []),
  ...(window.__TAURI_INTERNALS__
    ? [
        {
          label: "USB",
          pick_and_connect: {
            connect: tauri_serial_connect,
            list: serial_list_devices,
          },
        },
      ]
    : []),
].filter((t) => t !== undefined);

async function listen_for_notifications(
  notification_stream: ReadableStream<Notification>,
  signal: AbortSignal,
): Promise<void> {
  const reader = notification_stream.getReader();
  const onAbort = () => {
    reader.cancel();
    reader.releaseLock();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  while (!signal.aborted) {
    const pub = getPublisher();

    try {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      console.log("Notification", value);
      pub("rpc_notification", value);

      const subsystem = Object.entries(value).find(
        (entry) => entry[1] !== undefined,
      );
      if (!subsystem) {
        continue;
      }

      const [subId, subData] = subsystem;
      const event = Object.entries(subData).find(
        (entry) => entry[1] !== undefined,
      );

      if (!event) {
        continue;
      }

      const [eventName, eventData] = event;
      const topic = ["rpc_notification", subId, eventName].join(".");

      pub(topic, eventData);
    } catch (e) {
      signal.removeEventListener("abort", onAbort);
      reader.releaseLock();
      throw e;
    }
  }

  signal.removeEventListener("abort", onAbort);
  reader.releaseLock();
  notification_stream.cancel();
}

async function connect(
  transport: RpcTransport,
  setConn: Dispatch<ConnectionState>,
  setConnectedDeviceName: Dispatch<string | undefined>,
  setConnectionError: Dispatch<string | undefined>,
  signal: AbortSignal,
) {
  setConnectionError(undefined);
  const conn = await create_rpc_connection(transport, { signal });

  const details = await Promise.race([
    call_rpc(conn, { core: { getDeviceInfo: true } })
      .then((r) => r?.core?.getDeviceInfo)
      .catch((e) => {
        console.error("Failed first RPC call", e);
        return undefined;
      }),
    valueAfter(undefined, 1000),
  ]);

  if (!details) {
    setConnectionError(
      "Wafer Studio could not read this keyboard. Reconnect it and try again.",
    );
    return;
  }

  listen_for_notifications(conn.notification_readable, signal)
    .then(() => {
      setConnectedDeviceName(undefined);
      setConn({ conn: null });
    })
    .catch(() => {
      setConnectedDeviceName(undefined);
      setConn({ conn: null });
    });

  setConnectedDeviceName(
    transport.label.toLocaleLowerCase().includes("demo")
      ? `${details.name} · Demo`
      : details.name,
  );
  setConnectionError(undefined);
  setConn({ conn });
}

/**
 * Connection and firmware commands.
 *
 * A child component rather than part of `App`, because registering requires the
 * context that `App` itself provides — and because this is exactly where the
 * destructive pair belongs: out of the header menu where `resetSettings` sat
 * two rows below "About".
 */
function ShellCommands({
  onDisconnect,
  onResetSettings,
  onShowAbout,
  onShowLicenseNotice,
  connected,
}: {
  onDisconnect: () => void;
  onResetSettings: () => void;
  onShowAbout: () => void;
  onShowLicenseNotice: () => void;
  connected: boolean;
}) {
  const commands = useMemo<Command[]>(
    () => [
      {
        id: "shell.about",
        label: "About Wafer Studio",
        section: "Application",
        icon: Info,
        run: onShowAbout,
      },
      {
        // Registered here rather than left in the header, which no longer has a
        // menu to hold it. This one is not optional the way a convenience row
        // is: the project ships a NOTICE file and the attributions in it have to
        // stay reachable from the running application.
        id: "shell.licenses",
        label: "Open-source notices",
        section: "Application",
        icon: Scale,
        keywords: "license licence attribution notice legal",
        run: onShowLicenseNotice,
      },
      {
        id: "shell.disconnect",
        label: "Disconnect keyboard",
        section: "Connection",
        icon: Unplug,
        disabled: !connected,
        run: onDisconnect,
      },
      {
        id: "shell.reset",
        label: "Reset keyboard settings",
        section: "Connection",
        icon: TriangleAlert,
        keywords: "erase wipe factory defaults",
        hint: "cannot be undone",
        destructive: true,
        disabled: !connected,
        run: onResetSettings,
      },
    ],
    [
      connected,
      onDisconnect,
      onResetSettings,
      onShowAbout,
      onShowLicenseNotice,
    ],
  );

  useCommands(commands);
  return null;
}

function App() {
  const [conn, setConn] = useState<ConnectionState>({ conn: null });
  const [connectedDeviceName, setConnectedDeviceName] = useState<
    string | undefined
  >(undefined);
  const [doIt, undo, redo, canUndo, canRedo, reset] = useUndoRedo();
  const [showAbout, setShowAbout] = useState(false);
  const [showLicenseNotice, setShowLicenseNotice] = useState(false);
  const [connectionError, setConnectionError] = useState<string>();
  const [connectionAbort, setConnectionAbort] = useState(new AbortController());
  const [draftController, setDraftController] =
    useState<KeymapDraftController>();
  const autoDemoStarted = useRef(false);

  const [lockState, setLockState] = useState<LockState>(
    LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
  );

  useSub("rpc_notification.core.lockStateChanged", (ls) => {
    setLockState(ls);
  });

  useEffect(() => {
    if (!conn.conn) {
      reset();
      setLockState(LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED);
    }

    async function updateLockState() {
      if (!conn.conn) {
        return;
      }

      const locked_resp = await call_rpc(conn.conn, {
        core: { getLockState: true },
      });

      setLockState(
        locked_resp.core?.getLockState ||
          LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
      );
    }

    updateLockState();
  }, [conn, reset, setLockState]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!conn.conn) {
      return false;
    }

    const resp = await call_rpc(conn.conn, { keymap: { saveChanges: true } });
    if (!resp.keymap?.saveChanges || resp.keymap?.saveChanges.err) {
      console.error("Failed to save changes", resp.keymap?.saveChanges);
      return false;
    }

    return true;
  }, [conn]);

  const discard = useCallback(() => {
    async function doDiscard() {
      if (!conn.conn) {
        return;
      }

      const resp = await call_rpc(conn.conn, {
        keymap: { discardChanges: true },
      });
      if (!resp.keymap?.discardChanges) {
        console.error("Failed to discard changes", resp);
      }

      reset();
      setConn({ conn: conn.conn });
    }

    doDiscard();
  }, [conn, reset]);

  const resetSettings = useCallback(() => {
    async function doReset() {
      if (!conn.conn) {
        return;
      }

      const resp = await call_rpc(conn.conn, {
        core: { resetSettings: true },
      });
      if (!resp.core?.resetSettings) {
        console.error("Failed to settings reset", resp);
      }

      reset();
      setConn({ conn: conn.conn });
    }

    doReset();
  }, [conn, reset]);

  const disconnect = useCallback(() => {
    async function doDisconnect() {
      if (!conn.conn) {
        return;
      }

      await conn.conn.request_writable.close();
      connectionAbort.abort("User disconnected");
      setConnectionAbort(new AbortController());
    }

    doDisconnect();
  }, [conn, connectionAbort]);

  const onConnect = useCallback(
    (t: RpcTransport) => {
      const ac = new AbortController();
      setConnectionAbort(ac);
      connect(
        t,
        setConn,
        setConnectedDeviceName,
        setConnectionError,
        ac.signal,
      );
    },
    [setConn, setConnectedDeviceName],
  );

  const onExploreDemo = useCallback(
    () => onConnect(createMockRpcTransport()),
    [onConnect],
  );

  const applyDraft = useCallback(async (): Promise<DraftApplyResult> => {
    if (!draftController) {
      return {
        ok: false,
        appliedCount: 0,
        remainingCount: 0,
        message: "No key draft is available.",
      };
    }

    const result = await draftController.apply();
    if (result.ok || result.appliedCount > 0) reset();
    return result;
  }, [draftController, reset]);

  const discardDraft = useCallback(() => {
    draftController?.discard();
    reset();
  }, [draftController, reset]);

  useEffect(() => {
    if (
      !autoDemoStarted.current &&
      new URLSearchParams(window.location.search).get("demo") === "1"
    ) {
      autoDemoStarted.current = true;
      onExploreDemo();
    }
  }, [onExploreDemo]);

  return (
    <ConnectionContext.Provider value={conn}>
      <LockStateContext.Provider value={lockState}>
        <UndoRedoContext.Provider value={doIt}>
          <UnlockModal />
          <ConnectModal
            open={!conn.conn}
            transports={TRANSPORTS}
            onTransportCreated={onConnect}
            onExploreDemo={onExploreDemo}
            connectionError={connectionError}
          />
          {/* Mounted only while open, so the chunk is fetched on first use.
              useModalRef opens the dialog from an effect, which still fires
              on mount, so nothing depends on a false-to-true transition. */}
          {showAbout && (
            <Suspense fallback={null}>
              <AboutModal open onClose={() => setShowAbout(false)} />
            </Suspense>
          )}
          <LicenseNoticeModal
            open={showLicenseNotice}
            onClose={() => setShowLicenseNotice(false)}
          />
          <CommandPaletteProvider>
            <ShellCommands
              connected={Boolean(conn.conn)}
              onDisconnect={disconnect}
              onResetSettings={resetSettings}
              onShowAbout={() => setShowAbout(true)}
              onShowLicenseNotice={() => setShowLicenseNotice(true)}
            />
            <div className="grid h-[100dvh] min-h-0 w-full max-w-[100vw] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-base-100 text-base-content">
              <AppHeader
                connectedDeviceLabel={connectedDeviceName}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onSave={save}
                onDiscard={discard}
                onDisconnect={disconnect}
                onResetSettings={resetSettings}
                onShowAbout={() => setShowAbout(true)}
                onShowLicenseNotice={() => setShowLicenseNotice(true)}
                draftCount={draftController?.draftCount || 0}
                draftChanges={draftController?.changes || []}
                draftErrors={draftController?.errors || []}
                draftIsApplying={draftController?.isApplying || false}
                onApplyDraft={applyDraft}
                onDiscardDraft={discardDraft}
              />
              <Keyboard onDraftStateChange={setDraftController} />
            </div>
          </CommandPaletteProvider>
        </UndoRedoContext.Provider>
      </LockStateContext.Provider>
    </ConnectionContext.Provider>
  );
}

export default App;
