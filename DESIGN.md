# Wafer design system

## The thesis

Wafer's surfaces carry no colour of their own. Colour appears only where an edge
turns away from the light and splits it. That is the whole identity, and this
design system treats it as a law the interface obeys rather than as a texture
applied to the interface.

Three statements define the system:

1. **Distance from the light decides brightness.**
2. **Bearing from the light decides hue.**
3. **Steepness decides whether any colour appears at all.**

The third is the important one. It is what keeps flat regions achromatic no
matter how far dispersion is pushed, and it is why the result reads as split
light rather than as an oil slick.

### Why this is not skeuomorphism

Skeuomorphic chrome fakes a material by drawing a bevel on each control: every
button carries its own little gradient pretending to be a lit object. Nothing
here pretends to be an object. The system models one physical law and lets
geometry decide what each edge shows.

The whole application shares **one** light source. Every dispersive edge paints
its gradient in viewport space, so each element is a window onto the same field
and samples it at its own position. An element near the light shows a white
specular edge; one further away falls into the spectrum. Move the light and the
entire interface re-disperses coherently, because there is only one gradient.

This cannot be authored per component, and it cannot be screenshotted. That is
the point.

## Finish levels

Not three visual systems. One material at three amplitudes. Every level
disperses, because dispersion is the base of the system rather than a decoration
layered onto it. What changes is how loudly.

| Level | Gain | Character |
| --- | --- | --- |
| Precision | 0.5 | Colour only where the surface truly turns. The quiet default. |
| Alloy | 1.0 | The reference amplitude. Balanced light and spectrum. |
| Prism | 1.55 | Full spectral response across every live edge. |

The level is stored on `<html data-wafer-finish>` and is independent of the
operating system light and dark preference. It scales `--dispersion-gain` and
`--specular-gain`.

## Foundations

### Substrate

Achromatic. Value carries hierarchy and hue never touches a fill, because split
light only reads as split light against neutral. A warm cast would tint the
specular highlight and the system would collapse.

`--surface-canvas`, `--surface-panel`, `--surface-raised`, `--surface-hover`,
`--surface-selected`, `--surface-overlay`.

### Ink and line

`--ink-primary`, `--ink-secondary`, `--ink-tertiary`; `--line-subtle`,
`--line-default`, `--line-strong`. Every ink token is documented with its
measured contrast against panel, and every one clears WCAG AA in both schemes.

### Spectrum

`--spectral-cyan`, `--spectral-azure`, `--spectral-violet`, `--spectral-magenta`,
in the order light splits.

**Requirement — the ramp is the cool half of the spread only.** No warm stop may
enter it. A warm stop in a one-pixel edge stops reading as dispersion and starts
reading as a glow, which drags every dispersive edge on the page toward looking
like a highlight rather than like split light. The sweep runs out to magenta and
back rather than passing through orange.

### Accent

**Requirement — the accent is achromatic. There is no brand hue.**

`--wafer-primary` is the far end of the value range, not a colour: near-black on
light, polished chrome on dark, inverting with the scheme. `--primary-content`,
`--accent-foreground`, `--wafer-primary-hover`, `--wafer-deep` and
`--surface-selected` are all neutral with it.

This exists so the spectrum is the *only* source of hue in the interface. An
accent colour competing with the dispersion ramp produces two colour systems
sharing a page, and the ramp always loses — it lives at one pixel, and a filled
accent does not. Removing the hue also removed the system's tightest contrast
margins: every accent pair now measures 10.9:1 or better in both schemes, where
the previous coral pairs sat at 4.8:1 and 5.8:1.

What marks an element as primary is therefore **position on the dispersion
scale, not colour** — `.wafer-accent` sits permanently at `--dispersion-committed`
so its edge carries full spectrum at rest, while every other control's edge stays
dark until you touch it.

### Light

`--light-specular` and `--light-shadow` are the two ends of the value range.
Every lit edge and every sheen is built from these plus the spectrum; there are
no per-component gradients. On light paper the dark end has to be genuinely dark
or the surface has nowhere to go but white.

### Dispersion scale

The system's fourth axis, alongside colour, type, and space. An element sits on
a step according to how live it is.

