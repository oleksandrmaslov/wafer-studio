# Wafer design system

## The thesis

**This product has no accent colour. The accent is a material.**

The Wafer mark is chromatic metal: a chrome form whose rainbows sit in tight
bands along its bevels. That material is the design system's primary, and every
committed, selected, and primary surface wears it. There is no coral fill left
anywhere in the product.

## Chromatic metal

Modelled on Figma's shader of the same name, which is shape-driven rather than
texture-driven. Four steps:

1. **Bevel the shape.** A height field rolls off over `rounding` pixels at each
   edge. `depth` sets how steeply it turns.
2. **Take the normal** of that bevel.
3. **Find one coordinate** from it, and look that up in a **grayscale** gradient
   ramp tiled `repeats` times. This is what produces chrome's banding.
4. **Sample the ramp three times**, once per channel, at positions `rgbSplit`
   apart.

Step 4 is the one worth understanding. **The ramp contains no hue at all.**
Colour appears only where the ramp changes fastest, because that is where the
three channel samples disagree most. Flat regions stay perfectly achromatic no
matter how high the split goes, which is why the rainbows land in tight bands
along the bevel rather than washing across the surface.

### The ramp coordinate has two terms

```
t = (base + bend) * scale + offset
```

- **base** is a linear sweep across the shape. It makes the bands run straight
  through the flat interior.
- **bend** is the bevel refracting that sweep. It makes them compress and fan
  out around the rim.

The normal alone gives contour rings parallel to the outline. Position alone
gives flat stripes with no metal in them. It is the sum that reads as a
reflection.

## Two implementations

Both obey the same profile, and they must always agree.

### The CSS ramps (`src/design-system/metal.css`)

A canvas per chip would be absurd, so the material is also expressed as a
repeating gradient with the split fringes baked in as stops: cool on the
entering wall of the dark band, warm on the leaving one.

| Token | Use |
| --- | --- |
| `--metal-ramp` | Full range. Edges, marks, decorative fills. |
| `--metal-ramp-bright` | Floor lifted to `#8F9AA4`. Anything carrying text. |

The bands rotate with `--light-x`, so a pointer sweep moves the reflection
across every metal surface on the page at once.

### The shader (`src/design-system/shader/`)

The reference implementation, for hero surfaces and the mark. Its parameter
schema mirrors Figma's control set in the same order, so tuning transfers
between the two by eye. The panel is generated from that schema, presets are
validated against it, and the runtime reads its uniform names from it, so the
inspector can never drift out of sync.

`MetalSurface` reads its parent's computed `border-radius` and bevels to that,
so the material follows the real geometry.

### Roles

Presets are roles, not moods. Each exists because a surface needs the material
to behave differently.

| Role | For |
| --- | --- |
| Action | Text-bearing fills. Lifted floor keeps labels legible. |
| Edge | Selection rings and small chrome. |
| Mark | The logo's material. |
| Panel | Broad bands for hero surfaces. |

## Contrast

This is the part a metallic accent gets wrong, so it is fixed by construction
rather than by inspection.

Text never sits on the full-range ramp. It sits on `--metal-ramp-bright`, whose
darkest band is `#8F9AA4`. Against `--metal-ink` (`#0D0F11`) that is **6.7:1**,
so a label clears WCAG AA against the *worst* point of the material, not against
its average. The shader's `floor` parameter does the same job, which is why the
Action role sets it high and Panel does not.

Disabled drops the material entirely. A greyed label over live chrome still
reads as available.

## Foundations

- **Substrate.** Achromatic. Value carries hierarchy and hue never touches a
  fill, because metal only reads as metal against neutral.
- **Ink and line.** Every token documented with its measured contrast against
  panel; all clear AA in both schemes.
- **Status** colours stay chromatic and stay outside the material. Meaning must
  never be confused with reflection.
- **Geometry.** One radius scale by role: `--radius-control` for buttons and
  inputs, `--radius-surface` for rows and tiles, `--radius-panel`,
  `--radius-modal`, `--radius-key`. Pills are reserved for filter chips, the
  only control that is a tag rather than a button.
- **Motion.** 120ms and 170ms on `cubic-bezier(0.2, 0.8, 0.2, 1)`. Nothing
  exceeds 300ms. Pressable controls scale to 0.97 on `:active`.
- **Strength.** How present the material is on a control, replacing what a
  colour scale would normally do: inert, latent (hover), engaged (focus),
  committed (selected).

## Non-negotiables

1. **The material never carries state alone.** Every state it accompanies also
   has a non-metallic signal: tint, weight, border, or icon.
2. **Focus is never metallic.** A 3px `--focus-ring` outline, always.
3. **Text contrast never depends on a shader value.** Copy over a shader sits on
   a scrim, never on a blend mode.
4. **Reduced motion removes movement, not feedback.** Transforms drop; opacity
   and colour transitions stay, because they are what tell you the interface
   responded.
5. **Hover is gated** behind `(hover: hover) and (pointer: fine)`, or a tap
   leaves a touch device stuck in a hovered state.
6. **The canvas is the product.** Chrome frames the keyboard; it never competes.

## Known constraints

- If WebGL is unavailable or the program fails to link, the canvas hides itself
  and the CSS ramp underneath remains. The interface degrades to the quiet
  finish, not to nothing.
- Writing `--light-x` on `:root` invalidates style for everything that reads it.
  That is inherent to one shared light. Writes are deduplicated at three decimal
  places and the loop parks when idle.
- `MetalSurface` redraws only when something changes. A static surface costs one
  draw, not sixty a second; only a non-zero `evolution` animates.

## Also in this repo

`src/design-system/aberration/` holds the earlier material: a single shared
light source with fbm-based liquid chrome and true optical dispersion. It is
self-contained and unused by Wafer Studio, kept intact to be lifted into another
project.

## Acceptance checks

- Precision, Alloy, and Prism preserve identical layout, interactions, and
  availability.
- Desktop, narrow desktop, and 390px mobile layouts remain usable.
- Keyboard focus is always visible and never relies on the material.
- Text meets WCAG AA in both schemes, including placeholders, helper text, and
  every button label against the darkest band of its own fill.
- With the shader disabled entirely, every state is still readable.
