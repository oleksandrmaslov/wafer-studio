# Agent log

Orientation for whoever picks this up next. `DESIGN.md` is the visual system,
`UX.md` is the interaction research and roadmap, `LAYOUTS.md` is research into
what people actually build on these keyboards and what other configurators have
learned. This file is the working memory between them: what is true, what was
decided and why, and what will waste your afternoon if nobody tells you.

Newest entries at the top of §5.

---

## 1. The one thing to know first

**There is no browser in the agent environment.** Everything visual in this
repo has been verified by `tsc`, ESLint, `vite build`, and by HTTP-fetching
modules through the dev server to confirm they transform. None of it has been
*seen*. Several bugs shipped and were caught only when the user posted a
screenshot.

So: state plainly what you verified and what you did not. "The build passes" and
"it looks right" are different claims. If you can get a screenshot, ask for one —
it has been the fastest debugging tool available in this project by a wide
margin.

---

## 2. Facts about ZMK Studio that cost time to establish

**The RPC surface is fully consumed.** All eighteen methods across `core`,
`keymap` and `behaviors` are already called somewhere in `src/`. There is no
unexposed capability waiting to be surfaced. If a feature seems missing, it is
either badly placed in the UI or genuinely not in the protocol.

**A binding is `{behaviorId, param1, param2}` — one id and two integers.**
There is no field that can reference another binding, so behaviour composition
is impossible through Studio. `&mt` is defined in devicetree as
`bindings = <&kp>, <&kp>;` — both sides hardwired to key press — so "mod-tap
with hold = Bluetooth" is not a parameter you can reach; it is a *different*
hold-tap that must be compiled into the firmware. Same for macros and
tap-dances. The editor renders exactly what each behavior's metadata declares;
it is not narrowing anything.

Not in the protocol at all, so no UI work reaches them: combos, macros,
tap-dance definitions, conditional layers, encoders, RGB, backlight, display,
BT profile management, power settings, hold-tap timing.

**Behaviour identity is inferred, not reported.** ZMK does not say which
behavior is "the" key press. `src/behaviors/behaviorKinds.ts` holds that
inference (name + parameter shape). Both the picker and type-through depend on
the same answer, which is why it is not inline in a component.

---

## 3. Design system laws

Encoded in `DESIGN.md`, enforced in `src/design-system/`. Two are recent and
easy to undo by accident:

- **The accent is achromatic.** `--wafer-primary` is the far end of the value
  range, not a hue — near-black on light, chrome on dark. The spectrum is the
  only source of colour in the interface. Every accent pair measures ≥10.9:1.
- **The dispersion ramp is the cool half only** — cyan, azure, violet, magenta.
  No warm stop. A warm stop in a 1px edge reads as a glow, not as split light.
- **One implementation.** The WebGL metal and aberration shaders are deprecated
  and live in `deprecated/`, which is gitignored and outside `src/` so the
  toolchain never walks it. Do not reintroduce a second renderer for the same
  law.

---

## 4. Traps

**`clientHeight` includes padding.** The auto-fit in
`src/keyboard/PhysicalLayout.tsx` measured `parent.clientHeight` and therefore
counted padding as usable space, scaling the board too large so it overflowed
and grew a scrollbar. It now subtracts the computed padding. If Fit ever looks
wrong again, look here first.

**A wedged dev server looks exactly like a code bug.** If a syntax error lands
mid-edit, Vite can keep serving an *empty body* for that module afterwards —
HTTP 200, zero bytes — so React never mounts and the app is a white screen while
`tsc`, ESLint and `vite build` are all clean. Diagnose by checking the served
bytes, not the status code:
`curl -s http://localhost:5173/src/keyboard/Keyboard.tsx | wc -c`. Zero means
restart the server and `rm -rf node_modules/.vite`. This cost an hour.

**To find a real render crash without a browser**, bundle the app with esbuild
and run `renderToString` in Node behind a small DOM shim. It surfaces
render-phase throws and invalid element types, though not effects. That is how
`SelectField`, `HidUsageGrid`, `Key` and the whole `App` were each cleared here.

**A transformed ancestor silently breaks `background-attachment: fixed`.** This
is the nastiest one in the project, because nothing errors — the effect just
quietly stops being global. The board is inside `transform: scale()`, so every
key's dispersive ring resolved against the *board's* box instead of the
viewport: the same hue on every key, never tracking the cursor. Fixed by
converting the light into board space instead of abandoning the transform —
`PhysicalLayout` publishes `--board-x/-y/-scale` (only on move or rescale, never
per frame), `scalePosition` publishes each key's `--kx/--ky`, and
`.wafer-key-field` in dispersion.css does the arithmetic in CSS. Anything else
drawn inside a transform needs the same treatment; `background-attachment:
fixed` is not available there.

**Absolutely positioned children of an `overflow-auto` element scroll with the
content.** Cost one round trip: an overlay anchored to the canvas scrolled away
when the canvas panned. Position against a non-scrolling wrapper.

**Grid children with no column.** Changing `grid-template-columns` while a child
is still rendered auto-places it into a phantom cell, on top of everything. This
produced the "repeat on keys is broken" report. If you hide a pane, hide it and
change the template together — or do neither.

