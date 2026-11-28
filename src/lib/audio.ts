// 効果音はすべてコード内で合成しています（録音素材・既存曲のフレーズは使っていません）。
import type { SoundId } from "./game";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let loop: AudioBuffer | null = null;

/** 鳴り続ける音（砂・スライム）。止め忘れを防ぐため一括で止められるようにしておく */
type Stream = { set(level: number): void; stop(): void };
const streams = new Set<Stream>();
export function stopAllStreams() {
  for (const s of [...streams]) s.stop();
}
export type AudioStream = Stream;

/* ---------- 左右の定位（ステレオパン） ---------- */
let curPan = 0;
/** -1(左) 〜 1(右)。次に鳴る音と、鳴り続けている音に反映される */
export function setPan(p: number) {
  curPan = Math.max(-1, Math.min(1, p));
}
function makePanner(c: AudioContext): StereoPannerNode | null {
  return typeof c.createStereoPanner === "function" ? c.createStereoPanner() : null;
}
/** 音の出口。いまのパンを反映したパナーを通してマスターにつなぐ */
function out(c: AudioContext): AudioNode {
  const p = makePanner(c);
  if (!p) return master!;
  p.pan.value = curPan;
  p.connect(master!);
  return p;
}

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
    // 別のタブに移ったら、鳴り続ける音を止めて、音声そのものも止める（戻ると次の操作で再開）
    const created = ctx;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAllStreams();
        void created.suspend();
      }
    });
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function makeNoise(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
const noiseBuffer = (c: AudioContext) => (noise ??= makeNoise(c, 0.3));
const loopBuffer = (c: AudioContext) => (loop ??= makeNoise(c, 2));

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
  o.connect(g).connect(out(c));
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
  s.connect(f).connect(g).connect(out(c));
  s.start(t);
  s.stop(t + decay + 0.02);
}

/** コンボが増えるほど音程が少し上がる（最大 +7 半音）＋わずかなゆらぎ */
const pitch = (combo: number) =>
  2 ** ((Math.min(Math.max(combo - 1, 0), 14) * 0.5) / 12) * (0.97 + Math.random() * 0.06);

/** ペンタトニック（どの音を重ねても濁らない音階）の半音オフセット */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

/* ---------- しゃぼん玉（と、解放した音たち） ---------- */
export function playPop(id: SoundId, combo: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const r = pitch(combo);

  switch (id) {
    case "soft":
      hiss(c, t, "bandpass", 2400 * r, 1.2, 0.09, 0.5);
      tone(c, t, 900 * r, 260 * r, 0.1, 0.35);
      break;
    case "deep":
      tone(c, t, 320 * r, 80 * r, 0.22, 0.6);
      hiss(c, t, "lowpass", 900, 0.7, 0.08, 0.25);
      break;
    case "glass":
      tone(c, t, 1568 * r, 1500 * r, 0.35, 0.2);
      tone(c, t, 2349 * r, 2300 * r, 0.25, 0.12);
      hiss(c, t, "highpass", 5000, 0.7, 0.04, 0.25);
      break;
    case "drop": // 音程が上がる水滴
      tone(c, t, 520 * r, 1150 * r, 0.09, 0.45);
      tone(c, t + 0.035, 330 * r, 700 * r, 0.13, 0.22);
      hiss(c, t, "lowpass", 1200, 0.7, 0.05, 0.12);
      break;
    case "pluck": {
      const f = 523.25 * r * 2 ** (PENTA[Math.floor(Math.random() * 5)] / 12);
      tone(c, t, f, f, 0.5, 0.4);
      tone(c, t, f * 4, f * 4, 0.07, 0.1);
      break;
    }
    case "crackle": {
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        hiss(c, t + Math.random() * 0.16, "highpass", 3000 + Math.random() * 3000, 0.8, 0.02, 0.3);
      }
      tone(c, t, 1800 * r, 900 * r, 0.04, 0.1);
      break;
    }
    case "chime": {
      const f = 1175 * r;
      tone(c, t, f, f, 0.9, 0.14);
      tone(c, t, f * 2.76, f * 2.76, 0.5, 0.08);
      tone(c, t, f * 5.4, f * 5.4, 0.25, 0.04);
      break;
    }
    case "wood":
      tone(c, t, 720 * r, 520 * r, 0.06, 0.5);
      tone(c, t, 1440 * r, 1000 * r, 0.03, 0.15);
      hiss(c, t, "bandpass", 1800, 1.5, 0.02, 0.25);
      break;
    case "sparkle": {
      const s0 = Math.floor(Math.random() * 3);
      for (let i = 0; i < 5; i++) {
        const f = 1046.5 * r * 2 ** (PENTA[(s0 + i) % PENTA.length] / 12);
        tone(c, t + i * 0.045, f, f, 0.3, 0.12);
      }
      hiss(c, t, "highpass", 7000, 0.7, 0.15, 0.06);
      break;
    }
    case "harp": {
      const s0 = Math.floor(Math.random() * 3);
      for (let i = 0; i < 6; i++) {
        const f = 392 * r * 2 ** (PENTA[s0 + i] / 12);
        tone(c, t + i * 0.06, f, f, 0.7, 0.22, "triangle");
      }
      break;
    }
  }
}

