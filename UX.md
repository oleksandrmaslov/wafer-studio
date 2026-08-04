# Wafer Studio — interaction research

Companion to `DESIGN.md`. That document governs how the interface *looks*; this
one governs how it *behaves*. Where they disagree, this one yields on colour and
material, and wins on layout, flow, and disclosure.

---

## 1. What this is based on

Read before writing: `src/App.tsx`, `src/AppHeader.tsx`, `src/keyboard/Keyboard.tsx`,
`src/keyboard/LayerPicker.tsx`, `src/keyboard/PhysicalLayoutPicker.tsx`,
`src/behaviors/BehaviorBindingPicker.tsx`, `src/behaviors/actionCatalog.ts`, and
the full RPC surface in `@zmkfirmware/zmk-studio-ts-client`.

One finding shaped everything below, so it goes first.

### The protocol is fully consumed

Every method the ZMK Studio RPC exposes is already called somewhere in this
codebase. All eighteen:

| Subsystem | Methods |
| --- | --- |
| `core` | `getDeviceInfo`, `getLockState`, `lock`, `resetSettings` |
| `keymap` | `getKeymap`, `setLayerBinding`, `checkUnsavedChanges`, `saveChanges`, `discardChanges`, `getPhysicalLayouts`, `setActivePhysicalLayout`, `moveLayer`, `addLayer`, `removeLayer`, `restoreLayer`, `setLayerProps` |
| `behaviors` | `listAllBehaviors`, `getBehaviorDetails` |

**There is no unexposed capability to go and surface.** The features that feel
missing are missing for one of two reasons, and the distinction decides whether
this is a design problem or a firmware problem. Section 6 separates them.

---

## 2. Diagnosis: the canvas is a minority of its own application

Measured from `Keyboard.tsx:879` and `AppHeader.tsx:130`, at 1440×900:

| Region | Cost |
| --- | --- |
| Right inspector rail | `24rem` = 384px, **27% of width**, permanent above `xl` |
| App header | `min-h-16` = 64px |
| Canvas toolbar row | ~60px |
| Bottom status strip | `min-h-10` = 40px |

The keyboard gets **1056 × 736 ≈ 60% of the viewport**, and it is the only thing
on screen the user actually came for. At 1280px the rail alone takes 30%.

Four specific faults follow from that:

**The rail is permanent but its content is conditional.** `Keyboard.tsx:1038`
renders a "Choose a key" placeholder — 384px of screen reserved to say nothing
is selected. The most common state of the most expensive region is empty.

**Depth is inverted.** Selecting a key is one click. Choosing what it does is a
list inside a panel inside a rail. The frequent operation and the rare one cost
the same, and the layout is sized for the rare one.

**Chrome is stacked, not grouped.** Header, toolbar, and status strip are three
horizontal bands with three different background treatments
(`bg-base-200`, `wafer-finish-panel`, `wafer-finish-panel`) before any content.

**Destructive actions hide next to trivial ones.** `resetSettings` — which wipes
the keyboard — sits in the same header menu as "About", two rows apart
(`AppHeader.tsx:319` and `:355`).

---

## 3. Principles taken from the reference

From the Work Louder Input screenshot. Adapted, not copied — Input configures a
macropad with a handful of keys and one conceptual layer stack; Wafer Studio
configures 60–100+ key boards with layer trees, swappable physical layouts, and a
behavior set that varies per firmware build. The principles transfer; the
literal layout does not.

1. **The canvas is the subject.** It floats on the ground plane and owns the
   centre. Nothing is docked beside it.
2. **Controls are thin labelled clusters at the periphery**, not panels. Small
   uppercase labels, a few controls each, no borders or fills.
3. **Entry points, not editors.** "New Action →" is a door. The editor is not
   on screen until it is asked for.
4. **Direct manipulation on the object itself.** Click a key to modify; drag the
   board to reposition.
5. **Status is ephemeral and centred**, not a permanent strip.
6. **Teaching text lives at the bottom, low contrast** — instruction without
   permanent chrome.

Two things I am deliberately **not** taking:

- **Top tab navigation** (Keymap / Widgets / Setup). Wafer Studio has one
  subject. Tabs would invent modes it does not have.
- **A draggable canvas as the primary interaction.** Fun on a macropad, a
  liability on a 100-key board where the user needs a stable target to click.
  Pan belongs behind space-drag or middle-drag, not as the default.

---

