import type { SoundId } from "./game";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

/** 最初のユーザー操作の中で呼ばれる前提（自動再生制限対策） */
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext) {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function envelope(g: GainNode, t: number, peak: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
}

function tone(c: AudioContext, t: number, f0: number, f1: number, decay: number, peak: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + decay);
  envelope(g, t, peak, decay);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + decay + 0.02);
}

function hiss(c: AudioContext, t: number, filter: BiquadFilterType, freq: number, q: number, decay: number, peak: number) {
  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = noiseBuffer(c);
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  envelope(g, t, peak, decay);
  s.connect(f).connect(g).connect(master!);
  s.start(t);
  s.stop(t + decay + 0.02);
}

/** コンボが増えるほど音程が少し上がる（最大 +7 半音） */
export function playPop(id: SoundId, combo: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const semis = Math.min(Math.max(combo - 1, 0), 14) * 0.5;
  const r = 2 ** (semis / 12) * (0.97 + Math.random() * 0.06);

  if (id === "soft") {
    hiss(c, t, "bandpass", 2400 * r, 1.2, 0.09, 0.5);
    tone(c, t, 900 * r, 260 * r, 0.1, 0.35);
  } else if (id === "deep") {
    tone(c, t, 320 * r, 80 * r, 0.22, 0.6);
    hiss(c, t, "lowpass", 900, 0.7, 0.08, 0.25);
  } else {
    tone(c, t, 1568 * r, 1500 * r, 0.35, 0.2);
    tone(c, t, 2349 * r, 2300 * r, 0.25, 0.12);
    hiss(c, t, "highpass", 5000, 0.7, 0.04, 0.25);
  }
}

export function playLevelUp() {
  const c = getCtx();
  if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(c, c.currentTime + i * 0.09, f, f, 0.5, 0.22, "triangle");
  });
}
