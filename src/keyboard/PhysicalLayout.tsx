// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import type React from "react";
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
  /** Key positions with unsent draft changes on the visible layer. */
  draftedPositions?: ReadonlySet<number>;
  /** Every key in the multi-selection, including the primary one. */
  selectedPositions?: ReadonlySet<number>;
  oneU?: number;
  hoverZoom?: boolean;
  zoom?: LayoutZoom;
  onPositionClicked?: (position: number, event: React.MouseEvent) => void;
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
    // The key's own origin inside the board, so its dispersive ring can place
    // the shared light relative to itself. See the board-space note below.
    "--kx": `${left}px`,
    "--ky": `${top}px`,
  } as CSSProperties;
}

export const PhysicalLayout = ({
  positions,
  selectedPosition,
  draftedPositions,
  selectedPositions,
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

  /**
   * Publish where the board sits, so its keys can sample the shared light.
   *
   * The board is wrapped in `transform: scale()`, and inside a transformed
   * ancestor `background-attachment: fixed` stops resolving against the
   * viewport — it resolves against the transformed box instead. Every key's
   * dispersive ring therefore became a *local* gradient that could not see the
   * cursor: the same hue on every key, never changing as the light moved.
   *
   * Rather than give up the transform, the light is converted into the board's
   * own coordinate space. These three numbers are all that conversion needs,
   * and they change only when the board moves or rescales — never per frame —
   * so the light itself keeps costing two root properties and no JavaScript.
   */
  useLayoutEffect(() => {
    const element = layoutRef.current;
    if (!element) return;

    const publish = () => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--board-x", `${rect.left}px`);
      element.style.setProperty("--board-y", `${rect.top}px`);
      element.style.setProperty("--board-scale", `${scale || 1}`);
    };

    publish();

    const resizeObserver = new ResizeObserver(publish);
    resizeObserver.observe(element);
    // Scrolling the canvas moves the board without resizing it, and capture
    // catches the scroller itself rather than only the window.
    window.addEventListener("scroll", publish, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", publish, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", publish, { capture: true });
      window.removeEventListener("resize", publish);
    };
  }, [scale]);

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
        drafted={draftedPositions?.has(idx)}
        coSelected={idx !== selectedPosition && selectedPositions?.has(idx)}
        onClick={
          onPositionClicked
            ? (event) => onPositionClicked(idx, event)
            : undefined
        }
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