/* ---------- ゼリー ---------- */
export function playSquish(combo: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const r = pitch(combo);
  tone(c, t, 240 * r, 90 * r, 0.18, 0.5);
  hiss(c, t, "lowpass", 700, 0.8, 0.14, 0.3);
}

export function playJellyBubble(combo: number) {
  const c = getCtx();
  if (!c) return;
  const r = pitch(combo) * (0.9 + Math.random() * 0.5);
  tone(c, c.currentTime, 260 * r, 420 * r, 0.09, 0.18);
}

/** 離したときの「ぷるん」。長く押すほど少し大きく低く鳴る */
export function playBoing(heldSeconds: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const h = Math.min(heldSeconds, 2);
  const base = 130 + h * 20;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  const steps: [number, number][] = [
    [0, 1], [0.05, 1.7], [0.11, 0.78], [0.18, 1.3], [0.26, 0.92], [0.36, 1.08], [0.5, 1],
  ];
  o.frequency.setValueAtTime(base, t);
  steps.forEach(([dt, m]) => o.frequency.linearRampToValueAtTime(base * m, t + dt));
  envelope(g, t, 0.3 + h * 0.12, 0.55);
  o.connect(g).connect(out(c));
  o.start(t);
  o.stop(t + 0.6);
}

/* ---------- 砂 ---------- */
/** なぞっている間ずっと鳴る「さー」という音。set(0〜1)で勢いを変える */
export function startSand(): Stream | null {
  const c = getCtx();
  if (!c) return null;
  const s = c.createBufferSource();
  s.buffer = loopBuffer(c);
  s.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 4500;
  bp.Q.value = 0.6;
  const g = c.createGain();
  g.gain.value = 0;
  const pn = makePanner(c);
  s.connect(hp).connect(bp).connect(g).connect(pn ?? master!);
  pn?.connect(master!);
  s.start();
  const ctl: Stream = {
    set(level: number) {
      const t = c.currentTime;
      pn?.pan.setTargetAtTime(curPan, t, 0.03);
      const jitter = 0.7 + Math.random() * 0.6; // 粒っぽさ
      g.gain.setTargetAtTime(level * 0.35 * jitter, t, 0.04);
      bp.frequency.setTargetAtTime(3500 + level * 3000, t, 0.05);
    },
    stop() {
      if (!streams.delete(ctl)) return; // 二重に止めない
      const t = c.currentTime;
      g.gain.setTargetAtTime(0, t, 0.06);
      s.stop(t + 0.4);
    },
  };
  streams.add(ctl);
  return ctl;
}
export type SandStream = NonNullable<ReturnType<typeof startSand>>;

/* ---------- ぷちぷちシート ---------- */
export function playWrap(combo: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const r = pitch(Math.min(combo, 8));
  hiss(c, t, "bandpass", 3200 * r, 1.5, 0.05, 0.55);
  tone(c, t, 1500 * r, 700 * r, 0.06, 0.3);
}

