export const COMBO_WINDOW_MS = 1500;

export const PALETTE = ["#f4b6d2", "#8fe3e0", "#b9a7f5", "#ffe9a8"] as const;

export type ObjectId = "bubble" | "jelly" | "sand" | "wrap" | "slime" | "water" | "pushpop" | "marble" | "keys" | "squeeze";
export type SoundId =
  | "soft" | "deep" | "glass" | "drop" | "pluck" | "crackle" | "chime" | "wood" | "sparkle" | "harp";
export type ThemeId = "night" | "dawn" | "forest" | "aurora" | "sakura" | "galaxy";
export type EffectId = "droplet" | "star" | "petal" | "heart";
export type Kind = "object" | "sound" | "theme" | "effect" | "title";

export type Unlock = {
  id: string;
  kind: Kind;
  name: string;
  desc: string;
  level: number; // このレベルで解放
};

export const KIND_LABEL: Record<Kind, string> = {
  object: "さわるもの",
  sound: "音",
  theme: "テーマ",
  effect: "エフェクト",
  title: "称号",
};
export const KIND_ORDER: Kind[] = ["object", "sound", "theme", "effect", "title"];

export const UNLOCKS: Unlock[] = [
  { id: "bubble", kind: "object", name: "しゃぼん玉", desc: "薄い膜がぷちっと割れる", level: 1 },
  { id: "soft", kind: "sound", name: "ぷちっ", desc: "軽くて乾いた破裂音", level: 1 },
  { id: "night", kind: "theme", name: "夜の水", desc: "静かな深い青", level: 1 },
  { id: "droplet", kind: "effect", name: "しずく", desc: "丸い水しぶき", level: 1 },
  { id: "t1", kind: "title", name: "はじめの一粒", desc: "最初の称号", level: 1 },

  { id: "deep", kind: "sound", name: "ぽこん", desc: "丸くて低い、水っぽい音", level: 2 },
  { id: "jelly", kind: "object", name: "ゼリー", desc: "長押しでつぶして、離すとぷるん", level: 3 },
  { id: "glass", kind: "sound", name: "きらん", desc: "ガラスのような高い余韻", level: 4 },
  { id: "dawn", kind: "theme", name: "あけぼの", desc: "明け方の紫", level: 4 },
  { id: "sand", kind: "object", name: "さらさら砂", desc: "指でなぞると流れる砂", level: 5 },
  { id: "t5", kind: "title", name: "泡つぶし", desc: "泡を割るのが日課", level: 5 },

  { id: "drop", kind: "sound", name: "ぽちゃん", desc: "水滴が落ちるような丸い音", level: 6 },
  { id: "star", kind: "effect", name: "ほしくず", desc: "きらめく星のかけら", level: 6 },
  { id: "wrap", kind: "object", name: "ぷちぷちシート", desc: "なぞって、全部つぶす", level: 7 },
  { id: "slime", kind: "object", name: "スライム", desc: "ひっぱって、のばして、ぬちゃっ", level: 8 },
  { id: "pluck", kind: "sound", name: "ぽろん", desc: "木の鍵盤を弾いたような音", level: 8 },
  { id: "forest", kind: "theme", name: "もりの底", desc: "苔むした深い緑", level: 8 },
  { id: "crackle", kind: "sound", name: "ぱちぱち", desc: "細かく弾ける小さな音", level: 9 },
  { id: "t9", kind: "title", name: "ぷちぷち職人", desc: "指先が覚えている", level: 9 },

  { id: "water", kind: "object", name: "みずたまり", desc: "触れると波紋が広がる", level: 10 },
  { id: "chime", kind: "sound", name: "ちりん", desc: "風鈴のような澄んだ余韻", level: 11 },
  { id: "petal", kind: "effect", name: "はなびら", desc: "ひらひら舞う花びら", level: 11 },
  { id: "aurora", kind: "theme", name: "オーロラ", desc: "ゆっくり色が流れる空", level: 12 },
  { id: "pushpop", kind: "object", name: "プッシュポップ", desc: "押しこんで、ぽこっ。なぞって一気に押せる", level: 12 },
  { id: "marble", kind: "object", name: "ビー玉", desc: "落として転がす", level: 13 },
  { id: "wood", kind: "sound", name: "コトッ", desc: "木をたたく温かい音", level: 14 },
  { id: "t15", kind: "title", name: "ASMRの住人", desc: "ここが居場所", level: 15 },

  { id: "keys", kind: "object", name: "かちかちキー", desc: "打鍵感の違う4種類のキー", level: 16 },
  { id: "squeeze", kind: "object", name: "パキパキスクイーズ", desc: "ぎゅっと握ると、パキパキ鳴る", level: 18 },
  { id: "sparkle", kind: "sound", name: "しゃらん", desc: "きらきら駆け上がる音", level: 17 },
  { id: "heart", kind: "effect", name: "ハート", desc: "ふわっと広がるハート", level: 17 },
  { id: "sakura", kind: "theme", name: "さくら夜", desc: "夜桜のような紅", level: 18 },
  { id: "harp", kind: "sound", name: "ぽろろん", desc: "ハープのような駆け上がり", level: 20 },
  { id: "t20", kind: "title", name: "いやしの達人", desc: "まわりまで静かになる", level: 20 },
  { id: "galaxy", kind: "theme", name: "ほしぞら", desc: "星が瞬く夜空", level: 22 },
  { id: "t24", kind: "title", name: "ぷちぷちの神さま", desc: "すべてを触りつくした", level: 24 },
];

