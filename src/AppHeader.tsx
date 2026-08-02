import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { useConnectedDeviceData } from "./rpc/useConnectedDeviceData";
import { useSub } from "./usePubSub";
import { useContext, useEffect, useState } from "react";
import { useModalRef } from "./misc/useModalRef";
import { LockStateContext } from "./rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { ConnectionContext } from "./rpc/ConnectionContext";
import {
  Check,
  ChevronDown,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { Tooltip } from "./misc/Tooltip";
import { GenericModal } from "./GenericModal";
import { WaferMark } from "./WaferMark";

export interface AppHeaderProps {
  connectedDeviceLabel?: string;
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void | Promise<void>;
  onUndo?: () => Promise<void>;
  onRedo?: () => Promise<void>;
  onResetSettings?: () => void | Promise<void>;
  onDisconnect?: () => void | Promise<void>;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const AppHeader = ({
  connectedDeviceLabel,
  canRedo,
  canUndo,
  onRedo,
  onUndo,
  onSave,
  onDiscard,
  onDisconnect,
  onResetSettings,
}: AppHeaderProps) => {
  const [showSettingsReset, setShowSettingsReset] = useState(false);

  const lockState = useContext(LockStateContext);
  const connectionState = useContext(ConnectionContext);

  useEffect(() => {
    if (
      (!connectionState.conn ||
        lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) &&
      showSettingsReset
    ) {
      setShowSettingsReset(false);
    }
  }, [connectionState.conn, lockState, showSettingsReset]);

  const showSettingsRef = useModalRef(showSettingsReset);
  const [unsaved, setUnsaved] = useConnectedDeviceData<boolean>(
    { keymap: { checkUnsavedChanges: true } },
    (r) => r.keymap?.checkUnsavedChanges,
  );

  useSub("rpc_notification.keymap.unsavedChangesStatusChanged", (unsaved) =>
    setUnsaved(unsaved),
  );

  return (
    <header className="relative z-20 flex min-h-16 max-w-full items-center gap-2 border-b border-line bg-base-200 px-3 shadow-[0_1px_0_rgba(23,24,21,0.02)] sm:gap-3 sm:px-4">
      <WaferMark className="min-w-fit" compact />
      <GenericModal
        ref={showSettingsRef}
        className="w-[min(30rem,calc(100vw-2rem))]"
      >
        <h2 className="my-2 text-lg font-semibold">Restore stock settings?</h2>
        <div>
          <p className="max-w-md text-sm leading-relaxed text-base-content/65">
            This removes customizations stored through ZMK Studio and restores
            the keyboard&apos;s stock keymap. This action cannot be undone from
            Wafer Studio.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              className="min-h-11 rounded-lg px-4 text-sm font-semibold hover:bg-base-300"
              onPress={() => setShowSettingsReset(false)}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11 rounded-lg bg-danger px-4 text-sm font-semibold text-white hover:brightness-95"
              onPress={() => {
                setShowSettingsReset(false);
                onResetSettings?.();
              }}
            >
              Restore Stock Settings
            </Button>
          </div>
        </div>
      </GenericModal>
      <MenuTrigger>
        <Button
          className="ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-raised px-2.5 text-left outline-none transition hover:border-base-content/25 hover:bg-base-100 rac-disabled:opacity-0 rac-focus-visible:ring-2 rac-focus-visible:ring-focus sm:px-3"
          isDisabled={!connectedDeviceLabel}
        >
          <span
            aria-label="Connected"
            className="size-2 shrink-0 rounded-full bg-success ring-4 ring-success/10"
          />
          <span className="min-w-0">
            <span className="block max-w-20 truncate text-sm font-semibold sm:max-w-44">
              {connectedDeviceLabel}
            </span>
            <span className="hidden text-[0.625rem] font-medium uppercase tracking-wide text-base-content/45 sm:block">
              Connected
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-base-content/45"
          />
        </Button>
        <Popover className="min-w-[var(--trigger-width)] rounded-xl border border-line bg-raised p-1 text-base-content shadow-xl outline-none">
          <Menu className="cursor-pointer overflow-hidden outline-none">
            <MenuItem
              className="flex min-h-10 items-center rounded-lg px-3 text-sm outline-none hover:bg-base-300 rac-focus:bg-base-300"
              onAction={onDisconnect}
            >
              Disconnect
            </MenuItem>
            <MenuItem
              className="flex min-h-10 items-center rounded-lg px-3 text-sm text-danger outline-none hover:bg-danger/10 rac-focus:bg-danger/10"
              onAction={() => setShowSettingsReset(true)}
            >
              Restore Stock Settings
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>

      <div className="ml-auto hidden min-w-0 items-center gap-2 lg:flex">
        {unsaved === undefined ? (
          <div className="px-2 text-xs font-medium text-base-content/45">
            Reading keyboard state…
          </div>
        ) : unsaved ? (
          <div className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
            Applied, not saved
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-success">
            <Check aria-hidden="true" className="size-3.5" />
            Saved on keyboard
          </div>
        )}
      </div>

      <div className="ml-auto flex justify-end gap-1 lg:ml-0">
        {onUndo && (
          <Tooltip label="Undo">
            <Button
              className="hidden min-h-11 min-w-11 place-items-center rounded-lg text-base-content/65 outline-none hover:bg-base-300 rac-disabled:opacity-35 rac-focus-visible:ring-2 rac-focus-visible:ring-focus sm:grid"
              isDisabled={!canUndo}
              onPress={onUndo}
            >
              <Undo2 className="size-4" aria-label="Undo" />
            </Button>
          </Tooltip>
        )}

        {onRedo && (
          <Tooltip label="Redo">
            <Button
              className="hidden min-h-11 min-w-11 place-items-center rounded-lg text-base-content/65 outline-none hover:bg-base-300 rac-disabled:opacity-35 rac-focus-visible:ring-2 rac-focus-visible:ring-focus sm:grid"
              isDisabled={!canRedo}
              onPress={onRedo}
            >
              <Redo2 className="size-4" aria-label="Redo" />
            </Button>
          </Tooltip>
        )}
        <Tooltip label="Revert changes">
          <Button
            className="hidden min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-base-content/65 outline-none hover:bg-base-300 rac-disabled:opacity-35 rac-focus-visible:ring-2 rac-focus-visible:ring-focus sm:flex"
            isDisabled={!unsaved}
            onPress={onDiscard}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <span className="hidden xl:inline">Revert</span>
          </Button>
        </Tooltip>
        <Tooltip label="Save to keyboard">
          <Button
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-content shadow-[inset_0_-2px_0_rgba(158,50,31,0.35)] outline-none transition hover:bg-wafer-deep rac-disabled:cursor-not-allowed rac-disabled:bg-base-300 rac-disabled:text-base-content/35 rac-disabled:shadow-none rac-focus-visible:ring-2 rac-focus-visible:ring-focus rac-focus-visible:ring-offset-2 sm:px-4"
            onPress={onSave}
            isDisabled={!unsaved}
          >
            <Save aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Save to keyboard</span>
            <span className="sm:hidden">Save</span>
          </Button>
        </Tooltip>
      </div>
    </header>
  );
};
