// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from "react";

import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";
import { ArrowLeft, Bluetooth, Download, RefreshCw, Usb } from "lucide-react";
import { Key, ListBox, ListBoxItem, Selection } from "react-aria-components";

import { GenericModal } from "./GenericModal";
import { ExternalLink } from "./misc/ExternalLink";
import { useModalRef } from "./misc/useModalRef";
import type { AvailableDevice } from "./tauri/index";
import { WaferMark } from "./WaferMark";

export type TransportFactory = {
  label: string;
  isWireless?: boolean;
  connect?: () => Promise<RpcTransport>;
  pick_and_connect?: {
    list: () => Promise<Array<AvailableDevice>>;
    connect: (dev: AvailableDevice) => Promise<RpcTransport>;
  };
};

export interface ConnectModalProps {
  open?: boolean;
  transports: TransportFactory[];
  onTransportCreated: (t: RpcTransport) => void;
  onExploreDemo?: () => void;
  connectionError?: string;
}

interface PickerProps {
  transports: TransportFactory[];
  onTransportCreated: (t: RpcTransport) => void;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We could not open that connection. Check the keyboard and try again.";
}

function InlineError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="mt-3 rounded-xl border border-danger/35 bg-danger/10 px-3 py-2.5 text-sm text-danger"
    >
      <span aria-hidden="true" className="mr-2 font-black">
        !
      </span>
      {message}
    </div>
  );
}

/**
 * The two ways a keyboard can be reached, as a fixed pair.
 *
 * Both are always drawn, whether or not this build can use them. Rendering only
 * the transports that happen to work meant a browser showed a single "USB" card
 * and nothing else — so the fact that Bluetooth *exists at all* was information
 * you could only get by already knowing it. An unavailable card that says why,
 * and offers the thing that would make it work, is the whole point.
 */
const CONNECTION_KINDS = [
  {
    id: "USB",
    label: "USB",
    icon: Usb,
    blurb: "The most reliable way to edit and test your keymap.",
    /** Shown in place of the blurb when this build cannot offer it. */
    unavailable: "Needs a current Chrome or Edge browser.",
  },
  {
    id: "BLE",
    label: "Bluetooth",
    icon: Bluetooth,
    blurb: "Pair without a cable.",
    unavailable:
      "Browsers only expose Web Bluetooth for this on Linux. The desktop app has it everywhere.",
  },
] as const;

