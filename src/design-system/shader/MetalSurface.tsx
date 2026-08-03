import { useEffect, useRef } from "react";
import { METAL_FRAG, METAL_VERT } from "./chromaticMetal.glsl.ts";
import {
  MAX_GRADIENT_STOPS,
  METAL_PARAMS,
  METAL_PARAM_KEYS,
  type GradientStop,
  type MetalParams,
} from "./params.ts";

/**
 * Renders Wafer Chromatic Metal into a canvas sized to its parent.
 *
 * WebGL2 is the required backend: the shader uses `gl_VertexID` for its
 * fullscreen triangle and `dFdx`/`dFdy` for normals, both of which keep it to
 * one draw call with no vertex buffer and no extra height samples. If WebGL2 is
 * unavailable, or the program fails to link, the canvas hides itself and the
 * CSS gradient underneath is what remains.
 *
 * The canvas is decorative, so it is `aria-hidden` and never receives pointer
 * events. Text, focus rings, and interactive elements stay in the DOM.
 */

const DEFAULT_MAX_DPR = 1.75;

interface Built {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  texture: WebGLTexture;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) {
      console.warn("Chromatic metal shader failed:", gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function build(gl: WebGL2RenderingContext): Built | null {
  const vert = compile(gl, gl.VERTEX_SHADER, METAL_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, METAL_FRAG);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  const vao = gl.createVertexArray();
  const texture = gl.createTexture();
  if (!program || !vao || !texture) return null;

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

  // A 1x1 white texture stands in until a real SDF mask arrives. It is never
  // sampled while uUseSdfMask is false.
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,
    1,
    1,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255])
  );
  for (const [key, value] of [
    [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
    [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ] as const) {
    gl.texParameteri(gl.TEXTURE_2D, key, value);
  }

  const names = [
    "uResolution",
    "uTime",
    "uGradient[0]",
    "uGradientCount",
    "uSdfMask",
    "uUseSdfMask",
    ...METAL_PARAM_KEYS.map((key) => METAL_PARAMS[key].uniform),
  ];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, vao, texture, uniforms };
}

/** Pads to five stops so the uniform array is always fully written. */
function packGradient(stops: readonly GradientStop[]): Float32Array {
  const sorted = [...stops]
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_GRADIENT_STOPS);
  const packed = new Float32Array(MAX_GRADIENT_STOPS * 4);

  for (let index = 0; index < MAX_GRADIENT_STOPS; index += 1) {
    const stop = sorted[Math.min(index, sorted.length - 1)];
    if (!stop) break;
    packed[index * 4] = stop.color[0];
    packed[index * 4 + 1] = stop.color[1];
    packed[index * 4 + 2] = stop.color[2];
    packed[index * 4 + 3] = stop.position;
  }

  return packed;
}

export interface MetalSurfaceProps {
  params: MetalParams;
  className?: string;
  /** Grayscale SDF mask: 0.5 is the edge, above is inside. */
  sdfMaskUrl?: string;
  /** Stops the loop without unmounting, for offscreen or inactive panels. */
  paused?: boolean;
  maxDevicePixelRatio?: number;
}

export function MetalSurface({
  params,
  className,
  sdfMaskUrl,
  paused = false,
  maxDevicePixelRatio = DEFAULT_MAX_DPR,
}: MetalSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Params live in a ref so moving a slider never rebuilds the GL context.
  const latest = useRef(params);
  latest.current = params;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.removeProperty("display");

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
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

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let hasMask = false;
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth === width && nextHeight === height) return false;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      return true;
    };
    resize();

    let frame: number | null = null;
    let visible = true;
    let lastKey = "";
    const start = performance.now();

    const draw = (time: number) => {
      const p = latest.current;
      const u = built.uniforms;

      gl.viewport(0, 0, width, height);
      gl.useProgram(built.program);
      gl.bindVertexArray(built.vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, built.texture);
      gl.uniform1i(u.uSdfMask, 0);
      gl.uniform1i(u.uUseSdfMask, hasMask ? 1 : 0);

      gl.uniform2f(u.uResolution, width, height);
      gl.uniform1f(u.uTime, time);

      for (const key of METAL_PARAM_KEYS) {
        const spec = METAL_PARAMS[key];
        // Angle is authored in degrees and consumed in radians.
        const value = key === "angle" ? (p[key] * Math.PI) / 180 : p[key];
        gl.uniform1f(u[spec.uniform], value);
      }

      gl.uniform4fv(u["uGradient[0]"], packGradient(p.gradient));
      gl.uniform1i(
        u.uGradientCount,
        Math.min(p.gradient.length, MAX_GRADIENT_STOPS)
      );

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || pausedRef.current || width === 0) return;

      const p = latest.current;
      const animating = p.evolution > 0 && !reduced.matches;
      const time = animating ? (performance.now() - start) / 1000 : 0;

      // Redraw only when something changed. A still surface costs one draw,
      // not sixty a second, which is what keeps an idle editor at zero GPU.
      const key = animating
        ? "live"
        : `${width}x${height}:${hasMask}:${METAL_PARAM_KEYS.map(
            (k) => p[k]
          ).join(",")}:${p.gradient
            .map((s) => `${s.color.join("/")}@${s.position}`)
            .join("|")}`;
      if (key === lastKey) return;
      lastKey = key;

      draw(time);
    };

    frame = requestAnimationFrame(render);

    const invalidate = () => {
      lastKey = "";
    };
    const onResize = () => {
      if (resize()) invalidate();
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

    if (sdfMaskUrl) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (disposed) return;
        gl.bindTexture(gl.TEXTURE_2D, built.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R8,
          gl.RED,
          gl.UNSIGNED_BYTE,
          image
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        hasMask = true;
        invalidate();
      };
      image.onerror = () => {
        // The rounded-rectangle shape field is the fallback, so the surface
        // still renders; it just is not cut to the mark.
        if (import.meta.env.DEV) {
          console.warn(`Could not load SDF mask: ${sdfMaskUrl}`);
        }
      };
      image.src = sdfMaskUrl;
    }

    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", invalidate);
      gl.deleteTexture(built.texture);
      gl.deleteVertexArray(built.vao);
      gl.deleteProgram(built.program);
      // Not calling WEBGL_lose_context: a canvas hands back the same context on
      // every getContext, so losing it would leave StrictMode's second mount
      // holding a dead one and the surface would vanish in development.
    };
  }, [maxDevicePixelRatio, sdfMaskUrl]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      tabIndex={-1}
      className={["pointer-events-none block h-full w-full", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
