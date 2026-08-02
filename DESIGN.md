# Wafer design system

## Design read

Wafer Studio is a dense keyboard configuration tool for enthusiasts. Its design
language combines the directness of Work Louder Input with Wafer's metallic,
chromatic identity. Metal appears as controlled light and edge color—not as a
literal chrome object or a skeuomorphic control panel.

## Principles

1. The keyboard canvas is the product. Chrome should frame it, not compete with
   it.
2. Prefer one surface and internal rhythm over cards nested inside cards.
3. Keep interactive hit targets at least 40px while making their visible mass
   lighter.
4. Coral identifies the primary commitment or current choice. It is not a
   general-purpose text color.
5. Firmware capabilities determine which controls exist. Visual variants never
   change behavior, hierarchy, or availability.
6. Texture cannot carry state. Focus, selection, warning, and disabled states
   remain legible without metallic effects.

## Finish variants

- **Precision** is the default. Flat warm surfaces, hairline separators, and a
  restrained coral selection treatment. This is the production candidate.
- **Alloy** uses the same geometry with a subtle, static specular gradient and
  silver highlight. It should feel material without looking embossed.
- **Prism** adds a one-pixel cyan–violet–coral edge to selected controls. The
  spectrum is never used as a fill or persistent glow.

The active finish is stored on `<html data-wafer-finish>` and remains independent
from the operating-system light/dark color scheme.

## Foundations

- Surfaces: canvas, panel, raised, hover, selected, overlay.
- Ink: primary, secondary, tertiary, inverse.
- Lines: subtle, control, strong.
- Accent: solid, hover, soft, foreground, on-accent.
- Geometry: control, surface, panel, modal, and key radii.
- Density: compact and comfortable control heights, panel padding, and group
  gaps. Compact is the editor default.
- Elevation: panel, popover, modal, and physical-key shadows.
- Motion: 120–180ms state transitions using opacity and transform. Reduced motion
  removes non-essential transitions.

## Component recipes

- **Segmented control:** quiet shared track; selected item uses a soft tint and
  accent foreground rather than a solid accent fill.
- **Action row:** 52–60px, icon + name + one-line description, with one selected
  edge. Do not place each row in a heavy standalone card.
- **Search field:** 40px, one control border, clear button only when populated.
- **Option tile:** compact selectable value; grid only when side-by-side
  comparison is valuable.
- **Panel header:** owns selection context, current value, and local-draft status
  so those are not repeated as separate cards.
- **Inline notice:** tinted background and icon; border only for warnings and
  destructive actions.

## Acceptance checks

- Precision, Alloy, and Prism preserve identical layout and interactions.
- Desktop, narrow desktop, and 390px mobile layouts remain usable.
- Keyboard focus is always visible and never relies on finish effects.
- Text meets WCAG AA contrast; muted text remains readable in both color schemes.
- No state change alters control dimensions or causes the editor to remount.
- Draft review and Apply output are identical across finishes.