/* ---------- みずたまり ---------- */
/** x: 0〜1（左右の位置で音階が変わる） */
export function playRipple(x: number, strong: boolean) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const idx = Math.min(PENTA.length - 1, Math.max(0, Math.floor(x * PENTA.length)));
  const f = 392 * 2 ** (PENTA[idx] / 12);
  const peak = strong ? 0.4 : 0.2;
  tone(c, t, f, f * 1.6, 0.1, peak);
  tone(c, t + 0.02, f * 2, f * 2, 0.35, peak * 0.35);
  hiss(c, t, "lowpass", 900, 0.7, 0.04, 0.1);
}

/* ---------- ビー玉 ---------- */
export function playClack(intensity: number, idx: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const f = 1700 + (idx % 5) * 260;
  const peak = 0.08 + 0.3 * intensity;
  tone(c, t, f, f * 0.8, 0.05, peak);
  tone(c, t, f * 1.5, f * 1.4, 0.03, peak * 0.5);
  hiss(c, t, "highpass", 5000, 0.8, 0.02, 0.03 + 0.12 * intensity);
}

/* ---------- かちかちキー ---------- */
/** type: 0 リニア / 1 クリッキー / 2 タクタイル / 3 スペース */
export function playKey(type: number, combo: number, rate: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const r = pitch(Math.min(combo, 6)) * rate;
  if (type === 0) {
    tone(c, t, 180 * r, 90 * r, 0.07, 0.5);
    hiss(c, t, "lowpass", 1500, 0.7, 0.04, 0.3);
  } else if (type === 1) {
    tone(c, t, 2800 * r, 1800 * r, 0.025, 0.35);
    tone(c, t, 160 * r, 80 * r, 0.07, 0.4);
    hiss(c, t, "highpass", 4000, 0.8, 0.02, 0.3);
  } else if (type === 2) {
    tone(c, t, 260 * r, 120 * r, 0.06, 0.5);
    hiss(c, t, "bandpass", 2000, 1, 0.03, 0.35);
  } else {
    tone(c, t, 110 * r, 60 * r, 0.14, 0.6);
    hiss(c, t, "lowpass", 800, 0.7, 0.1, 0.3);
  }
}

/* ---------- スライム ---------- */
/** のばしている間ずっと鳴る、ぬめっとした音。set(0〜1)で勢いを変える */
export function startSlime(): Stream | null {
  const c = getCtx();
  if (!c) return null;
  const s = c.createBufferSource();
  s.buffer = loopBuffer(c);
  s.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 700;
  bp.Q.value = 5;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  const g = c.createGain();
  g.gain.value = 0;
  const pn = makePanner(c);
  s.connect(bp).connect(lp).connect(g).connect(pn ?? master!);
  pn?.connect(master!);
  s.start();
  const ctl: Stream = {
    set(level: number) {
      const t = c.currentTime;
      pn?.pan.setTargetAtTime(curPan, t, 0.03);
      g.gain.setTargetAtTime(level * 0.5, t, 0.05);
      bp.frequency.setTargetAtTime(350 + level * 900 + Math.random() * 350, t, 0.03);
    },
    stop() {
      if (!streams.delete(ctl)) return;
      const t = c.currentTime;
      g.gain.setTargetAtTime(0, t, 0.08);
      s.stop(t + 0.5);
    },
  };
  streams.add(ctl);
  return ctl;
}
export type SlimeStream = NonNullable<ReturnType<typeof startSlime>>;

export function playSlimePress() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 150, 70, 0.12, 0.4);
  hiss(c, t, "lowpass", 600, 0.8, 0.1, 0.35);
  tone(c, t + 0.03, 420, 260, 0.06, 0.15);
}

/** 離したときの「ぬぽっ」。長くのばしたほど大きい */
export function playSlimeRelease(strength: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 520, 170, 0.14, 0.15 + 0.35 * strength);
  tone(c, t + 0.05, 300, 160, 0.12, 0.1 + 0.2 * strength);
  hiss(c, t, "bandpass", 900, 2, 0.08, 0.15 + 0.25 * strength);
}

export function playSlimeBubble() {
  const c = getCtx();
  if (!c) return;
  const f = 260 + Math.random() * 260;
  tone(c, c.currentTime, f, f * 1.8, 0.07, 0.2);
}

