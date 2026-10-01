// Port of Assets/Afterlife/Scripts/AudioManager.cs: procedural chiptune clips synthesized in memory
// at 22.05 kHz, played one-shot with Unity's per-sound pitch jitter and volume scales.
const SAMPLE_RATE = 22050;
const PREF_KEY = 'Afterlife.Sound';
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const clamp01 = t => Math.min(1, Math.max(0, t));
const square = x => (Math.sin(x) >= 0 ? 1 : -1); // Mathf.Sign(0) is 1.
const range = (min, max) => min + Math.random() * (max - min);
// Deterministic noise per clip, like System.Random(seed) in the Unity synthesizer.
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const TAU = 2 * Math.PI;

const CLIPS = {
  click: [0.035, () => t => Math.sin(TAU * 1400 * t) * Math.exp(-t * 120) * 0.4],
  build: [0.16, () => t => {
    const knock1 = square(TAU * lerp(220, 90, t / 0.16) * t) * Math.exp(-t * 40) * 0.5;
    const t2 = Math.max(0, t - 0.06);
    const knock2 = (Math.sin(TAU * lerp(300, 120, t2 / 0.1) * t2) > 0 ? 1 : -1) * Math.exp(-t2 * 50) * 0.4;
    return (knock1 + knock2) * 0.6;
  }],
  shoot: [0.12, () => { const rand = seeded(1337); return t => {
    const tonal = square(TAU * lerp(900, 180, t / 0.12) * t) * 0.4, noise = (rand() * 2 - 1) * 0.6;
    return (tonal + noise) * Math.exp(-t * 35) * 0.7;
  }; }],
  hit: [0.14, () => { const rand = seeded(42); return t => {
    const wave = Math.sin(TAU * lerp(160, 50, t / 0.14) * t), crunch = (rand() * 2 - 1) * 0.35;
    return (wave * 0.65 + crunch) * Math.exp(-t * 28) * 0.6;
  }; }],
  repair: [0.14, () => t => (Math.sin(TAU * 720 * t) * 0.6 + Math.sin(TAU * 1440 * t) * 0.4) * Math.exp(-t * 30) * 0.5],
  heal: [0.28, () => t => {
    const freq = t < 0.14 ? 523.25 : 659.25, sub = t < 0.14 ? t : t - 0.14;
    return (Math.sin(TAU * freq * t) + 0.3 * Math.sin(TAU * freq * 2 * t)) * Math.exp(-sub * 18) * 0.35;
  }],
  alarm: [0.32, () => t => {
    const freq = t % 0.16 < 0.08 ? 587.33 : 440;
    return square(TAU * freq * t) * Math.sin(Math.PI * clamp01(t / 0.32)) * 0.4;
  }],
  dawn: [0.45, () => t => {
    const freq = t < 0.15 ? 523.25 : t < 0.3 ? 783.99 : 1046.5;
    return Math.sin(TAU * freq * t) * Math.exp(-(t % 0.15) * 12) * 0.35;
  }],
  dusk: [0.5, () => t => {
    const freq = t < 0.16 ? 659.25 : t < 0.33 ? 523.25 : 440;
    return (Math.sin(TAU * freq * t) * 0.8 + Math.sin(TAU * freq * 0.5 * t) * 0.3) * Math.exp(-(t % 0.16) * 10) * 0.4;
  }],
  defeat: [0.8, () => t => square(TAU * lerp(300, 65, t / 0.8) * t) * Math.exp(-t * 4) * 0.45],
  victory: [0.7, () => t => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    return Math.sin(TAU * notes[Math.min(3, Math.floor(t / 0.175))] * t) * Math.exp(-(t % 0.175) * 8) * 0.4;
  }],
  bash: [0.16, () => { const rand = seeded(88); return t => {
    const sub = Math.sin(TAU * lerp(120, 35, t / 0.16) * t) * 0.7, splinter = (rand() * 2 - 1) * 0.5;
    return (sub + splinter) * Math.exp(-t * 22) * 0.75;
  }; }],
  groan: [0.45, () => t => {
    const freq = 80 + Math.sin(TAU * 5 * t) * 15;
    const wave = square(TAU * freq * t) * 0.5, sub = Math.sin(TAU * freq * 0.5 * t) * 0.5;
    return (wave + sub) * Math.sin(Math.PI * clamp01(t / 0.45)) * 0.4;
  }],
};

class AudioManager {
  constructor() {
    this.volume = 0.6;
    this.ctx = null;
    this.buffers = new Map();
    try { this.sfxEnabled = localStorage.getItem(PREF_KEY) !== '0'; } catch { this.sfxEnabled = true; }
  }

  // Browsers only allow audio after a user gesture; the host calls this on the first input.
  unlock() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      for (const [name, [duration, make]] of Object.entries(CLIPS)) {
        const wave = make(), length = Math.ceil(duration * SAMPLE_RATE);
        const buffer = this.ctx.createBuffer(1, length, SAMPLE_RATE), data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.max(-1, Math.min(1, wave(i / SAMPLE_RATE)));
        this.buffers.set(name, buffer);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  play(name, pitch = 1, volumeScale = 1) {
    if (!this.sfxEnabled || !this.ctx || this.ctx.state !== 'running') return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.min(2, Math.max(0.5, pitch));
    gain.gain.value = this.volume * volumeScale;
    source.connect(gain).connect(this.ctx.destination);
    source.start();
  }

  playClick() { this.play('click', range(0.95, 1.05), 0.7); }
  playBuild() { this.play('build', range(0.95, 1.05), 1); }
  playShoot() { this.play('shoot', range(0.92, 1.08), 0.9); }
  playHit() { this.play('hit', range(0.9, 1.1), 0.8); }
  playRepair() { this.play('repair', range(0.95, 1.05), 0.8); }
  playHeal() { this.play('heal', 1, 0.9); }
  playAlarm() { this.play('alarm', 1, 1); }
  playDawn() { this.play('dawn', 1, 0.9); }
  playDusk() { this.play('dusk', 1, 0.9); }
  playZombieBash() { this.play('bash', range(0.85, 1.15), 0.85); }
  playZombieGroan() { this.play('groan', range(0.85, 1.15), 0.75); }
  playOutcome(won) { this.play(won ? 'victory' : 'defeat', 1, 1); }

  toggleSound() {
    this.sfxEnabled = !this.sfxEnabled;
    try { localStorage.setItem(PREF_KEY, this.sfxEnabled ? '1' : '0'); } catch { /* preference is best effort */ }
  }
}

export const audio = new AudioManager();
