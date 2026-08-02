import { useCallback, useEffect, useState } from "react";
import {
  METAL_PRESETS,
  clampParams,
  type MetalParams,
  type MetalPresetId,
} from "./params.ts";

const STORAGE_KEY = "wafer.metal.v2";

function readInitial(preset: MetalPresetId): MetalParams {
  const fallback = METAL_PRESETS[preset];
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<MetalParams>;
    return clampParams({ ...fallback, ...parsed });
  } catch {
    return fallback;
  }
}

export interface UseMetalResult {
  params: MetalParams;
  setParams: (params: MetalParams) => void;
  applyPreset: (preset: MetalPresetId) => void;
}

/**
 * Owns the material's parameters and persists them. Everything read back is
 * clamped to the schema first, so a stale or corrupt entry can never break the
 * surface.
 */
export function useMetal(initialPreset: MetalPresetId = "action"): UseMetalResult {
  const [params, setParamsState] = useState<MetalParams>(() =>
    readInitial(initialPreset)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    } catch {
      // The material still applies for this session.
    }
  }, [params]);

  const setParams = useCallback((next: MetalParams) => {
    setParamsState(clampParams(next));
  }, []);

  const applyPreset = useCallback((preset: MetalPresetId) => {
    setParamsState(METAL_PRESETS[preset]);
  }, []);

  return { params, setParams, applyPreset };
}
