"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import BubbleStage from "@/components/BubbleStage";
import HUD from "@/components/HUD";
import JellyStage from "@/components/JellyStage";
import ObjectSwitcher from "@/components/ObjectSwitcher";
import SandStage from "@/components/SandStage";
import { useGame, type TouchMode } from "@/hooks/useGame";
import { playLevelUp } from "@/lib/audio";
import { COMBO_WINDOW_MS, xpToNext, type ObjectId } from "@/lib/game";

const HINTS: Record<ObjectId, string> = {
  bubble: "タップして割る",
  jelly: "長押しでつぶして、離すとぷるん",
  sand: "指でなぞると砂が流れる",
};

export default function Home() {
  const { save, ready, combo, levelUp, touch } = useGame();
  const [object, setObject] = useState<ObjectId>("bubble");

  const handleTouch = useCallback(
    (mode: TouchMode) => {
      const r = touch(mode);
      if (r.leveledUp) setTimeout(playLevelUp, 120);
      return r;
    },
    [touch],
  );

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col">
      <HUD
        level={save.level}
        xp={save.xp}
        need={xpToNext(save.level)}
        combo={combo}
        windowMs={COMBO_WINDOW_MS}
      />

      {!ready && <div className="flex-1" />}
      {ready && object === "bubble" && <BubbleStage key="bubble" onTouch={handleTouch} />}
      {ready && object === "jelly" && <JellyStage key="jelly" onTouch={handleTouch} />}
      {ready && object === "sand" && <SandStage key="sand" onTouch={handleTouch} />}

      <p className="px-5 pb-2 text-center text-sm text-white/50">{HINTS[object]}</p>
      <ObjectSwitcher level={save.level} current={object} onSelect={setObject} />

      <footer className="relative flex items-center justify-between px-5 pb-5 pt-2 text-sm text-white/70">
        <p>{save.totalPops} 回さわった</p>
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
