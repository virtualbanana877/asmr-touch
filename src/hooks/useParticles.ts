"use client";

import { useCallback, useEffect, useRef } from "react";
import { PALETTE } from "@/lib/game";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  color: string;
  kind: "drop" | "ring" | "star";
};

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Canvasのパーティクル。粒子がある間だけアニメーションループを回す */
export function useParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const startLoop = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = containerRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
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
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ctx.clearRect(0, 0, w, h);
      const list = particles.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        const k = p.age / p.life;
        ctx.globalAlpha = 1 - k;
        if (p.kind === "ring") {
          const ease = 1 - (1 - k) ** 3;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1 + 3 * (1 - k);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.35 + 0.65 * ease), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === "drop") {
          p.vy += 380 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2);
          ctx.fill();
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const s = p.r * (1 - k * 0.4);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (list.length > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        ctx.clearRect(0, 0, w, h);
      }
    };

    startLoop.current = () => {
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

  /** 泡が割れる大きなエフェクト。コンボで豪華になる */
  const burst = useCallback((x: number, y: number, combo: number, size: number) => {
    const list = particles.current;
    const n = Math.min(12 + combo * 2, 56);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(90, 260) + Math.min(combo, 20) * 6;
      list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        r: rand(2.5, 6.5),
        age: 0,
        life: rand(0.5, 0.9),
        color: PALETTE[i % PALETTE.length],
        kind: "drop",
      });
    }
    list.push({ x, y, vx: 0, vy: 0, r: size * 0.75, age: 0, life: 0.45, color: PALETTE[0], kind: "ring" });
    if (combo >= 10) {
      list.push({ x, y, vx: 0, vy: 0, r: size * 1.2, age: 0, life: 0.65, color: PALETTE[1], kind: "ring" });
    }
    if (combo >= 20) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rand(-0.2, 0.2);
        const s = rand(120, 220);
        list.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: rand(6, 11),
          age: 0,
          life: rand(0.5, 0.8),
          color: PALETTE[3],
          kind: "star",
        });
      }
    }
    if (list.length > 400) list.splice(0, list.length - 400);
    startLoop.current();
  }, []);

  /** ゼリー用の小さなしずく */
  const sparkle = useCallback((x: number, y: number, count: number) => {
    const list = particles.current;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 150);
      list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        r: rand(2, 5),
        age: 0,
        life: rand(0.5, 0.8),
        color: PALETTE[i % PALETTE.length],
        kind: "drop",
      });
    }
    if (list.length > 400) list.splice(0, list.length - 400);
    startLoop.current();
  }, []);

  return { containerRef, canvasRef, burst, sparkle };
}