| Step | Value | Use |
| --- | --- | --- |
| `--dispersion-inert` | 0 | At rest |
| `--dispersion-latent` | 0.34 | Hover |
| `--dispersion-engaged` | 0.66 | Focus, open, active |
| `--dispersion-committed` | 1 | Selected, bound, primary |

### Geometry

One radius scale, applied by role and not by taste: `--radius-control` (0.5rem)
for buttons, inputs, and segments; `--radius-surface` (0.625rem) for rows and
tiles; `--radius-panel` (0.875rem) for panels; `--radius-modal` (1rem);
`--radius-key` (0.5rem). Pills (`999px`) are reserved for filter chips, which are
the only control in the system that is a tag rather than a button.

### Motion

`--motion-fast` 120ms and `--motion-base` 170ms on
`cubic-bezier(0.2, 0.8, 0.2, 1)`. Nothing in the product interface exceeds
300ms. Pressable controls scale to 0.97 on `:active`.

## Implementation

The law is implemented once.

### 1. The CSS edge layer (`src/design-system/dispersion.css`)

`--light-x` and `--light-y` on `:root` position a viewport-space radial
(specular) and conic (spectrum) field. `.wafer-dispersive` cuts a one pixel ring
out of that field with a mask, at an opacity set by `--dispersion`. This is
cheap enough to put on every control on the page.

### 2. There is no second implementation

There used to be one — a WebGL band shader, and later a metallic aberration
shader, for hero surfaces and the mark. Both are **deprecated** and now live in
`deprecated/`, outside the build.

**Requirement — the CSS edge layer is the only implementation.** A second
renderer for the same law has to be kept in agreement with the first by hand,
and it brings failure modes the CSS layer does not have: context loss, driver
compile failures, blank canvases, and a fallback path that must be maintained
and is almost never seen. One gradient, one law, no canvas.

### The light (`src/design-system/DispersionField.tsx`)

Owns two numbers and publishes them to `<html>`. The pointer writes to a ref, a
single `requestAnimationFrame` loop eases the light toward it, and the loop
parks itself once the light settles. React re-renders zero times while the light
moves. `pulse()` throws the light to a point so that it can follow meaning, such
as a committed binding, and not only the cursor.

## Non-negotiables

These hold regardless of finish level.

1. **Dispersion never carries state alone.** Every state it accompanies also has
   a non-spectral signal: tint, weight, border, or icon.
2. **Focus is never dispersive.** A 3px `--focus-ring` outline, always.
3. **Text contrast never depends on a material value.** Copy over a lit surface
   sits on a scrim, never on a blend mode.
4. **Reduced motion removes movement, not feedback.** The light parks at rest
   and transforms are dropped; opacity and colour transitions stay, because they
   are what tell you the interface responded.
5. **Hover effects are gated** behind `(hover: hover) and (pointer: fine)`, or a
   tap leaves a touch device stuck in a hovered state.
6. **The canvas is the product.** Chrome frames the keyboard; it does not
   compete with it.
7. **Firmware capability decides what exists.** Visual finish never changes
   behaviour, hierarchy, or availability.

## Known constraints

- Viewport-space gradients rely on `background-attachment: fixed`. Inside an
  ancestor with a `transform`, `filter`, or `backdrop-filter`, that resolves
  against the ancestor's box instead, and the edge degrades to a local gradient.
  It still looks correct, it just stops being globally coherent, so avoid
  transformed ancestors around dispersive edges. Where a transform is
  unavoidable — the keyboard is inside `transform: scale()` — convert the light
  into that element's own coordinate space instead: publish its offset and
  scale, and let CSS do the subtraction. `.wafer-key-field` is the worked
  example.
- Writing `--light-x` on `:root` invalidates style for everything that reads it.
  This is inherent to one shared light. Writes are deduplicated at three decimal
  places and the loop parks when idle.
- `mask-composite` is what cuts the one pixel ring. Without it the ring paints
  as a filled rectangle, so the property is required rather than progressive.

## Acceptance checks

- Precision, Alloy, and Prism preserve identical layout, interactions, and
  availability.
- Desktop, narrow desktop, and 390px mobile layouts remain usable.
- Keyboard focus is always visible and never relies on a finish effect.
- Text meets WCAG AA in both colour schemes, including placeholders, helper
  text, and every button label against its own background.
- No state change alters control dimensions or remounts the editor.
- With dispersion disabled entirely, every state in the product is still
  readable and distinguishable.
