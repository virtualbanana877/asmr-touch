"use client";

import Link from "next/link";
import { useCallback } from "react";
import BubbleStage from "@/components/BubbleStage";
import HUD from "@/components/HUD";
import { useGame } from "@/hooks/useGame";
import { playLevelUp, playPop } from "@/lib/audio";
import { COMBO_WINDOW_MS, soundIdsAt, xpToNext } from "@/lib/game";

export default function Home() {
  const { save, ready, combo, levelUp, pop } = useGame();

  const handlePop = useCallback(() => {
    const r = pop();
    const ids = soundIdsAt(r.level);
    playPop(ids[Math.floor(Math.random() * ids.length)], r.combo);
    if (r.leveledUp) setTimeout(playLevelUp, 120);
    return r.combo;
  }, [pop]);

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col">
      <HUD
        level={save.level}
        xp={save.xp}
        need={xpToNext(save.level)}
        combo={combo}
        windowMs={COMBO_WINDOW_MS}
      />

      {ready ? <BubbleStage onPop={handlePop} /> : <div className="flex-1" />}

      <footer className="relative flex items-center justify-between px-5 pb-5 pt-3 text-sm text-white/70">
        <p>{save.totalPops} 回割った</p>
        <Link href="/collection" className="rounded-full bg-shade px-4 py-2 text-foam">
          コレクション
        </Link>

        {levelUp && (
          <div
            role="status"
            className="toast-in absolute inset-x-5 bottom-20 rounded-2xl bg-shade px-4 py-3 text-foam shadow-lg"
          >
            <p className="font-bold">Lv.{levelUp.level} になった</p>
            {levelUp.unlocks.length > 0 && (
              <p className="mt-1 text-sm text-film-cyan">
                解放: {levelUp.unlocks.map((u) => u.name).join("、")}
              </p>
            )}
          </div>
        )}
      </footer>
    </main>
  );
}
