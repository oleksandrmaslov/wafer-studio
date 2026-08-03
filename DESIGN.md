# Wafer design system

## The thesis

The Wafer mark is a chrome glyph on a neutral tile. Its surface carries no
colour of its own; colour appears only where the form turns away from the light
and splits it. That is the whole identity, and this design system treats it as a
law the interface obeys rather than as a texture applied to the interface.

Three statements define the system:

1. **Distance from the light decides brightness.**
2. **Bearing from the light decides hue.**
3. **Steepness decides whether any colour appears at all.**

The third is the important one. It is what keeps flat regions achromatic no
matter how far dispersion is pushed, and it is why the result reads as metal
rather than as an oil slick.

### Why this is not skeuomorphism

Skeuomorphic chrome fakes a material by drawing a bevel on each control: every
button carries its own little gradient pretending to be a lit object. Nothing
here pretends to be an object. The system models one physical law and lets
geometry decide what each edge shows.

The whole application shares **one** light source. Every metallic edge paints
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
| Alloy | 1.0 | The reference material. Balanced metal and spectrum. |
| Prism | 1.55 | Full spectral response across every live edge. |

The level is stored on `<html data-wafer-finish>` and is independent of the
operating system light and dark preference. It scales `--dispersion-gain` and
`--specular-gain`, and the shader presets of the same name move in step.

## Foundations

### Substrate

Achromatic. Value carries hierarchy and hue never touches a fill, because metal
only reads as metal against neutral. A warm cast would tint the specular
highlight and the material would collapse.

`--surface-canvas`, `--surface-panel`, `--surface-raised`, `--surface-hover`,
`--surface-selected`, `--surface-overlay`.

### Ink and line

`--ink-primary`, `--ink-secondary`, `--ink-tertiary`; `--line-subtle`,
`--line-default`, `--line-strong`. Every ink token is documented with its
measured contrast against panel, and every one clears WCAG AA in both schemes.

### Spectrum

`--spectral-azure`, `--spectral-violet`, `--spectral-coral`, `--spectral-amber`,
in the order light splits.

`--wafer-primary` is not a separate brand colour. It is the coral sample of this
same ramp, which is why the accent and the aberration never look like two
systems sharing a page.

### Metal

`--metal-specular` and `--metal-shadow` are the two ends of the material's value
range. The shader interpolates between them rather than between the substrate
and white, so on light paper the surface still has somewhere dark to go instead
of washing out.

### Dispersion scale

The system's fourth axis, alongside colour, type, and space. An element sits on
a step according to how live it is.

| Step | Value | Use |
| --- | --- | --- |
| `--dispersion-inert` | 0 | Resting chrome |
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

The law is implemented twice, at two costs, and the two must always agree.

### 1. The CSS edge layer (`src/design-system/dispersion.css`)

`--light-x` and `--light-y` on `:root` position a viewport-space radial
(specular) and conic (spectrum) field. `.wafer-dispersive` cuts a one pixel ring
out of that field with a mask, at an opacity set by `--dispersion`. This is
cheap enough to put on every control on the page.

### 2. The shader (`src/design-system/shader/`)

A WebGL fragment shader renders the material itself: a domain-warped height
field, a normal derived from its true gradient, a reflected studio environment,
and a spectrum admitted only where the slope is steep. Used for hero surfaces
and the mark, not for ordinary chrome.

Both read the same light and the same spectrum tokens, so a small control and
the field behind it cast the same colour.

### The light (`src/design-system/DispersionField.tsx`)

Owns two numbers and publishes them to `<html>`. The pointer writes to a ref, a
single `requestAnimationFrame` loop eases the light toward it, and the loop
parks itself once the light settles. React re-renders zero times while the light
moves. `pulse()` throws the light to a point so that it can follow meaning, such
as a committed binding, and not only the cursor.

## The shader inspector

Parameters are declared once in `shader/params.ts`. The control panel is
generated from that schema, presets are validated against it, and the WebGL
runtime reads its uniform names from it, so the panel can never drift out of
sync with the shader. Presets are the entry point and the sliders are the escape
hatch.

Groups: Surface (scale, detail, warp, relief, flow), Light (metalness, specular,
spread, exposure), Dispersion (dispersion, edge bias, chroma, rotation), Finish
(contrast, grain, vignette, opacity).

Tuning persists under a versioned storage key and every value read back is
clamped to the schema, so a stale or corrupt entry can never brick the surface.

## Non-negotiables

These hold regardless of finish level or shader parameters.

1. **Dispersion never carries state alone.** Every state it accompanies also has
   a non-spectral signal: tint, weight, border, or icon.
2. **Focus is never dispersive.** A 3px `--focus-ring` outline, always.
3. **Text contrast never depends on a shader value.** Copy over a shader sits on
   a scrim, never on a blend mode.
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
  transformed ancestors around dispersive chrome.
- Writing `--light-x` on `:root` invalidates style for everything that reads it.
  This is inherent to one shared light. Writes are deduplicated at three decimal
  places and the loop parks when idle.
- If WebGL is unavailable or the program fails to link, the canvas hides itself
  and the CSS specular field underneath is what remains. The interface degrades
  to the quiet finish, not to nothing.

## Acceptance checks

- Precision, Alloy, and Prism preserve identical layout, interactions, and
  availability.
- Desktop, narrow desktop, and 390px mobile layouts remain usable.
- Keyboard focus is always visible and never relies on a finish effect.
- Text meets WCAG AA in both colour schemes, including placeholders, helper
  text, and every button label against its own background.
- No state change alters control dimensions or remounts the editor.
- With the shader disabled entirely, every state in the product is still
  readable and distinguishable.
