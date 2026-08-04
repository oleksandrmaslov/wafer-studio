import { useCallback, useEffect, useState } from "react";
import {
  ABERRATION_PRESETS,
  clampParams,
  type AberrationParams,
  type AberrationPresetId,
} from "./params.ts";

// Versioned: retuning the presets must not leave existing users pinned to
// values that were calibrated against different surface maths.
const STORAGE_KEY = "wafer.aberration.v2";

function readInitial(preset: AberrationPresetId): AberrationParams {
  const fallback = ABERRATION_PRESETS[preset];
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<AberrationParams>;
    return clampParams({ ...fallback, ...parsed });
  } catch {
    // Corrupt or unavailable storage should never cost the user the material.
    return fallback;
  }
}

export interface UseAberrationResult {
  params: AberrationParams;
  setParams: (params: AberrationParams) => void;
  applyPreset: (preset: AberrationPresetId) => void;
}

/**
 * Owns the shader's parameters and persists them.
 *
 * Tuning is a design decision, not a session preference, so edits survive a
 * reload — but a corrupt value can never brick the surface, because everything
 * read back is clamped to the schema before it reaches the shader.
 */
export function useAberration(
  initialPreset: AberrationPresetId = "alloy"
): UseAberrationResult {
  const [params, setParamsState] = useState<AberrationParams>(() =>
    readInitial(initialPreset)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    } catch {
      // The material still applies for this session.
    }
  }, [params]);

  const setParams = useCallback((next: AberrationParams) => {
    setParamsState(clampParams(next));
  }, []);

  const applyPreset = useCallback((preset: AberrationPresetId) => {
    setParamsState(ABERRATION_PRESETS[preset]);
  }, []);

  return { params, setParams, applyPreset };
}
