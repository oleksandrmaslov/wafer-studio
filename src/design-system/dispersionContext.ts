// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import { createContext, useCallback, useContext, useMemo } from "react";

/**
 * Access to the application's shared light.
 *
 * Kept separate from the provider component so that the hooks and the component
 * live in different modules, which keeps fast refresh working.
 */

export interface DispersionControls {
  /**
   * Throw the light to a point in viewport coordinates (px). Use this when the
   * application commits to something, such as selecting a key or binding an
   * action, so that the light follows meaning and not only the cursor.
   */
  pulse: (clientX: number, clientY: number) => void;
  /** Release the light back to its rest position. */
  release: () => void;
}

export const DispersionContext = createContext<DispersionControls | null>(null);

/**
 * Safe to call outside a `DispersionField`: the controls become inert rather
 * than throwing, so components stay usable in isolation in Storybook or tests.
 */
export function useDispersion(): DispersionControls {
  const controls = useContext(DispersionContext);
  const fallback = useMemo<DispersionControls>(
    () => ({ pulse: () => {}, release: () => {} }),
    []
  );
  return controls ?? fallback;
}

/**
 * Convenience for surfaces that should throw the light when they are committed
 * to. Attach to a click handler on a key, a binding, or a primary action.
 */
export function useDispersionPulse() {
  const { pulse } = useDispersion();
  return useCallback(
    (event: { clientX: number; clientY: number }) => {
      pulse(event.clientX, event.clientY);
    },
    [pulse]
  );
}
