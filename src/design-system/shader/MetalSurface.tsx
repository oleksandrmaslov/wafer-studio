import { useEffect, useRef } from "react";
import { METAL_FRAG, METAL_VERT } from "./chromaticMetal.glsl.ts";
import { METAL_PARAMS, METAL_PARAM_KEYS, type MetalParams } from "./params.ts";

/**
 * Renders chromatic metal into a canvas sized to its parent.
 *
 * The effect is shape-driven, so the canvas has to know the shape: it reads the
 * computed `border-radius` off its parent and bevels to that. Put it inside the
 * element it should fill and the metal follows the real geometry, including
 * when the radius is a token that changes with density.
 *
 * Decorative, so `aria-hidden`. If WebGL is unavailable the canvas hides itself
 * and the CSS ramp underneath is what remains.
 */

const MAX_DPR = 2;

interface Built {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  buffer: WebGLBuffer;
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) {
      console.warn("Chromatic metal failed:", gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function build(gl: WebGLRenderingContext): Built | null {
  const vert = compile(gl, gl.VERTEX_SHADER, METAL_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, METAL_FRAG);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) {
      console.warn("Chromatic metal link failed:", gl.getProgramInfoLog(program));
    }
    gl.deleteProgram(program);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const names = [
    "uResolution",
    "uRadius",
    "uTime",
    ...METAL_PARAM_KEYS.map((key) => METAL_PARAMS[key].uniform),
  ];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, uniforms, buffer };
}

export interface MetalSurfaceProps {
  params: MetalParams;
  className?: string;
  /**
   * Corner radius override in CSS px. Omit to read it from the parent's
   * computed style, which is what keeps the bevel on the real shape.
   */
  radius?: number;
  paused?: boolean;
}

export function MetalSurface({
  params,
  className,
  radius,
  paused = false,
}: MetalSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(params);
  latest.current = params;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.removeProperty("display");

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    const built = build(gl);
    if (!built) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(built.program);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cornerRadius = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      // The shape comes from the parent, so the bevel tracks the real radius
      // rather than a number duplicated in two places.
      if (radiusRef.current !== undefined) {
        cornerRadius = radiusRef.current * dpr;
      } else {
        const host = canvas.parentElement;
        const raw = host
          ? parseFloat(getComputedStyle(host).borderTopLeftRadius)
          : 0;
        cornerRadius = (Number.isFinite(raw) ? raw : 0) * dpr;
      }

      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };
    resize();

    let frame: number | null = null;
    let visible = true;
    const start = performance.now();
    // Only the roughness pattern is time-dependent, and only when evolving.
    let lastDrawKey = "";

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || pausedRef.current || width === 0) return;

      const p = latest.current;
      const animating = p.evolution > 0 && !reduced.matches;
      const time = animating ? (performance.now() - start) / 1000 : 0;

      // Redraw only when something actually changed. A static surface costs one
      // draw, not sixty a second.
      const key = animating
        ? "live"
        : `${width}x${height}:${cornerRadius}:${METAL_PARAM_KEYS.map(
            (k) => p[k]
          ).join(",")}`;
      if (key === lastDrawKey) return;
      lastDrawKey = key;

      const u = built.uniforms;
      gl.uniform2f(u.uResolution, width, height);
      gl.uniform1f(u.uRadius, cornerRadius);
      gl.uniform1f(u.uTime, time);
      for (const key2 of METAL_PARAM_KEYS) {
        const spec = METAL_PARAMS[key2];
        // Rounding is authored in CSS px, so it has to follow device pixels.
        const value = key2 === "rounding" ? p[key2] * dpr : p[key2];
        gl.uniform1f(u[spec.uniform], value);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    frame = requestAnimationFrame(render);

    const invalidate = () => {
      lastDrawKey = "";
    };
    const onResize = () => {
      resize();
      invalidate();
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "96px" }
    );
    intersection.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", invalidate);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", invalidate);
      gl.deleteBuffer(built.buffer);
      gl.deleteProgram(built.program);
      // Not calling WEBGL_lose_context: a canvas returns the same context on
      // every getContext, so losing it would leave StrictMode's second mount
      // holding a dead one.
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={["block h-full w-full", className].filter(Boolean).join(" ")}
    />
  );
}