function ConnectionCard({
  kind,
  transport,
  isBusy,
  isDisabled,
  onChoose,
}: {
  kind: (typeof CONNECTION_KINDS)[number];
  transport?: TransportFactory;
  isBusy: boolean;
  isDisabled: boolean;
  onChoose: () => void;
}) {
  const Icon = kind.icon;

  if (!transport) {
    return (
      <div className="flex min-h-40 flex-col justify-between gap-3 rounded-2xl border border-dashed border-line bg-canvas/60 p-4">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-raised/50 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-tertiary">
          <Icon aria-hidden="true" className="size-3.5" />
          {kind.label}
        </span>
        <span>
          <span className="block font-bold text-muted">Not available here</span>
          <span className="mt-1 block text-xs leading-4 text-tertiary">
            {kind.unavailable}
          </span>
        </span>
        {/* The card is inert, but the way out of it is not. This is the only
            place someone learns the desktop app exists at the moment they
            have a reason to want it. */}
        <a
          href={`${import.meta.env.BASE_URL}download.html`}
          className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-xl border border-line bg-raised/70 px-3 text-xs font-bold !text-ink no-underline transition hover:border-wafer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Download aria-hidden="true" className="size-3.5" />
          Get the desktop app
        </a>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-busy={isBusy}
      disabled={isDisabled}
      onClick={onChoose}
      className="group flex min-h-40 w-full flex-col items-start justify-between gap-3 rounded-2xl border border-line bg-raised/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-wafer hover:shadow-[0_10px_28px_rgb(var(--light-shadow)/0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised/70 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">
          <Icon aria-hidden="true" className="size-3.5" />
          {kind.label}
        </span>
        <span
          aria-hidden="true"
          className="text-lg text-accent-foreground transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </span>
      <span>
        <span className="block font-bold text-ink">
          {isBusy
            ? "Waiting for approval…"
            : transport.pick_and_connect
              ? `Browse ${kind.label} keyboards`
              : `Connect over ${kind.label}`}
        </span>
        <span className="mt-1 block text-xs leading-4 text-muted">
          {kind.blurb}
        </span>
      </span>
    </button>
  );
}

function DeviceList({
  transports,
  onTransportCreated,
  open,
}: PickerProps & { open: boolean }) {
  const [devices, setDevices] = useState<
    Array<[TransportFactory, AvailableDevice]>
  >([]);
  const [selectedDev, setSelectedDev] = useState(new Set<Key>());
  const [refreshing, setRefreshing] = useState(false);
  const [connectingId, setConnectingId] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const entries: Array<[TransportFactory, AvailableDevice]> = [];

      for (const transport of transports.filter(
        (candidate) => candidate.pick_and_connect,
      )) {
        const available = await transport.pick_and_connect?.list();
        if (available) {
          entries.push(
            ...available.map<[TransportFactory, AvailableDevice]>((device) => [
              transport,
              device,
            ]),
          );
        }
      }

      setDevices(entries);
    } catch (loadError) {
      setDevices([]);
      setError(describeError(loadError));
    } finally {
      setRefreshing(false);
    }
  }, [transports]);

  useEffect(() => {
    setSelectedDev(new Set());
    setDevices([]);
    setConnectingId(null);
    void loadDevices();
  }, [loadDevices, open]);

  const onRefresh = useCallback(() => {
    setSelectedDev(new Set());
    setDevices([]);
    void loadDevices();
  }, [loadDevices]);

  const onSelect = useCallback(
    async (keys: Selection) => {
      if (keys === "all" || connectingId !== null) {
        return;
      }

      setSelectedDev(keys);
      const entry = devices.find(([, device]) => keys.has(device.id));
      if (!entry) {
        return;
      }

      const [transport, device] = entry;
      setConnectingId(device.id);
      setError(null);

      try {
        const connection = await transport.pick_and_connect!.connect(device);
        onTransportCreated(connection);
      } catch (connectionError) {
        if (!(connectionError instanceof UserCancelledError)) {
          setError(describeError(connectionError));
        }
      } finally {
        setConnectingId(null);
        setSelectedDev(new Set());
      }
    },
    [connectingId, devices, onTransportCreated],
  );

  return (
    <section aria-labelledby="available-keyboards-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="available-keyboards-heading"
            className="text-sm font-bold text-ink"
          >
            Available keyboards
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            Choose a nearby keyboard to connect.
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh available keyboards"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-raised/70 text-muted transition hover:border-wafer hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            aria-hidden="true"
            className={["size-5", refreshing && "animate-spin"]
              .filter(Boolean)
              .join(" ")}
          />
        </button>
      </div>

      <ListBox
        aria-label="Available keyboards"
        items={devices}
        onSelectionChange={onSelect}
        selectionMode="single"
        selectedKeys={selectedDev}
        className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto"
      >
        {([transport, device]) => (
          <ListBoxItem
            id={device.id}
            aria-label={[device.label, transport.label].join(", ")}
            className="group grid min-h-16 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-line bg-raised/65 px-4 py-3 outline-none transition hover:-translate-y-0.5 hover:border-wafer hover:shadow-[0_8px_24px_rgb(var(--light-shadow)/0.28)] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 rac-selected:border-wafer rac-selected:bg-selected"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-canvas text-muted">
              {transport.isWireless ? (
                <Bluetooth aria-hidden="true" className="size-4" />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-[0.62rem] font-black tracking-wide"
                >
                  USB
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">
                {device.label}
              </span>
              <span className="block truncate text-xs text-muted">
                {transport.label}
              </span>
            </span>
            <span className="text-xs font-bold text-accent-foreground">
              {connectingId === device.id ? "Connecting…" : "Connect"}
            </span>
          </ListBoxItem>
        )}
      </ListBox>

      {!refreshing && devices.length === 0 && !error && (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-canvas/75 px-4 py-5 text-center">
          <p className="font-semibold text-ink">No keyboards found yet</p>
          <p className="mt-1 text-sm leading-5 text-muted">
            Wake your keyboard, keep it nearby, then refresh the list.
          </p>
        </div>
      )}

      <InlineError message={error} />
    </section>
  );
}

function ConnectionKindPicker({
  transports,
  onTransportCreated,
  open,
}: PickerProps & { open: boolean }) {
  const [connectingLabel, setConnectingLabel] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState<TransportFactory | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reopening the dialog after a failed connection should not drop you back
  // into the device list of whatever you tried last.
  useEffect(() => {
    setBrowsing(null);
    setError(null);
  }, [open]);

  const connectTransport = useCallback(
    async (transport: TransportFactory) => {
      if (!transport.connect) {
        setError("This connection is not available on this device.");
        return;
      }

      setConnectingLabel(transport.label);
      setError(null);

      try {
        const connection = await transport.connect();
        onTransportCreated(connection);
      } catch (connectionError) {
        if (!(connectionError instanceof UserCancelledError)) {
          setError(describeError(connectionError));
        }
      } finally {
        setConnectingLabel(null);
      }
    },
    [onTransportCreated],
  );

  // A transport that lists devices first (desktop) drills into the scan list;
  // one that connects straight through (the browser's own picker) does not.
  const choose = useCallback(
    (transport: TransportFactory) => {
      setError(null);
      if (transport.pick_and_connect) {
        setBrowsing(transport);
        return;
      }
      void connectTransport(transport);
    },
    [connectTransport],
  );

  if (browsing) {
    return (
      <section aria-labelledby="connection-method-heading">
        <button
          type="button"
          onClick={() => setBrowsing(null)}
          className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All connections
        </button>
        <DeviceList
          open
          transports={[browsing]}
          onTransportCreated={onTransportCreated}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="connection-method-heading">
      <h2 id="connection-method-heading" className="text-sm font-bold">
        Choose how to connect
      </h2>
      <p className="mt-1 text-sm leading-5 text-muted">
        You approve a specific keyboard for this session. Nothing is scanned
        until you pick one.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {CONNECTION_KINDS.map((kind) => {
          const transport = transports.find(
            (candidate) => candidate.label === kind.id,
          );

          return (
            <li key={kind.id}>
              <ConnectionCard
                kind={kind}
                transport={transport}
                isBusy={connectingLabel === kind.id}
                isDisabled={connectingLabel !== null}
                onChoose={() => transport && choose(transport)}
              />
            </li>
          );
        })}
      </ul>
      <InlineError message={error} />
    </section>
  );
}

function NoTransportsOptionsPrompt() {
  return (
    <section
      aria-labelledby="unsupported-browser-heading"
      className="rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5"
    >
      <p id="unsupported-browser-heading" className="font-bold text-warning">
        This browser cannot connect to a keyboard
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        Wafer Studio connects using{" "}
        <ExternalLink href="https://caniuse.com/web-serial">
          Web Serial
        </ExternalLink>{" "}
        or{" "}
        <ExternalLink href="https://caniuse.com/web-bluetooth">
          Web Bluetooth
        </ExternalLink>{" "}
        where the platform supports it.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-5 text-muted">
        <li>Open this page in a current Chrome or Edge browser, or</li>
        <li>
          download the{" "}
          <ExternalLink href={`${import.meta.env.BASE_URL}download.html`}>
            desktop application
          </ExternalLink>
          .
        </li>
      </ul>
    </section>
  );
}

/**
 * One entry point for every build.
 *
 * This used to fork: a browser got a grid of transport buttons, desktop got a
 * flat scan list of everything within range. Two different first screens for
 * the same question, and the desktop one skipped straight past the choice of
 * *how* to connect — so a BLE keyboard and a USB one arrived in the same
 * undifferentiated list. Now both start from the same pair of cards.
 */
function ConnectOptions({
  transports,
  onTransportCreated,
  open,
}: PickerProps & { open: boolean }) {
  return (
    <ConnectionKindPicker
      open={open}
      transports={transports}
      onTransportCreated={onTransportCreated}
    />
  );
}

export const ConnectModal = ({
  open,
  transports,
  onTransportCreated,
  onExploreDemo,
  connectionError,
}: ConnectModalProps) => {
  const dialog = useModalRef(open || false, false, false);
  const haveTransports = useMemo(() => transports.length > 0, [transports]);

  return (
    <GenericModal
      ref={dialog}
      className="w-[min(46rem,calc(100vw-2rem))] [&_a]:!text-accent-foreground"
    >
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WaferMark />
            <span className="rounded-full border border-line bg-raised/65 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">
              Compatible with ZMK Studio
            </span>
          </div>
          <div className="mt-7 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-foreground">
              Keyboard workspace
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.035em] text-ink sm:text-4xl">
              Make your keyboard feel like yours.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted sm:text-base">
              Connect a ZMK Studio-enabled keyboard to remap keys, explore
              layers, and build a layout that fits the way you work.
            </p>
          </div>
        </header>

        <div aria-hidden="true" className="h-px bg-line" />

        {haveTransports ? (
          <ConnectOptions
            open={open || false}
            transports={transports}
            onTransportCreated={onTransportCreated}
          />
        ) : (
          <NoTransportsOptionsPrompt />
        )}

        <InlineError message={connectionError || null} />

        {onExploreDemo && (
          <div className="relative pt-2">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 h-px bg-line"
            />
            <span className="relative mx-auto block w-fit bg-panel px-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">
              No keyboard nearby?
            </span>
            <button
              type="button"
              onClick={onExploreDemo}
              className="relative mt-4 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl wafer-accent px-5 py-3 text-sm font-black shadow-[0_8px_20px_rgb(var(--wafer-primary)/0.18)] transition hover:shadow-[0_10px_26px_rgb(var(--wafer-primary)/0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:translate-y-px"
            >
              Explore demo keyboard
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        <aside className="flex gap-3 rounded-2xl bg-canvas px-4 py-3.5">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full border border-success/30 bg-success/10 px-2 text-[0.58rem] font-black uppercase tracking-[0.12em] text-success"
          >
            Local
          </span>
          <div>
            <p className="text-sm font-bold text-ink">
              Your keymap stays in your hands
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              Connection and editing happen locally. You choose which keyboard
              this session may access.
            </p>
          </div>
        </aside>
      </div>
    </GenericModal>
  );
};
