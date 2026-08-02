import { useCallback, useEffect, useMemo, useState } from "react";

import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";
import { Bluetooth, RefreshCw } from "lucide-react";
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
      className="mt-3 rounded-xl border border-[#B83A36]/35 bg-[#B83A36]/10 px-3 py-2.5 text-sm text-[#7F2623]"
    >
      <span aria-hidden="true" className="mr-2 font-black">
        !
      </span>
      {message}
    </div>
  );
}

function TransportBadge({ wireless }: { wireless?: boolean }) {
  return wireless ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5D1C6] bg-white/70 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#5D6059]">
      <Bluetooth aria-hidden="true" className="size-3.5" />
      Wireless
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-[#D5D1C6] bg-white/70 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#5D6059]">
      USB
    </span>
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
            className="text-sm font-bold text-[#171815]"
          >
            Available keyboards
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#5D6059]">
            Choose a nearby keyboard to connect.
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh available keyboards"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#D5D1C6] bg-white/70 text-[#5D6059] transition hover:border-[#FF6A3D] hover:text-[#9E321F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
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
            className="group grid min-h-16 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[#D5D1C6] bg-white/65 px-4 py-3 outline-none transition hover:-translate-y-0.5 hover:border-[#FF6A3D] hover:shadow-[0_8px_24px_rgba(23,24,21,0.08)] focus-visible:ring-2 focus-visible:ring-[#155EEF] focus-visible:ring-offset-2 rac-selected:border-[#FF6A3D] rac-selected:bg-[#FFF1EB]"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#F3F0E8] text-[#5D6059]">
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
              <span className="block truncate font-semibold text-[#171815]">
                {device.label}
              </span>
              <span className="block truncate text-xs text-[#5D6059]">
                {transport.label}
              </span>
            </span>
            <span className="text-xs font-bold text-[#9E321F]">
              {connectingId === device.id ? "Connecting…" : "Connect"}
            </span>
          </ListBoxItem>
        )}
      </ListBox>

      {!refreshing && devices.length === 0 && !error && (
        <div className="mt-4 rounded-2xl border border-dashed border-[#D5D1C6] bg-[#F3F0E8]/75 px-4 py-5 text-center">
          <p className="font-semibold text-[#171815]">No keyboards found yet</p>
          <p className="mt-1 text-sm leading-5 text-[#5D6059]">
            Wake your keyboard, keep it nearby, then refresh the list.
          </p>
        </div>
      )}

      <InlineError message={error} />
    </section>
  );
}

function SimpleDevicePicker({ transports, onTransportCreated }: PickerProps) {
  const [connectingLabel, setConnectingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section aria-labelledby="connection-method-heading">
      <h2 id="connection-method-heading" className="text-sm font-bold">
        Choose how to connect
      </h2>
      <p className="mt-1 text-sm leading-5 text-[#5D6059]">
        Your browser will ask you to approve a keyboard for this session.
      </p>
      <ul
        className={[
          "mt-4 grid gap-3",
          transports.length > 1 && "sm:grid-cols-2",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {transports.map((transport) => {
          const isConnecting = connectingLabel === transport.label;

          return (
            <li key={transport.label}>
              <button
                type="button"
                aria-busy={isConnecting}
                disabled={connectingLabel !== null}
                onClick={() => void connectTransport(transport)}
                className="group flex min-h-28 w-full flex-col items-start justify-between gap-4 rounded-2xl border border-[#D5D1C6] bg-white/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#FF6A3D] hover:shadow-[0_10px_28px_rgba(23,24,21,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <TransportBadge wireless={transport.isWireless} />
                  <span
                    aria-hidden="true"
                    className="text-lg text-[#9E321F] transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
                <span>
                  <span className="block font-bold text-[#171815]">
                    {isConnecting ? "Waiting for approval…" : transport.label}
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-[#5D6059]">
                    {transport.isWireless
                      ? "Pair without a cable when your platform supports it."
                      : "The most reliable way to edit and test your keymap."}
                  </span>
                </span>
              </button>
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
      className="rounded-2xl border border-[#A86413]/30 bg-[#FFF5E5] p-4 sm:p-5"
    >
      <p id="unsupported-browser-heading" className="font-bold text-[#6F430C]">
        This browser cannot connect to a keyboard
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5D6059]">
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
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-5 text-[#5D6059]">
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

function ConnectOptions({
  transports,
  onTransportCreated,
  open,
}: PickerProps & { open: boolean }) {
  const useSimplePicker = useMemo(
    () => transports.every((transport) => !transport.pick_and_connect),
    [transports],
  );

  return useSimplePicker ? (
    <SimpleDevicePicker
      transports={transports}
      onTransportCreated={onTransportCreated}
    />
  ) : (
    <DeviceList
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
      className="w-[min(46rem,calc(100vw-2rem))] [&_a]:!text-[#9E321F]"
    >
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WaferMark />
            <span className="rounded-full border border-[#D5D1C6] bg-white/65 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#5D6059]">
              Compatible with ZMK Studio
            </span>
          </div>
          <div className="mt-7 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9E321F]">
              Keyboard workspace
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.035em] text-[#171815] sm:text-4xl">
              Make your keyboard feel like yours.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#5D6059] sm:text-base">
              Connect a ZMK Studio-enabled keyboard to remap keys, explore
              layers, and build a layout that fits the way you work.
            </p>
          </div>
        </header>

        <div aria-hidden="true" className="h-px bg-[#D5D1C6]" />

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
              className="absolute inset-x-0 top-1/2 h-px bg-[#D5D1C6]"
            />
            <span className="relative mx-auto block w-fit bg-[#FCFAF4] px-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#5D6059]">
              No keyboard nearby?
            </span>
            <button
              type="button"
              onClick={onExploreDemo}
              className="relative mt-4 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#FF6A3D] px-5 py-3 text-sm font-black text-[#171815] shadow-[0_8px_20px_rgba(158,50,31,0.18)] transition hover:bg-[#F85A2B] hover:shadow-[0_10px_26px_rgba(158,50,31,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF] focus-visible:ring-offset-2 active:translate-y-px"
            >
              Explore demo keyboard
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        <aside className="flex gap-3 rounded-2xl bg-[#F3F0E8] px-4 py-3.5">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full border border-[#2E7D5B]/30 bg-[#2E7D5B]/10 px-2 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#2E7D5B]"
          >
            Local
          </span>
          <div>
            <p className="text-sm font-bold text-[#171815]">
              Your keymap stays in your hands
            </p>
            <p className="mt-0.5 text-xs leading-5 text-[#5D6059]">
              Connection and editing happen locally. You choose which keyboard
              this session may access.
            </p>
          </div>
        </aside>
      </div>
    </GenericModal>
  );
};
