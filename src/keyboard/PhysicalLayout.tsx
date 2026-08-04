import {
  CSSProperties,
  PropsWithChildren,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Key } from "./Key";
import type { LayoutZoom } from "./layoutZoom";

export type KeyPosition = PropsWithChildren<{
  id: string;
  header?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  r?: number;
  rx?: number;
  ry?: number;
}>;

interface PhysicalLayoutProps {
  positions: Array<KeyPosition>;
  selectedPosition?: number;
  oneU?: number;
  hoverZoom?: boolean;
  zoom?: LayoutZoom;
  onPositionClicked?: (position: number) => void;
}

interface PhysicalLayoutPositionLocation {
  x: number;
  y: number;
  r?: number;
  rx?: number;
  ry?: number;
}

function scalePosition(
  { x, y, r, rx, ry }: PhysicalLayoutPositionLocation,
  oneU: number,
): CSSProperties {
  const left = x * oneU;
  const top = y * oneU;
  let transformOrigin = undefined;
  let transform = undefined;
  const transformStyle = "preserve-3d";

  if (r) {
    // Use `??` so an explicit rotation origin of 0 is honored; `rx || x`
    // collapsed a legitimate 0 back to the key's own position, pivoting the
    // key around its own corner instead of the layout origin (#97).
    const transformX = ((rx ?? x) - x) * oneU;
    const transformY = ((ry ?? y) - y) * oneU;
    transformOrigin = `${transformX}px ${transformY}px`;
    transform = `rotate(${r}deg)`;
  }

  return {
    top,
    left,
    transformOrigin,
    transform,
    transformStyle,
  };
}

export const PhysicalLayout = ({
  positions,
  selectedPosition,
  oneU = 48,
  hoverZoom = false,
  zoom,
  onPositionClicked,
}: PhysicalLayoutProps) => {
  const layoutRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = layoutRef.current;
    if (!element) return;

    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;

    const calculateScale = () => {
      if (zoom === "auto") {
        // clientWidth/clientHeight include the parent's own padding, so
        // measuring them directly reports space the board cannot actually use
        // and Fit scales the board too large — it then overflows and the canvas
        // grows a scrollbar. Subtract the padding to get the real content box.
        const styles = getComputedStyle(parent);
        const padX =
          parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const padY =
          parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        const availableWidth = Math.max(1, parent.clientWidth - padX);
        const availableHeight = Math.max(1, parent.clientHeight - padY);

        // A little breathing room so the board never touches the rails.
        const margin = Math.min(window.innerWidth, window.innerHeight) * 0.02;
        const newScale = Math.min(
          availableWidth / (element.clientWidth + 2 * margin),
          availableHeight / (element.clientHeight + 2 * margin),
        );
        setScale(Math.max(newScale, 0.05));
      } else {
        setScale(zoom || 1);
      }
    };

    calculateScale(); // Initial calculation

    const resizeObserver = new ResizeObserver(() => {
      calculateScale();
    });

    resizeObserver.observe(element);
    resizeObserver.observe(parent);

    return () => {
      resizeObserver.disconnect();
    };
  }, [zoom]);

  // TODO: Add a bit of padding for rotation when supported
  const rightMost = positions
    .map((k) => k.x + k.width)
    .reduce((a, b) => Math.max(a, b), 0);
  const bottomMost = positions
    .map((k) => k.y + k.height)
    .reduce((a, b) => Math.max(a, b), 0);

  const positionItems = positions.map(({ children, ...position }, idx) => (
    <div
      key={position.id}
      className="absolute hover:z-10 focus-within:z-20"
      style={scalePosition(position, oneU)}
    >
      <Key
        oneU={oneU}
        selected={idx === selectedPosition}
        onClick={onPositionClicked ? () => onPositionClicked(idx) : undefined}
        {...position}
      >
        {children}
        {onPositionClicked && (
          <span className="sr-only">Key position {idx + 1}</span>
        )}
      </Key>
    </div>
  ));

  return (
    <div
      ref={wrapperRef}
      style={{
        height: bottomMost * oneU * scale + "px",
        width: rightMost * oneU * scale + "px",
      }}
      data-hover-zoom={hoverZoom || undefined}
      role="group"
      aria-label="Keyboard layout"
    >
      <div
        ref={layoutRef}
        className="relative origin-top-left"
        style={{
          height: bottomMost * oneU + "px",
          width: rightMost * oneU + "px",
          transform: `scale(${scale})`,
          transformStyle: "preserve-3d",
        }}
      >
        {positionItems}
      </div>
    </div>
  );
};