/* ---------- パキパキスクイーズ ---------- */
export function playCrack(strong: boolean) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const f = 3000 + Math.random() * 3000;
  hiss(c, t, "highpass", f, 0.9, 0.02, strong ? 0.55 : 0.25);
  hiss(c, t + 0.011, "bandpass", f * 0.7, 1.2, 0.015, strong ? 0.35 : 0.15);
  tone(c, t, 1100 + Math.random() * 1400, 350, 0.025, strong ? 0.25 : 0.1);
}

/* ---------- プッシュポップ ---------- */
/** col: 列（ペンタトニックの音階になる）。inward: 押しこむ=true、押し戻す=false */
export function playPush(col: number, inward: boolean) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const jitter = 0.985 + Math.random() * 0.03;
  const f = 330 * 2 ** (PENTA[col % PENTA.length] / 12) * (inward ? 1 : 0.75) * jitter;
  if (inward) {
    tone(c, t, f * 1.4, f, 0.09, 0.45);
    tone(c, t, f * 2, f * 1.8, 0.04, 0.15);
    hiss(c, t, "lowpass", 1400, 0.8, 0.03, 0.25);
  } else {
    tone(c, t, f * 0.7, f * 1.2, 0.08, 0.3);
    hiss(c, t, "bandpass", 1000, 1, 0.03, 0.15);
  }
}

/** ロウが全部割れる大きなパキパキ */
export function playWaxBreak() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 6; i++) {
    hiss(c, t + i * 0.025 + Math.random() * 0.02, "highpass", 2500 + Math.random() * 3500, 0.9, 0.03, 0.5);
  }
  tone(c, t, 300, 90, 0.12, 0.4);
}

/** ロウがなくなったあとの、やわらかい「ぷにゅ」 */
export function playPuni(strong: boolean) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 200 + Math.random() * 90, 110, 0.1, strong ? 0.32 : 0.18);
  hiss(c, t, "lowpass", 500, 0.8, 0.08, strong ? 0.22 : 0.12);
}

/* ---------- 鳴り続ける音の共通部品 ---------- */
type FilterSpec = { type: BiquadFilterType; freq: number; q: number };
/** ノイズをフィルターに通して鳴らし続ける。set(0〜1)で音量、tuneで音色が変わる */
function noiseStream(
  specs: FilterSpec[],
  gainScale: number,
  tuneIdx: number,
  tune: (level: number) => number,
): Stream | null {
  const c = getCtx();
  if (!c) return null;
  const s = c.createBufferSource();
  s.buffer = loopBuffer(c);
  s.loop = true;
  const nodes = specs.map((sp) => {
    const f = c.createBiquadFilter();
    f.type = sp.type;
    f.frequency.value = sp.freq;
    f.Q.value = sp.q;
    return f;
  });
  const g = c.createGain();
  g.gain.value = 0;
  const pn = makePanner(c);
  let node: AudioNode = s;
  for (const f of nodes) {
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(pn ?? master!);
  pn?.connect(master!);
  s.start();
  const ctl: Stream = {
    set(level: number) {
      const t = c.currentTime;
      const jitter = 0.7 + Math.random() * 0.6;
      g.gain.setTargetAtTime(level * gainScale * jitter, t, 0.04);
      const target = nodes[tuneIdx];
      if (target) target.frequency.setTargetAtTime(tune(level), t, 0.04);
      pn?.pan.setTargetAtTime(curPan, t, 0.03);
    },
    stop() {
      if (!streams.delete(ctl)) return;
      const t = c.currentTime;
      g.gain.setTargetAtTime(0, t, 0.07);
      s.stop(t + 0.5);
    },
  };
  streams.add(ctl);
  return ctl;
}

/* ---------- マイクブラシ ---------- */
export function startBrush() {
  return noiseStream(
    [
      { type: "highpass", freq: 1500, q: 0.7 },
      { type: "bandpass", freq: 3200, q: 0.5 },
      { type: "lowpass", freq: 9000, q: 0.5 },
    ],
    0.5,
    1,
    (level) => 2500 + level * 3500,
  );
}
/** 向きを変えたときの「さっ」 */
export function playBrushTurn() {
  const c = getCtx();
  if (!c) return;
  hiss(c, c.currentTime, "bandpass", 3800, 0.6, 0.07, 0.18);
}

/* ---------- けずるブロック ---------- */
export type Material = "soap" | "sand" | "ice";
export function startScrape(m: Material) {
  if (m === "soap") {
    return noiseStream([{ type: "highpass", freq: 600, q: 0.7 }, { type: "bandpass", freq: 1800, q: 0.8 }], 0.45, 1, (l) => 1400 + l * 1600);
  }
  if (m === "sand") {
    return noiseStream([{ type: "highpass", freq: 250, q: 0.5 }, { type: "lowpass", freq: 2000, q: 0.5 }], 0.55, 1, (l) => 1200 + l * 900);
  }
  return noiseStream([{ type: "highpass", freq: 3000, q: 0.7 }, { type: "bandpass", freq: 6000, q: 0.7 }], 0.45, 1, (l) => 4500 + l * 3000);
}
/** 切りこみの一音。big は大きく崩れたとき */
export function playCut(m: Material, big: boolean) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  if (m === "soap") {
    hiss(c, t, "bandpass", 2200, 1, 0.07, big ? 0.45 : 0.3);
    tone(c, t, 180, 90, 0.08, 0.25);
  } else if (m === "sand") {
    hiss(c, t, "lowpass", 1400, 0.7, 0.1, big ? 0.5 : 0.35);
    tone(c, t, 110, 60, 0.1, 0.3);
  } else {
    hiss(c, t, "highpass", 4500, 0.8, 0.03, 0.4);
    tone(c, t, 2600 + Math.random() * 800, 900, 0.04, 0.25);
    hiss(c, t + 0.02, "highpass", 6500, 0.8, 0.025, 0.25);
    if (big) tone(c, t + 0.03, 3600, 1800, 0.06, 0.12);
  }
}

