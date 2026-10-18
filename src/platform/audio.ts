// All sound effects are synthesized with Web Audio. No sound files.

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let enabled = true;
let noise: AudioBuffer | null = null;

function getCtx(): Ctx | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

/** iOS only starts audio from a user gesture: call on the first tap. */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

function ready(): Ctx | null {
  if (!enabled) return null;
  const c = getCtx();
  if (!c) return null;
  if (c.state === 'suspended') void c.resume();
  return c;
}

function tone(
  c: Ctx,
  opts: { freq: number; to?: number; type?: OscillatorType; start?: number; dur: number; gain: number; attack?: number },
) {
  const t0 = c.currentTime + (opts.start ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
  const attack = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

function noiseBurst(c: Ctx, opts: { dur: number; gain: number; freq: number; start?: number }) {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (opts.start ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = opts.freq;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);
}

/** Low wooden knock. */
export function sfxPlace(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 190, to: 90, type: 'sine', dur: 0.12, gain: 0.5 });
  tone(c, { freq: 420, to: 260, type: 'triangle', dur: 0.05, gain: 0.12 });
  noiseBurst(c, { dur: 0.04, gain: 0.25, freq: 1800 });
}

/** Rising chime; pitch goes up with the combo. */
export function sfxClear(lines: number, combo: number): void {
  const c = ready();
  if (!c) return;
  const base = 523.25 * Math.pow(2, Math.min(combo - 1, 8) / 12 * 2);
  const steps = [0, 4, 7, 12].slice(0, Math.min(4, 1 + lines));
  steps.forEach((semi, i) => {
    tone(c, { freq: base * Math.pow(2, semi / 12), type: 'triangle', start: i * 0.06, dur: 0.35, gain: 0.18 });
    tone(c, { freq: base * 2 * Math.pow(2, semi / 12), type: 'sine', start: i * 0.06, dur: 0.25, gain: 0.05 });
  });
}

/** Short arpeggio for a cleared board or a won level. */
export function sfxFanfare(): void {
  const c = ready();
  if (!c) return;
  [0, 4, 7, 12, 16].forEach((semi, i) =>
    tone(c, { freq: 523.25 * Math.pow(2, semi / 12), type: 'triangle', start: i * 0.08, dur: 0.4, gain: 0.16 }),
  );
}

/** Soft descending tone. */
export function sfxFail(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 392, to: 196, type: 'sine', dur: 0.6, gain: 0.2, attack: 0.03 });
  tone(c, { freq: 330, to: 165, type: 'triangle', start: 0.12, dur: 0.6, gain: 0.08, attack: 0.03 });
}

/** Soft click for an invalid drop. */
export function sfxInvalid(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 240, to: 180, type: 'sine', dur: 0.07, gain: 0.15 });
}

export function sfxTap(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 880, to: 660, type: 'sine', dur: 0.05, gain: 0.08 });
}

export function sfxPickup(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 600, to: 800, type: 'sine', dur: 0.05, gain: 0.05 });
}
