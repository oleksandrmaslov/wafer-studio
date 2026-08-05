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
_seen_. Several bugs shipped and were caught only when the user posted a
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
with hold = Bluetooth" is not a parameter you can reach; it is a _different_
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
mid-edit, Vite can keep serving an _empty body_ for that module afterwards —
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
key's dispersive ring resolved against the _board's_ box instead of the
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

### The rail holds layers; the board holds its own controls

The left rail had grown to eight stacked clusters in a 13rem column — layout,
layers, a draft-lock note, copy-from, alphas, type-through, the palette door,
zoom — and scrolled _as a whole_. Adding a fifth layer pushed zoom off the
bottom of the window, which is the wrong thing to lose: the rail's own contents
were competing with each other for the same finite height.

Rather than making the rail taller or the controls smaller, each control moved
to whatever it is actually about:

- **Which board, and how big** float in the corners of the canvas. They are
  questions about the board, so they are answered on it.
- **Copy-from and alphas** are two buttons in the canvas's bottom-left corner,
  beside the board they rewrite. Neither is a setting — both are one-shot edits
  to the current layer — so as standing select fields they read as settings
  _and_ claimed permanent height. See the reversal below before moving them.
- **The palette door** is in the app header. It is a global escape hatch and had
  no business living inside the pane about layers.
- **Layers stay**, alone, and are the only thing that can scroll — inside their
  own list, not by taking the rail with them.

Two traps this walked into, both already in §4 and both worth re-reading before
moving anything else onto the canvas. The floating controls are anchored to the
canvas _wrapper_, not to the scrolling `section`, or they scroll away with the
board. And the section's vertical padding is load-bearing: `PhysicalLayout`
sizes Fit against the parent's content box, so the padding is what stops a
fitted board sliding under the controls. It is not a taste value.

Also fixed here: the canvas asked for `xl:col-start-2` while type-through
dropped the template to `xl:grid-cols-1`, which put it in an implicit track with
the explicit `1fr` eating the free space. Template and placement now move
together in one pair of variables — the same rule §4 states, applied to the
column the canvas asks for rather than to a pane being hidden.

### Scroll containers belong to `xl` only

Reported from a screenshot at a narrow window: the key panel rendered as an
empty sliver with a scrollbar in it, and the layer strip grew a second, useless
scrollbar. Both were the same mistake — a rail's `min-h-0 flex-1 overflow-y-auto`
left switched on below `xl`.

That trio only means "scroll inside me" when an ancestor has a **bounded**
height to flex against. At `xl` the rails are full-height grid columns, so it
works. Below `xl` the layout is stacked auto-height cards inside a page that
scrolls as a whole, so `flex-1` resolves against nothing, the content gets a few
pixels, and the scrollbar is all that is left of it. The rule now: **the
scrollers are `xl:` prefixed, and below that everything renders at natural
height and the page scrolls.**

The layer strip had a second version of it — below `md` the list is a
_horizontal_ strip of chips, and a vertical overflow rule on a sideways-
scrolling row is just a second scrollbar. The vertical scroller is `xl:` too.

Also from that screenshot: the canvas's own controls want more width than a
phone has, so type-through hides below `sm` (it is a registered command, and
nobody types a board through on a phone) and the layout picker caps narrower.

### Copy-from and alphas are buttons, after a reversal

They went into a `⋯` menu on the layer list first. That fixed the rail's height
and cost more than it saved: the two features that turn a two-hour setup into
ten minutes became the two nobody could see. An overflow menu is the right home
for an action that is occasionally necessary, and the wrong home for the ones
the product is worth opening for. They are plain buttons on the canvas now, each
opening its own short list. Do not re-propose the menu.

They sit in the **bottom-left** corner, not the top-left: up there they crowded
the picker that says which board this even is.

