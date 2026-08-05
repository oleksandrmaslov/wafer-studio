# Wafer interaction model

Wafer presents user intent first and compiles it to the behaviors reported by
the connected keyboard. Runtime behavior IDs remain an implementation detail.

## Key assignment library

- **Keys** contains keyboard and consumer usages only: letters, numbers,
  symbols, editing, navigation, function keys, media, modifier keys, and
  modifier chords.
- **Actions** contains single firmware operations, grouped by purpose:
  keymap flow, layers, typing helpers, connectivity, pointer, lighting, power,
  system, and device-specific fallbacks.
- **Multi** contains compound behaviors already provided by the firmware. The
  first supported templates are Mod-Tap and Layer-Tap, expressed as clear Hold
  and Tap choices.

Only capabilities reported by the keyboard appear. Wafer never assumes that a
numeric behavior ID has the same meaning on another firmware build.

## Combo editor

Combos are relationships between physical key positions, not another choice in
a single-key behavior menu. Their future editor should therefore be a dedicated
canvas mode:

1. Select two or more keys directly on the keyboard.
2. Show the chord as one outlined visual group.
3. Choose its result using the same Keys / Actions / Multi library.
4. Configure timing, active layers, prior-idle behavior, and release mode in a
   compact panel.
5. Warn about fully or partially overlapping combos and make those overlaps
   visible on the canvas.

The complete combo becomes one local draft operation so review and rollback do
not expose a partially configured chord.

## Conditional-layer editor

Conditional layers belong beside layer management. The visual model is a rule:

`When [Lower] + [Raise] are active → activate [Adjust]`

Each rule should use named layer chips and a small relationship diagram. Wafer
should prevent duplicate inputs, a target layer appearing in its own condition,
and invalid/missing layers. It should also explain when layer ordering could
make the target inaccessible and visualize chained rules before they are
applied.

## Current protocol boundary

The pinned ZMK Studio client can assign firmware-defined behaviors to keys, but
does not expose read/write messages for combos or conditional layers. Official
ZMK Studio documentation currently lists both editors as planned. Wafer should
not show non-functional creation controls until the firmware reports those
capabilities. When the protocol arrives, these structures should use their own
snapshot, draft, validation, review, and reconciliation path rather than being
encoded as key bindings.

- <https://zmk.dev/docs/features/studio>
- <https://zmk.dev/docs/keymaps/combos>
- <https://zmk.dev/docs/keymaps/conditional-layers>
