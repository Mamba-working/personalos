// Procedural ambience (rain / wind / air) and small UI sounds. Off until the user enables it.
const MIX: Record<string, { air: number; wind: number; rain: number }> = {
  sunny: { air: 0.1, wind: 0.04, rain: 0 },
  cloudy: { air: 0.14, wind: 0.1, rain: 0 },
  windy: { air: 0.06, wind: 0.5, rain: 0 },
  rain: { air: 0.05, wind: 0.08, rain: 0.42 },
  snow: { air: 0.08, wind: 0.12, rain: 0 },
  fog: { air: 0.18, wind: 0.03, rain: 0 },
};

type Layer = { f: BiquadFilterNode; g: GainNode };

export class Ambience {
  enabled = false;
  private ctx: AudioContext | null = null;
  private weather = 'sunny';
  private master!: GainNode;
  private noise!: AudioBuffer;
  private air!: Layer;
  private wind!: Layer;
  private rain!: Layer;

  enable(on: boolean) {
    this.enabled = on;
    if (on && !this.ctx) this.init();
    if (!this.ctx) return;
    if (on) this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.4);
  }

  private init() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      // pinkish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    this.noise = buf;
    const layer = (type: BiquadFilterType, freq: number, q: number): Layer => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return { f, g };
    };
    this.air = layer('lowpass', 420, 0.5);
    this.wind = layer('bandpass', 380, 1.4);
    this.rain = layer('highpass', 900, 0.4);
    this.setWeather(this.weather);
  }

  dispose() { this.enabled = false; void this.ctx?.close(); this.ctx = null; }

  setWeather(name: string) {
    this.weather = name;
    if (!this.ctx) return;
    const m = MIX[name] || MIX.sunny;
    const t = this.ctx.currentTime;
    this.air.g.gain.setTargetAtTime(m.air, t, 1.2);
    this.wind.g.gain.setTargetAtTime(m.wind, t, 1.2);
    this.rain.g.gain.setTargetAtTime(m.rain, t, 1.2);
  }

  update(gust: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.wind.f.frequency.setTargetAtTime(260 + gust * 520, t, 0.3);
  }

  blip(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  boop(k = 1) { this.blip(520 * k, 820 * k, 0.16, 0.18); }
  hop() { this.blip(300, 420, 0.1, 0.05); }
  thud(impact: number) { this.blip(140, 55, 0.25, Math.min(0.08 + impact * 0.02, 0.4)); }

  thunder() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.4 + Math.random() * 0.8;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 2.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 3.1);
  }
}
