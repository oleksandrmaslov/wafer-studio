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
import type {
  DraftApplyResult,
  DraftChangeSummary,
} from "./keyboard/keymapDraft";
import { WaferMark } from "./WaferMark";

export interface AppHeaderProps {
  connectedDeviceLabel?: string;
  onSave?: () => void | boolean | Promise<void | boolean>;
  onDiscard?: () => void | Promise<void>;
  onUndo?: () => Promise<void>;
  onRedo?: () => Promise<void>;
  onResetSettings?: () => void | Promise<void>;
  onDisconnect?: () => void | Promise<void>;
  onShowAbout?: () => void;
  onShowLicenseNotice?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  draftCount?: number;
  draftChanges?: DraftChangeSummary[];
  draftErrors?: string[];
  draftIsApplying?: boolean;
  onApplyDraft?: () => Promise<DraftApplyResult>;
  onDiscardDraft?: () => void;
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
  onShowAbout,
  onShowLicenseNotice,
  draftCount = 0,
  draftChanges = [],
  draftErrors = [],
  draftIsApplying = false,
  onApplyDraft,
  onDiscardDraft,
}: AppHeaderProps) => {
  const [showSettingsReset, setShowSettingsReset] = useState(false);
  const [showDraftReview, setShowDraftReview] = useState(false);
  const [applyResult, setApplyResult] = useState<DraftApplyResult>();
  const [isApplying, setIsApplying] = useState(false);

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
  const draftReviewRef = useModalRef(showDraftReview);
  const [unsaved, setUnsaved] = useConnectedDeviceData<boolean>(
    { keymap: { checkUnsavedChanges: true } },
    (r) => r.keymap?.checkUnsavedChanges,
  );

  useSub("rpc_notification.keymap.unsavedChangesStatusChanged", (unsaved) =>
    setUnsaved(unsaved),
  );

  const hasDraft = draftCount > 0;
  const applying = isApplying || draftIsApplying;

  const startApply = async () => {
    if (!onApplyDraft || applying || draftErrors.length > 0) return;

    setApplyResult(undefined);
    setIsApplying(true);
    try {
      const result = await onApplyDraft();
      setApplyResult(result);
      if (result.ok) setUnsaved(result.deviceUnsaved);
    } finally {
      setIsApplying(false);
    }
  };

  const savePermanently = async () => {
    const saved = await onSave?.();
    if (saved !== false) {
      setUnsaved(false);
      setShowDraftReview(false);
    }
  };

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
            This removes customizations stored on the keyboard and restores its
            stock keymap. This action cannot be undone from Wafer Studio.
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
      <GenericModal
        ref={draftReviewRef}
        onClose={() => {
          if (!applying) setShowDraftReview(false);
        }}
        className="max-h-[min(44rem,calc(100dvh-2rem))] w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden open:flex"
      >
        <div className="border-b border-line px-5 py-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">
            Local draft
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {applyResult?.ok
              ? "Changes applied"
              : `Review ${draftCount} key ${draftCount === 1 ? "change" : "changes"}`}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-base-content/60">
            {applyResult?.ok
              ? "The keyboard is using this keymap for testing. It is not permanent yet."
              : "Nothing is sent until you apply this ordered change list."}
          </p>
        </div>

        {!applyResult?.ok && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {draftErrors.length > 0 && (
              <div className="mb-4 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
                <p className="font-semibold">Draft needs attention</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                  {draftErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {applyResult && !applyResult.ok && (
              <div className="mb-4 rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm">
                <p className="font-semibold text-warning">Apply stopped</p>
                <p className="mt-1 text-xs leading-relaxed text-base-content/70">
                  {applyResult.message}
                </p>
                <p className="mt-2 font-mono text-[0.6875rem] text-base-content/55">
                  {applyResult.appliedCount} applied ·{" "}
                  {applyResult.remainingCount} remaining
                </p>
              </div>
            )}

            <ol className="grid gap-2">
              {draftChanges.map((change) => (
                <li
                  key={`${change.layerId}:${change.keyPosition}`}
                  className="rounded-xl border border-line bg-base-100 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold">{change.layerName}</span>
                    <span className="font-mono text-base-content/50">
                      K{String(change.keyPosition).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                    <span
                      className="truncate text-base-content/55"
                      title={change.beforeLabel}
                    >
                      {change.beforeLabel}
                    </span>
                    <span aria-hidden="true" className="text-base-content/35">
                      →
                    </span>
                    <span
                      className="truncate font-semibold text-primary"
                      title={change.afterLabel}
                    >
                      {change.afterLabel}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {applyResult?.ok ? (
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            <Button
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold outline-none hover:bg-base-300 rac-focus-visible:ring-2 rac-focus-visible:ring-focus"
              onPress={() => setShowDraftReview(false)}
            >
              Keep testing
            </Button>
            <Button
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-content outline-none hover:bg-wafer-deep rac-focus-visible:ring-2 rac-focus-visible:ring-focus"
              onPress={savePermanently}
              isDisabled={!applyResult.deviceUnsaved}
            >
              Save permanently
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
            <Button
              className="min-h-11 rounded-lg px-4 text-sm font-semibold outline-none hover:bg-base-300 rac-disabled:opacity-40 rac-focus-visible:ring-2 rac-focus-visible:ring-focus"
              onPress={() => setShowDraftReview(false)}
              isDisabled={applying}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-content outline-none hover:bg-wafer-deep rac-disabled:cursor-not-allowed rac-disabled:bg-base-300 rac-disabled:text-base-content/40 rac-focus-visible:ring-2 rac-focus-visible:ring-focus"
              onPress={startApply}
              isDisabled={
                applying ||
                draftCount === 0 ||
                draftErrors.length > 0 ||
                draftChanges.length === 0
              }
            >
              {applying
                ? "Applying…"
                : `Apply ${draftCount} ${draftCount === 1 ? "change" : "changes"}`}
            </Button>
          </div>
        )}
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
              isDisabled={hasDraft || applying}
            >
              Disconnect
            </MenuItem>
            <MenuItem
              className="flex min-h-10 items-center rounded-lg px-3 text-sm text-danger outline-none hover:bg-danger/10 rac-focus:bg-danger/10"
              onAction={() => setShowSettingsReset(true)}
              isDisabled={hasDraft || applying}
            >
              Restore Stock Settings
            </MenuItem>
            <MenuItem
              className="mt-1 flex min-h-10 items-center rounded-lg border-t border-line px-3 pt-1 text-sm outline-none hover:bg-base-300 rac-focus:bg-base-300"
              onAction={onShowAbout}
            >
              About Wafer Studio
            </MenuItem>
            <MenuItem
              className="flex min-h-10 items-center rounded-lg px-3 text-sm outline-none hover:bg-base-300 rac-focus:bg-base-300"
              onAction={onShowLicenseNotice}
            >
              Open-source notices
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>

      <div className="ml-auto hidden min-w-0 items-center gap-2 lg:flex">
        {hasDraft ? (
          <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            Draft · {draftCount} {draftCount === 1 ? "change" : "changes"}
          </div>
        ) : unsaved === undefined ? (
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
        <Tooltip
          label={hasDraft ? "Discard local draft" : "Revert applied changes"}
        >
          <Button
            className="hidden min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-base-content/65 outline-none hover:bg-base-300 rac-disabled:opacity-35 rac-focus-visible:ring-2 rac-focus-visible:ring-focus sm:flex"
            isDisabled={hasDraft ? applying : !unsaved}
            onPress={hasDraft ? onDiscardDraft : onDiscard}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <span className="hidden xl:inline">
              {hasDraft ? "Discard draft" : "Revert"}
            </span>
          </Button>
        </Tooltip>
        <Tooltip
          label={hasDraft ? "Review and apply draft" : "Save permanently"}
        >
          <Button
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-content shadow-[inset_0_-2px_0_rgba(158,50,31,0.35)] outline-none transition hover:bg-wafer-deep rac-disabled:cursor-not-allowed rac-disabled:bg-base-300 rac-disabled:text-base-content/35 rac-disabled:shadow-none rac-focus-visible:ring-2 rac-focus-visible:ring-focus rac-focus-visible:ring-offset-2 sm:px-4"
            onPress={() => {
              if (hasDraft) {
                setApplyResult(undefined);
                setShowDraftReview(true);
              } else {
                void savePermanently();
              }
            }}
            isDisabled={hasDraft ? applying : !unsaved}
          >
            <Save aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">
              {hasDraft ? "Review & apply" : "Save permanently"}
            </span>
            <span className="sm:hidden">{hasDraft ? "Apply" : "Save"}</span>
          </Button>
        </Tooltip>
      </div>
    </header>
  );
};