/* ---------- くしゃくしゃ ---------- */
export type Sheet = "paper" | "plastic" | "cellophane";
export function playCrinkle(m: Sheet, intensity: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const k = 0.4 + 0.6 * Math.min(1, intensity);
  if (m === "paper") {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) hiss(c, t + Math.random() * 0.07, "bandpass", 2200 + Math.random() * 2600, 0.8, 0.03, 0.25 * k);
  } else if (m === "plastic") {
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) hiss(c, t + Math.random() * 0.09, "highpass", 3500 + Math.random() * 3500, 0.7, 0.04, 0.2 * k);
  } else {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      hiss(c, t + Math.random() * 0.07, "highpass", 5000 + Math.random() * 4000, 0.8, 0.025, 0.2 * k);
      tone(c, t + Math.random() * 0.05, 3500 + Math.random() * 2000, 6000, 0.02, 0.06 * k);
    }
  }
}
/** のばしたときの「ぱりぱりぱり…」 */
export function playUnfold(m: Sheet) {
  for (let i = 0; i < 5; i++) setTimeout(() => playCrinkle(m, 0.8), i * 60);
}

/* ---------- カリカリお絵かき ---------- */
export type Pen = "pencil" | "crayon" | "marker";
export function startScratch(p: Pen) {
  if (p === "pencil") {
    return noiseStream([{ type: "highpass", freq: 2500, q: 0.7 }, { type: "bandpass", freq: 4200, q: 0.9 }], 0.4, 1, (l) => 3500 + l * 1800);
  }
  if (p === "crayon") {
    return noiseStream([{ type: "highpass", freq: 500, q: 0.6 }, { type: "bandpass", freq: 1500, q: 0.6 }], 0.55, 1, (l) => 1100 + l * 900);
  }
  return noiseStream([{ type: "highpass", freq: 3500, q: 0.6 }, { type: "bandpass", freq: 6500, q: 0.5 }], 0.22, 1, (l) => 5500 + l * 1500);
}