That put three things along the bottom edge, so it is now **one flex row**
rather than three absolutely-positioned pieces. Absolute corners plus absolutely
centred teaching text is a layout that only works at the width you happened to
check — at ~54rem of canvas the left cluster, a 36rem hint and the zoom cluster
want 63rem and silently overlap. As a row they cannot: the hint takes what is
left and drops out below `lg`. The empty `<span>` in the left slot is load
bearing, or `justify-between` sends zoom to the left when a layer has nothing to
copy from.

`CanvasMenuButton` is at module scope, not a closure inside `Keyboard`, or every
keystroke anywhere in that component remounts the popover. Note that `Button`
from react-aria-components filters DOM props and drops `title`, so the tooltip
hangs on a wrapping span — the trigger itself has to stay `MenuTrigger`'s direct
child or the press and `aria-expanded` wiring never happens.

### There is one finish, not three

`appearance.ts` is deleted, with the three `[data-wafer-finish]` blocks in
dispersion.css and the header menu that switched them. Nobody could tell the
levels apart in use, which makes a three-way choice a question with no answer —
and a design system with a volume knob is three design systems that have to be
checked three times.

`--dispersion-gain: 0.5` / `--specular-gain: 0.4` are now _the_ amplitude. Those
are the values the default finish resolved to, so the removal changes nothing on
screen. The other two levels were 1/1 and 1.55/1.35, if it is ever deliberately
turned up.

### The device menu stays; the finishes came out of it

Removing the whole menu was tried and reverted at the user's request. The
reasoning for removing it was not wrong — every entry is a registered command,
so ⌘K reaches all of it — but it mistook "reachable" for "findable". A menu
hanging off the thing it acts on is the obvious way in, and the palette is only
obvious once you already know it exists. What actually needed to go was the
three visual finishes sitting in the middle of the list; those are gone for
good. Disconnect, Restore Stock Settings, About and the notices stay.

Two things from that round were kept because they are improvements on their own:
the palette has a visible affordance in the header (a shortcut nobody has been
told about is not a feature), and `shell.licenses` is registered as a command.
**Keep that command registered.** The project ships a NOTICE file whose
attributions have to stay reachable from the running application, and it should
not depend on one menu row surviving the next redesign.

Do not re-propose deleting the menu without a replacement that is visible.

### A removed layer offers itself back

`restoreLayer` has been in the protocol from the start and never had an entry
point. ⌘Z reached it, but only if you knew the delete was on top of the undo
stack and that nothing had happened since — precisely the knowledge someone who
just deleted the wrong layer does not have.

A layer delete now leaves a centred pill for twelve seconds with a Restore
button. It goes **through the undo stack** rather than calling the RPC directly,
so remove and restore stay two ordinary reversible operations instead of one
operation with a side channel the history knows nothing about. The offer
deliberately outlives ⌘Z, so it can be taken after the layer is already back:
restoring twice is an error on the keyboard, and the handler checks for the id
before acting.

`removeLayerAt` / `restoreLayerAt` are hoisted out of the callbacks that used
them because three call sites needed the same request — remove, the undo of add,
and the undo of restore — and were three copies of it. Where the selection lands
after a removal is left to the clamp effect at the foot of the component, so
there is one rule for it rather than two that can disagree.

### The consumer page is a third of the catalogue, not a footnote

`&kp` takes a consumer usage as happily as a keyboard one, and the consumer page
is where the keys an outer layer exists to hold live. The catalogue shipped
thirteen of them in one "Media" bucket sixth of seven, below twenty-four
function keys — present in the product, invisible in it.

Now thirty-four across three categories (Media, System, Browser & apps), with
the consumer half given its own collapsed group _above_ the keys grid rather
than below it: the keys grid is open by default and a hundred buttons tall, so a
heading placed after it is only nominally on the page.

**Every usage ID was read out of `src/keyboard-and-consumer-usage-tables.json`,
not written from memory**, and re-verified against it afterwards — all 24 new
and touched IDs resolve to exactly the usage their label claims. This is the
same class of hazard as the alpha layouts below: a wrong ID here is silent. The
binding applies, the firmware accepts it, and the owner finds out when the key
does the wrong thing. If you add more, verify the same way and say so.

