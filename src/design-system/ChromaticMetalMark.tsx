import { useEffect, useRef } from "react";

export interface ChromaticMetalMarkProps {
  src: string;
  className?: string;
  /** 0..1, controls spectral intensity. */
  intensity?: number;
  /** 0..1, controls roughness of the simulated metal. */
  roughness?: number;
  /** 0..1, controls RGB separation. */
  rgbSplit?: number;
  /** Disable pointer-following light while keeping the static finish. */
  interactive?: boolean;
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_light;
uniform float u_time;
uniform float u_intensity;
uniform float u_roughness;
uniform float u_rgbSplit;

in vec2 v_uv;
out vec4 outColor;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 spectrum(float t) {
  t = fract(t);
  vec3 p = abs(fract(t + vec3(0.0, 0.6667, 0.3333)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

float sourceMask(vec2 uv) {
  vec3 c = texture(u_texture, uv).rgb;
  float l = luminance(c);
  // The supplied icon has an almost-black tile and a bright mark. Luminance
  // gives us a clean runtime mask without requiring a second asset.
  return smoothstep(0.16, 0.48, l);
}

void main() {
  vec2 uv = v_uv;
  vec2 texel = 1.0 / max(u_resolution, vec2(1.0));

  float mask = sourceMask(uv);
  if (mask < 0.004) discard;

  // Estimate a bevel normal from the image mask. This turns a flat bitmap into
  // a softly rounded, raised surface and keeps the implementation asset-agnostic.
  float ml = sourceMask(uv - vec2(texel.x * 2.2, 0.0));
  float mr = sourceMask(uv + vec2(texel.x * 2.2, 0.0));
  float mb = sourceMask(uv - vec2(0.0, texel.y * 2.2));
  float mt = sourceMask(uv + vec2(0.0, texel.y * 2.2));
  vec2 grad = vec2(mr - ml, mt - mb);
  vec3 normal = normalize(vec3(-grad * 4.8, 1.0));

  vec2 p = uv - 0.5;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);
  vec2 lightP = u_light - 0.5;
  lightP.x *= u_resolution.x / max(u_resolution.y, 1.0);

  vec3 lightDir = normalize(vec3(lightP - p, 0.36));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);

  float ndl = max(dot(normal, lightDir), 0.0);
  float ndh = max(dot(normal, halfDir), 0.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);

  float rough = mix(0.06, 0.72, clamp(u_roughness, 0.0, 1.0));
  float specPower = mix(180.0, 18.0, rough);
  float specular = pow(ndh, specPower);

  float angle = atan(p.y - lightP.y, p.x - lightP.x) / 6.2831853;
  float radius = length(p - lightP);
  float bands = angle * 1.15 + radius * 0.82;

  // Small RGB phase offsets mimic chromatic dispersion at grazing angles.
  float split = mix(0.002, 0.055, clamp(u_rgbSplit, 0.0, 1.0));
  vec3 spectral = vec3(
    spectrum(bands + split).r,
    spectrum(bands).g,
    spectrum(bands - split).b
  );

  // Fine directional grain reads as brushed metal without becoming noisy.
  float grain = hash21(vec2(uv.x * 900.0, floor(uv.y * 1300.0))) - 0.5;
  grain *= mix(0.035, 0.13, rough);

  float edge = smoothstep(0.08, 0.72, length(grad));
  float spectralWeight = (0.18 + fresnel * 0.95 + edge * 0.62) * u_intensity;

  vec3 silver = vec3(0.82, 0.87, 0.93);
  vec3 darkMetal = vec3(0.10, 0.13, 0.18);
  vec3 base = mix(darkMetal, silver, 0.34 + ndl * 0.72);
  base += grain;

  vec3 color = mix(base, spectral, clamp(spectralWeight, 0.0, 0.92));
  color += vec3(1.0, 0.98, 0.94) * specular * 1.8;
  color += vec3(0.42, 0.62, 1.0) * fresnel * 0.16;

  // Thin warm/cool rim, inspired by the Figma Chromatic Metal preset.
  color += spectrum(angle + u_time * 0.012) * edge * 0.24 * u_intensity;
  color = pow(max(color, 0.0), vec3(0.88));

  outColor = vec4(color, mask);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export function ChromaticMetalMark({
  src,
  className,
  intensity = 1,
  roughness = 0.33,
  rgbSplit = 0.58,
  interactive = true,
}: ChromaticMetalMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    let disposed = false;
    let frame = 0;
    let texture: WebGLTexture | null = null;
    const pointer = { x: 0.68, y: 0.24 };
    const target = { x: pointer.x, y: pointer.y };

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Unable to link shader.");
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const lightLocation = gl.getUniformLocation(program, "u_light");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const intensityLocation = gl.getUniformLocation(program, "u_intensity");
    const roughnessLocation = gl.getUniformLocation(program, "u_roughness");
    const rgbSplitLocation = gl.getUniformLocation(program, "u_rgbSplit");

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onPointerMove = (event: PointerEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      target.x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      target.y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
    };
    const onPointerLeave = () => {
      target.x = 0.68;
      target.y = 0.24;
    };
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });

    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image.onload = () => {
      if (disposed) return;
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );

      gl.useProgram(program);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

      const started = performance.now();
      const render = (now: number) => {
        if (disposed) return;
        resize();
        pointer.x += (target.x - pointer.x) * 0.075;
        pointer.y += (target.y - pointer.y) * 0.075;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform2f(lightLocation, pointer.x, pointer.y);
        gl.uniform1f(timeLocation, (now - started) / 1000);
        gl.uniform1f(intensityLocation, intensity);
        gl.uniform1f(roughnessLocation, roughness);
        gl.uniform1f(rgbSplitLocation, rgbSplit);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (texture) gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [src, intensity, roughness, rgbSplit, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      role="presentation"
    />
  );
}
