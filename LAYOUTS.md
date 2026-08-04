# Layout systems and configurator prior art

Research for the starter-layout work in `UX.md` §6b. Two questions: what do
people actually build on small ZMK/QMK boards, and what have other configurators
already learned.

One finding reframes the feature, so it goes first.

---

## 1. The finding that changes the plan

**Miryoku-class layouts depend on firmware settings ZMK Studio cannot reach.**

Every one of these layouts is built on home row mods — modifiers on the home row
that only appear when a key is held. Whether that feels like magic or like a
broken keyboard is decided almost entirely by hold-tap tuning:

| Setting | What it does |
| --- | --- |
| `tapping-term-ms` | How long a hold must last |
| `require-prior-idle-ms` | Resolves to a tap when you are typing fast, removing input lag |
| `flavor` (`balanced`, `tap-preferred`, `hold-preferred`) | How ambiguity is broken |
| positional hold-tap | Forces a tap when the next key is on the *same hand* |

None of these are in the Studio RPC. They are devicetree properties set when the
firmware is compiled.

In naive implementations a home row mod must be held longer than the tapping
term and released faster than it to tap, which demands very consistent typing
speed that most people do not have — and mod-taps getting stuck is a
[known ZMK issue](https://github.com/zmkfirmware/zmk/issues/986). The community
fix is bilateral combinations and positional hold-tap, not different keycodes.

**So a "apply Miryoku" button that writes 36 mod-tap bindings would hand the user
a keyboard that feels broken**, and the fix would be in a file Studio never sees.
This is the single most important constraint on the feature. See §5 for what to
do instead.

---

## 2. Miryoku, and the class it defines

[Miryoku](https://github.com/manna-harbour/miryoku) is the reference point —
3.8k stars, and implementations for QMK, ZMK, KMonad, KMK and Oryx. It is a
36-key layout, and its stated principles are:

1. Use layers instead of reaching for distant keys
2. Use both hands instead of contortions
3. Keep fingers at home positions as much as possible
4. Make full use of the thumbs
5. Avoid unnecessary complication

**Six layers, one purpose each**, per
[the reference](https://deepwiki.com/manna-harbour/miryoku):

| Layer | Contents |
| --- | --- |
| Base | Colemak Mod-DH alphas + punctuation |
| Nav | Cursor keys at home position, clipboard, page controls |
| Mouse | Mouse movement mirroring the Nav arrangement |
| Media | Volume and playback |
| Num | Numerals in numpad arrangement |
| Sym | Shifted symbols matching the Num positions |

**Home row mods in GACS order**, mirrored on both hands: GUI on pinky, Alt on
ring, Control on middle, Shift on index.

**Layers come off thumb holds.** Tap for the primary function, hold for a layer —
Esc/Media, Space/Nav, Tab/Mouse, Enter/Sym, Backspace/Num, Delete/Fun. Each
layer is reached with the *opposite* hand's thumb from the keys it serves.

Two structural ideas are worth naming because they generalise:

- **Mirrored layer access.** Layers live under the hand that is not using them.
- **Positional correspondence.** Sym sits directly over Num so the shifted
  symbol is on the same key as its digit. Mouse mirrors Nav.

## 3. Where the family disagrees

The interesting split is **mod-taps versus one-shot mods**.

[Seniply](https://keymapdb.com/) is 34 keys, six layers, "Callum-style" — no
layer-taps, and one-shot modifiers instead of home row mods: tap a mod and it
queues, applying to the next key. This exists specifically because home row mods
are the part of Miryoku people bounce off.

Others in the family: **Arsenik** (33 keys, works on any keyboard),
**Anachron**, **pnohty**, and a large collection at
[KeymapDB](https://keymapdb.com/).

So there is no single correct system, and any starter feature must not pretend
otherwise. What is common across all of them:

- 30–36 keys, split, columnar stagger
- Layers instead of reaches
- Thumbs carry the heavy work
- One purpose per layer
- Symmetry between hands

## 4. Alpha layouts, for the record

The other axis, and much simpler — it is a permutation of the alpha block:

| Layout | Character |
| --- | --- |
| **Colemak-DH** | Widely held as the best all-round English layout; fixes Colemak's lateral stretch. Miryoku's default. |
| **Colemak** | The realistic switch if you must keep shipping work during it |
| **Graphite** | Strong when punctuation ergonomics matter |
| **Canary** | Colemak evolution accounting for row stagger |
| **Gallium** | Balanced across all main metrics |
| **Workman** | A deliberate QWERTY alternative without a heavily changed symbol layer |
| **Dvorak** | Historical, still in use |

Comparisons at [cyanophage](https://cyanophage.github.io/) and
[getreuer's guide](https://getreuer.info/posts/keyboards/alt-layouts/index.html).

## 5. What this means for Wafer Studio

**Do not ship "apply Miryoku".** It would write mod-taps whose feel depends on
timing settings Studio cannot set, and the user would blame us for a keyboard
that misfires. Anything that writes home row mods must say plainly that tuning
lives in the firmware.

**Do ship alpha-only starter layouts.** Swapping the alpha block to Colemak-DH,
Graphite, Canary, Gallium, Workman or Dvorak is plain `&kp` bindings with no
timing dependency and no firmware coupling. It is the safe, genuinely useful
80%.

The hard part remains identifying the alpha block on an unfamiliar board.
Options, least to most reliable: assume the 3×10 in reading order (breaks on
anything unusual); require the user to point at the top-left alpha key and
derive the block; or only offer it when the current layer already looks like a
known layout — detect QWERTY by reading existing bindings, then permute
positionally. **The third is the honest one**: it needs no geometry guessing,
and if the board does not currently read as a known layout, the feature declines
rather than guesses.

**Structural helpers beat whole layouts.** The parts of Miryoku that transfer
without firmware coupling are the *moves*, and we have most of them: mirror
(mirrored thumbs, GACS symmetry), bulk apply that wraps (home row mods in one
pass), copy layer (Sym over Num positional correspondence). A "mirror this
layer's thumb row" or "make Sym match Num" is closer to how these layouts are
actually built than a one-shot template.

---

## 6. Configurator prior art

| Tool | Model | Notable |
| --- | --- | --- |
| **VIA** | Live over HID, no reflash | Closed source; ~4 layer default cap; no encoder keycodes |
| **Vial** | Live, GUI-first | Open source; keymap definition stored *in the firmware* and read at runtime, so no PR to a central repo |
| **Oryx** (ZSA) | Cloud, compiles firmware | Full QMK feature access precisely *because* it compiles |
| **keymap-editor** | Edits devicetree via GitHub | Combos, macros, conditional layers, encoders — searchable behaviors, auto-formatting |
| **keymap-drawer** | Renders SVG from a keymap | Decouples physical layout from keymap; visualises hold-taps and combos |

**The pattern is unmissable.** The configurators that can edit macros, combos
and conditional layers are the ones that manipulate *source* and compile —
[keymap-editor](https://github.com/nickcoutsos/keymap-editor) edits devicetree
through GitHub; Oryx builds firmware in the cloud. The ones that talk to a
running keyboard over a protocol — VIA, Vial, and ZMK Studio — are all bounded
by what that protocol can express.

That is the same ceiling documented in `AGENTS.md` §2, and it is architectural
rather than a gap in our UI. It also says where the ceiling could move: Studio's
advantage is live editing with no reflash, and the honest long-term answer is
either a richer protocol upstream or an export path into a `.keymap` for the
things the protocol cannot hold.

Two things worth stealing outright:

- **Vial storing its definition in the firmware** so the tool needs no central
  registry — ZMK Studio already does the equivalent via `getPhysicalLayouts` and
  `listAllBehaviors`, which is why it works on unknown boards. Worth knowing we
  are on the right side of this one.
- **keymap-drawer decoupling physical layout from keymap.** We have this
  separation in the protocol; we do not yet use it for anything but rendering.

---

## Sources

- [Miryoku](https://github.com/manna-harbour/miryoku) · [reference](https://deepwiki.com/manna-harbour/miryoku) · [ZMK implementation](https://github.com/manna-harbour/miryoku_zmk)
- [Miryoku adapted, with layer/mod detail](https://github.com/jellydn/miryoku-silakka54-layout)
- [KeymapDB](https://keymapdb.com/) · [Arsenik](https://github.com/OneDeadKey/arsenik)
- [Taming home row mods with bilateral combinations](https://sunaku.github.io/home-row-mods.html) · [urob/zmk-config](https://github.com/urob/zmk-config)
- [ZMK hold-tap docs](https://zmk.dev/docs/keymaps/behaviors/hold-tap) · [mod-taps getting stuck](https://github.com/zmkfirmware/zmk/issues/986)
- [Keyboard layout stats](https://cyanophage.github.io/) · [A guide to alt layouts](https://getreuer.info/posts/keyboards/alt-layouts/index.html) · [Colemak Mod-DH](https://colemakmods.github.io/mod-dh/compare.html)
- [keymap-editor](https://github.com/nickcoutsos/keymap-editor) · [ZMK community spotlight](https://zmk.dev/blog/2023/11/09/keymap-editor) · [keymap-drawer](https://github.com/caksoylar/keymap-drawer)
- [QMK/VIA/Vial overview](https://maxzsol.com/a-detailed-overview-of-qmk-via-and-vial-visual-configurators-for-mechanical-keyboards/) · [Oryx](https://configure.zsa.io/)
