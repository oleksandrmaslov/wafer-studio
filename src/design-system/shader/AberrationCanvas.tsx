import { useEffect, useRef } from "react";
import { ABERRATION_FRAG, ABERRATION_VERT } from "./aberration.glsl.ts";
import {
  ABERRATION_PARAMS,
  ABERRATION_PARAM_KEYS,
  type AberrationParams,
} from "./params.ts";

/**
 * Renders the aberration shader into a canvas.
 *
 * The canvas is decorative and never carries meaning, so it is `aria-hidden`
 * and sits behind content. If WebGL is unavailable or the program fails to
 * link, the canvas removes itself and the CSS specular field underneath is what
 * you see — the interface degrades to the quiet finish rather than to nothing.
 */

/** Above this the cost stops buying visible quality on a soft gradient field. */
const MAX_DPR = 1.5;

interface CompiledProgram {
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
      console.warn("Aberration shader failed:", gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function build(gl: WebGLRenderingContext): CompiledProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, ABERRATION_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, ABERRATION_FRAG);
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
      console.warn("Aberration link failed:", gl.getProgramInfoLog(program));
    }
    gl.deleteProgram(program);
    return null;
  }

  // One triangle covering the clip volume — cheaper than a quad, no seam.
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
    "uTime",
    "uLight",
    "uSpectrumA",
    "uSpectrumB",
    "uSpectrumC",
    "uSpectrumD",
    "uMetalLow",
    "uMetalHigh",
    ...ABERRATION_PARAM_KEYS.map((key) => ABERRATION_PARAMS[key].uniform),
  ];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, uniforms, buffer };
}

/** Reads an `R G B` custom property and normalises it to 0..1. */
function readChannel(styles: CSSStyleDeclaration, name: string): [number, number, number] {
  const raw = styles.getPropertyValue(name).trim();
  const parts = raw.split(/[\s,/]+/).map(Number).filter(Number.isFinite);
  if (parts.length < 3) return [0.5, 0.5, 0.5];
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
}

export interface AberrationCanvasProps {
  params: AberrationParams;
  className?: string;
  /** Stops the loop without unmounting — for offscreen or inactive panels. */
  paused?: boolean;
}

export function AberrationCanvas({
  params,
  className,
  paused = false,
}: AberrationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Params live in a ref so changing a slider never rebuilds the GL context.
  const latest = useRef(params);
  latest.current = params;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A previous mount may have hidden it after a failure.
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

    const built = build(gl);
    if (!built) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(built.program);

    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");

    // Palette comes from the same tokens the rest of the system uses, so the
    // shader re-skins with the theme instead of hard-coding its own colours.
    let palette = {
      a: [0, 0, 0] as [number, number, number],
      b: [0, 0, 0] as [number, number, number],
      c: [0, 0, 0] as [number, number, number],
      d: [0, 0, 0] as [number, number, number],
      low: [0, 0, 0] as [number, number, number],
      high: [1, 1, 1] as [number, number, number],
    };
    const readPalette = () => {
      const styles = getComputedStyle(root);
      palette = {
        a: readChannel(styles, "--spectral-azure"),
        b: readChannel(styles, "--spectral-violet"),
        c: readChannel(styles, "--spectral-coral"),
        d: readChannel(styles, "--spectral-amber"),
        low: readChannel(styles, "--metal-shadow"),
        high: readChannel(styles, "--metal-specular"),
      };
    };
    readPalette();

    // Cached because reading it per frame would force layout every frame.
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
    const start = performance.now();

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || pausedRef.current || width === 0) return;

      const p = latest.current;

      // The shared light, in this canvas's local space. Read from the inline
      // style DispersionField writes, which costs no style recalculation.
      const lx = parseFloat(root.style.getPropertyValue("--light-x")) || 0.28;
      const ly = parseFloat(root.style.getPropertyValue("--light-y")) || 0.06;
      const localX = rect.width
        ? (lx * window.innerWidth - rect.left) / rect.width
        : 0.5;
      const localY = rect.height
        ? (ly * window.innerHeight - rect.top) / rect.height
        : 0.5;

      const u = built.uniforms;
      gl.uniform2f(u.uResolution, width, height);
      gl.uniform1f(
        u.uTime,
        reduced.matches ? 0 : (performance.now() - start) / 1000
      );
      gl.uniform2f(u.uLight, localX, localY);
      gl.uniform3fv(u.uSpectrumA, palette.a);
      gl.uniform3fv(u.uSpectrumB, palette.b);
      gl.uniform3fv(u.uSpectrumC, palette.c);
      gl.uniform3fv(u.uSpectrumD, palette.d);
      gl.uniform3fv(u.uMetalLow, palette.low);
      gl.uniform3fv(u.uMetalHigh, palette.high);

      for (const key of ABERRATION_PARAM_KEYS) {
        gl.uniform1f(u[ABERRATION_PARAMS[key].uniform], p[key]);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    frame = requestAnimationFrame(render);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Off-screen canvases stop costing anything.
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

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
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
      // Deliberately not calling WEBGL_lose_context here. A canvas hands back
      // the same context object on every getContext call, so losing it would
      // leave StrictMode's second mount holding a dead context and the surface
      // would silently disappear in development. The context is released with
      // the canvas element anyway.
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
