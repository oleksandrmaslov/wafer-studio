export interface WaferMarkProps {
  className?: string;
  compact?: boolean;
}

/**
 * The supplied Wafer icon paired with a restrained product label. The image is
 * decorative here because the combined mark already has an accessible name.
 */
export const WaferMark = ({ className, compact = false }: WaferMarkProps) => (
  <div
    aria-label="Wafer Studio"
    className={["inline-flex items-center gap-2.5", className]
      .filter(Boolean)
      .join(" ")}
    role="img"
  >
    <img
      alt=""
      aria-hidden="true"
      className={[
        "shrink-0 rounded-[20%]",
        compact ? "size-9" : "size-11",
      ].join(" ")}
      src="/wafer-mark.svg"
    />
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
