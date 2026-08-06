// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import { useState, type CSSProperties } from "react";
import {
  Bluetooth,
  Layers,
  Search as SearchIcon,
  Sparkles,
} from "lucide-react";
import { DispersionField } from "./DispersionField.tsx";
import { useDispersionPulse } from "./dispersionContext.ts";
import { ActionRow } from "./ActionRow.tsx";
import { SearchField } from "./SearchField.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

/**
 * The design system reference.
 *
 * Everything on this page is lit by the same light — the mark, the section
 * rules, the swatch edges and every control. That is the point of the page: one
 * gradient in viewport space, and every edge a window onto it, so you can watch
 * the whole interface disperse as a single surface rather than as a thousand
 * separately-styled parts.
 *
 * There is no material inspector any more, and no canvas. The WebGL metal and
 * aberration shaders this page used to demonstrate now live in `deprecated/`.
 */

const SUBSTRATE = [
  { token: "--surface-canvas", label: "Canvas" },
  { token: "--surface-panel", label: "Panel" },
  { token: "--surface-raised", label: "Raised" },
  { token: "--surface-hover", label: "Hover" },
  { token: "--surface-selected", label: "Selected" },
];

const SPECTRUM = [
  { token: "--spectral-cyan", label: "Cyan" },
  { token: "--spectral-azure", label: "Azure" },
  { token: "--spectral-violet", label: "Violet" },
  { token: "--spectral-magenta", label: "Magenta" },
];

const DISPERSION_STEPS = [
  { token: "--dispersion-inert", label: "Inert", use: "At rest" },
  { token: "--dispersion-latent", label: "Latent", use: "Hover" },
  { token: "--dispersion-engaged", label: "Engaged", use: "Focus, open" },
  {
    token: "--dispersion-committed",
    label: "Committed",
    use: "Selected, bound",
  },
];

function Section({
  title,
  law,
  children,
}: {
  title: string;
  law: string;
  children: React.ReactNode;
}) {
  return (
    // Every divider on the page is a slice of the same spectrum field, so
    // scrolling reads as moving down one continuous surface rather than past a
    // stack of unrelated rules.
    <section className="grid gap-3">
      <hr aria-hidden="true" className="wafer-rule" />
      <div className="grid gap-1 pt-3">
        <h2 className="text-sm font-bold tracking-wide text-ink">{title}</h2>
        <p className="max-w-prose text-xs leading-relaxed text-muted">{law}</p>
      </div>
      {children}
    </section>
  );
}

