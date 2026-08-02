import { useContext, useMemo } from "react";

import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

import { GenericModal } from "./GenericModal";
import { ExternalLink } from "./misc/ExternalLink";
import { useModalRef } from "./misc/useModalRef";
import { ConnectionContext } from "./rpc/ConnectionContext";
import { LockStateContext } from "./rpc/LockStateContext";
import type { AvailableDevice } from "./tauri/index";
import { WaferMark } from "./WaferMark";

export type TransportFactory = {
  label: string;
  connect?: () => Promise<RpcTransport>;
  pick_and_connect?: {
    list: () => Promise<Array<AvailableDevice>>;
    connect: (dev: AvailableDevice) => Promise<RpcTransport>;
  };
};

export interface UnlockModalProps {}

export const UnlockModal = () => {
  const connection = useContext(ConnectionContext);
  const lockState = useContext(LockStateContext);

  const open = useMemo(
    () =>
      !!connection.conn &&
      lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED,
    [connection, lockState],
  );
  const dialog = useModalRef(open, false, false);

  return (
    <GenericModal
      ref={dialog}
      className="w-[min(39rem,calc(100vw-2rem))] [&_a]:!text-accent-foreground"
    >
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WaferMark />
            <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-warning">
              Keyboard locked
            </span>
          </div>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-accent-foreground">
            Compatible with ZMK Studio
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.035em] text-ink sm:text-4xl">
            Unlock your keyboard to continue.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Wafer Studio is connected, but your keyboard is protecting its
            settings until you confirm access on the keyboard itself.
          </p>
        </header>

        <section
          aria-labelledby="unlock-steps-heading"
          aria-live="polite"
          className="rounded-2xl border border-line bg-raised/65 p-4 sm:p-5"
        >
          <h2 id="unlock-steps-heading" className="font-bold text-ink">
            Confirm on your keyboard
          </h2>
          <ol className="mt-4 space-y-4">
            <li className="grid grid-cols-[2rem_1fr] gap-3">
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center wafer-metal rounded-full text-xs font-black"
              >
                1
              </span>
              <div>
                <p className="font-semibold text-ink">
                  Keep this window open
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted">
                  Wafer Studio will detect the unlock automatically.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[2rem_1fr] gap-3">
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center wafer-metal rounded-full text-xs font-black"
              >
                2
              </span>
              <div>
                <p className="font-semibold text-ink">
                  Press your Studio Unlock key or combo
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted">
                  The exact shortcut is defined by your keyboard firmware.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[2rem_1fr] gap-3">
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-full bg-success text-xs font-black text-white"
              >
                3
              </span>
              <div>
                <p className="font-semibold text-ink">Start editing</p>
                <p className="mt-0.5 text-sm leading-5 text-muted">
                  This dialog closes as soon as the keyboard reports it is
                  unlocked.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <div className="rounded-2xl bg-canvas px-4 py-3.5">
          <p className="text-sm font-bold text-ink">
            A local security check
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Unlocking grants this local session access to Studio settings. It
            does not reset your keymap or install firmware.
          </p>
        </div>

        <p className="text-sm leading-6 text-muted">
          No unlock key configured? Follow the official{" "}
          <ExternalLink href="https://zmk.dev/docs/keymaps/behaviors/studio-unlock">
            Studio Unlock Behavior documentation
          </ExternalLink>
          .
        </p>
      </div>
    </GenericModal>
  );
};
