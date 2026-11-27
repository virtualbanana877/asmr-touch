export const COMBO_WINDOW_MS = 1500;

export const PALETTE = ["#f4b6d2", "#8fe3e0", "#b9a7f5", "#ffe9a8"] as const;

export type ObjectId = "bubble" | "jelly" | "sand";
export type SoundId = "soft" | "deep" | "glass" | "drop" | "pluck" | "crackle" | "chime";

export type Unlock = {
  id: string;
  kind: "object" | "sound";
  name: string;
  desc: string;
  level: number; // このレベルで解放
};

export const UNLOCKS: Unlock[] = [
  { id: "bubble", kind: "object", name: "しゃぼん玉", desc: "薄い膜がぷちっと割れる", level: 1 },
  { id: "soft", kind: "sound", name: "ぷちっ", desc: "軽くて乾いた破裂音", level: 1 },
  { id: "deep", kind: "sound", name: "ぽこん", desc: "丸くて低い、水っぽい音", level: 2 },
  { id: "jelly", kind: "object", name: "ゼリー", desc: "長押しでつぶして、離すとぷるん", level: 3 },
  { id: "glass", kind: "sound", name: "きらん", desc: "ガラスのような高い余韻", level: 4 },
  { id: "sand", kind: "object", name: "さらさら砂", desc: "指でなぞると流れる砂", level: 5 },
  { id: "drop", kind: "sound", name: "ぽちゃん", desc: "水滴が落ちるような丸い音", level: 6 },
  { id: "pluck", kind: "sound", name: "ぽろん", desc: "木の鍵盤を弾いたような音", level: 7 },
  { id: "crackle", kind: "sound", name: "ぱちぱち", desc: "細かく弾ける小さな音", level: 8 },
  { id: "chime", kind: "sound", name: "ちりん", desc: "風鈴のような澄んだ余韻", level: 9 },
];

/** Lv.level → level+1 に必要なXP */
export const xpToNext = (level: number) => 40 + (level - 1) * 25;

/** 1タップで得るXP。コンボ5ごとに+1（微増） */
export const xpGain = (combo: number) => 2 + Math.floor(combo / 5);

export const unlocksAtLevel = (level: number) => UNLOCKS.filter((u) => u.level === level);

export const soundIdsAt = (level: number): SoundId[] =>
  UNLOCKS.filter((u) => u.kind === "sound" && u.level <= level).map((u) => u.id as SoundId);
