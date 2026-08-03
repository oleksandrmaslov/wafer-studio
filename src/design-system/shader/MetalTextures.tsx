import { useEffect } from "react";
import { renderMetalTexture } from "./metalTexture.ts";
import { METAL_PRESETS, type MetalParams } from "./params.ts";

/**
 * Bakes the material once and publishes it to the whole document.
 *
 * Mount this near the root. It renders two textures offscreen and sets them as
 * custom properties on `<html>`:
 *
 *   --metal-texture         spectral. Edges, marks, decorative fills.
 *   --metal-texture-bright  silver. Anything carrying text.
 *
 * Every `.wafer-metal` surface in the product then shows the real shader output
 * instead of a CSS gradient approximating it, at the cost of one render rather
 * than one WebGL context per control.
 *
 * Renders nothing. If WebGL2 is unavailable the properties are never set and
 * the CSS gradient fallbacks stay in place.
 */

export interface MetalTexturesProps {
  /** Overrides the spectral material. Defaults to the Button role. */
  spectral?: MetalParams;
  /** Overrides the text-safe material. Defaults to the Silver role. */
  bright?: MetalParams;
}

export function MetalTextures({ spectral, bright }: MetalTexturesProps) {
  const spectralParams = spectral ?? METAL_PRESETS.button;
  const brightParams = bright ?? METAL_PRESETS.silver;

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const root = document.documentElement;

    const bake = async (property: string, params: MetalParams) => {
      const url = await renderMetalTexture(params, { width: 512, height: 256 });
      if (!url) return;
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      urls.push(url);
      root.style.setProperty(property, `url("${url}")`);
    };

    void bake("--metal-texture", spectralParams);
    void bake("--metal-texture-bright", brightParams);

    return () => {
      cancelled = true;
      root.style.removeProperty("--metal-texture");
      root.style.removeProperty("--metal-texture-bright");
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [spectralParams, brightParams]);

  return null;
}
