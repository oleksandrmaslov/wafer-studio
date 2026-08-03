import { useEffect } from "react";
import {
  applyMetalUniforms,
  buildMetalProgram,
  readChannel,
} from "./MetalCanvas.tsx";
import type { MetalParams } from "./params.ts";

/**
 * Publishes the material as a CSS image so that every accent surface in the
 * application can be made of metal without owning a WebGL context.
 *
 * A keymap editor shows dozens of keys at once. Giving each one a live canvas
 * would mean dozens of contexts, canvas layers, and resize observers, which is
 * the single most expensive mistake available here. Instead the material is
 * rendered once offscreen, handed to CSS as `--wafer-metal-image`, and sampled
 * in viewport space by every control that needs it. One render, any number of
 * surfaces.
 *
 * Live canvases stay reserved for the places worth the cost: the mark and hero
 * surfaces.
 */

/** Enough resolution to hold the bands at hero size, small enough to encode fast. */
const FIELD_SIZE = 640;

/** Slider drags must not trigger an encode per frame. */
const SETTLE_MS = 140;

export interface MetalFieldProps {
  params: MetalParams;
}

export function MetalField({ params }: MetalFieldProps) {
  useEffect(() => {
    const root = document.documentElement;
    let objectUrl: string | null = null;
    let cancelled = false;

    const paint = () => {
      const canvas = document.createElement("canvas");
      canvas.width = FIELD_SIZE;
      canvas.height = FIELD_SIZE;

      const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      });
      if (!gl) return;

      const built = buildMetalProgram(gl);
      if (!built) return;

      gl.useProgram(built.program);
      gl.viewport(0, 0, FIELD_SIZE, FIELD_SIZE);

      const styles = getComputedStyle(root);

      applyMetalUniforms(gl, built, params, {
        width: FIELD_SIZE,
        height: FIELD_SIZE,
        // Baked at the light's rest position. The CSS layer then parallaxes
        // this image against the live light, so the field still responds to
        // the pointer without re-encoding a texture every frame.
        light: [0.28, 0.06],
        low: readChannel(styles, "--metal-shadow"),
        high: readChannel(styles, "--metal-specular"),
        shape: 0,
      });

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      canvas.toBlob((blob) => {
        if (!blob || cancelled) return;
        const next = URL.createObjectURL(blob);
        root.style.setProperty("--wafer-metal-image", `url(${next})`);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = next;
      }, "image/png");

      gl.deleteBuffer(built.buffer);
      gl.deleteProgram(built.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };

    const timer = window.setTimeout(paint, SETTLE_MS);

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => paint();
    scheme.addEventListener("change", onScheme);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      scheme.removeEventListener("change", onScheme);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [params]);

  return null;
}
