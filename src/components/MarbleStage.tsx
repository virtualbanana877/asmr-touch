"use client";

import { useEffect, useRef } from "react";
import { rand } from "@/hooks/useParticles";
import { playClack, setPan } from "@/lib/audio";
import { PALETTE } from "@/lib/game";
import type { StageProps } from "./stage";

type Marble = { x: number; y: number; vx: number; vy: number; r: number; color: string; idx: number };

const GRAV = 1500;
const BOUNCE = 0.6;
const MAX = 24;
const COLORS = [...PALETTE, "#ffffff"];

export default function MarbleStage({ onTouch, onDiscover }: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const marbles = useRef<Marble[]>([]);
  const wake = useRef<() => void>(() => {});
  const pressing = useRef(false);
  const lastSpawn = useRef(0);
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
    let calm = 0;
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
      const dt = Math.min((t - last) / 1000, 0.033);
      last = t;
      const list = marbles.current;

      let sounds = 0;
      const click = (intensity: number, idx: number, x: number) => {
        if (sounds < 4 && intensity > 0.08) {
          sounds++;
          setPan((x / Math.max(w, 1)) * 1.7 - 0.85); // ビー玉の位置から聞こえる
          playClack(Math.min(1, intensity), idx);
        }
      };

      for (const m of list) {
        m.vy += GRAV * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
      }

      for (let it = 0; it < 2; it++) {
        // ビー玉どうしの衝突
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const min = a.r + b.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const push = (min - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (approach > 0) {
              const imp = ((1 + BOUNCE) * approach) / 2;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              b.vx += imp * nx;
              b.vy += imp * ny;
              if (it === 0) click(approach / 900, a.idx, a.x);
            }
          }
        }
        // 床と壁
        for (const m of list) {
          if (m.y + m.r > h) {
            m.y = h - m.r;
            if (m.vy > 0) {
              click(m.vy / 1000, m.idx, m.x);
              m.vy = m.vy > 50 ? -m.vy * BOUNCE : 0;
            }
            m.vx *= 1 - Math.min(1, 3 * dt);
          }
          if (m.x - m.r < 0) {
            m.x = m.r;
            if (m.vx < 0) m.vx = -m.vx * BOUNCE;
          }
          if (m.x + m.r > w) {
            m.x = w - m.r;
            if (m.vx > 0) m.vx = -m.vx * BOUNCE;
          }
        }
      }

      // 描画
      ctx.clearRect(0, 0, w, h);
      let speed = 0;
      for (const m of list) {
        speed = Math.max(speed, Math.hypot(m.vx, m.vy));
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(m.x - m.r * 0.35, m.y - m.r * 0.35, 1, m.x - m.r * 0.2, m.y - m.r * 0.2, m.r);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(0.5, "rgba(255,255,255,0.15)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 全部落ち着いたらループを止める
      calm = speed < 40 ? calm + dt : 0;
      if (list.length > 0 && calm < 0.7) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };

    wake.current = () => {
      calm = 0;
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

  const spawn = (x: number, y: number) => {
    const list = marbles.current;
    if (list.length >= MAX) list.shift();
    const idx = Math.floor(Math.random() * COLORS.length);
    list.push({ x, y, vx: rand(-120, 120), vy: rand(-120, 60), r: rand(12, 20), color: COLORS[idx], idx });
    wake.current();
    if (list.length >= 20) discoverRef.current("marbles");
  };

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="タップしてビー玉を落とす"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pressing.current = true;
        lastSpawn.current = performance.now();
        const p = local(e);
        onTouch("tap");
        spawn(p.x, p.y);
      }}
      onPointerMove={(e) => {
        if (!pressing.current) return;
        const now = performance.now();
        if (now - lastSpawn.current < 110) return;
        lastSpawn.current = now;
        const p = local(e);
        onTouch("hold", 1);
        spawn(p.x, p.y);
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
