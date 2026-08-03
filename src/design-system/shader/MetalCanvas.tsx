import { useEffect, useRef } from "react";
import { METAL_FRAG, METAL_VERT } from "./chromaticMetal.glsl.ts";
import { METAL_PARAMS, METAL_PARAM_KEYS, type MetalParams } from "./params.ts";

/**
 * Renders the chromatic metal into a canvas.
 *
 * Decorative and never load-bearing, so it is aria-hidden. If WebGL is missing
 * or the program fails to link the canvas removes itself, and the CSS metal
 * underneath is what remains.
 */

const MAX_DPR = 1.5;

interface Compiled {
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
      console.warn("Metal shader failed:", gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function buildMetalProgram(gl: WebGLRenderingContext): Compiled | null {
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
      console.warn("Metal link failed:", gl.getProgramInfoLog(program));
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
    "uLight",
    "uMetalLow",
    "uMetalHigh",
    "uShape",
    ...METAL_PARAM_KEYS.map((key) => METAL_PARAMS[key].uniform),
  ];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, uniforms, buffer };
}

export function readChannel(
  styles: CSSStyleDeclaration,
  name: string
): [number, number, number] {
  const raw = styles.getPropertyValue(name).trim();
  const parts = raw.split(/[\s,/]+/).map(Number).filter(Number.isFinite);
  if (parts.length < 3) return [0.5, 0.5, 0.5];
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
}

/** Pushes every uniform for one frame. Shared with the offscreen field. */
export function applyMetalUniforms(
  gl: WebGLRenderingContext,
  compiled: Compiled,
  params: MetalParams,
  options: {
    width: number;
    height: number;
    light: [number, number];
    low: [number, number, number];
    high: [number, number, number];
    shape: number;
  }
) {
  const u = compiled.uniforms;
  gl.uniform2f(u.uResolution, options.width, options.height);
  gl.uniform2f(u.uLight, options.light[0], options.light[1]);
  gl.uniform3fv(u.uMetalLow, options.low);
  gl.uniform3fv(u.uMetalHigh, options.high);
  gl.uniform1f(u.uShape, options.shape);

  for (const key of METAL_PARAM_KEYS) {
    const spec = METAL_PARAMS[key];
    const value = key === "angle" ? (params[key] * Math.PI) / 180 : params[key];
    gl.uniform1f(u[spec.uniform], value);
  }
}

export interface MetalCanvasProps {
  params: MetalParams;
  className?: string;
  /** True cuts a rounded box; false fills the canvas edge to edge. */
  shaped?: boolean;
  paused?: boolean;
}

export function MetalCanvas({
  params,
  className,
  shaped = false,
  paused = false,
}: MetalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(params);
  latest.current = params;
  const shapedRef = useRef(shaped);
  shapedRef.current = shaped;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.removeProperty("display");

    const gl =
      canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      }) ?? null;

    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    const built = buildMetalProgram(gl);
    if (!built) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(built.program);

    const root = document.documentElement;
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");

    let low: [number, number, number] = [0, 0, 0];
    let high: [number, number, number] = [1, 1, 1];
    const readPalette = () => {
      const styles = getComputedStyle(root);
      low = readChannel(styles, "--metal-shadow");
      high = readChannel(styles, "--metal-specular");
    };
    readPalette();

    let rect = canvas.getBoundingClientRect();
    let width = 0;
    let height = 0;

    const resize = () => {
      rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
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

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || pausedRef.current || width === 0) return;

      const lx = parseFloat(root.style.getPropertyValue("--light-x")) || 0.28;
      const ly = parseFloat(root.style.getPropertyValue("--light-y")) || 0.06;
      const localX = rect.width
        ? (lx * window.innerWidth - rect.left) / rect.width
        : 0.5;
      const localY = rect.height
        ? (ly * window.innerHeight - rect.top) / rect.height
        : 0.5;

      applyMetalUniforms(gl, built, latest.current, {
        width,
        height,
        light: [localX, localY],
        low,
        high,
        shape: shapedRef.current ? 1 : 0,
      });

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    frame = requestAnimationFrame(render);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "128px" }
    );
    intersection.observe(canvas);

    const onScroll = () => {
      rect = canvas.getBoundingClientRect();
    };
    const onVisibility = () => {
      visible = !document.hidden;
    };

    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    scheme.addEventListener("change", readPalette);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      scheme.removeEventListener("change", readPalette);
      gl.deleteBuffer(built.buffer);
      gl.deleteProgram(built.program);
      // Not calling WEBGL_lose_context: a canvas hands back the same context
      // object, so losing it would leave StrictMode's second mount holding a
      // dead one and the surface would silently vanish in development.
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