/* ---------- ふわふわ泡 ---------- */
export function startFoam() {
  return noiseStream([{ type: "highpass", freq: 4500, q: 0.5 }], 0.25, 0, (l) => 4000 + l * 3000);
}
/** 泡がひとつ消える、ごく小さな「ぷち」 */
export function playFoamPop() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  hiss(c, t, "highpass", 7000 + Math.random() * 2000, 0.8, 0.012, 0.12);
  tone(c, t, 2500 + Math.random() * 2000, 1500, 0.01, 0.05);
}

/* ---------- ウッドスープ ---------- */
/** 木のボールがぶつかる「コロッ」。idx（0〜7）でボールごとに音の高さが少し違う */
export function playWoodClick(intensity: number, idx: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const f = 450 + (idx % 8) * 70;
  const peak = 0.1 + 0.4 * Math.min(1, intensity);
  tone(c, t, f, f * 0.9, 0.05, peak);
  tone(c, t, f * 2.4, f * 2.2, 0.03, peak * 0.4);
  hiss(c, t, "bandpass", 1800, 1, 0.02, 0.05 + 0.15 * Math.min(1, intensity));
}
/** ボールが転がり続ける「ゴロゴロ」と、水のゆれる音 */
export function startRoll() {
  return noiseStream(
    [
      { type: "highpass", freq: 150, q: 0.5 },
      { type: "bandpass", freq: 700, q: 0.8 },
    ],
    0.35,
    1,
    (l) => 450 + l * 500,
  );
}

/* ---------- ジッパー・テープ ---------- */
/** ジッパーの歯がかみ合う小さな「カチカチ」を、count個ぶん続けて鳴らす */
export function playZipTicks(count: number, speed: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const n = Math.min(6, Math.max(1, count));
  const k = 0.5 + 0.5 * Math.min(1, speed);
  for (let i = 0; i < n; i++) {
    const f = 3200 + Math.random() * 1200;
    tone(c, t + i * 0.012, f, f * 0.8, 0.012, 0.18 * k);
    hiss(c, t + i * 0.012, "highpass", 5500, 0.8, 0.01, 0.15 * k);
  }
}
/** テープをはがしている間の「ビリビリ」 */
export function startTear() {
  return noiseStream(
    [
      { type: "highpass", freq: 1500, q: 0.7 },
      { type: "bandpass", freq: 3500, q: 1.2 },
    ],
    0.55,
    1,
    (l) => 2500 + l * 2500,
  );
}
/** のりがはがれる「ぺり」 */
export function playPeelTick() {
  const c = getCtx();
  if (!c) return;
  hiss(c, c.currentTime, "bandpass", 4500, 1, 0.015, 0.3);
}
/** テープが完全にはがれた */
export function playTapeOff() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  hiss(c, t, "highpass", 3000, 0.8, 0.12, 0.4);
  tone(c, t, 400, 150, 0.08, 0.2);
}

/* ---------- 本のページ ---------- */
/** speed: 0〜1。速くめくるほど大きい */
export function playPageTurn(speed: number) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const k = 0.5 + 0.5 * Math.min(1, Math.max(0, speed));
  hiss(c, t, "bandpass", 2500, 0.7, 0.18, 0.3 * k);
  hiss(c, t + 0.02, "highpass", 6000, 0.6, 0.12, 0.1 * k);
}
/** ページがぱさっと落ち着く */
export function playPageLand() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  hiss(c, t, "lowpass", 900, 0.7, 0.06, 0.25);
  tone(c, t, 120, 70, 0.06, 0.2);
}

/* ---------- ごほうび ---------- */
export function playLevelUp() {
  const c = getCtx();
  if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(c, c.currentTime + i * 0.09, f, f, 0.5, 0.22, "triangle");
  });
}

/** 金の泡：きらきら駆け上がる */
export function playGolden() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => {
    tone(c, t + i * 0.06, f, f, 0.6, 0.2, "triangle");
  });
  hiss(c, t, "highpass", 6000, 0.7, 0.5, 0.1);
}

/** ひみつ発見：ふしぎな上昇音 */
export function playSecret() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  [659.25, 783.99, 987.77, 1318.5, 1568].forEach((f, i) => {
    tone(c, t + i * 0.08, f, f, 0.7, 0.18);
    tone(c, t + i * 0.08, f * 2.76, f * 2.76, 0.3, 0.05);
  });
}
