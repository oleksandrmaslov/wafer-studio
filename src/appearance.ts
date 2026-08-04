import { useCallback, useEffect, useState } from "react";

/**
 * Not three visual systems — one material at three amplitudes.
 *
 * Every level disperses, because dispersion is the base of the design system
 * rather than a decoration layered on top of it. What changes between them is
 * how loudly: `--dispersion-gain` and `--specular-gain` scale the whole field.
 */
export const WAFER_FINISHES = [
  {
    id: "precision",
    label: "Precision",
    description: "Lowest amplitude. Colour only where the surface truly turns.",
  },
  {
    id: "alloy",
    label: "Alloy",
    description: "The reference amplitude. Balanced light and spectrum.",
  },
  {
    id: "prism",
    label: "Prism",
    description: "Full spectral response across every live edge.",
  },
] as const;

export type WaferFinish = (typeof WAFER_FINISHES)[number]["id"];

const FINISH_STORAGE_KEY = "wafer.visual-finish";

function isWaferFinish(value: string | null): value is WaferFinish {
  return WAFER_FINISHES.some((finish) => finish.id === value);
}

function readInitialFinish(): WaferFinish {
  const queryFinish = new URLSearchParams(window.location.search).get("finish");
  if (isWaferFinish(queryFinish)) return queryFinish;

  try {
    const storedFinish = window.localStorage.getItem(FINISH_STORAGE_KEY);
    if (isWaferFinish(storedFinish)) return storedFinish;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return "precision";
}

export function useWaferFinish(): [WaferFinish, (finish: WaferFinish) => void] {
  const [finish, setFinishState] = useState<WaferFinish>(readInitialFinish);

  useEffect(() => {
    document.documentElement.dataset.waferFinish = finish;
    try {
      window.localStorage.setItem(FINISH_STORAGE_KEY, finish);
    } catch {
      // The visual finish still applies for the current session.
    }
  }, [finish]);

  const setFinish = useCallback((nextFinish: WaferFinish) => {
    setFinishState(nextFinish);

    const url = new URL(window.location.href);
    if (nextFinish === "precision") {
      url.searchParams.delete("finish");
    } else {
      url.searchParams.set("finish", nextFinish);
    }
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return [finish, setFinish];
}