**`display: contents` on a landmark** drops it from the accessibility tree in
some browsers. `<main>` is the grid itself for this reason.

**Pre-existing lint errors** in `src/keyboard/HidUsageLabel.tsx` (two
`prefer-const`). Not yours; `npx eslint src --max-warnings 0` will always fail
until someone fixes them.

**Exporting a non-component from a `.tsx`** trips `react-refresh/only-export-components`
under `--max-warnings 0`. Put shared helpers in a `.ts` module.

---

## 5. Decisions, newest first

Reversals are recorded with their reasons so nobody re-litigates them.

### Starter layouts detect, they do not guess geometry
`alphaLayouts.ts`. The current layer is *read*: every key bound to a plain
letter is collected in reading order, and if that whole sequence matches a known
layout the mapping is known position by position — no assumption about rows,
columns or where the block starts. A sequence that matches nothing declines
rather than scrambling the board, which is what a half-edited layer or an
unlisted layout gets. Keys carrying an implicit modifier are skipped: a Ctrl+C
key is not part of the alphabet even though its usage is a letter.

Only five layouts ship (QWERTY, Colemak, Colemak-DH, Dvorak, Workman) because
those are the grids that could be stated with certainty. **A wrong row silently
scrambles someone's board**, so adding Graphite/Canary/Gallium is a data-only
change that must be checked against that layout's own reference rather than
written from memory. Each table is validated in the probe: 30 cells, 26 unique
letters.

### Multi-select is additive, not a rewrite
`selectedKeyPosition` stays the *primary* — the key the inspector describes and
the one type-through advances. `selection` is a separate set of who an edit
actually lands on, and `selectedPositions` guarantees the primary is in it. That
split is why every existing single-key path kept working untouched.

Shift extends in **reading order**, not array order — the run you see between
two keys, which on a split is not the run the binding array would give you.
⌘/Ctrl toggles one key; a plain click starts over.

`applyWrapped` is now the single home of the hold-tap wrap rule (each key keeps
its own usage as the tap), shared by bulk apply and by multi-select — select the
eight home-row keys, choose mod-tap once, and every key keeps its own letter.
`mirrorSelection` does the same across a selection, which is the four-mods-at-
once case that makes mirror worth having.

### The command palette registers, it does not declare
`commandRegistry.ts` + `CommandPalette.tsx`. Components register their own
commands with `useCommands(memoisedArray)` — layer operations from `Keyboard`,
connection and firmware from `App`'s `ShellCommands`. A central list would have
forced three components to hand their callbacks upward just to be listed.
**Memoise the array**, or every parent render re-registers.

Destructive commands sort last, are styled as danger, and take two presses (arm,
then confirm). Weaker than a typed confirmation, stronger than a menu row —
chosen because the palette is muscle memory and muscle memory is exactly what
fires an unintended `resetSettings`. That is also why `resetSettings` moved here
out of the header menu where it sat two rows from "About".

Note the filename: `commandRegistry.ts`, not `commandPalette.ts` — the latter
collides with `CommandPalette.tsx` on a case-insensitive filesystem and TS
errors with "differs only in casing".

### Type-through binds modifiers on release, not on press
Binding a modifier on keydown made the mode unusable: reaching for Ctrl+Arrow to
skip a key wrote Ctrl onto the key you were standing on first, every time,
because the two presses are never simultaneous. A modifier is now held pending
and bound only if it is *released* with nothing pressed in between —
press-and-release binds, press-and-hold is a chord. Same tap/hold rule the
keyboards run on. `event.repeat` is also ignored, or a held key walks itself
across the board, and a pending modifier is dropped on window blur since a
modifier held through a focus change never sends its keyup.

### Drafted keys are marked on the board
`draftedPositions()` in `keymapDraft.ts` gives the changed positions for a
layer; `Key` renders a small spectral dot for them. Before this, the only way to
see what a draft held was the review dialog — no good after typing through forty
keys. It is a corner mark rather than a ring so it coexists with selection,
since the key you are editing is by definition one you just changed.

Note the trap it exposed: `.wafer-key` sets the `background` *shorthand*, which
resets `background-image`, and pseudo-elements do not inherit `background-image`
anyway. `.wafer-key-field` therefore publishes `--key-light-field` and
`--key-spectrum-field` as custom properties — those *do* inherit — and each
pseudo-element paints its own gradient from them.

### Floating panes, and the light goes out rather than home
Panes are `.wafer-float` cards on a continuous lit substrate, not full-bleed
regions with borders cutting the window into strips. `--light-presence` (0/1,
registered and therefore interpolable) fades the whole light field when the
pointer leaves the window; the position is left untouched so the light comes
back up where the pointer re-enters. It used to ease home to its rest position,
which animated an abandoned window. The selected key now wears the shared
spectral ring at full commitment instead of a flat `--wafer-primary` border —
that border went grey when the accent became achromatic, so selection had lost
its only colour.

