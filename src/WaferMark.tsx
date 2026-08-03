import { ChromaticMetalMark } from "./design-system/ChromaticMetalMark";

export interface WaferMarkProps {
  className?: string;
  compact?: boolean;
}

const waferMarkUrl = `${import.meta.env.BASE_URL}wafer-mark.png`;

/**
 * Wafer's mark rendered as a live chromatic-metal surface. The canvas derives
 * its mask from the supplied bitmap, so the brand asset remains the single
 * source of truth while light, dispersion and roughness stay fully dynamic.
 */
export const WaferMark = ({ className, compact = false }: WaferMarkProps) => (
  <div
    aria-label="Wafer Studio"
    className={["inline-flex items-center gap-2.5", className]
      .filter(Boolean)
      .join(" ")}
    role="img"
  >
    <span
      aria-hidden="true"
      className={[
        "relative shrink-0 overflow-hidden rounded-[22%] bg-[#202020]",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.18)]",
        compact ? "size-9" : "size-11",
      ].join(" ")}
    >
      <ChromaticMetalMark
        className="absolute inset-0 size-full"
        intensity={1}
        roughness={0.33}
        rgbSplit={0.58}
        src={waferMarkUrl}
      />
    </span>
    <span aria-hidden="true" className="leading-none">
      <span className="block text-sm font-extrabold tracking-[0.14em] text-base-content">
        WAFER
      </span>
      <span className="mt-1 block text-[0.625rem] font-medium uppercase tracking-[0.18em] text-base-content/45">
        Studio
      </span>
    </span>
  </div>
);
