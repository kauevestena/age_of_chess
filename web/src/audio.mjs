/** Original, locally synthesized score. Modal melodies, plucked strings,
 * recorder, bowed drone, frame drum and bells. No recordings or borrowed themes. */
export const SCORES = [
  {
    name: "Banners in the Mist",
    root: 50,
    tempo: 80,
    melody: [
      7, 9, 10, 7, 5, 3, 2, 0, 3, 5, 7, 10, 9, 7, 5, 3, 2, 5, 7, 9, 10, 12, 10,
      7, 9, 7, 5, 3, 2, 0, 2, 0,
    ],
    chords: [0, 0, 3, 5, 0, 7, 5, 0, 3, 5, 0, 7, 5, 3, 7, 0],
  },
  {
    name: "The Ashen March",
    root: 50,
    tempo: 88,
    melody: [
      0, 7, 5, 7, 10, 9, 7, 5, 3, 2, 3, 7, 5, 3, 2, 0, 7, 10, 12, 10, 9, 7, 9,
      5, 7, 5, 3, 2, 0, 2, 3, 0,
    ],
    chords: [0, 7, 0, 5, 3, 0, 7, 0, 5, 5, 3, 7, 0, 3, 7, 0],
  },
  {
    name: "A Crown at Dusk",
    root: 48,
    tempo: 76,
    melody: [
      12, 10, 7, 9, 5, 7, 3, 5, 7, 5, 3, 2, 0, 3, 5, 7, 10, 9, 7, 5, 3, 5, 2, 0,
      3, 2, 0, 2, 5, 3, 2, 0,
    ],
    chords: [0, 3, 5, 0, 7, 5, 3, 0, 3, 7, 5, 0, 5, 3, 7, 0],
  },
];
const hz = (note) => 440 * 2 ** ((note - 69) / 12);
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export class Soundscape {
  constructor(onTrack = () => {}) {
    this.onTrack = onTrack;
    this.musicVolume = 0.38;
    this.effectsVolume = 0.6;
    this.enabled = true;
    this.started = false;
    this.beat = 0;
    this.track = 0;
    this.tension = false;
    this.buffers = new Map();
    document.addEventListener("visibilitychange", () => this.visibility());
  }
  async start() {
    if (!this.enabled) return false;
    try {
      if (!this.ctx) this.setup();
      await this.ctx.resume();
      this.started = true;
      this.schedule();
      this.onTrack(SCORES[this.track].name);
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }
  setup() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error("Audio unavailable");
    this.ctx = new Audio();
    const c = this.ctx;
    this.master = c.createDynamicsCompressor();
    this.master.threshold.value = -12;
    this.master.ratio.value = 6;
    this.master.connect(c.destination);
    this.music = c.createGain();
    this.effects = c.createGain();
    this.music.connect(this.master);
    this.effects.connect(this.master);
    const reverb = c.createConvolver(),
      impulse = c.createBuffer(2, c.sampleRate * 1.7, c.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++)
        data[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.2;
    }
    reverb.buffer = impulse;
    const wet = c.createGain();
    wet.gain.value = 0.25;
    this.music.connect(reverb);
    reverb.connect(wet);
    wet.connect(this.master);
    this.setVolumes(this.musicVolume, this.effectsVolume);
  }
  setVolumes(music, effects) {
    this.musicVolume = clamp(music);
    this.effectsVolume = clamp(effects);
    if (this.ctx) {
      this.music.gain.setTargetAtTime(
        this.musicVolume * 0.6,
        this.ctx.currentTime,
        0.05,
      );
      this.effects.gain.setTargetAtTime(
        this.effectsVolume * 0.45,
        this.ctx.currentTime,
        0.05,
      );
    }
  }
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) return this.start();
    clearInterval(this.timer);
    this.timer = null;
    if (this.ctx) await this.ctx.suspend();
    return false;
  }
  async visibility() {
    if (!this.ctx || !this.started || !this.enabled) return;
    clearInterval(this.timer);
    this.timer = null;
    if (document.hidden) await this.ctx.suspend();
    else {
      await this.ctx.resume();
      this.schedule();
    }
  }
  schedule() {
    if (this.timer || document.hidden) return;
    this.next = this.ctx.currentTime + 0.08;
    const tick = () => {
      while (this.next < this.ctx.currentTime + 0.3) {
        this.playBeat(this.next);
        this.next += 60 / SCORES[this.track].tempo / 2;
      }
    };
    tick();
    this.timer = setInterval(tick, 80);
  }
  tone(note, at, duration, gain, style = "flute", bus = this.music) {
    const c = this.ctx,
      env = c.createGain(),
      f = hz(note),
      voices = [];
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.06);
    env.gain.setValueAtTime(gain * 0.72, at + duration * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    env.connect(bus);
    const harmonics =
      style === "drone"
        ? [
            [1, 0.7],
            [2, 0.16],
            [3, 0.08],
          ]
        : style === "bell"
          ? [
              [1, 0.7],
              [2.76, 0.12],
              [4.07, 0.07],
            ]
          : [
              [1, 0.8],
              [2, 0.12],
            ];
    for (const [multiple, level] of harmonics) {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f * multiple, at);
      if (style === "flute") {
        o.frequency.linearRampToValueAtTime(
          f * multiple * 1.003,
          at + duration / 2,
        );
        o.frequency.linearRampToValueAtTime(f * multiple, at + duration);
      }
      g.gain.value = level;
      o.connect(g);
      g.connect(env);
      o.start(at);
      o.stop(at + duration + 0.02);
      voices.push([o, g]);
    }
    voices[0][0].onended = () => {
      for (const [o, g] of voices) {
        o.disconnect();
        g.disconnect();
      }
      env.disconnect();
    };
  }
  pluck(note, at, gain = 0.3, bus = this.music) {
    const c = this.ctx;
    if (!this.buffers.has(note)) {
      const length = Math.round(c.sampleRate / hz(note)),
        buffer = c.createBuffer(1, c.sampleRate * 2.4, c.sampleRate);
      const out = buffer.getChannelData(0),
        ring = new Float32Array(length);
      for (let i = 0; i < length; i++) ring[i] = Math.random() * 2 - 1;
      for (let i = 0; i < out.length; i++) {
        const p = i % length;
        out[i] = ring[p] * Math.min(1, i / 70);
        ring[p] = 0.496 * (ring[p] + ring[(p + 1) % length]);
      }
      this.buffers.set(note, buffer);
    }
    const source = c.createBufferSource(),
      volume = c.createGain();
    source.buffer = this.buffers.get(note);
    volume.gain.value = gain;
    source.connect(volume);
    volume.connect(bus);
    source.start(at);
    source.onended = () => {
      source.disconnect();
      volume.disconnect();
    };
  }
  noise(at, duration, gain, frequency, bus = this.effects) {
    const c = this.ctx,
      buf = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate),
      data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      env = c.createGain();
    src.buffer = buf;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    env.gain.value = gain;
    src.connect(filter);
    filter.connect(env);
    env.connect(bus);
    src.start(at);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }
  drum(at, gain, bus = this.music) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.setValueAtTime(115, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.2);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    o.connect(g);
    g.connect(bus);
    o.start(at);
    o.stop(at + 0.36);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
    this.noise(at, 0.12, gain * 0.35, 1000, bus);
  }
  playBeat(at) {
    const score = SCORES[this.track],
      b = this.beat,
      bar = Math.floor(b / 8),
      step = b % 8,
      beat = 60 / score.tempo;
    const chord = score.root + score.chords[bar % 16];
    this.pluck(
      chord + [12, 19, 24, 19, 15, 19, 24, 22][step],
      at,
      step % 2 ? 0.14 : 0.22,
    );
    if (step === 0 || step === 4) {
      const n =
        score.melody[(bar * 2 + (step === 4 ? 1 : 0)) % score.melody.length];
      this.tone(
        score.root + 24 + n,
        at + 0.035,
        beat * (step === 0 ? 1.8 : 1.65),
        0.13,
      );
    }
    if (step === 0) {
      this.tone(chord - 12, at, beat * 3.8, 0.07, "drone");
      this.drum(at, 0.23);
    }
    if (step === 4) this.drum(at, 0.15);
    if (this.tension && [2, 6, 7].includes(step))
      this.noise(at, 0.13, 0.07, 6200, this.music);
    if (bar % 4 === 3 && step === 6)
      this.tone(chord + 24, at, beat * 1.5, 0.035, "bell");
    this.beat++;
    if (this.beat >= 128) {
      this.beat = 0;
      this.track = (this.track + 1) % SCORES.length;
      this.onTrack(SCORES[this.track].name);
    }
  }
  effect(kind) {
    if (!this.ctx || !this.enabled || this.ctx.state !== "running") return;
    const at = this.ctx.currentTime + 0.01;
    if (kind === "move") {
      this.noise(at, 0.12, 0.2, 1200);
      this.drum(at, 0.08, this.effects);
    }
    if (kind === "cavalry")
      for (let i = 0; i < 6; i++)
        this.drum(at + i * 0.1, i % 2 ? 0.13 : 0.24, this.effects);
    if (kind === "melee") {
      this.noise(at, 0.25, 0.48, 5800);
      for (const n of [79, 86.2, 91.4])
        this.tone(n, at, 0.65, 0.1, "bell", this.effects);
    }
    if (kind === "ranged") {
      this.pluck(76, at, 0.5, this.effects);
      this.noise(at + 0.12, 0.35, 0.2, 3400);
    }
    if (kind === "convert")
      [62, 69, 74, 77, 81].forEach((n, i) =>
        this.tone(n, at + i * 0.13, 1.2, 0.12, "bell", this.effects),
      );
    if (kind === "victory")
      [50, 57, 62, 65, 69, 74].forEach((n, i) =>
        this.tone(n, at + i * 0.18, 1.7, 0.17, "flute", this.effects),
      );
  }
}
