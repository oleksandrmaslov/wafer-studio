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
- Honest live-testing state: edits are applied to volatile device memory, then
  explicitly saved or reverted.

Local Draft → diff → Apply is the next domain slice. Until that lands, the UI
does not label live device changes as a draft.

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

## Protocol and attribution

The application pins `@zmkfirmware/zmk-studio-ts-client` at `0.0.18` and does
not change the ZMK Studio wire protocol. The upstream ZMK Studio code remains
covered by Apache-2.0; the official TypeScript client is MIT licensed. See
[`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for the bundled notices.

Pinned versions and the remaining messages-SHA release blocker are recorded in
[`PROTOCOL_PROVENANCE.md`](./PROTOCOL_PROVENANCE.md).

Wafer Studio is an independent product and is not an official ZMK application.
