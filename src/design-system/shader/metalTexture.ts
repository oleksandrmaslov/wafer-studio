import { METAL_FRAG, METAL_VERT } from "./chromaticMetal.glsl.ts";
import {
  MAX_GRADIENT_STOPS,
  METAL_PARAMS,
  METAL_PARAM_KEYS,
  type GradientStop,
  type MetalParams,
} from "./params.ts";

/**
 * Bakes the material to an image, once.
 *
 * Dozens of controls need the metal, and a WebGL context per chip is the single
 * most expensive mistake available here: the browser has to manage a context,
 * a canvas layer, resize events, and compositing for every one of them. So the
 * real shader renders once into an offscreen canvas and every small surface
 * uses the result as an ordinary `background-image`.
 *
 * That also means the small chrome is the same material as the hero rather than
 * a flat gradient approximating it.
 */

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
      console.warn("Metal texture shader failed:", gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

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

export interface MetalTextureOptions {
  width?: number;
  height?: number;
}

/**
 * Renders `params` full-bleed and resolves to an object URL.
 *
 * Returns null when WebGL2 is unavailable or the program fails to link, which
 * is the signal for callers to leave the CSS gradient fallback in place.
 * The caller owns the URL and must revoke it.
 */
export async function renderMetalTexture(
  params: MetalParams,
  { width = 512, height = 256 }: MetalTextureOptions = {}
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    // Required: toBlob reads the buffer after the draw has been submitted.
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;

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
      console.warn("Metal texture link failed:", gl.getProgramInfoLog(program));
    }
    gl.deleteProgram(program);
    return null;
  }

  const uniform = (name: string) => gl.getUniformLocation(program, name);

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

  gl.viewport(0, 0, width, height);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(uniform("uSdfMask"), 0);
  gl.uniform1i(uniform("uUseSdfMask"), 0);
  gl.uniform1i(uniform("uFullBleed"), 1);

  gl.uniform2f(uniform("uResolution"), width, height);
  gl.uniform1f(uniform("uTime"), 0);

  for (const key of METAL_PARAM_KEYS) {
    const spec = METAL_PARAMS[key];
    const value = key === "angle" ? (params[key] * Math.PI) / 180 : params[key];
    gl.uniform1f(uniform(spec.uniform), value);
  }

  gl.uniform4fv(uniform("uGradient[0]"), packGradient(params.gradient));
  gl.uniform1i(
    uniform("uGradientCount"),
    Math.min(params.gradient.length, MAX_GRADIENT_STOPS)
  );

  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  gl.deleteTexture(texture);
  gl.deleteVertexArray(vao);
  gl.deleteProgram(program);
  // Safe here, unlike in a mounted component: this canvas is discarded and its
  // context is never requested again.
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  return blob ? URL.createObjectURL(blob) : null;
}
