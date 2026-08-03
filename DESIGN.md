# Wafer design system

## The thesis

**This product has no accent colour. The accent is a material.**

The Wafer mark is chromatic metal: a chrome form whose rainbows sit in tight
bands along its bevels. That material is the design system's primary, and every
committed, selected, and primary surface wears it. There is no coral fill left
anywhere in the product.

## Chromatic metal

Independently implemented, inspired by iridescent metals and thin-film
interference. The parameter names match the reference material's so tuning
transfers by eye; the algorithm is our own.

The layers, in order:

| Layer | Job |
| --- | --- |
| Shape field | Rounded rectangle, or an SDF mask for the mark |
| Height field | Dome plus FBM dents, domain-warped |
| Normals | Screen-space derivatives of that height |
| Anisotropy | Bands stretched along `angle`, at `scale` and `stretch` |
| Gradient | A **colour** ramp, tiled `repeats` times |
| RGB separation | Red and blue sampled either side of green |
| Specular | Sharp and broad Blinn-Phong lobes |
| Fresnel rim | Drives the silhouette toward white |
| Grain | Micro-roughness |

### Three things that decide whether it reads as metal

These were each learned the hard way, and each one alone is enough to ruin it.

**Metal has no diffuse term.** What you see is the environment, reflected.
Multiplying the ramp by a diffuse factor and adding specular on top flattens the
whole thing into pastel mush. The environment goes through essentially
untouched; only Fresnel, a tight specular lobe, and a shadow term act on it.

**The gradient is mostly white.** It is a studio reflected in chrome: white and
silver across most of its length, one genuinely dark gap, and the dispersed
colour packed into a narrow slice beside that gap. Spreading colour evenly
across the ramp produces an oil slick every time. Colour lives in the ramp, not
in the RGB split; deriving it from channel separation on a grey ramp gives
brushed steel instead.

**The band coordinate must not be steepened.** Pushing it toward a square wave
collapses it to 0 and 1, and with an integer `repeats` both ends land on the
same ramp position, so the surface floods with a single colour and the gradient
is only ever visible in the transitions. Hard edges belong in the gradient's
stops. For the same reason the domain warp on the bands stays small: chrome is
anisotropic streaks, and heavy warp turns them into marbling.

## Two implementations

Both obey the same profile, and they must always agree.

### The CSS ramps (`src/design-system/metal.css`)

A canvas per chip would be absurd, so the material is also expressed as a
repeating gradient with the split fringes baked in as stops: cool on the
entering wall of the dark band, warm on the leaving one.

| Token | Use |
| --- | --- |
| `--metal-texture` | Spectral, baked from the shader. Edges, marks, fills. |
| `--metal-texture-bright` | Silver, baked. Anything carrying text. |
| `--metal-ramp` / `--metal-ramp-bright` | CSS gradient fallbacks of the same stops. |

`<MetalTextures />` renders the real shader once offscreen and publishes both as
custom properties. A WebGL context per chip is the most expensive mistake
available here, so dozens of controls share two baked images and the chrome on a
chip is the same material as the hero rather than a gradient imitating it.

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
| Button | Primary actions and hero fills. |
| Keycap | Selected keys. |
| Logo | The mark's material. |
| Silver | Monochrome. High contrast and text-bearing fills. |

## Contrast

This is the part a metallic accent gets wrong, so it is fixed by construction
rather than by inspection.

Text never sits on the spectral ramp. It sits on silver, whose darkest band is
`#8F9AA4`. Against `--metal-ink` (`#0D0F11`) that is **6.7:1**, so a label
clears WCAG AA against the *worst* point of the material, not against its
average. High-contrast mode goes further: `adaptPresetForTheme` drops the split
to 0.08 and forces the silver ramp, because colour must never be the only
signal.

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
