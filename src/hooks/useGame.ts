"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COMBO_WINDOW_MS, unlocksAtLevel, xpGain, xpToNext, type Unlock } from "@/lib/game";
import { DEFAULT_SAVE, loadSave, writeSave, type SaveData } from "@/lib/storage";

export type LevelUpInfo = { level: number; unlocks: Unlock[] };
/** tap: 触った瞬間（コンボ+1） / hold: 押し続け・なぞり中（コンボ維持＋XP少し） */
export type TouchMode = "tap" | "hold";
export type TouchResult = { combo: number; level: number; leveledUp: boolean };

export function useGame() {
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [ready, setReady] = useState(false);
  const [combo, setCombo] = useState(0);
  const [levelUp, setLevelUp] = useState<LevelUpInfo | null>(null);

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

  useEffect(() => {
    if (!levelUp) return;
    const id = setTimeout(() => setLevelUp(null), 3200);
    return () => clearTimeout(id);
  }, [levelUp]);

  const touch = useCallback((mode: TouchMode = "tap"): TouchResult => {
    const nextCombo = mode === "tap" ? comboRef.current + 1 : comboRef.current;
    comboRef.current = nextCombo;
    setCombo(nextCombo);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, COMBO_WINDOW_MS);

    const prev = saveRef.current;
    let { xp, level } = prev;
    xp += mode === "tap" ? xpGain(nextCombo) : 1;
    const gained: Unlock[] = [];
    while (xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level += 1;
      gained.push(...unlocksAtLevel(level));
    }

    const next: SaveData = {
      ...prev,
      xp,
      level,
      totalPops: prev.totalPops + (mode === "tap" ? 1 : 0),
      bestCombo: Math.max(prev.bestCombo, nextCombo),
    };
    saveRef.current = next;
    setSave(next);
    writeSave(next);
    if (level > prev.level) setLevelUp({ level, unlocks: gained });

    return { combo: nextCombo, level, leveledUp: level > prev.level };
  }, []);

  return { save, ready, combo, levelUp, touch };
}