A data probe worth keeping the shape of: bundle `actionCatalog.ts` with esbuild
and assert in Node that no two actions share a _packed_ usage, that
`(usage >>> 16) & 0xff` is the page and `usage & 0xffff` the id, that every
consumer id exists in the shipped table, and that no consumer usage carries an
implicit modifier — the report cannot express Ctrl+VolumeUp, so one there is an
authoring mistake. Note that duplicates by `(page, id)` are _expected_: the
shifted symbols share a base id with their unshifted key and differ only in the
modifier mask in the top byte. A probe that checks `(page, id)` reports 42
false failures.

### Starter layouts detect, they do not guess geometry

`alphaLayouts.ts`. The current layer is _read_: every key bound to a plain
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

`selectedKeyPosition` stays the _primary_ — the key the inspector describes and
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
and bound only if it is _released_ with nothing pressed in between —
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

Note the trap it exposed: `.wafer-key` sets the `background` _shorthand_, which
resets `background-image`, and pseudo-elements do not inherit `background-image`
anyway. `.wafer-key-field` therefore publishes `--key-light-field` and
`--key-spectrum-field` as custom properties — those _do_ inherit — and each
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
`src/keyboard/mirror.ts` mirrors _one_ key onto its geometric opposite and flips
modifier handedness in both places ZMK encodes it (usage IDs 0xE0–0xE7, and the
implicit modifier mask in the top byte). Returns undefined when the board has no
opposite key, and the button hides rather than guessing.

### Live apply — no commit button inside the editor

Choosing a _key_ applied instantly while choosing an _action with parameters_
required pressing "Assign to key". Two meanings for a click in one panel, and
the button was a commit inside a commit — the draft already holds everything
back until Review. Everything edits live now; invalid intermediate states are
simply not sent. **Side effect not yet assessed: every parameter tweak is its
own undo entry.** If that proves annoying, coalesce consecutive edits to the
same key.

### Bulk apply wraps, it does not replace

Applying one identical binding to eight keys is useless for hold-taps — home-row
mods needs each key to keep _its own_ letter as the tap. So when the painted
behaviour is a hold-tap and the key underneath is a plain key press, the
existing usage is preserved as param2. That rule is the whole feature.

### Type-through binding

`src/keyboard/typeThrough.ts`. Keyed on `event.code`, not `event.key`, so a host
set to AZERTY still binds the physical key. Traversal is _reading order_, not
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
  to publish signed manifests. Separately: _firmware_ update over BLE is not
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

From `UX.md` §6b and §7, in value order. Type-through, bulk apply,
copy-from-layer, mirror, the command palette, multi-select and starter layouts
were already built. The two items that stood here — consumer-key prominence with
chroma on the active layer, and an undo path for a deleted layer — are now built
too; both are written up in §5.

**The next job is adaptivity, and it is a job for someone with a browser.**
Everything in §5 above is reasoned and type-checked, not seen. The open
questions, none yet answered by observation:

- Whether the board controls floating in the canvas corners clear the board at
  every size. The section's vertical padding is what reserves the strip, and
  `pt-20 pb-14` is a guess — the first thing to measure. The top value is set by
  the tallest thing in that corner: the layout picker's label-over-button stack,
  now sitting beside the copy-from and alphas buttons.
- Whether the key grid fits the 21rem right rail.
- How the three panes stack at ~330px. The two reported breakages there are
  fixed (see §5, "Scroll containers belong to `xl` only"), but the fix was
  reasoned from the screenshot, not seen — confirm the key panel now renders
  full height and the page scrolls, rather than the panel scrolling.
- Whether the bottom row (copy-from + alphas, hint, zoom) compresses gracefully
  at ~380px. It is one flex row so it cannot overlap, but the two menu buttons
  will truncate and nobody has looked at how far.
- Whether the browser eats keys during type-through (⌘W, F5 — and Tauri will
  differ from the web).

A screenshot answers all of these faster than any amount of reading, per §1.
