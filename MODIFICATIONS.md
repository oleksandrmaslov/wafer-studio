# Modifications

Wafer Studio is a derivative work of [ZMK Studio](https://github.com/zmkfirmware/zmk-studio),
Copyright 2024 The ZMK Contributors, licensed under the Apache License, Version 2.0.

This file exists to satisfy section 4(b) of that license, which requires
derivative works to carry prominent notices stating that files have been
changed. Source files that accept comments carry that notice in their header:

```
// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0
```

Files created for Wafer Studio carry:

```
// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0
```

JSON, TOML, HTML and other formats where a header would be invalid or awkward
are listed below instead.

## Project identity

Wafer Studio is an independent redesign. It is not an official ZMK project, it
is not endorsed by the ZMK Project, and the companies that sponsored upstream
ZMK Studio development do not sponsor it. It speaks the official ZMK Studio RPC
protocol via the upstream `@zmkfirmware/zmk-studio-ts-client` package, which is
consumed unmodified.

## Modified files without an in-file header

| File | Change |
| --- | --- |
| `index.html` | Retitled to Wafer Studio; Wafer icon, description, canonical/social metadata and structured data added. |
| `download.html` | Retitled and re-described for Wafer Studio desktop builds. |
| `design.html` | Added; entry point for the Wafer design-system page, which has no upstream equivalent. |
| `package.json` | Version and dependency set adjusted for the Wafer build. |
| `src-tauri/tauri.conf.json` | `productName`, `mainBinaryName`, `identifier`, window title, copyright, publisher, license metadata and bundled `resources` changed for Wafer Studio. Identifier moved from `dev.zmk.studio` to `io.github.oleksandrmaslov.wafer-studio`. |
| `src-tauri/Cargo.toml` | Version and dependency versions adjusted. |
| `.github/workflows/pages.yml` | Rewritten to deploy this fork to GitHub Pages. |
| `.github/workflows/release-please.yml` | Release token and action version changed for this repository. |
| `.github/workflows/release.yml` | Added; drafts a release first, then fills it from a runner matrix. |
| `NOTICE` | Wafer Studio attribution prepended. The upstream ZMK Studio notice is retained verbatim below it. |
| `tailwind.config.js` | Extended with the Wafer design tokens. |

## Substantive source changes

The full diff against upstream is `git diff origin/main...HEAD`. In summary:

### Reworked from upstream

- `src/App.tsx`, `src/AppHeader.tsx` — restructured shell, command palette
  integration, layer and layout controls moved into the header. `AppFooter.tsx`
  was removed.
- `src/keyboard/Keyboard.tsx` — the largest change in the project. Rewritten
  around a draft-based editing model with type-through, mirroring, modifier
  handling and keyboard-driven navigation.
- `src/keyboard/Keymap.tsx`, `PhysicalLayout.tsx`, `PhysicalLayoutPicker.tsx`,
  `LayerPicker.tsx`, `Key.tsx` — re-rendered against the Wafer design tokens
  and the new selection model.
- `src/behaviors/BehaviorBindingPicker.tsx` — rebuilt around a searchable
  action catalog rather than a raw behavior list.
- `src/behaviors/HidUsagePicker.tsx`, `ParameterValuePicker.tsx`,
  `BehaviorParametersPicker.tsx`, `parameters.ts` — adapted to the catalog and
  to visual usage selection.
- `src/ConnectModal.tsx`, `src/UnlockModal.tsx`, `src/AboutModal.tsx`,
  `src/GenericModal.tsx`, `src/DownloadPage.tsx` — restyled; About gained a
  licence and attribution section and a disclaimer over the upstream sponsor
  logos.
- `src/undoRedo.ts`, `src/rpc/logging.ts`, `src/main.tsx`, `vite.config.ts`,
  `scripts/generate-release-data.js` — adjusted for the above.

### New in Wafer Studio

- `src/design-system/` — design tokens, dispersion field, command palette and
  form controls.
- `src/keyboard/alphaLayouts.ts`, `keymapDraft.ts`, `layoutZoom.ts`,
  `mirror.ts`, `typeThrough.ts` — editing model and starter layouts.
- `src/behaviors/actionCatalog.ts`, `behaviorKinds.ts`, `HidUsageGrid.tsx`,
  `VisualHidUsagePicker.tsx` — the action catalog and visual pickers.
- `src/rpc/mockTransport.ts`, `mockFixtures.ts` — an in-process fake keyboard
  so the UI can be developed without hardware.
- `src/WaferMark.tsx`, `src/design.tsx` — Wafer branding and the design-system
  page.

## Trademarks

Apache-2.0 grants no trademark rights. "ZMK" and the ZMK marks belong to the ZMK
Project; the sponsor logos shown in the About dialog belong to their respective
companies and appear only as an attribution of upstream support.
