"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParticles } from "@/hooks/useParticles";
import { playGolden, playPush } from "@/lib/audio";
import type { StageProps } from "./stage";

const COLS = 5;
const ROWS = 6;
const N = COLS * ROWS;
const ROW_COLORS = ["#f4b6d2", "#ffd0a8", "#ffe9a8", "#b8e6b0", "#8fe3e0", "#b9a7f5"];

export default function PushPopStage({ onTouch, onDiscover, effect }: StageProps) {
  const { containerRef, canvasRef, burst, sparkle } = useParticles(effect);
  const state = useRef<boolean[]>(Array(N).fill(false));
  const [pressed, setPressed] = useState<boolean[]>(() => Array(N).fill(false));
  const paint = useRef<boolean | null>(null); // なぞっている間、全部この状態にそろえる
  const locked = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const setCell = (i: number, el: Element, value: boolean) => {
    if (locked.current || state.current[i] === value) return;
    state.current[i] = value;
    onTouch("tap");
    playPush(i % COLS, value);

    const s = containerRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (value) sparkle(r.left + r.width / 2 - s.left, r.top + r.height / 2 - s.top, 3);

    const next = [...state.current];
    setPressed(next);

    // 全部押しこんだらごほうび。ひっくり返して全部もとに戻す
    if (next.every(Boolean)) {
      locked.current = true;
      onDiscover("flip");
      onTouch("hold", 12);
      playGolden();
      burst(s.width / 2, s.height / 2, 25, 220);
      resetTimer.current = setTimeout(() => {
        state.current = Array(N).fill(false);
        setPressed(Array(N).fill(false));
        for (let c = 0; c < COLS; c++) setTimeout(() => playPush(c, false), c * 50);
        locked.current = false;
      }, 900);
    }
  };

  const hit = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell]");
    if (!el) return;
    const i = Number(el.getAttribute("data-cell"));
    if (!Number.isInteger(i)) return;
    // 最初に触れたセルの反対の状態を、なぞった先すべてに適用する
    if (paint.current === null) paint.current = !state.current[i];
    setCell(i, el, paint.current);
  };

  return (
    <div
      ref={containerRef}
      className="relative grid flex-1 touch-none select-none place-items-center overflow-hidden px-5"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        paint.current = null;
        hit(e);
      }}
      onPointerMove={(e) => {
        if (paint.current !== null) hit(e);
      }}
      onPointerUp={() => {
        paint.current = null;
      }}
      onPointerCancel={() => {
        paint.current = null;
      }}
    >
      <div className="w-full max-w-[340px] rounded-[2rem] bg-shade/70 p-4 shadow-lg">
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {pressed.map((p, i) => (
            <div
              key={i}
              data-cell={i}
              data-in={p}
              className="pop-cell"
              style={{ "--c": ROW_COLORS[Math.floor(i / COLS)] } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
