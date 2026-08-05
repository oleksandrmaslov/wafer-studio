<div align="center">

<img src="public/wafer-mark.png" alt="" width="96" />

# Wafer Studio

**A keyboard configurator for ZMK Studio-enabled keyboards.**

[Open in your browser](https://oleksandrmaslov.github.io/wafer-zmk-studio/) ·
[Download for desktop](https://oleksandrmaslov.github.io/wafer-zmk-studio/download.html) ·
[Releases](https://github.com/oleksandrmaslov/wafer-zmk-studio/releases)

</div>

---

## Why this exists

Setting up a 42-key split with four layers is 168 bindings. Through a
conventional configurator — click a key, read a list, find the action, click it —
that is over two hours, which is why people give up and hand-edit a `.keymap`
file instead.

Wafer Studio is built around getting that number down. It speaks the standard
ZMK Studio protocol and changes nothing on the wire; what it changes is the
number of decisions between you and a finished keyboard.

## What makes it fast

**Type through the board.** Select a key, then _press the key you want it to
become_. It binds, advances to the next key in reading order, and waits. You set
your base layer by typing your base layer. The application is running on a
keyboard — hunting for `A` in a searchable list while your finger rests on `A`
is the central absurdity of every configurator, and it is free to fix.

**Starter layouts.** Your alphas are read off the current layer and matched
against QWERTY, Colemak, Colemak-DH, Dvorak and Workman. Recognised, they can be
permuted to any of the others in one step — letters only, leaving punctuation,
thumbs and layer keys exactly where you put them. If nothing matches, it
declines rather than guessing at your geometry.

**Copy a layer, then change the dozen keys that differ.** Nobody builds a symbol
layer from nothing. The whole copy is a single undo entry, not forty-two.

**Paint a binding across keys — and hold-taps wrap rather than replace.** Home-row
mods means eight keys that each become a mod-tap _keeping the letter already on
them_. Paint mod-tap across the home row and every key keeps its own letter.
That one rule is the difference between a feature nobody uses and home-row mods
in eight clicks.

**Mirror, per key.** The mirror of Left Shift is Right Shift, so handedness is
flipped in both places ZMK encodes it. Offered only when the board actually has
an opposite key.

**Multi-select and a command palette.** Shift-click for a run in reading order,
⌘/Ctrl-click to add one. ⌘K reaches everything else.

Nothing is sent to the keyboard until you review the draft.

## Connecting

|           | Browser          | Desktop app |
| --------- | ---------------- | ----------- |
| USB       | ✅ Chrome / Edge | ✅          |
| Bluetooth | Linux only       | ✅          |

Browsers expose Web Bluetooth for this on Linux only, which is the entire reason
the desktop build exists. Over USB the web version does everything the desktop
one does.

No keyboard nearby? **Explore demo keyboard** on the connection screen opens the
full editor against a deterministic fixture. `?demo=1` connects it directly.

## What it cannot do

Worth knowing before you go looking. A ZMK Studio binding is one behavior id and
two integers — there is no field that can reference another binding — so
behaviour composition is impossible through the protocol, not merely unbuilt.

Not exposed by ZMK Studio at all: combos, macros, tap-dance definitions,
conditional layers, encoders and sensors, RGB underglow, backlight, display
config, Bluetooth profile management, power and idle settings, and hold-tap
timing (`tapping-term-ms`, `quick-tap-ms`, `flavor`).

These need firmware and protocol work upstream in ZMK. Any UI here would be a UI
over nothing. You _can_ bind the composite behaviours your firmware was already
compiled with.

## Development

```sh
npm ci
npm run dev
```

Checks that must pass:

```sh
npx tsc --noEmit
npx eslint src --max-warnings 0
npx prettier --write .
npm run build
```

`npm run storybook` runs the component workshop.

### Desktop build

Needs the Rust toolchain, and on Windows the MSVC linker — Rust's default
Windows target links through it, and installing Rust alone is not enough:

```sh
winget install --id Microsoft.VisualStudio.2022.BuildTools \
  --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Open a new terminal afterwards so the PATH change is picked up, then:

```sh
npm run tauri dev      # or: npm run tauri build
```

A release build needs several GB free — `src-tauri/target` grows large, and a
full disk surfaces as a confusing `LNK1318` linker error rather than an
out-of-space one.

### Cutting a release

Tauri does not cross-compile: a `.dmg` needs macOS, a `.deb` needs Linux, an
`.msi` needs Windows. Pushing a `v*` tag runs
[`.github/workflows/release.yml`](.github/workflows/release.yml), which drafts a
release and builds all three into it.

The download page reads `src/data/release-data.json`, regenerated at build time
from the latest **published** release — drafts are invisible to that endpoint,
and draft assets are not publicly downloadable. So publish first, then rebuild
and redeploy the site.

## Documentation

| File                                                 | What it holds                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| [`DESIGN.md`](./DESIGN.md)                           | The visual system — surfaces, the dispersion scale, the accent |
| [`UX.md`](./UX.md)                                   | Interaction research and the roadmap it came from              |
| [`LAYOUTS.md`](./LAYOUTS.md)                         | What people actually build on these keyboards                  |
| [`AGENTS.md`](./AGENTS.md)                           | Working memory: decisions, reversals, and the traps            |
| [`PROTOCOL_PROVENANCE.md`](./PROTOCOL_PROVENANCE.md) | Pinned protocol versions                                       |

`AGENTS.md` is the one to read before changing anything. It records why each
decision was made and which of them have already been tried and reversed.

## Protocol and attribution

Wafer Studio is a redesign of [ZMK Studio](https://github.com/zmkfirmware/zmk-studio)
and would not exist without it. It pins `@zmkfirmware/zmk-studio-ts-client` at
`0.0.18` and does not change the wire protocol.

Upstream ZMK Studio code remains under Apache-2.0; the official TypeScript
client is MIT. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

**Wafer Studio is an independent product and is not an official ZMK
application.**
