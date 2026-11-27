import { noMotion } from './motion.ts';

/*
 * The big NorthList name at the bottom of the footer. It is sized to fill the width, then drawn into a
 * WebGL canvas (owner, 27 Nov 2026, after trae.ai):
 * - film grain over it that changes about twelve times a second, like the film heroes' grain;
 * - the first time it scrolls into view the letters develop out of the grain;
 * - a soft light passes slowly across the letters every few seconds;
 * - where the pointer moves the letters bend like soft glass and light up; phones: a finger drag does the same.
 * It draws only while it is on screen. No WebGL or less motion: the plain name stays.
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// R = letters, G = mark. The pointer pushes the letters along its path (smear), swells them a little (lens)
// and lights them; the passing light lights them too. Grain: a fresh speck pattern per seed, stronger on the
// letters and where they are lit, faint on the page. Develop: each speck of a letter shows once `reveal`
// passes its own fixed random level, so the letters form out of grain.
const FRAG = `precision mediump float;
uniform sampler2D tex; uniform vec2 res; uniform vec2 m; uniform vec2 vel; uniform float power; uniform float rad;
uniform float seed; uniform float reveal; uniform float sweep; uniform float speck;
uniform vec3 bg; uniform vec3 ink; uniform vec3 lit; uniform vec3 mark; uniform vec3 markLit;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 d = px - m;
  float f = exp(-dot(d, d) / (rad * rad)) * power;
  vec2 src = px - vel * f * 6.0 - d * f * 0.18;
  vec4 t = texture2D(tex, src / res);
  vec2 cell = floor(px / speck);
  float form = smoothstep(0.0, 0.08, reveal * 1.08 - hash(cell + 0.5));
  float sx = (px.x / res.x - sweep) * 4.0;
  float light = max(f, exp(-sx * sx) * 0.45);
  float n = hash(cell + seed) - 0.5;
  vec3 letters = mix(ink, lit, light);
  vec3 sun = mix(mark, markLit, light);
  vec3 c = mix(bg, letters, t.r * form);
  c = mix(c, sun, t.g * form);
  float on = max(t.r, t.g) * form;
  float page = 0.035 * smoothstep(0.0, 0.45, px.y / res.y); // the page's grain fades in from the top: no edge
  c += n * mix(page, 0.11 + 0.22 * light, on);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Dim letters on the page colour; near the pointer they light to grey and the mark to its blue
 *  (owner picked this quiet look over a light band, 27 Nov 2026). */
const LOOK = { bg: '#08090a', ink: '#1f2023', lit: '#8a8f98', mark: '#1d2b47', markLit: '#4c86ff' };

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Fits the name to the footer's width: the plain name, and the size the canvas copies. */
function fit(box: HTMLElement, wm: HTMLElement): void {
  const pad = parseFloat(getComputedStyle(box).paddingLeft) * 2;
  const room = box.clientWidth - pad;
  const size = parseFloat(getComputedStyle(wm).fontSize);
  box.style.setProperty('--fm-size', `${(size * room) / wm.getBoundingClientRect().width}px`);
}

/** Draws the plain name into a 2D canvas at the exact places the page put each letter. */
function paint(box: HTMLElement, wm: HTMLElement, dpr: number): HTMLCanvasElement {
  const area = box.getBoundingClientRect();
  const out = document.createElement('canvas');
  out.width = Math.round(area.width * dpr);
  out.height = Math.round(area.height * dpr);
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.scale(dpr, dpr);
  const style = getComputedStyle(wm);
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  const ascent = ctx.measureText('n').fontBoundingBoxAscent;
  ctx.fillStyle = '#f00';
  for (const span of wm.querySelectorAll('span')) {
    const text = span.firstChild;
    if (!text?.textContent) continue;
    for (let i = 0; i < text.textContent.length; i++) {
      const range = document.createRange();
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const r = range.getBoundingClientRect();
      ctx.fillText(text.textContent[i], r.left - area.left, r.top - area.top + ascent);
    }
  }
  const svg = wm.querySelector('svg');
  const d = svg?.querySelector('path')?.getAttribute('d');
  if (svg && d) {
    const r = svg.getBoundingClientRect();
    ctx.save();
    ctx.translate(r.left - area.left, r.top - area.top);
    ctx.scale(r.width / 28, r.height / 28);
    ctx.translate(-2, -2);
    ctx.fillStyle = '#0f0';
    ctx.fill(new Path2D(d));
    ctx.restore();
  }
  return out;
}

function shader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

