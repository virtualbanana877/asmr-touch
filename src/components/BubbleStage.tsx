"use client";

import { useEffect, useRef, useState } from "react";
import { rand, useParticles } from "@/hooks/useParticles";
import { playGolden, playPop } from "@/lib/audio";
import { soundIdsAt } from "@/lib/game";
import type { StageProps } from "./stage";

type BubbleState = { id: number; x: number; y: number; size: number; golden: boolean };

const GOLDEN_RATE = 0.04; // 25個に1個くらい

const spawnBubble = (id: number): BubbleState => ({
  id,
  x: rand(24, 76), // % 単位
  y: rand(26, 72),
  size: rand(110, 170),
  golden: Math.random() < GOLDEN_RATE,
});

export default function BubbleStage({ onTouch, onDiscover, effect }: StageProps) {
  const { containerRef, canvasRef, burst } = useParticles(effect);
  const respawn = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [bubble, setBubble] = useState<BubbleState | null>(null);

  // 初期の泡はマウント後に生成（ランダム値によるhydration不一致を避ける）
  useEffect(() => {
    setBubble(spawnBubble(0));
    return () => clearTimeout(respawn.current);
  }, []);

  const popBubble = (el: HTMLElement) => {
    if (!bubble) return;
    const stage = containerRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - stage.left;
    const cy = r.top + r.height / 2 - stage.top;

    const res = onTouch("tap");
    if (bubble.golden) {
      onTouch("hold", 15); // 金の泡はXPボーナス
      playGolden();
      burst(cx, cy, res.combo + 25, bubble.size); // いつもより豪華に
      onDiscover("golden");
    } else {
      const ids = soundIdsAt(res.level);
      playPop(ids[Math.floor(Math.random() * ids.length)], res.combo);
      burst(cx, cy, res.combo, bubble.size);
    }

    const nextId = bubble.id + 1;
    setBubble(null);
    respawn.current = setTimeout(() => setBubble(spawnBubble(nextId)), 200);
  };

  return (
    <div ref={containerRef} className="relative flex-1 touch-none select-none overflow-hidden">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {bubble && (
        <button
          key={bubble.id}
          type="button"
          aria-label={bubble.golden ? "金色の泡を割る" : "泡を割る"}
          className={bubble.golden ? "bubble golden" : "bubble"}
          style={{
            width: bubble.size,
            height: bubble.size,
            left: `calc(${bubble.x}% - ${bubble.size / 2}px)`,
            top: `calc(${bubble.y}% - ${bubble.size / 2}px)`,
          }}
          // 反応速度のため pointerdown で割る。キーボード操作(click, detail=0)にも対応
          onPointerDown={(e) => {
            e.preventDefault();
            popBubble(e.currentTarget);
          }}
          onClick={(e) => {
            if (e.detail === 0) popBubble(e.currentTarget);
          }}
        />
      )}
    </div>
  );
}
