"use client";

import { useEffect, useRef } from "react";
import { rand, useParticles } from "@/hooks/useParticles";
import { playCrack } from "@/lib/audio";
import type { StageProps } from "./stage";

const STEPS = 12; // 握りこみを12段階に区切り、段階をまたぐたびに「パキッ」

export default function SqueezeStage({ onTouch, onDiscover, effect }: StageProps) {
  const { containerRef, canvasRef, sparkle } = useParticles(effect);
  const ballRef = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);
  const depth = useRef(0); // 0=自然な形 / 1=いっぱいに握った
  const vel = useRef(0);
  const lastStep = useRef(0);
  const wake = useRef<() => void>(() => {});
  const total = useRef(0);
  const wiggle = useRef(0);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const crackRef = useRef<(strong: boolean) => void>(() => {});

  const crack = (strong: boolean) => {
    playCrack(strong);
    const s = containerRef.current!.getBoundingClientRect();
    const b = ballRef.current!.getBoundingClientRect();
    sparkle(b.left - s.left + rand(0.2, 0.8) * b.width, b.top - s.top + rand(0.15, 0.85) * b.height, 2);
    total.current += 1;
    if (strong && total.current % 2 === 0) onTouch("hold", 1); // 2回に1回、経験値
    if (total.current >= 100) onDiscover("pakipaki");
  };

  useEffect(() => {
    crackRef.current = crack;
  });

  useEffect(() => {
    let last = 0;
    let running = false;
    let raf = 0;

    const apply = () => {
      const el = ballRef.current;
      if (el) el.style.transform = `scale(${1 + depth.current * 0.26}, ${1 - depth.current * 0.32})`;
    };

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.033);
      last = t;

      if (pressing.current) {
        depth.current = Math.min(1, depth.current + dt / 0.9); // 約0.9秒で握りきる
        vel.current = 0;
      } else {
        // 離すとバネで戻り、少しふくらんでから落ち着く
        const acc = -170 * depth.current - 11 * vel.current;
        vel.current += acc * dt;
        depth.current += vel.current * dt;
      }
      apply();

      const step = Math.max(0, Math.floor(depth.current * STEPS));
      if (step !== lastStep.current) {
        const diff = step - lastStep.current;
        const n = Math.min(3, Math.abs(diff));
        for (let i = 0; i < n; i++) crackRef.current(diff > 0); // 握る=強く、戻る=やさしく
        lastStep.current = step;
      }

      if (pressing.current || Math.abs(depth.current) > 0.003 || Math.abs(vel.current) > 0.02) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        depth.current = 0;
        lastStep.current = 0;
        apply();
      }
    };

    wake.current = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    return () => cancelAnimationFrame(raf);
  }, []);

  const press = (x: number, y: number) => {
    if (pressing.current) return;
    pressing.current = true;
    lastPos.current = { x, y };
    wiggle.current = 0;
    onTouch("tap");
    crack(true);
    wake.current();
  };

  const release = () => {
    if (!pressing.current) return;
    pressing.current = false;
    lastPos.current = null;
    wake.current();
  };

  return (
    <div ref={containerRef} className="relative flex-1 touch-none select-none overflow-hidden">
      <div className="absolute inset-0 grid place-items-center">
        <div
          ref={ballRef}
          role="button"
          tabIndex={0}
          aria-label="スクイーズを握る"
          className="squeeze"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            press(e.clientX, e.clientY);
          }}
          // 握ったまま動かすと、ひねった分だけパキッと鳴る
          onPointerMove={(e) => {
            const prev = lastPos.current;
            if (!pressing.current || !prev) return;
            wiggle.current += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
            lastPos.current = { x: e.clientX, y: e.clientY };
            if (wiggle.current >= 40) {
              wiggle.current -= 40;
              crack(true);
            }
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              press(0, 0);
            }
          }}
          onKeyUp={release}
        />
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