## 4. Proposed layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ◆ Wafer     Corne · connected            ⌘K      ⤺ ⤻    Save (3)    │  56px
├──────────────────────────────────────────────────────────────────────┤
│  LAYOUT              LAYERS                            KEYMAP        │
│  Split 42  ▾    ● base  1 sym  2 nav  +          Bind key →          │  ~44px
│                                                   Layer settings →   │
│                                                                      │
│                                                                      │
│                    ┌────────────────────────────┐                    │
│                    │                            │                    │
│                    │      the keyboard          │                    │
│                    │                            │                    │
│                    └────────────────────────────┘                    │
│                                                                      │
│                        ╭──────────────╮                              │
│                        │ layer saved  │   ← ephemeral, auto-dismiss   │
│                        ╰──────────────╯                              │
│         click a key to bind it · ⌘K for anything else                │
└──────────────────────────────────────────────────────────────────────┘
```

**Canvas gains roughly 27% width and 40px height** — from ~60% of the viewport to
~88%. That is the entire point of the exercise.

The three peripheral clusters map to the three questions a user actually has:
*which board* (layout), *which layer* (layers), *what does this key do* (keymap).
Each is a small labelled group with no panel behind it, sitting directly on the
substrate.

The status strip is deleted. Its two jobs split: the persistent hint becomes the
low-contrast line at the bottom, and transient results become a centred pill that
fades. Neither reserves layout space.

---

## 5. The editing flow

This is the core change, and the reason the rail can go.

### 5.1 Three ways in, one model

| Path | For | Cost |
| --- | --- | --- |
| **Listen mode** | "make this key F" | 2 actions |
| **Action shelf** | browsing, parameters, layer-taps | 3–4 actions |
| **Command palette** | experts, everything else | 1 action + typing |

**Listen mode is the headline.** Select a key on the canvas, then *press the key
you want it to become*. The application is running on a keyboard; making the
user hunt for `A` in a searchable list when their finger is already on `A` is the
single largest avoidable cost in the current flow. Enter it by selecting a key
and pressing <kbd>Enter</kbd>, or by double-clicking. Escape exits. It binds
plain keycodes only — anything with parameters falls through to the shelf.

**The action shelf** replaces the rail. It rises from the bottom edge *over* the
canvas at `--shelf-h` (`min(46vh, 30rem)`), with the first control focused on
open.

*Revised during implementation.* This originally said the shelf overlays without
the canvas ever reflowing, with the selected key scrolled into view. Built that
way it is worse: on a board that already fits, scroll-into-view does nothing and
the bottom two rows simply sit behind the sheet. The canvas instead pads itself
by exactly `--shelf-h` while the shelf is open, so the board re-centres in the
space that is still visible. It is a reflow, and it is the right trade — a
keyboard that moves beats a keyboard that is hidden. The height is one token
read by both, so the pad and the sheet cannot drift apart.

The shelf is where `BehaviorBindingPicker` goes, largely intact. Its content
model is fine; its container is the problem.

**The command palette** (<kbd>⌘K</kbd>) is the escape hatch for everything that
is not binding a key: add layer, rename layer, switch physical layout, reset
settings, disconnect, toggle finish. This is what lets the peripheral clusters
stay small — anything that does not earn permanent screen presence still has a
fast path.

### 5.2 Multi-select

Not currently supported and it should be. Shift-click and marquee-drag to select
several keys, then bind once. On a split board, "make every key on the right half
transparent" is currently 20+ operations.

The shelf header becomes "3 keys selected" and the binding applies to all. This
is free once editing is a transient surface — it was awkward in a rail because
the rail header was built around a single key's identity
(`Keyboard.tsx:986–1016`).

### 5.3 What happens to the draft model

`keymapDraft.ts` and the review dialog in `AppHeader.tsx:166` are good and should
stay. One change: the draft count belongs on the **Save** control in the header,
not in a separate pill cluster (`AppHeader.tsx:364–384`). One object, one place.

---

## 6. Feature inventory

The honest split. **Group A is design work available today. Group B is not
blocked on this project at all** — no amount of UI work surfaces it.

### Group A — in the protocol, poorly surfaced

| Feature | Now | Should be |
| --- | --- | --- |
| Physical layout switch | Small select in toolbar | Peripheral cluster + palette; it is a rare, high-consequence action |
| Layer rename | Inside `LayerPicker` | Double-click the layer chip |
| Layer reorder (`moveLayer`) | Buttons in picker | Drag the layer chips |
| Layer restore (`restoreLayer`) | Exists; hard to find | Undo toast after delete — the moment it is wanted |
| Reset settings | Header menu, next to About | Palette only, typed confirmation, visually separated from everything non-destructive |
| Unlock | Modal | Keep as modal; it is a genuine gate |
| Undo/redo | Header buttons | Keep, plus ⌘Z/⌘⇧Z |
| Behavior parameters | Nested in rail | Inline in shelf, progressive |

### Group B — not in the ZMK Studio protocol

Combos · macros · tap-dance definitions · conditional layers · encoder and sensor
bindings · RGB underglow · backlight · display config · Bluetooth profile
management · power and idle settings · mouse-key tuning · hold-tap timing
(`tapping-term-ms`, `quick-tap-ms`, `flavor`).

These require **firmware and protocol work upstream in ZMK**, not UI work here.
Any Wafer Studio UI for them today would be a UI over nothing.

What this document can do is make sure they slot in without a redesign. Two
provisions:

- **The peripheral cluster pattern is extensible by construction.** Combos and
  encoders become additional clusters or additional shelf tabs. Neither requires
  reclaiming space, because nothing permanent was given away.
- **The shelf is behavior-agnostic already.** `actionCatalog.ts` is organised by
  category (`letters`, `numbers`, `symbols`, `navigation-editing`, `function`,
  `media`, `modifiers`). A combo or macro is another category, and the search
  field does not care.

**Recommendation:** state plainly in the product that these are firmware-limited
rather than leaving users hunting. A single line in the palette — "Combos need
firmware support that ZMK Studio does not expose yet" — is better UX than
silence, and costs nothing.

---

## 6b. Setting a keyboard up fast

*This is the section that matters.* Everything above makes the app tidier.
None of it makes it **worth choosing**, and tidiness is not a reason to open
something.

### The arithmetic nobody survives

A 42-key split with four layers is **168 bindings**. The current flow per
binding is: click key → read the list → find the action → click it → sometimes
set a parameter. Call it four seconds when you know exactly what you want,
which nobody does for all 168.

**That is over two hours to set up a keyboard**, and the reason people give up
on configurators and go back to editing a `.keymap` file by hand — where the
base layer is thirty seconds of typing.

Any feature that does not attack that number is decoration. Four that do,
ordered by value per unit of work:

> **Status:** 1, 3 and 4 are built (`src/keyboard/typeThrough.ts`,
> `src/keyboard/mirror.ts`, and copy-from-layer plus bulk apply in
> `Keyboard.tsx`). Starter layouts are not.

### 1. Type-through binding — the one that changes the product

Select a key, then **press the key you want it to become**. Bind, advance to the
next key in reading order, repeat. You set the base layer by *typing the base
layer*.

This is not a shortcut for the existing flow; it is a different activity. 168
bindings stops being 168 decisions and becomes a minute of typing. The
application is running on a keyboard — making someone hunt for `A` in a
searchable list while their finger rests on `A` is the central absurdity of
every configurator, and it is free to fix.

Details that decide whether it works:

- **Advance in layout order, not array order.** `getPhysicalLayouts` gives x/y
  per key, so sort by row then column. On a split, cross the gap correctly.
- **A visible cursor on the canvas.** The next target must be obvious.
- **Backspace steps back**, Escape exits. Never bind Escape or Backspace while
  in the mode — that is what the shelf/rail is for.
- **Skip with Tab** for keys you want left alone.
- **Everything lands in the existing draft**, so the whole session is one
  reviewable, undoable unit. The draft model already supports this.

Honest limit: it binds plain keycodes only. Layer-taps, mod-taps and anything
with parameters still go through the rail. That is fine — plain keycodes are
the overwhelming majority of any keymap.

### 2. Starter layouts — alphas only

Nobody designs a base layer from nothing. They start from QWERTY, Colemak-DH,
Graphite, Canary, Gallium, Workman or Dvorak and change nine keys.

**Scope corrected by research — see `LAYOUTS.md`.** Whole layout *systems* of the
Miryoku class are off the table, and not for UI reasons: they are built on home
row mods whose behaviour is set by `tapping-term-ms`, `require-prior-idle-ms`,
`flavor` and positional hold-tap, none of which the Studio protocol exposes.
Writing those bindings would produce a keyboard that misfires with the remedy in
a file we cannot touch.

Swapping the alpha block is a different matter — plain key presses, no timing
coupling, no firmware dependency. Identify the block by detecting a known layout
in the current bindings and permuting positionally, and decline when nothing is
recognised. That avoids guessing geometry on a board we have never seen.

### 3. Copy and mirror

**Copy from another layer — built.** Nobody builds a symbol layer from nothing;
they start from the base and change the dozen keys that differ. "Copy from" in
the left rail writes the whole source layer into the current one.

The detail that matters is that the entire copy is **one undo entry**. Forty-two
separate entries would mean forty-two presses of ⌘Z to take back one mistaken
click, which is not an undo history so much as a punishment. Verified against
the real draft module: undo returns the draft to zero overrides rather than
stacking inverse ones, and copying onto an identical layer records nothing.

**Mirror — built, and deliberately per-key.** Mirroring a whole half is a
feature that sounds useful and is almost never correct: the halves hold
different letters, so copying one onto the other destroys the layer. What is
actually symmetric is a handful of keys — home-row mods, thumb clusters, layer
keys, the modifier row.

And for those a copy is still wrong, because the mirror of Left Shift is Right
Shift. Mirror flips modifier handedness in both places ZMK encodes it: as a
usage in its own right (0xE0–0xE3 ↔ 0xE4–0xE7) and as the implicit modifier
mask in the top byte. Parameters that are not usages — a layer index, a
Bluetooth profile — are passed through untouched, since they have no handedness.

The button appears only when the board has an opposite key. Verified on a
synthetic 42-key split: all 42 positions form involutive pairs, and the centre
key of an odd board correctly reports no twin.

### 4. Bulk apply — and why it has to *wrap*, not replace

Pick an action, then click keys to apply it repeatedly. "Make this whole row
transparent" becomes 12 clicks instead of 12 round trips through the rail.

The version of this that matters is **hold-taps**, and it is not the obvious
one. Home-row mods means eight keys that each become a mod-tap **keeping the
letter already on them** — A stays A on tap and becomes Ctrl on hold. Applying
one identical binding to eight keys is useless here: it would give all eight
the same tap letter.

So bulk apply defaults to **preserving each key's own usage as the tap
parameter** whenever the painted behavior is a hold-tap and the key underneath
is a plain key press. Paint mod-tap across the home row and each key keeps its
own letter. That single rule is the difference between a feature nobody uses
and home-row mods in eight clicks.

The checkbox is offered only for hold-taps, because a plain key press has no
second parameter for the existing usage to survive into.

The same shape generalises to every other bulk task ZMK has: paint a layer-tap
along a thumb row, paint transparent down a column, paint sticky-shift across a
half. The wrap rule is what makes it work for the parameterised ones.

### What this adds up to

| | Now | With the above |
| --- | --- | --- |
| Base layer (42 keys) | ~3 min of hunting | ~30 s of typing |
| Second layer from first | ~3 min | one click, then edit the differences |
| Whole 4-layer board | **~2 hours** | **~10 minutes** |

That is the difference between a tool people tolerate and one they recommend.

### Deliberately excluded

**Import/export keymap JSON.** Tempting — the protocol can read and write every
binding, so a client-side file format is technically easy. But a Studio-only
JSON format that is not ZMK's own `.keymap` invents a second source of truth
for keymaps, and the moment someone edits both, the question of which one is
real has no good answer. Worth doing only in agreement with upstream ZMK.

---

## 7. Phasing

Ordered by value per unit of risk.

**Phase 1 — reclaim the canvas.** Remove the rail; move `BehaviorBindingPicker`
into the bottom shelf. Delete the status strip. Collapse header and toolbar into
one band plus one cluster row. *Largest visible win, no new interaction model.*

**Phase 2 — listen mode.** Select a key, press a key, bound. *Highest ratio of
delight to code in the whole document.*

**Phase 3 — command palette.** Every Group A action registered as a command.
Lets the clusters shed everything rare.

**Phase 4 — multi-select and layer chip direct manipulation.** Drag to reorder,
double-click to rename, marquee to multi-select.

**Phase 5 — destructive-action hygiene.** Reset settings out of the convenience
menu, typed confirmation, undo toast for layer delete wired to `restoreLayer`.

---

## 8. Risks and open questions

**The shelf covers the bottom rows.** On a 100-key board at Fit zoom, a 40%
shelf can hide the bottom two rows including the key being edited. Mitigation is
scroll-into-view on open, but it needs testing on a real 5-row board — this is
the most likely thing to have to redesign.

**Listen mode versus browser shortcuts.** While listening, the app must capture
keys the browser wants (⌘W, ⌘T, F5). It cannot get all of them on the web, and
Tauri behaves differently from the browser. The mode must degrade honestly: show
which keys it cannot capture rather than silently missing them.

**Discoverability of a palette-first design.** If rare actions live only behind
⌘K, users who never learn ⌘K never find them. The bottom hint line has to teach
it, and there should be a visible affordance in the header, not only a shortcut.

**Accessibility of a canvas-first layout.** *Revised during implementation.*
This originally called for focus to be trapped while the shelf is open. That is
wrong: the shelf is a properties editor, not a dialog, and trapping focus would
make selecting a different key by keyboard impossible without closing first —
while retargeting the shelf by clicking another key is a core flow. It ships
non-modal (`role="region"`), focus moves in on open, and Escape or the close
button returns focus to the originating key. Other close paths deliberately do
not steal focus back, because the user has already chosen somewhere to be.

**Touch and narrow viewports.** The current design already stacks below `xl`.
The shelf model is *better* on mobile — it is the native pattern — but the
peripheral clusters need a collapse rule.

**Unvalidated by users.** Everything here is reasoned from the code and from one
reference screenshot. None of it has been tested with anyone who owns a ZMK
board. The measurements in §2 are facts; the proposals in §4–5 are hypotheses.
