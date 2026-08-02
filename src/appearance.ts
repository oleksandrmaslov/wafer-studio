import { useCallback, useEffect, useState } from "react";

export const WAFER_FINISHES = [
  {
    id: "precision",
    label: "Precision",
    description: "Flat, quiet, and closest to Input.",
  },
  {
    id: "alloy",
    label: "Alloy",
    description: "Soft metallic light across the same controls.",
  },
  {
    id: "prism",
    label: "Prism",
    description: "A restrained chromatic edge for selection.",
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
