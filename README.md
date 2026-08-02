# Wafer Studio

Wafer Studio is a Wafer-designed keyboard configurator compatible with
ZMK Studio-enabled keyboards. It keeps the official ZMK Studio protocol and
TypeScript client underneath a warmer, capability-driven product experience.

## Current preview

This branch establishes the first vertical slice of the Wafer redesign:

- A branded, responsive keymap workspace with real device geometry and layers.
- USB, supported Bluetooth, and native Tauri connection paths inherited from
  ZMK Studio.
- A deterministic Wafer demo keyboard for review without physical hardware.
- A generic inspector for every behavior reported by the connected firmware.
- Local key-assignment drafts with undo/redo, a deterministic review diff, and
  explicit Apply to volatile device memory.
- A separate permanent Save step after Apply, with partial-failure recovery that
  preserves the remaining local draft.

Layer structure and physical-layout changes still use the upstream live RPC
flow. Wafer disables those controls while a key-assignment draft is pending;
bringing them into the same operation planner is a later domain slice.

## Development

```sh
npm ci
npm run dev
```

Use **Explore demo keyboard** on the connection screen to enter the complete
editor without connecting hardware. For automated review or screenshots, open
the app with `?demo=1` to connect the same deterministic fixture directly.

Other useful checks:

```sh
npm run build
npm run lint
npm run storybook
```

## Hosted builds

GitHub Pages serves the current published build at
[oleksandrmaslov.github.io/zmk-studio](https://oleksandrmaslov.github.io/zmk-studio/).
Pushes to `main` deploy production automatically. A reviewed development commit
on `agent/wafer-foundation` publishes the current debugging build. Other feature
branches never replace the hosted site.

## Protocol and attribution

The application pins `@zmkfirmware/zmk-studio-ts-client` at `0.0.18` and does
not change the ZMK Studio wire protocol. The upstream ZMK Studio code remains
covered by Apache-2.0; the official TypeScript client is MIT licensed. See
[`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for the bundled notices.

Pinned versions and the remaining messages-SHA release blocker are recorded in
[`PROTOCOL_PROVENANCE.md`](./PROTOCOL_PROVENANCE.md).

Wafer Studio is an independent product and is not an official ZMK application.
