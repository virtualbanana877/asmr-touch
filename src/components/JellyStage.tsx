"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParticles } from "@/hooks/useParticles";
import type { TouchMode, TouchResult } from "@/hooks/useGame";
import { playBoing, playJellyBubble, playSquish } from "@/lib/audio";

type Phase = "idle" | "pressed" | "release";
const HOLD_TICK_MS = 350;

export default function JellyStage({ onTouch }: { onTouch: (mode: TouchMode) => TouchResult }) {
  const { containerRef, canvasRef, sparkle } = useParticles();
  const jellyRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [tilt, setTilt] = useState(0);
  const pressing = useRef(false);
  const pressedAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearInterval(holdTimer.current);
      clearTimeout(releaseTimer.current);
    },
    [],
  );

  const center = () => {
    const s = containerRef.current!.getBoundingClientRect();
    const j = jellyRef.current!.getBoundingClientRect();
    return { x: j.left + j.width / 2 - s.left, y: j.top + j.height / 2 - s.top };
  };

  const press = (tiltValue: number) => {
    if (pressing.current) return;
    pressing.current = true;
    pressedAt.current = performance.now();
    clearTimeout(releaseTimer.current);
    setTilt(tiltValue);
    setPhase("pressed");

    const res = onTouch("tap");
    playSquish(res.combo);

    holdTimer.current = setInterval(() => {
      const h = onTouch("hold");
      playJellyBubble(h.combo);
      const c = center();
      sparkle(c.x, c.y - 50, 2);
    }, HOLD_TICK_MS);
  };

  const release = () => {
    if (!pressing.current) return;
    pressing.current = false;
    clearInterval(holdTimer.current);
    const held = Math.min((performance.now() - pressedAt.current) / 1000, 2);
    setPhase("release");
    playBoing(held);
    const c = center();
    sparkle(c.x, c.y, 6 + Math.floor(held * 8));
    releaseTimer.current = setTimeout(() => setPhase("idle"), 750);
  };

  return (
    <div ref={containerRef} className="relative flex-1 touch-none select-none overflow-hidden">
      <div className="absolute inset-0 grid place-items-center">
        <div
          ref={jellyRef}
          role="button"
          tabIndex={0}
          aria-label="ゼリーを押す"
          className="jelly"
          data-phase={phase}
          style={{ "--tilt": tilt } as CSSProperties}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            press((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              press(0);
            }
          }}
          onKeyUp={release}
        />
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
