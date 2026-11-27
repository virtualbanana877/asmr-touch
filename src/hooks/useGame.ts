"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMBO_WINDOW_MS,
  SECRETS,
  SECRET_XP,
  unlocksAtLevel,
  xpGain,
  xpToNext,
  type Unlock,
} from "@/lib/game";
import { DEFAULT_SAVE, loadSave, writeSave, type SaveData } from "@/lib/storage";

export type Notice = { title: string; body?: string };
/** tap: 触った瞬間（コンボ+1） / hold: 押し続け・なぞり・ボーナス（コンボ維持＋XP） */
export type TouchMode = "tap" | "hold";
export type TouchResult = { combo: number; level: number; leveledUp: boolean; secret: boolean };

function addXp(s: SaveData, amount: number) {
  let { xp, level } = s;
  xp += amount;
  const gained: Unlock[] = [];
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    gained.push(...unlocksAtLevel(level));
  }
  return { next: { ...s, xp, level }, gained };
}

const secretName = (id: string) => SECRETS.find((s) => s.id === id)?.name ?? id;

function makeNotice(levelUp: number | null, gained: Unlock[], secrets: string[]): Notice | null {
  const parts: string[] = [];
  if (gained.length) parts.push(`解放: ${gained.map((u) => u.name).join("、")}`);
  if (secrets.length) parts.push(`ひみつ: ${secrets.map(secretName).join("、")}`);
  if (levelUp !== null) return { title: `Lv.${levelUp} になった`, body: parts.join(" ／ ") || undefined };
  if (secrets.length) return { title: "ひみつを見つけた", body: secrets.map(secretName).join("、") };
  return null;
}

export function useGame() {
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [ready, setReady] = useState(false);
  const [combo, setCombo] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);

  const saveRef = useRef<SaveData>(DEFAULT_SAVE);
  const comboRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // localStorageはマウント後に読む（SSRとのhydration不一致を避ける）
  useEffect(() => {
    const s = loadSave();
    saveRef.current = s;
    setSave(s);
    setReady(true);
    return () => clearTimeout(timer.current);
  }, []);

  // テーマはhtml要素の属性で切り替える
  useEffect(() => {
    document.documentElement.dataset.theme = save.theme;
  }, [save.theme]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3400);
    return () => clearTimeout(id);
  }, [notice]);

  const commit = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  const touch = useCallback(
    (mode: TouchMode = "tap", amount = 1): TouchResult => {
      const nextCombo = mode === "tap" ? comboRef.current + 1 : comboRef.current;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        comboRef.current = 0;
        setCombo(0);
      }, COMBO_WINDOW_MS);

      const prev = saveRef.current;
      const newly: string[] = [];
      if (nextCombo >= 30) newly.push("zone");
      if (new Date().getHours() < 5) newly.push("owl");
      const fresh = newly.filter((id) => !prev.found.includes(id));

      const base = mode === "tap" ? xpGain(nextCombo) : amount;
      const { next: leveled, gained } = addXp(prev, base + fresh.length * SECRET_XP);
      const next: SaveData = {
        ...leveled,
        found: [...prev.found, ...fresh],
        totalPops: prev.totalPops + (mode === "tap" ? 1 : 0),
        bestCombo: Math.max(prev.bestCombo, nextCombo),
      };
      commit(next);

      const leveledUp = next.level > prev.level;
      const n = makeNotice(leveledUp ? next.level : null, gained, fresh);
      if (n) setNotice(n);
      return { combo: nextCombo, level: next.level, leveledUp, secret: fresh.length > 0 };
    },
    [commit],
  );

  /** 画面側で見つけたひみつ（金の泡、シート完走など）。初回だけXPボーナス */
  const discover = useCallback(
    (id: string): { leveledUp: boolean } | null => {
      const prev = saveRef.current;
      if (prev.found.includes(id) || !SECRETS.some((s) => s.id === id)) return null;
      const { next: leveled, gained } = addXp(prev, SECRET_XP);
      const next: SaveData = { ...leveled, found: [...prev.found, id] };
      commit(next);
      const leveledUp = next.level > prev.level;
      const n = makeNotice(leveledUp ? next.level : null, gained, [id]);
      if (n) setNotice(n);
      return { leveledUp };
    },
    [commit],
  );

  const select = useCallback(
    (kind: "theme" | "effect", id: string) => {
      const s = saveRef.current;
      commit(kind === "theme" ? { ...s, theme: id } : { ...s, effect: id });
    },
    [commit],
  );

  return { save, ready, combo, notice, touch, discover, select };
}