function Specimens() {
  const [query, setQuery] = useState("");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [selected, setSelected] = useState("momentary");
  const pulse = useDispersionPulse();

  return (
    <div className="grid gap-8">
      <Section
        title="Substrate"
        law="Achromatic. Value carries hierarchy; hue never touches a fill, because split light only reads as split light against neutral."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SUBSTRATE.map((swatch) => (
            <div key={swatch.token} className="grid gap-1.5">
              <div
                className="wafer-dispersive h-14 rounded-surface border border-line-subtle"
                style={
                  {
                    background: `rgb(var(${swatch.token}))`,
                    "--dispersion": "var(--dispersion-latent)",
                  } as CSSProperties
                }
              />
              <div className="grid">
                <span className="text-[0.6875rem] font-semibold text-ink">
                  {swatch.label}
                </span>
                <span className="font-mono text-[0.5625rem] text-tertiary">
                  {swatch.token}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Spectrum"
        law="The dispersion ramp, in the order light splits — and deliberately the cool half of the spread only. A warm stop in a one-pixel edge stops reading as dispersion and starts reading as a glow, which is why there is no orange in it."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SPECTRUM.map((swatch) => (
            <div key={swatch.token} className="grid gap-1.5">
              <div
                className="wafer-dispersive h-14 rounded-surface"
                style={
                  {
                    background: `rgb(var(${swatch.token}))`,
                    "--dispersion": "var(--dispersion-committed)",
                  } as CSSProperties
                }
              />
              <div className="grid">
                <span className="text-[0.6875rem] font-semibold text-ink">
                  {swatch.label}
                </span>
                <span className="font-mono text-[0.5625rem] text-tertiary">
                  {swatch.token}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Dispersion scale"
        law="The system's fourth axis, alongside colour, type, and space. An element sits on a step according to how live it is. Move your pointer across these tiles: each one samples the same light from its own position, so they never show the same hue at once."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DISPERSION_STEPS.map((step) => (
            <div
              key={step.token}
              className="wafer-dispersive grid min-h-24 content-end gap-0.5 rounded-surface border border-line-subtle bg-raised/60 p-3"
              style={{ "--dispersion": `var(${step.token})` } as CSSProperties}
            >
              <span className="text-[0.6875rem] font-semibold text-ink">
                {step.label}
              </span>
              <span className="text-[0.625rem] text-tertiary">{step.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Controls"
        law="Dispersion confirms state; it never carries it alone. Every selected, focused, and disabled state below stays fully legible with the effect switched off."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-2">
            <SearchField
              ariaLabel="Search actions"
              value={query}
              placeholder="Search actions"
              onChange={setQuery}
            />
            <SegmentedControl
              ariaLabel="Density"
              value={density}
              options={[
                { id: "compact", label: "Compact" },
                { id: "comfortable", label: "Comfortable" },
              ]}
              onChange={setDensity}
            />
            <div className="flex gap-2">
              <button type="button" className="wafer-button wafer-dispersive">
                Secondary
              </button>
              <button
                type="button"
                data-intent="primary"
                className="wafer-button wafer-dispersive"
                onClick={(event) => pulse(event)}
              >
                <Sparkles aria-hidden="true" className="size-3.5" />
                Commit
              </button>
            </div>
          </div>

          <div className="grid content-start gap-0.5">
            {[
              {
                id: "momentary",
                icon: Layers,
                title: "Momentary layer",
                description: "Open a layer while held.",
              },
              {
                id: "bluetooth",
                icon: Bluetooth,
                title: "Bluetooth profile",
                description: "Select or clear a saved host.",
              },
              {
                id: "find",
                icon: SearchIcon,
                title: "Disabled example",
                description: "Unavailable on this firmware.",
                disabled: true,
              },
            ].map((row) => (
              <ActionRow
                key={row.id}
                icon={row.icon}
                title={row.title}
                description={row.description}
                disabled={row.disabled}
                selected={selected === row.id}
                onPress={() => setSelected(row.id)}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Keys"
        law="The keyboard is the one genuinely physical object in the interface, and the only place a literal shadow is allowed. Everything else is light on a flat plane."
      >
        <div className="flex flex-wrap gap-1.5">
          {["Q", "W", "E", "R", "T", "⇧", "␣"].map((cap, index) => (
            <button
              key={cap}
              type="button"
              data-interactive="true"
              data-selected={index === 2}
              className="wafer-key relative grid size-14 place-items-center text-xs font-semibold"
            >
              {cap}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function DesignSystemPage() {
  return (
    <DispersionField>
      <div className="wafer-substrate grid h-full grid-rows-[auto_minmax(0,1fr)] bg-canvas">
        <header className="flex items-center justify-between gap-4 border-b border-line-subtle bg-panel/80 px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* The mark is the system's proof: an achromatic tile catching the
                same light as everything else, wearing the same spectral ring at
                full commitment. It is not a logo with an effect on it. */}
            <span
              aria-hidden="true"
              className="wafer-dispersive wafer-mark-tile block size-9 rounded-[22%] bg-raised"
              style={{
                backgroundImage: "var(--wafer-light-field)",
                backgroundAttachment: "fixed",
              }}
            />
            <span className="leading-none">
              <span className="block text-sm font-extrabold tracking-[0.14em] text-ink">
                WAFER
              </span>
              <span className="mt-1 block text-[0.625rem] font-medium uppercase tracking-[0.18em] text-tertiary">
                Design system
              </span>
            </span>
          </div>
        </header>

        <main className="min-h-0 overflow-y-auto">
          <div className="relative">
            {/* Achromatic, and painted in viewport space like every other
                specular surface here, so the hero is lit by the same source as
                the controls further down rather than carrying its own art. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10"
              style={{
                backgroundImage: "var(--wafer-light-field)",
                backgroundAttachment: "fixed",
                opacity: 0.12,
              }}
            />
            <div className="grid min-h-64 content-end gap-2 p-6 pt-24">
              <h1 className="max-w-lg text-2xl font-bold leading-tight text-ink">
                Dispersion, as a law rather than a texture.
              </h1>
              <p className="max-w-prose text-xs leading-relaxed text-muted">
                One light source for the whole interface. Distance from it sets
                brightness, bearing from it sets hue, and how live an element is
                decides how much of that hue reaches its edge. Nothing here is a
                bevel, and nothing here is a shader — it is one gradient, and
                every edge on the page is a window onto it.
              </p>
            </div>
          </div>

          <div className="grid gap-8 p-6 pt-0">
            <Specimens />
          </div>
        </main>
      </div>
    </DispersionField>
  );
}
