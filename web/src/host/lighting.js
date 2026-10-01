// Port of Assets/ZombieBaseKit/Scripts/SurvivalLighting.cs and the ZombieBaseKit/GradedSprite shader.
// The time-of-day grade is rgb = (luma + (rgb - luma) * sat) * mul + add, with the kit's three
// window-glass colours blending toward lamplight after dark. Values match Resources/lighting.json.
const P = globalThis.PIXI;

// [sat, mul, add, dark, glow] for early morning, morning, day, early evening, evening, night, late night.
const PRESETS = [
  [0.72, [0.80, 0.76, 0.88], [0.07, 0.04, 0.06], 0.45, 0.35],
  [0.98, [1.04, 0.97, 0.84], [0.04, 0.02, 0.00], 0, 0],
  [1.00, [1, 1, 1], [0, 0, 0], 0, 0],
  [1.06, [1.10, 0.90, 0.70], [0.05, 0.02, 0.00], 0.3, 0.2],
  [0.72, [0.74, 0.58, 0.72], [0.05, 0.02, 0.07], 0.75, 0.7],
  [0.45, [0.34, 0.42, 0.62], [0.01, 0.02, 0.05], 1, 1],
  [0.30, [0.22, 0.26, 0.42], [0.00, 0.01, 0.03], 1, 0.8],
];
// Hour each preset peaks at, in order; late night wraps past midnight.
const HOURS = [5.5, 8, 12, 17.5, 19.5, 22, 26];
const smoothStep = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

export function gradeAt(hour) {
  const h = hour < HOURS[0] ? hour + 24 : hour;
  for (let i = 0; i < HOURS.length; i++) {
    const h0 = HOURS[i], h1 = i + 1 < HOURS.length ? HOURS[i + 1] : HOURS[0] + 24;
    if (h >= h0 && h < h1) {
      const a = PRESETS[i], b = PRESETS[(i + 1) % PRESETS.length], t = smoothStep((h - h0) / (h1 - h0));
      return { sat: mix(a[0], b[0], t), mul: mix3(a[1], b[1], t), add: mix3(a[2], b[2], t), darkness: mix(a[3], b[3], t), glow: mix(a[4], b[4], t) };
    }
  }
  const d = PRESETS[2];
  return { sat: d[0], mul: d[1], add: d[2], darkness: d[3], glow: d[4] };
}

// Applied to the composited lit layer, so colours arrive premultiplied.
const FRAGMENT = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uDesat;
uniform float uGlow;
uniform vec3 uMul;
uniform vec3 uAdd;
bool near(vec3 a, vec3 b) { vec3 d = abs(a - b); return d.r < 1.5 / 255.0 && d.g < 1.5 / 255.0 && d.b < 1.5 / 255.0; }
void main() {
  vec4 c = texture2D(uSampler, vTextureCoord);
  if (c.a <= 0.0) { gl_FragColor = c; return; }
  vec3 src = c.rgb / c.a;
  float l = dot(src, vec3(0.299, 0.587, 0.114));
  vec3 rgb = clamp((l + (src - l) * (1.0 - uDesat)) * uMul + uAdd, 0.0, 1.0);
  if (uGlow > 0.0) {
    if (near(src, vec3(31.0, 40.0, 37.0) / 255.0)) rgb = mix(rgb, vec3(150.0, 96.0, 40.0) / 255.0, uGlow);
    else if (near(src, vec3(52.0, 66.0, 60.0) / 255.0)) rgb = mix(rgb, vec3(214.0, 150.0, 64.0) / 255.0, uGlow);
    else if (near(src, vec3(86.0, 106.0, 96.0) / 255.0)) rgb = mix(rgb, vec3(244.0, 212.0, 132.0) / 255.0, uGlow);
  }
  gl_FragColor = vec4(rgb * c.a, c.a);
}`;

export class SurvivalLighting {
  constructor() {
    this.hour = 12;
    this.darkness = 0;
    this.glow = 0;
    this.filter = new P.Filter(undefined, FRAGMENT, { uDesat: 0, uGlow: 0, uMul: new Float32Array([1, 1, 1]), uAdd: new Float32Array([0, 0, 0]) });
  }

  update() {
    const g = gradeAt(this.hour);
    this.darkness = g.darkness;
    this.glow = g.glow;
    const u = this.filter.uniforms;
    u.uDesat = 1 - g.sat;
    u.uGlow = g.glow;
    u.uMul[0] = g.mul[0]; u.uMul[1] = g.mul[1]; u.uMul[2] = g.mul[2];
    u.uAdd[0] = g.add[0]; u.uAdd[1] = g.add[1]; u.uAdd[2] = g.add[2];
  }
}
