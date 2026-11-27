"use client";

import Link from "next/link";
import { useCallback, useState, type ComponentType } from "react";
import BubbleStage from "@/components/BubbleStage";
import HUD from "@/components/HUD";
import JellyStage from "@/components/JellyStage";
import KeysStage from "@/components/KeysStage";
import MarbleStage from "@/components/MarbleStage";
import ObjectSwitcher from "@/components/ObjectSwitcher";
import PushPopStage from "@/components/PushPopStage";
import SandStage from "@/components/SandStage";
import SlimeStage from "@/components/SlimeStage";
import SqueezeStage from "@/components/SqueezeStage";
import type { StageProps } from "@/components/stage";
import WaterStage from "@/components/WaterStage";
import WrapStage from "@/components/WrapStage";
import { useGame, type TouchMode } from "@/hooks/useGame";
import { playLevelUp, playSecret } from "@/lib/audio";
import { asEffect, COMBO_WINDOW_MS, titleAt, xpToNext, type ObjectId } from "@/lib/game";

const STAGES: Record<ObjectId, ComponentType<StageProps>> = {
  bubble: BubbleStage,
  jelly: JellyStage,
  sand: SandStage,
  wrap: WrapStage,
  slime: SlimeStage,
  water: WaterStage,
  pushpop: PushPopStage,
  marble: MarbleStage,
  keys: KeysStage,
  squeeze: SqueezeStage,
};

const HINTS: Record<ObjectId, string> = {
  bubble: "タップして割る。たまに光る泡が出るかも",
  jelly: "長押しでつぶして、離すとぷるん",
  sand: "指でなぞると砂が流れる。出した量だけ経験値が入る",
  wrap: "なぞって、ぷちぷちを全部つぶす",
  slime: "つかんでひっぱる。離すとぷるんと戻る",
  water: "触れると波紋。なぞると連なる",
  pushpop: "押しこんでぽこっ。なぞると一気に押せる。もう一度で戻る",
  marble: "タップでビー玉を落とす",
  keys: "キーを打つ。PCなら実際のキーボードでも鳴る",
  squeeze: "長押しで握りこむ。ロウがパキパキ割れて、中身が出てくる",
};

export default function Home() {
  const { save, ready, combo, notice, touch, discover } = useGame();
  const [object, setObject] = useState<ObjectId>("bubble");

  const handleTouch = useCallback(
    (mode: TouchMode, amount?: number) => {
      const r = touch(mode, amount);
      if (r.leveledUp) setTimeout(playLevelUp, 120);
      else if (r.secret) setTimeout(playSecret, 120);
      return r;
    },
    [touch],
  );

  const handleDiscover = useCallback(
    (id: string) => {
      const r = discover(id);
      if (r) setTimeout(r.leveledUp ? playLevelUp : playSecret, 150);
    },
    [discover],
  );

  const Stage = STAGES[object];

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col">
      {combo >= 15 && <div className={combo >= 30 ? "zone-glow strong" : "zone-glow"} aria-hidden />}

      <HUD
        level={save.level}
        title={titleAt(save.level)}
        xp={save.xp}
        need={xpToNext(save.level)}
        combo={combo}
        windowMs={COMBO_WINDOW_MS}
      />

      {ready ? (
        <Stage
          key={object}
          onTouch={handleTouch}
          onDiscover={handleDiscover}
          effect={asEffect(save.effect)}
        />
      ) : (
        <div className="flex-1" />
      )}

      <p className="px-5 pb-2 text-center text-sm text-white/50">{HINTS[object]}</p>
      <ObjectSwitcher level={save.level} current={object} onSelect={setObject} />

      <footer className="relative flex items-center justify-between px-5 pb-5 pt-2 text-sm text-white/70">
        <p>{save.totalPops} 回さわった</p>
        <Link href="/collection" className="rounded-full bg-shade px-4 py-2 text-foam">
          コレクション
        </Link>

        {notice && (
          <div
            role="status"
            className="toast-in absolute inset-x-5 bottom-20 rounded-2xl bg-shade px-4 py-3 text-foam shadow-lg"
          >
            <p className="font-bold">{notice.title}</p>
            {notice.body && <p className="mt-1 text-sm text-film-cyan">{notice.body}</p>}
          </div>
        )}
      </footer>
    </main>
  );
}