/** ひみつ：条件を満たすと見つかる。見つけるとXPボーナス */
export type Secret = { id: string; name: string; hint: string; note: string };
export const SECRETS: Secret[] = [
  { id: "golden", name: "きんのしゃぼん", hint: "めったに現れない、光るもの", note: "ごくまれに現れる金色の泡を割った。" },
  { id: "zone", name: "ゾーン", hint: "途切れない指先", note: "コンボ30に到達した。" },
  { id: "wrap", name: "ひとシート完走", hint: "ぷちぷちを残さず全部", note: "ぷちぷちシートを全部つぶした。" },
  { id: "stretch", name: "のびのびゼリー", hint: "ゼリーを、じっくり長く", note: "ゼリーを5秒以上押し続けた。" },
  { id: "dune", name: "小さな砂丘", hint: "砂を高く高く", note: "砂をたっぷり出して山を築いた。" },
  { id: "owl", name: "よふかし", hint: "みんなが寝静まるころ", note: "深夜0時〜5時にさわった。" },
  { id: "marbles", name: "ビー玉あふれる", hint: "ビー玉をたくさん", note: "ビー玉を20個ためた。" },
  { id: "typist", name: "いい打鍵感", hint: "キーを打ちまくる", note: "キーを50回打った。" },
  { id: "longslime", name: "のびーるスライム", hint: "どこまで伸びるか試したくなる", note: "スライムを思いきり長くのばした。" },
  { id: "pakipaki", name: "パキパキ職人", hint: "握る音を聴き込む", note: "パキパキを100回鳴らした。" },
  { id: "flip", name: "ひっくり返し", hint: "全部押しこんだら、どうなる？", note: "プッシュポップを全部押しこんだ。" },
];
export const SECRET_XP = 20;

export const THEME_SWATCH: Record<ThemeId, string> = {
  night: "linear-gradient(135deg,#1f4663,#10243a)",
  dawn: "linear-gradient(135deg,#6b3f6e,#2a1c3a)",
  forest: "linear-gradient(135deg,#1f5c46,#0f2a22)",
  aurora: "linear-gradient(135deg,#1b6a6f,#2a2a6a)",
  sakura: "linear-gradient(135deg,#8a4a6f,#2b1a28)",
  galaxy: "linear-gradient(135deg,#2a2a7a,#07081c)",
};

export type Shape = "circle" | "star" | "petal" | "heart";
export const EFFECT_STYLE: Record<EffectId, { shape: Shape; colors: readonly string[]; sample: string }> = {
  droplet: { shape: "circle", colors: PALETTE, sample: "●" },
  star: { shape: "star", colors: ["#ffe9a8", "#fff6d0", "#8fe3e0"], sample: "✦" },
  petal: { shape: "petal", colors: ["#f9c6dc", "#ffd9e8", "#f4b6d2"], sample: "✿" },
  heart: { shape: "heart", colors: ["#ff8fb1", "#f4b6d2", "#ffb3c7"], sample: "♥" },
};

export const asEffect = (s: string): EffectId => (s in EFFECT_STYLE ? (s as EffectId) : "droplet");

/** Lv.level → level+1 に必要なXP（上限あり） */
export const xpToNext = (level: number) => Math.min(40 + (level - 1) * 15, 260);

/** 1タップで得るXP。コンボ5ごとに+1（微増） */
export const xpGain = (combo: number) => 2 + Math.floor(combo / 5);

export const unlocksAtLevel = (level: number) => UNLOCKS.filter((u) => u.level === level);

export const soundIdsAt = (level: number): SoundId[] =>
  UNLOCKS.filter((u) => u.kind === "sound" && u.level <= level).map((u) => u.id as SoundId);

export const titleAt = (level: number) =>
  UNLOCKS.filter((u) => u.kind === "title" && u.level <= level).at(-1)?.name ?? "";
