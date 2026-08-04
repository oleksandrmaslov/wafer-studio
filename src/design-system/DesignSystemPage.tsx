import { useCallback, useState, type CSSProperties } from "react";
import { Bluetooth, Layers, Search as SearchIcon, Sparkles } from "lucide-react";
import { DispersionField } from "./DispersionField.tsx";
import { useDispersionPulse } from "./dispersionContext.ts";
import { AberrationCanvas } from "./shader/AberrationCanvas.tsx";
import { AberrationControls } from "./shader/AberrationControls.tsx";
import { useAberration } from "./shader/useAberration.ts";
import { ABERRATION_PRESETS } from "./shader/params.ts";
import { ActionRow } from "./ActionRow.tsx";
import { SearchField } from "./SearchField.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { WAFER_FINISHES, useWaferFinish } from "../appearance.ts";

/**
 * The design system reference.
 *
 * Everything on this page is lit by the same light as everything else on it —
 * the shader, the specimen edges, and the inspector's own controls. That is the
 * point of the page: you can watch the material and the interface agree.
 */

const SUBSTRATE = [
  { token: "--surface-canvas", label: "Canvas" },
  { token: "--surface-panel", label: "Panel" },
  { token: "--surface-raised", label: "Raised" },
  { token: "--surface-hover", label: "Hover" },
  { token: "--surface-selected", label: "Selected" },
];

const SPECTRUM = [
  { token: "--spectral-azure", label: "Azure" },
  { token: "--spectral-violet", label: "Violet" },
  { token: "--spectral-coral", label: "Coral" },
  { token: "--spectral-amber", label: "Amber" },
];

const DISPERSION_STEPS = [
  { token: "--dispersion-inert", label: "Inert", use: "Resting chrome" },
  { token: "--dispersion-latent", label: "Latent", use: "Hover" },
  { token: "--dispersion-engaged", label: "Engaged", use: "Focus, open" },
  { token: "--dispersion-committed", label: "Committed", use: "Selected, bound" },
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
    <section className="grid gap-3 border-t border-line-subtle pt-6">
      <div className="grid gap-1">
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
        law="Achromatic. Value carries hierarchy; hue never touches a fill, because metal only reads as metal against neutral."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SUBSTRATE.map((swatch) => (
            <div key={swatch.token} className="grid gap-1.5">
              <div
                className="h-14 rounded-surface border border-line-subtle"
                style={{ background: `rgb(var(${swatch.token}))` }}
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
        law="The dispersion ramp, in the order light splits. Coral is not a separate brand colour. It is this ramp's warm sample, which is why the accent and the aberration never look like two systems."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SPECTRUM.map((swatch) => (
            <div key={swatch.token} className="grid gap-1.5">
              <div
                className="h-14 rounded-surface"
                style={{ background: `rgb(var(${swatch.token}))` }}
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
  const { params, setParams, applyPreset } = useAberration("alloy");
  const [finish, setFinish] = useWaferFinish();
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(JSON.stringify(params, null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  }, [params]);

  return (
    <DispersionField>
      <div className="wafer-substrate grid h-full grid-rows-[auto_minmax(0,1fr)] bg-canvas">
        <header className="flex items-center justify-between gap-4 border-b border-line-subtle bg-panel/80 px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* The mark keeps its own material rather than the working values:
                at 36px the tuning that suits a full-bleed field reads as noise. */}
            <span className="wafer-dispersive wafer-mark-tile grid size-9 place-items-center overflow-hidden rounded-[22%]">
              <span className="absolute inset-0">
                <AberrationCanvas params={ABERRATION_PRESETS.mark} />
              </span>
            </span>
            <span className="leading-none">
              <span className="block text-sm font-extrabold tracking-[0.14em] text-ink">
                WAFER
              </span>
              <span className="mt-1 block text-[0.625rem] font-medium uppercase tracking-[0.18em] text-tertiary">
                Design system
              </span>
            </span>
          </div>
          <div className="w-64">
            <SegmentedControl
              ariaLabel="Finish amplitude"
              value={finish}
              options={WAFER_FINISHES.map((entry) => ({
                id: entry.id,
                label: entry.label,
              }))}
              onChange={setFinish}
            />
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-h-0 overflow-y-auto">
            <div className="relative isolate">
              <div className="absolute inset-0 -z-10">
                <AberrationCanvas params={params} />
              </div>
              {/* Text contrast must never depend on a shader parameter, so the
                  copy sits on a scrim rather than on a blend mode. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    "linear-gradient(to top, rgb(var(--surface-canvas)) 4%, rgb(var(--surface-canvas) / 0.86) 38%, rgb(var(--surface-canvas) / 0.15) 78%, transparent)",
                }}
              />
              <div className="grid min-h-72 content-end gap-2 p-6 pt-28">
                <h1 className="max-w-lg text-2xl font-bold leading-tight text-ink">
                  Metallic aberration, as a law rather than a texture.
                </h1>
                <p className="max-w-prose text-xs leading-relaxed text-muted">
                  One light source for the whole interface. Distance from it sets
                  brightness, bearing from it sets hue, and steepness decides
                  whether any colour appears at all. Nothing here is a bevel.
                </p>
              </div>
            </div>

            <div className="grid gap-8 p-6">
              <Specimens />
            </div>
          </main>

          <aside className="min-h-0 border-line-subtle bg-panel/70 lg:border-l">
            <AberrationControls
              params={params}
              onChange={setParams}
              onPreset={applyPreset}
              copied={copied}
              onCopy={onCopy}
              preview={
                <div className="h-40 border-b border-line-subtle">
                  <AberrationCanvas params={params} />
                </div>
              }
            />
          </aside>
        </div>
      </div>
    </DispersionField>
  );
}
