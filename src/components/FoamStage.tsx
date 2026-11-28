"use client";

import { useEffect, useRef } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import { rand } from "@/hooks/useParticles";
import { playFoamPop, startFoam, stopAllStreams, type AudioStream } from "@/lib/audio";
import type { StageProps } from "./stage";

const MAX = 520; // 泡の数
const BRUSH = 34; // 指で消える範囲(px)
const GROW_PER_SEC = 25; // 消した泡がまた生えてくる速さ

type Bubble = { x: number; y: number; r: number; h: number; age: number };
type Ring = { x: number; y: number; r: number; age: number };

export default function FoamStage({ onTouch, onDiscover }: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbles = useRef<Bubble[]>([]);
  const rings = useRef<Ring[]>([]);
  const wake = useRef<() => void>(() => {});
  const stream = useRef<AudioStream | null>(null);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastMove = useRef(0);
  const acc = useRef(0);
  const cleared = useRef(false);
  const discoverRef = useRef(onDiscover);

  useEffect(() => {
    discoverRef.current = onDiscover;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
    let last = 0;
    let growAcc = 0;
    let running = false;
    let raf = 0;

    const spawn = (age: number): Bubble => ({
      x: rand(0, w),
      y: rand(0, h),
      r: 6 + Math.pow(Math.random(), 1.6) * 16,
      h: rand(180, 330),
      age,
    });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (const b of bubbles.current) {
        const r = b.r * Math.min(1, b.age / 0.3); // 生えてくるときは、ふくらむ
        if (r <= 0) continue;
        ctx.fillStyle = `hsla(${b.h},70%,88%,0.20)`;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.beginPath();
        ctx.arc(b.x - r * 0.3, b.y - r * 0.3, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      // 消えた泡の輪
      for (const g of rings.current) {
        const k = g.age / 0.25;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r * (1 + k * 0.6), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bubbles.current = Array.from({ length: MAX }, () => spawn(1));
      bubbles.current.sort((a, b) => b.r - a.r); // 大きい泡から先に描く
      draw();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      for (const g of rings.current) g.age += dt;
      rings.current = rings.current.filter((g) => g.age < 0.25);

      growAcc += dt * GROW_PER_SEC;
      while (growAcc >= 1 && bubbles.current.length < MAX) {
        bubbles.current.push(spawn(0));
        growAcc -= 1;
      }
      if (bubbles.current.length >= MAX) growAcc = 0;

      let growing = false;
      for (const b of bubbles.current) {
        if (b.age < 0.3) {
          b.age += dt;
          growing = true;
        }
      }
      draw();
      if (rings.current.length > 0 || bubbles.current.length < MAX || growing) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };

    wake.current = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      stream.current?.stop();
      stopAllStreams();
    },
    [],
  );

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** 指の周りの泡を消す。消した数を返す */
  const popAt = (px: number, py: number): number => {
    const list = bubbles.current;
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      const lim = BRUSH + b.r * 0.2;
      if ((b.x - px) ** 2 + (b.y - py) ** 2 <= lim * lim) {
        rings.current.push({ x: b.x, y: b.y, r: b.r, age: 0 });
        list[i] = list[list.length - 1];
        list.pop();
        n++;
      }
    }
    return n;
  };

  /** 消したあとの共通処理：音、経験値、消しきったごほうび */
  const afterPop = (n: number) => {
    if (n <= 0) return;
    lastMove.current = performance.now();
    for (let i = 0; i < Math.min(n, 4); i++) playFoamPop();
    stream.current?.set(Math.min(1, n / 6));

    acc.current += n;
    const units = Math.floor(acc.current / 25); // 25個消すごとに経験値+1
    if (units > 0) {
      acc.current -= units * 25;
      onTouch("hold", units);
    }
    if (!cleared.current && bubbles.current.length < MAX * 0.1) {
      cleared.current = true;
      onTouch("hold", 6);
      discoverRef.current("foamclear");
    }
    if (bubbles.current.length >= MAX * 0.5) cleared.current = false;
    wake.current();
  };

  const end = () => {
    pointer.current = null;
    clearInterval(timer.current);
    stream.current?.stop();
    stream.current = null;
  };

  useOnHidden(end);

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="泡をなぞって消す"
      onPointerDown={(e) => {
        if (pointer.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        pointer.current = { ...p, id: e.pointerId };
        lastMove.current = performance.now();
        clearInterval(timer.current);
        stream.current?.stop();
        stream.current = startFoam();
        timer.current = setInterval(() => {
          if (performance.now() - lastMove.current > 150) stream.current?.set(0);
        }, 100);
        afterPop(popAt(p.x, p.y));
      }}
      onPointerMove={(e) => {
        const prev = pointer.current;
        if (!prev || e.pointerId !== prev.id) return;
        const p = local(e);
        const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
        const steps = Math.max(1, Math.ceil(dist / 14));
        let n = 0;
        for (let i = 1; i <= steps; i++) {
          n += popAt(prev.x + ((p.x - prev.x) * i) / steps, prev.y + ((p.y - prev.y) * i) / steps);
        }
        pointer.current = { ...p, id: prev.id };
        afterPop(n);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
