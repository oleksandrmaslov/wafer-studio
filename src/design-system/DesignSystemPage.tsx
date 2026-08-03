import { useCallback, useState, type CSSProperties } from "react";
import { Bluetooth, Layers, Search as SearchIcon, Sparkles } from "lucide-react";
import { DispersionField } from "./DispersionField.tsx";
import { useDispersionPulse } from "./dispersionContext.ts";
import { MetalCanvas } from "./shader/MetalCanvas.tsx";
import { MetalControls } from "./shader/MetalControls.tsx";
import { MetalField } from "./shader/MetalField.tsx";
import { useMetal } from "./shader/useMetal.ts";
import { METAL_PRESETS } from "./shader/params.ts";
import { ActionRow } from "./ActionRow.tsx";
import { SearchField } from "./SearchField.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { WAFER_FINISHES, useWaferFinish } from "../appearance.ts";

/**
 * The design system reference.
 *
 * Everything accented on this page is made of the same material, published once
 * and sampled in viewport space. No control on it is highlighted with a colour.
 */

const SUBSTRATE = [
  { token: "--surface-canvas", label: "Canvas" },
  { token: "--surface-panel", label: "Panel" },
  { token: "--surface-raised", label: "Raised" },
  { token: "--surface-hover", label: "Hover" },
  { token: "--surface-selected", label: "Selected" },
];

const EDGE_STEPS = [
  { value: "0", label: "Inert", use: "Resting chrome" },
  { value: "var(--metal-edge-idle)", label: "Latent", use: "Available" },
  { value: "var(--metal-edge-hover)", label: "Engaged", use: "Hover, focus" },
  { value: "var(--metal-edge-active)", label: "Committed", use: "Selected" },
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
        law="Achromatic. Value carries hierarchy and hue never touches a fill, because metal only reads as metal against neutral."
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
        title="Material"
        law="There is no accent colour in this system. The reflection ramp is achromatic; the three colour channels sample it at three different positions, so a steep transition splits into spectrum and a flat region stays silver. Every hue you can see was produced, not chosen."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <div className="wafer-metal h-20 rounded-surface" />
            <span className="text-[0.6875rem] font-semibold text-ink">Raw</span>
            <span className="text-[0.625rem] leading-snug text-tertiary">
              Decorative only. Never put text on this.
            </span>
          </div>
          <div className="grid gap-1.5">
            <div className="wafer-metal-fill grid h-20 place-items-center rounded-surface text-xs font-bold">
              Legible
            </div>
            <span className="text-[0.6875rem] font-semibold text-ink">Fill</span>
            <span className="text-[0.625rem] leading-snug text-tertiary">
              Plated so ink always clears AA.
            </span>
          </div>
          <div
            className="wafer-metal-edge grid h-20 place-items-center rounded-surface border border-line-subtle bg-raised/60"
            style={{ "--metal-edge": "1" } as CSSProperties}
          >
            <span className="text-[0.6875rem] font-semibold text-ink">Edge</span>
          </div>
          <div className="grid gap-1.5">
            <div className="wafer-metal-chip h-20 rounded-surface" />
            <span className="text-[0.6875rem] font-semibold text-ink">Chip</span>
            <span className="text-[0.625rem] leading-snug text-tertiary">
              Small sample, for swatches and slots.
            </span>
          </div>
        </div>
      </Section>

      <Section
        title="Edge scale"
        law="How live a control is decides how much material shows at its edge. Move your pointer across these: the material slides against the light, so no two sample the same part of it."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EDGE_STEPS.map((step) => (
            <div
              key={step.label}
              className="wafer-metal-edge grid min-h-24 content-end gap-0.5 rounded-surface border border-line-subtle bg-raised/60 p-3"
              style={{ "--metal-edge": step.value } as CSSProperties}
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
        law="The material confirms state; it never carries it alone. Every selected, focused, and disabled state below stays legible with the effect switched off."
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
              <button type="button" className="wafer-button wafer-metal-edge">
                Secondary
              </button>
              <button
                type="button"
                data-intent="primary"
                className="wafer-button wafer-metal-fill"
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
        law="The keyboard is the one genuinely physical object in the interface, and the only place a literal shadow is allowed. A selected key is ringed in the material."
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
  const { params, setParams, applyPreset } = useMetal("alloy");
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
      {/* Publishes the material to CSS. Renders nothing itself. */}
      <MetalField params={params} />

      <div className="wafer-substrate grid h-full grid-rows-[auto_minmax(0,1fr)] bg-canvas">
        <header className="flex items-center justify-between gap-4 border-b border-line-subtle bg-panel/80 px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* The mark keeps its own material: at 36px the tuning that suits a
                full-bleed field reads as noise. */}
            <span className="wafer-metal-edge wafer-mark-tile relative grid size-9 place-items-center overflow-hidden rounded-[22%]">
              <span className="absolute inset-0">
                <MetalCanvas params={METAL_PRESETS.mark} shaped />
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
                <MetalCanvas params={params} />
              </div>
              {/* Text contrast must never depend on a shader parameter, so the
                  copy sits on a scrim rather than on a blend mode. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    "linear-gradient(to top, rgb(var(--surface-canvas)) 4%, rgb(var(--surface-canvas) / 0.88) 40%, rgb(var(--surface-canvas) / 0.18) 78%, transparent)",
                }}
              />
              <div className="grid min-h-72 content-end gap-2 p-6 pt-28">
                <h1 className="max-w-lg text-2xl font-bold leading-tight text-ink">
                  Accent is a material, not a colour.
                </h1>
                <p className="max-w-prose text-xs leading-relaxed text-muted">
                  One achromatic reflection ramp, sampled three times at three
                  offsets. Steep transitions split into spectrum, flat regions
                  stay silver. Nothing here is tinted.
                </p>
              </div>
            </div>

            <div className="grid gap-8 p-6">
              <Specimens />
            </div>
          </main>

          <aside className="min-h-0 border-line-subtle bg-panel/70 lg:border-l">
            <MetalControls
              params={params}
              onChange={setParams}
              onPreset={applyPreset}
              copied={copied}
              onCopy={onCopy}
              preview={
                <div className="h-40 border-b border-line-subtle">
                  <MetalCanvas params={params} />
                </div>
              }
            />
          </aside>
        </div>
      </div>
    </DispersionField>
  );
}
