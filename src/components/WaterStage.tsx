"use client";

import { useRef } from "react";
import { useParticles } from "@/hooks/useParticles";
import { playRipple } from "@/lib/audio";
import { PALETTE } from "@/lib/game";
import type { StageProps } from "./stage";

export default function WaterStage({ onTouch, effect }: StageProps) {
  const { containerRef, canvasRef, ripple, sparkle } = useParticles(effect);
  const pressing = useRef(false);
  const last = useRef({ x: 0, y: 0, t: 0, n: 0 });

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };

  const drop = (p: { x: number; y: number; w: number }, strong: boolean) => {
    ripple(p.x, p.y, strong ? 130 : 80, PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    playRipple(p.x / p.w, strong);
    if (strong) sparkle(p.x, p.y, 3);
  };

  return (
    <div
      ref={containerRef}
      className="water-surface relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="水面に触れて波紋をつくる"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pressing.current = true;
        const p = local(e);
        last.current = { x: p.x, y: p.y, t: performance.now(), n: 0 };
        onTouch("tap");
        drop(p, true);
      }}
      onPointerMove={(e) => {
        if (!pressing.current) return;
        const p = local(e);
        const now = performance.now();
        const l = last.current;
        if (now - l.t < 130 || Math.hypot(p.x - l.x, p.y - l.y) < 12) return;
        last.current = { x: p.x, y: p.y, t: now, n: l.n + 1 };
        if (last.current.n % 2 === 0) onTouch("hold", 1);
        drop(p, false);
      }}
      onPointerUp={() => {
        pressing.current = false;
      }}
      onPointerCancel={() => {
        pressing.current = false;
      }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