### Mirror is per-key, not per-half
Whole-half mirroring sounds useful and is almost always wrong: the halves hold
different letters, so copying one onto the other destroys the layer. What is
genuinely symmetric is a handful of keys — home-row mods, thumbs, layer keys.
`src/keyboard/mirror.ts` mirrors *one* key onto its geometric opposite and flips
modifier handedness in both places ZMK encodes it (usage IDs 0xE0–0xE7, and the
implicit modifier mask in the top byte). Returns undefined when the board has no
opposite key, and the button hides rather than guessing.

### Live apply — no commit button inside the editor
Choosing a *key* applied instantly while choosing an *action with parameters*
required pressing "Assign to key". Two meanings for a click in one panel, and
the button was a commit inside a commit — the draft already holds everything
back until Review. Everything edits live now; invalid intermediate states are
simply not sent. **Side effect not yet assessed: every parameter tweak is its
own undo entry.** If that proves annoying, coalesce consecutive edits to the
same key.

### Bulk apply wraps, it does not replace
Applying one identical binding to eight keys is useless for hold-taps — home-row
mods needs each key to keep *its own* letter as the tap. So when the painted
behaviour is a hold-tap and the key underneath is a plain key press, the
existing usage is preserved as param2. That rule is the whole feature.

### Type-through binding
`src/keyboard/typeThrough.ts`. Keyed on `event.code`, not `event.key`, so a host
set to AZERTY still binds the physical key. Traversal is *reading order*, not
array order — the binding array follows devicetree declaration order, which on
splits interleaves the halves. Rows are found by clustering on y, because
columnar-stagger boards give every column a different y. Chord = command, bare
press = binding, checked by code rather than modifier flags so that pressing
Control alone stays bindable.

### Three panes, after a reversal
Phase 1 removed the right rail in favour of a bottom sheet. **The user tried it
and it was worse** — the sheet cropped the board between the top band and
itself. Reverted to: left rail (layout, layers, zoom, type-through), canvas,
right rail (assignment). Layers are vertical because horizontal chips truncated
every name past ~6 characters. Do not re-propose the bottom sheet.

### Actions are collapsible groups
Went tab strip → flat list → collapsed groups. The tab strip hid nine tenths of
the catalogue behind a guess; the flat list was too long to scroll. Collapsed
groups are the middle. Search force-opens everything and drives the key grid
too, so there is **one** search field, not two.

### The flow drives the layout
Rails appear only when the step needs them — no right rail with nothing
selected, no rails at all during type-through.

---

## 5b. Desktop (Tauri)

The shell is already scaffolded: `src-tauri/` with Cargo, capabilities and
icons, and working BLE + serial transports in `src/tauri/`. BLE is desktop-only
in practice — browsers expose Web Bluetooth for this on Linux only, which is the
main reason the desktop app exists.

**The Rust toolchain is not installed in the agent environment** (`cargo` and
`rustc` are both absent), so `npm run tauri build` cannot be run or verified
from here. Anything touching `src-tauri/` is unverified beyond reading it.

Two open items:

- **`identifier` is still `dev.zmk.studio`** while the product is now Wafer
  Studio. Deliberately not changed: the identifier is the app's OS identity —
  changing it orphans existing installs, their settings and any update channel.
  That is a product decision, not a cleanup.
- **No updater configured.** `tauri.conf.json` has only the `cli` plugin. App
  self-update needs the `updater` plugin, a signing keypair, an endpoint and CI
  to publish signed manifests. Separately: *firmware* update over BLE is not
  possible through the Studio protocol at all — it has no DFU methods, and would
  need SMP/MCUmgr work upstream in ZMK plus a Rust implementation here.

## 6. Verifying

```bash
npx tsc --noEmit                                   # must be clean
npx eslint src/<paths you touched> --max-warnings 0
npx prettier --write <files>                       # CI-relevant; run it
npx vite build                                     # must succeed
npm run dev                                        # then fetch modules:
curl -s -o /dev/null -w '%{http_code}' 'http://localhost:5173/?demo=1'
curl -s -o /dev/null -w '%{http_code}' 'http://localhost:5173/src/keyboard/Keyboard.tsx'
```

`?demo=1` auto-connects a mock transport (`src/rpc/mockTransport.ts`), so the
whole flow is exercisable without hardware. A 200 on a `.tsx` path means Vite
transformed it — that is the closest thing to a smoke test available here.

Pure logic is worth testing directly. `src/keyboard/typeThrough.ts` was verified
by bundling it with esbuild and running it against a synthetic 42-key columnar
split in Node. Do that rather than guessing.

---

## 7. What is next

From `UX.md` §6b and §7, in value order. Type-through, bulk apply, copy-from-layer
mirror, the command palette, multi-select and starter layouts are built; these
are not:

1. **Consumer-key prominence** in the picker, and chroma on hover / active
   layer.
2. **Undo toast wired to `restoreLayer`** after a layer delete — the protocol
   supports restoring, but nothing offers it at the moment it is wanted.

Known open questions, none yet answered by observation: whether the key grid
fits the 21rem rail; how the three panes stack at ~330px; whether the browser
eats keys during type-through (⌘W, F5 — and Tauri will differ from the web).
