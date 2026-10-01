// Procedural retro chiptune audio synthesizer for Afterlife.
// Uses Web Audio API to generate dynamic audio waveforms without external audio assets.

class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.enabled = true;
    this.volume = 0.6;
    this.sampleRate = 22050;

    // Load sound preference from localStorage
    try {
      const saved = localStorage.getItem('afterlife.sound');
      if (saved !== null) this.enabled = saved === '1';
    } catch {}
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ sampleRate: this.sampleRate });
        this.generateBuffers();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  createBuffer(name, duration, waveGen) {
    if (!this.ctx) return null;
    const totalSamples = Math.ceil(duration * this.sampleRate);
    const buffer = this.ctx.createBuffer(1, totalSamples, this.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < totalSamples; i++) {
      const t = i / this.sampleRate;
      const sample = waveGen(t);
      data[i] = Math.max(-1, Math.min(1, sample));
    }
    this.buffers.set(name, buffer);
    return buffer;
  }

  generateBuffers() {
    if (!this.ctx) return;

    // Click: snappy UI tap
    this.createBuffer('click', 0.035, t => {
      const env = Math.exp(-t * 120);
      const wave = Math.sin(2 * Math.PI * 1400 * t);
      return wave * env * 0.4;
    });

    // Build: thump + wood knock
    this.createBuffer('build', 0.16, t => {
      const env1 = Math.exp(-t * 40);
      const f1 = 220 + (90 - 220) * (t / 0.16);
      const knock1 = Math.sign(Math.sin(2 * Math.PI * f1 * t)) * env1 * 0.5;

      const t2 = Math.max(0, t - 0.06);
      const env2 = Math.exp(-t2 * 50);
      const f2 = 300 + (120 - 300) * (t2 / 0.10);
      const knock2 = (Math.sin(2 * Math.PI * f2 * t2) > 0 ? 1 : -1) * env2 * 0.4;
      return (knock1 + knock2) * 0.6;
    });

    // Shoot: gunfire crack + noise burst
    let sRand = 1337;
    const nextRand = () => { sRand = (sRand * 1664525 + 1013904223) >>> 0; return (sRand / 4294967296) * 2 - 1; };
    this.createBuffer('shoot', 0.12, t => {
      const env = Math.exp(-t * 35);
      const freq = 900 + (180 - 900) * (t / 0.12);
      const tonal = Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.4;
      const noise = nextRand() * 0.6;
      return (tonal + noise) * env * 0.7;
    });

    // Hit: zombie damage / blunt hit
    let hRand = 42;
    const nextHRand = () => { hRand = (hRand * 1664525 + 1013904223) >>> 0; return (hRand / 4294967296) * 2 - 1; };
    this.createBuffer('hit', 0.14, t => {
      const env = Math.exp(-t * 28);
      const freq = 160 + (50 - 160) * (t / 0.14);
      const wave = Math.sin(2 * Math.PI * freq * t);
      const crunch = nextHRand() * 0.35;
      return (wave * 0.65 + crunch) * env * 0.6;
    });

    // Repair: metallic hammer ping
    this.createBuffer('repair', 0.14, t => {
      const env = Math.exp(-t * 30);
      const tone = Math.sin(2 * Math.PI * 720 * t) * 0.6 + Math.sin(2 * Math.PI * 1440 * t) * 0.4;
      return tone * env * 0.5;
    });

    // Heal: uplifting medic chime (C5 -> E5)
    this.createBuffer('heal', 0.28, t => {
      const freq = t < 0.14 ? 523.25 : 659.25;
      const subT = t < 0.14 ? t : (t - 0.14);
      const env = Math.exp(-subT * 18);
      const wave = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
      return wave * env * 0.35;
    });

    // Alarm: emergency warble siren
    this.createBuffer('alarm', 0.32, t => {
      const freq = (t % 0.16 < 0.08) ? 587.33 : 440;
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, t / 0.32)));
      const wave = Math.sign(Math.sin(2 * Math.PI * freq * t));
      return wave * env * 0.4;
    });

    // Dawn: rising chime
    this.createBuffer('dawn', 0.45, t => {
      const freq = t < 0.15 ? 523.25 : (t < 0.3 ? 783.99 : 1046.50);
      const subT = t % 0.15;
      const env = Math.exp(-subT * 12);
      return Math.sin(2 * Math.PI * freq * t) * env * 0.35;
    });

    // Dusk: warning chime
    this.createBuffer('dusk', 0.50, t => {
      const freq = t < 0.16 ? 659.25 : (t < 0.33 ? 523.25 : 440.00);
      const subT = t % 0.16;
      const env = Math.exp(-subT * 10);
      return (Math.sin(2 * Math.PI * freq * t) * 0.8 + Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.3) * env * 0.4;
    });

    // Bash: barricade impact
    let bRand = 88;
    const nextBRand = () => { bRand = (bRand * 1664525 + 1013904223) >>> 0; return (bRand / 4294967296) * 2 - 1; };
    this.createBuffer('bash', 0.16, t => {
      const env = Math.exp(-t * 22);
      const freq = 120 + (35 - 120) * (t / 0.16);
      const sub = Math.sin(2 * Math.PI * freq * t) * 0.7;
      const splinter = nextBRand() * 0.5;
      return (sub + splinter) * env * 0.75;
    });

    // Groan: low zombie groan / roar
    this.createBuffer('groan', 0.45, t => {
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, t / 0.45)));
      const wobble = Math.sin(2 * Math.PI * 5 * t) * 15;
      const freq = 80 + wobble;
      const wave = Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.5;
      const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.5;
      return (wave + sub) * env * 0.4;
    });

    // Victory fanfare
    this.createBuffer('victory', 0.7, t => {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const idx = Math.min(3, Math.floor(t / 0.175));
      const subT = t % 0.175;
      const env = Math.exp(-subT * 8);
      return Math.sin(2 * Math.PI * notes[idx] * t) * env * 0.4;
    });

    // Defeat descending tone
    this.createBuffer('defeat', 0.8, t => {
      const freq = 300 + (65 - 300) * (t / 0.8);
      const env = Math.exp(-t * 4);
      const wave = Math.sign(Math.sin(2 * Math.PI * freq * t));
      return wave * env * 0.45;
    });
  }

  play(name, pitch = 1.0, volScale = 1.0) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.5, Math.min(2.0, pitch));

    const gain = this.ctx.createGain();
    gain.gain.value = this.volume * volScale;

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
  }

  playClick() { this.play('click', 0.95 + Math.random() * 0.1, 0.7); }
  playBuild() { this.play('build', 0.95 + Math.random() * 0.1, 1.0); }
  playShoot() { this.play('shoot', 0.92 + Math.random() * 0.16, 0.9); }
  playHit() { this.play('hit', 0.90 + Math.random() * 0.2, 0.8); }
  playRepair() { this.play('repair', 0.95 + Math.random() * 0.1, 0.8); }
  playHeal() { this.play('heal', 1.0, 0.9); }
  playAlarm() { this.play('alarm', 1.0, 1.0); }
  playDawn() { this.play('dawn', 1.0, 0.9); }
  playDusk() { this.play('dusk', 1.0, 0.9); }
  playZombieBash() { this.play('bash', 0.85 + Math.random() * 0.3, 0.85); }
  playZombieGroan() { this.play('groan', 0.85 + Math.random() * 0.3, 0.75); }
  playOutcome(won) { this.play(won ? 'victory' : 'defeat', 1.0, 1.0); }

  toggleSound() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('afterlife.sound', this.enabled ? '1' : '0');
    } catch {}
    return this.enabled;
  }
}

export const sound = new AudioManager();
