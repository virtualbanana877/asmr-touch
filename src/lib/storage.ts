export type SaveData = {
  version: 1;
  xp: number;
  level: number;
  totalPops: number;
  bestCombo: number;
  theme: string;
  effect: string;
  found: string[]; // 見つけたひみつのID
};

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  xp: 0,
  level: 1,
  totalPops: 0,
  bestCombo: 0,
  theme: "night",
  effect: "droplet",
  found: [],
};

const KEY = "asmr-touch:save";

const num = (v: unknown, fallback: number, min: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min ? Math.floor(v) : fallback;
const str = (v: unknown, fallback: string) => (typeof v === "string" && v.length < 40 ? v : fallback);

export function loadSave(): SaveData {
  if (typeof window === "undefined") return DEFAULT_SAVE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SAVE;
    const p = JSON.parse(raw) as Partial<SaveData>;
    return {
      version: 1,
      xp: num(p.xp, 0, 0),
      level: num(p.level, 1, 1),
      totalPops: num(p.totalPops, 0, 0),
      bestCombo: num(p.bestCombo, 0, 0),
      theme: str(p.theme, "night"),
      effect: str(p.effect, "droplet"),
      found: Array.isArray(p.found) ? p.found.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function writeSave(data: SaveData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 容量超過・プライベートモードなどは無視
  }
}
