// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  DispersionContext,
  type DispersionControls,
} from "./dispersionContext.ts";

/**
 * The light source the whole interface shares.
 *
 * This component owns exactly two numbers — where the light is — and publishes
 * them to `<html>` as `--light-x` / `--light-y`. Every dispersive edge in the
 * application reads those two numbers out of the same viewport-space gradient,
 * so the interface disperses as one surface instead of as a thousand
 * independently-shaded controls.
 *
 * It never renders on movement. The pointer writes to a ref, a single
 * requestAnimationFrame loop eases the light toward it and writes CSS custom
 * properties directly, and the loop parks itself once the light has settled.
 * React re-renders zero times while the light moves.
 */

/** Rest position: high and slightly left — the canonical studio key light. */
const REST_X = 0.28;
const REST_Y = 0.06;

/** Easing per frame. Following is quick; returning to rest is unhurried. */
const FOLLOW_RATE = 0.16;
const RETURN_RATE = 0.03;

/** Below this delta the light has arrived and the loop stops. */
const SETTLE_EPSILON = 0.0005;

export interface DispersionFieldProps {
  children: ReactNode;
  /**
   * When false the light parks at rest and stops tracking. Reduced-motion is
   * honoured automatically; this is for callers that need to force it.
   */
  enabled?: boolean;
}

export function DispersionField({
  children,
  enabled = true,
}: DispersionFieldProps) {
  // Live position and target. Both are refs: nothing here belongs in state,
  // because nothing here should cause a render.
  const current = useRef({ x: REST_X, y: REST_Y });
  const target = useRef({ x: REST_X, y: REST_Y });
  const rate = useRef(FOLLOW_RATE);
  const frame = useRef<number | null>(null);

  // Last values actually written, so identical frames cost nothing.
  const written = useRef({ x: "", y: "" });

  // Setting a custom property on :root invalidates style for every element that
  // reads it, which here is every dispersive edge on the page. That cost is
  // inherent to one shared light, but it must not be paid for a frame that
  // changes nothing: three decimals is well below a pixel of visible movement,
  // and writes below that threshold are dropped entirely.
  const write = useCallback((x: number, y: number) => {
    const nextX = x.toFixed(3);
    const nextY = y.toFixed(3);
    if (nextX === written.current.x && nextY === written.current.y) return;
    written.current = { x: nextX, y: nextY };
    const root = document.documentElement;
    root.style.setProperty("--light-x", nextX);
    root.style.setProperty("--light-y", nextY);
  }, []);

  /**
   * Turn the light off where it stands, rather than walking it home.
   *
   * Easing back to the rest position when the pointer left the window meant the
   * interface animated on its own after the user had already looked away —
   * movement in an abandoned window, drawing the eye back to nothing. Fading
   * `--light-presence` leaves the position untouched, so when the pointer
   * returns the light comes back up wherever it re-enters instead of sliding
   * across the screen to meet it.
   */
  const setPresence = useCallback((present: boolean) => {
    document.documentElement.style.setProperty(
      "--light-presence",
      present ? "1" : "0",
    );
  }, []);

  // A single loop, started on demand and parked the moment the light settles.
  const run = useCallback(() => {
    if (frame.current !== null) return;

    const step = () => {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;

      if (Math.abs(dx) < SETTLE_EPSILON && Math.abs(dy) < SETTLE_EPSILON) {
        current.current = { ...target.current };
        write(current.current.x, current.current.y);
        frame.current = null;
        return;
      }

      current.current = {
        x: current.current.x + dx * rate.current,
        y: current.current.y + dy * rate.current,
      };
      write(current.current.x, current.current.y);
      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
  }, [write]);

  const aim = useCallback(
    (x: number, y: number, nextRate: number) => {
      target.current = {
        x: Math.min(Math.max(x, -0.25), 1.25),
        y: Math.min(Math.max(y, -0.25), 1.25),
      };
      rate.current = nextRate;
      run();
    },
    [run],
  );

  const controls = useMemo<DispersionControls>(
    () => ({
      pulse: (clientX, clientY) => {
        aim(
          clientX / Math.max(window.innerWidth, 1),
          clientY / Math.max(window.innerHeight, 1),
          FOLLOW_RATE,
        );
      },
      release: () => aim(REST_X, REST_Y, RETURN_RATE),
    }),
    [aim],
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const tracking = () => enabled && !reduced.matches;

    const park = () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      current.current = { x: REST_X, y: REST_Y };
      target.current = { x: REST_X, y: REST_Y };
      write(REST_X, REST_Y);
      setPresence(true);
    };

    if (!tracking()) {
      park();
      // Still listen for the preference changing back.
      const onPreferenceChange = () => {
        if (!tracking()) park();
      };
      reduced.addEventListener("change", onPreferenceChange);
      return () => reduced.removeEventListener("change", onPreferenceChange);
    }

    const onPointerMove = (event: PointerEvent) => {
      setPresence(true);
      aim(
        event.clientX / Math.max(window.innerWidth, 1),
        event.clientY / Math.max(window.innerHeight, 1),
        FOLLOW_RATE,
      );
    };

    // Leaving the document or the window puts the light out where it stands.
    // relatedTarget === null means the pointer left the window entirely rather
    // than merely crossing between two elements inside it.
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) setPresence(false);
    };
    const onBlur = () => setPresence(false);
    const onPreferenceChange = () => {
      if (!tracking()) park();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", onBlur);
    reduced.addEventListener("change", onPreferenceChange);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", onBlur);
      reduced.removeEventListener("change", onPreferenceChange);
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [aim, controls, enabled, setPresence, write]);

  return (
    <DispersionContext.Provider value={controls}>
      {children}
    </DispersionContext.Provider>
  );
}