/** The WebGL side: one full-canvas square, the letters as a texture, the look's colours. Null when WebGL fails. */
function setup(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const vs = shader(gl, gl.VERTEX_SHADER, VERT);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
    gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  for (const k of ['bg', 'ink', 'lit', 'mark', 'markLit'] as const)
    gl.uniform3fv(u(k), rgb(LOOK[k]));
  return { gl, u };
}

export async function startFootmark(): Promise<void> {
  const box = document.querySelector<HTMLElement>('[data-footmark]');
  const wm = box?.querySelector<HTMLElement>('.wm');
  if (!box || !wm) return;
  if ('fonts' in document) await document.fonts.load('700 100px Geist').catch(() => undefined);
  fit(box, wm);
  if (noMotion) return;

  const canvas = document.createElement('canvas');
  const glow = setup(canvas);
  if (!glow) return;
  const { gl, u } = glow;

  let dpr = 1;
  const size = () => {
    fit(box, wm);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const src = paint(box, wm, dpr);
    canvas.width = src.width;
    canvas.height = src.height;
    gl.viewport(0, 0, src.width, src.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform2f(u('res'), src.width, src.height);
    gl.uniform1f(u('rad'), src.height * 0.32);
    gl.uniform1f(u('speck'), dpr); // one speck per CSS pixel, as in the heroes' grain
  };
  size();
  box.append(canvas);
  box.classList.add('live');

  const pointer = follow(box, canvas, () => dpr);
  let seen = -1; // when it first came into view
  let frame = 0;
  let lastSeed = -1;
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    const moving = pointer.step();
    const reveal = seen < 0 ? 0 : Math.min(1, (now - seen) / 1400);
    // once the letters have formed the light crosses in 2.6 s, then rests; one pass every 9 s
    const pass = seen < 0 || now - seen < 1400 ? 2 : ((now - seen - 1400) % 9000) / 2600;
    const seed = Math.floor(now / 83);
    if (!moving && reveal === 1 && pass > 1 && seed === lastSeed) return;
    lastSeed = seed;
    gl.uniform1f(u('seed'), seed % 1000);
    gl.uniform1f(u('reveal'), reveal);
    gl.uniform1f(u('sweep'), pass <= 1 ? -0.3 + pass * 1.6 : 2);
    pointer.send(gl, u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (seen < 0) seen = performance.now();
      if (!frame) frame = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }).observe(box);

  let last = box.clientWidth;
  new ResizeObserver(() => {
    if (box.clientWidth === last) return;
    last = box.clientWidth;
    size();
    lastSeed = -1;
  }).observe(box);
}

type Uniform = (n: string) => WebGLUniformLocation | null;

/** The pointer (or finger): where it is, how fast it moved (smoothed), and how strong the bend is. */
function follow(box: HTMLElement, canvas: HTMLCanvasElement, dpr: () => number) {
  const at = { x: -1e4, y: -1e4 };
  const shown = { x: -1e4, y: -1e4 };
  const vel = { x: 0, y: 0 };
  let power = 0;
  let inside = false;
  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    at.x = (e.clientX - r.left) * dpr();
    at.y = (e.clientY - r.top) * dpr();
    if (!inside) {
      // enter where the pointer is, so the bend does not fly in from a corner
      if (power < 0.01) Object.assign(shown, at);
      inside = true;
    }
  };
  const leave = () => {
    inside = false;
  };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerdown', move);
  box.addEventListener('pointerleave', leave);
  box.addEventListener('pointercancel', leave);
  box.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && leave());
  return {
    /** Moves one frame on; true while anything still changes. */
    step(): boolean {
      const nx = at.x - shown.x;
      const ny = at.y - shown.y;
      shown.x += nx * 0.18;
      shown.y += ny * 0.18;
      vel.x += (nx * 0.18 - vel.x) * 0.2;
      vel.y += (ny * 0.18 - vel.y) * 0.2;
      const goal = inside ? 1 : 0;
      power += (goal - power) * 0.08;
      return (
        Math.abs(nx) + Math.abs(ny) > 0.5 ||
        Math.abs(vel.x) + Math.abs(vel.y) > 0.05 ||
        Math.abs(goal - power) > 0.002
      );
    },
    send(gl: WebGLRenderingContext, u: Uniform): void {
      const clamp = (v: number) => Math.max(-40, Math.min(40, v));
      gl.uniform2f(u('m'), shown.x, shown.y);
      gl.uniform2f(u('vel'), clamp(vel.x), clamp(vel.y));
      gl.uniform1f(u('power'), power);
    },
  };
}
