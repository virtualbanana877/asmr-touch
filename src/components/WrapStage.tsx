"use client";

import { useEffect, useRef, useState } from "react";
import { useParticles } from "@/hooks/useParticles";
import { playGolden, playWrap } from "@/lib/audio";
import type { StageProps } from "./stage";

const COLS = 5;
const ROWS = 7;
const N = COLS * ROWS;

export default function WrapStage({ onTouch, onDiscover, effect }: StageProps) {
  const { containerRef, canvasRef, burst, sparkle } = useParticles(effect);
  const done = useRef<boolean[]>(Array(N).fill(false));
  const [popped, setPopped] = useState<boolean[]>(() => Array(N).fill(false));
  const pressing = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const pop = (i: number, el: Element) => {
    if (done.current[i]) return;
    done.current[i] = true;
    const res = onTouch("tap");
    playWrap(res.combo);

    const s = containerRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    sparkle(r.left + r.width / 2 - s.left, r.top + r.height / 2 - s.top, 5);

    const next = [...done.current];
    setPopped(next);

    // 全部つぶしたらごほうび。新しいシートに交換
    if (next.every(Boolean)) {
      onDiscover("wrap");
      onTouch("hold", 12);
      playGolden();
      burst(s.width / 2, s.height / 2, 25, 220);
      resetTimer.current = setTimeout(() => {
        done.current = Array(N).fill(false);
        setPopped(Array(N).fill(false));
      }, 900);
    }
  };

  const hit = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell]");
    if (!el) return;
    const i = Number(el.getAttribute("data-cell"));
    if (Number.isInteger(i)) pop(i, el);
  };

  return (
    <div
      ref={containerRef}
      className="relative grid flex-1 touch-none select-none place-items-center overflow-hidden px-5"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pressing.current = true;
        hit(e);
      }}
      onPointerMove={(e) => {
        if (pressing.current) hit(e);
      }}
      onPointerUp={() => {
        pressing.current = false;
      }}
      onPointerCancel={() => {
        pressing.current = false;
      }}
    >
      <div
        className="grid w-full max-w-[320px] gap-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {popped.map((p, i) => (
          <div key={i} data-cell={i} data-popped={p} className="wrap-cell" />
        ))}
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
