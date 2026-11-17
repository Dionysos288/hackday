import { WHEEL_DEF } from '@/components/wheel/config';
import { glassGlsl } from '@/components/wheel/crt';

/* The kit's glass globes: one canvas over the page draws every [data-globe] element as the wheel's glass globe, with
   its city as a light (data-lat, data-lon in degrees). Sizes: the hub, the lens (64px) and the dot (24px) are just
   the element's size. The light does not breathe here, so the canvas draws only when the page scrolls, resizes or
   changes: one moving thing per page, and on our pages that is the now line. Up to eight globes; without WebGL the
   elements stay as they are. */

const MAX = 8;
const FRAG = `
  precision highp float;
  uniform sampler2D uLand;
  uniform vec2 uHub; uniform float uRadius;
  uniform vec4 uG[${MAX}]; uniform vec3 uC[${MAX}]; uniform int uN;
  varying vec2 vUv;
  uniform vec2 uResolution;
  vec4 picture(vec2 px) { return vec4(0.); }
  ${glassGlsl(WHEEL_DEF)}
  void main() {
    vec2 px = vUv * uResolution;
    vec4 o = vec4(0.);
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uN) break;
      gYaw = uC[i].z; gCity = uC[i].xy; gGlow = uG[i].w;
      vec4 g = globe(px, uG[i].xy, uG[i].z, false);
      o = o * (1. - g.a) + g;
    }
    gl_FragColor = o;
  }
`;
const VERT = `attribute vec2 aPosition; varying vec2 vUv; void main() { vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }`;
const rad = (d: number) => (d * Math.PI) / 180;

export function mountGlobes(doc: Document, face = WHEEL_DEF.face): () => void {
  const win = doc.defaultView; if (!win) return () => {};
  const canvas = doc.createElement('canvas'); canvas.className = 'sk-globes'; canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return () => {};
  const prog = gl.createProgram()!;
  for (const [t, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return () => {}; }
    gl.attachShader(prog, s);
  }
  gl.bindAttribLocation(prog, 0, 'aPosition'); gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  const at = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform1i(at('uLand'), 0);
  doc.body.appendChild(canvas);

  let raf = 0;
  const draw = () => {
    raf = 0;
    const ratio = Math.min(win.devicePixelRatio || 1, 2), w = win.innerWidth, h = win.innerHeight;
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    const els = Array.from(doc.querySelectorAll<HTMLElement>('[data-globe]')).slice(0, MAX);
    const G = new Float32Array(MAX * 4), C = new Float32Array(MAX * 3); let n = 0;
    els.forEach((e) => {
      const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > h || r.width === 0) return;
      const lat = Number(e.dataset.lat) || 0, lon = Number(e.dataset.lon) || 0;
      G.set([(r.left + r.width / 2) * ratio, canvas.height - (r.top + r.height / 2) * ratio, (r.width / 2) * ratio, e.dataset.glow === '0' ? 0 : 1], n * 4);
      C.set([rad(lat), rad(lon), face - rad(lon)], n * 3); n++;
    });
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(at('uResolution'), canvas.width, canvas.height); gl.uniform1i(at('uN'), n);
    gl.uniform4fv(at('uG'), G); gl.uniform3fv(at('uC'), C);
    if (n) gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const ask = () => { if (!raf) raf = win.requestAnimationFrame(draw); };
  const img = new win.Image(); img.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); ask(); }; img.src = '/wheel/land.png';
  win.addEventListener('scroll', ask, { passive: true, capture: true }); win.addEventListener('resize', ask);
  const mo = new MutationObserver(ask); mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-globe', 'data-lat', 'data-lon', 'style', 'class'] });
  ask();
  return () => { win.cancelAnimationFrame(raf); win.removeEventListener('scroll', ask, { capture: true }); win.removeEventListener('resize', ask); mo.disconnect(); canvas.remove(); };
}
