"use client";

import { useEffect, useRef } from "react";
import type { TouchMode, TouchResult } from "@/hooks/useGame";
import { rand } from "@/hooks/useParticles";
import { startSand, type SandStream } from "@/lib/audio";

const COL = 4; // 砂山の1列の幅(px)
const DRAIN = 6; // 砂が1秒に沈む量(px)。積もり続けないようにゆっくり消す
const MAX_GRAINS = 1500;

type Grain = { x: number; y: number; vx: number; vy: number };

export default function SandStage({ onTouch }: { onTouch: (mode: TouchMode) => TouchResult }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grains = useRef<Grain[]>([]);
  const wake = useRef<() => void>(() => {});
  const stream = useRef<SandStream | null>(null);
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastMove = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // 砂のシミュレーション（粒が落ちて、斜面を転がって、山になる）
  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
    let n = 0;
    let heights = new Float32Array(0);
    let last = 0;
    let running = false;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      n = Math.ceil(w / COL);
      heights = new Float32Array(n);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    // 粒が着地した列から、より低い隣へ転がして安定させる
    const settle = (col: number) => {
      let i = col;
      for (let g = 0; g < 60; g++) {
        const l = i > 0 ? heights[i - 1] : Infinity;
        const r = i < n - 1 ? heights[i + 1] : Infinity;
        if (heights[i] - Math.min(l, r) > 3) i = l <= r ? i - 1 : i + 1;
        else break;
      }
      heights[i] = Math.min(heights[i] + 1.6, h * 0.7);
    };

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const list = grains.current;

      for (let i = list.length - 1; i >= 0; i--) {
        const g = list[i];
        g.vy += 900 * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        const col = Math.min(n - 1, Math.max(0, Math.floor(g.x / COL)));
        if (g.y >= h - heights[col]) {
          list.splice(i, 1);
          settle(col);
        }
      }

      let total = 0;
      for (let i = 0; i < n; i++) {
        heights[i] = Math.max(0, heights[i] - DRAIN * dt);
        total += heights[i];
      }

      ctx.clearRect(0, 0, w, h);
      if (n > 0) {
        const grad = ctx.createLinearGradient(0, h - 140, 0, h);
        grad.addColorStop(0, "#f3dfae");
        grad.addColorStop(1, "#cfae6f");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < n; i++) ctx.lineTo(i * COL, h - heights[i]);
        ctx.lineTo(w, h - heights[n - 1]);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#f6e7bf";
      for (const g of list) ctx.fillRect(g.x, g.y, 2.2, 2.2);

      if (list.length > 0 || total > 0.5) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        heights.fill(0);
        ctx.clearRect(0, 0, w, h);
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

  // 画面を離れるとき音とタイマーを止める
  useEffect(
    () => () => {
      clearInterval(timer.current);
      stream.current?.stop();
    },
    [],
  );

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const addGrains = (x: number, y: number, count: number) => {
    const list = grains.current;
    for (let i = 0; i < count && list.length < MAX_GRAINS; i++) {
      list.push({ x: x + rand(-8, 8), y: y + rand(-4, 4), vx: rand(-30, 30), vy: rand(20, 120) });
    }
    wake.current();
  };

  const end = () => {
    if (!pointer.current) return;
    pointer.current = null;
    clearInterval(timer.current);
    stream.current?.stop();
    stream.current = null;
  };

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="砂をなぞって流す"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        const now = performance.now();
        pointer.current = { ...p, t: now };
        lastMove.current = now;
        stream.current = startSand();
        onTouch("tap");
        addGrains(p.x, p.y, 6);

        let ticks = 0;
        timer.current = setInterval(() => {
          ticks += 1;
          const idle = performance.now() - lastMove.current > 150;
          if (idle) stream.current?.set(0);
          else if (ticks % 3 === 0) onTouch("hold"); // なぞっている間だけXP
        }, 100);
      }}
      onPointerMove={(e) => {
        const prev = pointer.current;
        if (!prev) return;
        const p = local(e);
        const now = performance.now();
        const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (dist > 0) {
          const speed = (dist / Math.max(now - prev.t, 1)) * 1000;
          lastMove.current = now;
          addGrains(p.x, p.y, Math.min(10, 1 + Math.floor(dist / 5)));
          stream.current?.set(Math.min(speed / 1200, 1));
        }
        pointer.current = { ...p, t: now };
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
