"use client";

import { useEffect, useRef } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import { rand } from "@/hooks/useParticles";
import { playBrushTurn, startBrush, stopAllStreams, type AudioStream } from "@/lib/audio";
import type { StageProps } from "./stage";

const COUNT = 700;
const FUR = ["#d9d2c3", "#c4bcab", "#e8e2d4", "#b3ab9a"];
const REACH = 46; // ブラシが毛に届く範囲(px)

type Strand = { x: number; y: number; a: number; rest: number; len: number; k: number };

const wrapAngle = (d: number) =>
  ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export default function BrushStage({ onTouch, onDiscover }: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strands = useRef<Strand[]>([]);
  const geom = useRef({ cx: 0, cy: 0, R: 100 });
  const wake = useRef<() => void>(() => {});
  const stream = useRef<AudioStream | null>(null);
  const pointer = useRef<{ x: number; y: number; t: number; vx: number; vy: number } | null>(null);
  const lastMove = useRef(0);
  const moved = useRef(0);
  const stroke = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const discoverRef = useRef(onDiscover);

  useEffect(() => {
    discoverRef.current = onDiscover;
  });

  // ふわふわの毛。ブラシでなでた方向に毛が寝て、ゆっくり元に戻る
  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
    let last = 0;
    let running = false;
    let raf = 0;

    const draw = () => {
      const { cx, cy, R } = geom.current;
      ctx.clearRect(0, 0, w, h);

      // 台
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, h - 30, R * 0.7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a3140";
      ctx.fillRect(cx - 7, cy + R * 0.6, 14, Math.max(0, h - 30 - (cy + R * 0.6)));

      // マイクの頭
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#5a6372");
      g.addColorStop(1, "#252b36");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // 毛（色ごとにまとめて描く）
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      for (let k = 0; k < FUR.length; k++) {
        ctx.strokeStyle = FUR[k];
        ctx.beginPath();
        for (const s of strands.current) {
          if (s.k !== k) continue;
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + Math.cos(s.a) * s.len, s.y + Math.sin(s.a) * s.len);
        }
        ctx.stroke();
      }

      // ブラシの位置
      const p = pointer.current;
      if (p) {
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.max(80, Math.min(120, Math.min(w, h) * 0.3));
      const cx = w / 2;
      const cy = h * 0.45;
      geom.current = { cx, cy, R };
      strands.current = Array.from({ length: COUNT }, () => {
        const r2 = R * 1.05 * Math.sqrt(Math.random());
        const th = Math.random() * Math.PI * 2;
        const rest = th + rand(-0.35, 0.35); // 中心から外へ向かって生えている
        return {
          x: cx + r2 * Math.cos(th),
          y: cy + r2 * Math.sin(th),
          a: rest,
          rest,
          len: rand(11, 19),
          k: Math.floor(Math.random() * FUR.length),
        };
      });
      draw();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const k = Math.min(1, dt * 1.4);
      let dev = 0;
      for (const s of strands.current) {
        const d = wrapAngle(s.rest - s.a);
        s.a += d * k;
        dev = Math.max(dev, Math.abs(d));
      }
      draw();
      if (pointer.current || dev > 0.03) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        for (const s of strands.current) s.a = s.rest;
        draw();
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

  /** ブラシが通った場所の毛を、動いた向きに寝かせる */
  const comb = (px: number, py: number, dx: number, dy: number) => {
    const ang = Math.atan2(dy, dx);
    for (const s of strands.current) {
      const d2 = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (d2 > REACH * REACH) continue;
      const wgt = 1 - Math.sqrt(d2) / REACH;
      s.a += wrapAngle(ang - s.a) * wgt * 0.6;
    }
  };

  const end = () => {
    pointer.current = null;
    clearInterval(timer.current);
    stream.current?.stop();
    stream.current = null;
    wake.current();
  };

  useOnHidden(end);

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="マイクをブラシでなでる"
      onPointerDown={(e) => {
        if (pointer.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        pointer.current = { ...p, t: performance.now(), vx: 0, vy: 0 };
        lastMove.current = performance.now();
        stroke.current = 0;
        clearInterval(timer.current);
        stream.current?.stop();
        stream.current = startBrush();
        timer.current = setInterval(() => {
          if (performance.now() - lastMove.current > 150) stream.current?.set(0);
        }, 100);
        wake.current();
      }}
      onPointerMove={(e) => {
        const prev = pointer.current;
        if (!prev) return;
        const p = local(e);
        const now = performance.now();
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          const speed = (dist / Math.max(now - prev.t, 1)) * 1000;
          lastMove.current = now;
          stream.current?.set(Math.min(speed / 1400, 1));
          comb(p.x, p.y, dx, dy);

          // 向きが逆になったら「さっ」
          if (prev.vx * dx + prev.vy * dy < 0 && speed > 250) playBrushTurn();

          // なでた距離に応じて経験値（90pxごとに+1）
          moved.current += dist;
          const units = Math.floor(moved.current / 90);
          if (units > 0) {
            moved.current -= units * 90;
            onTouch("hold", units);
          }
          stroke.current += dist;
          if (stroke.current >= 3000) discoverRef.current("tingle");
        }
        pointer.current = { x: p.x, y: p.y, t: now, vx: dx || prev.vx, vy: dy || prev.vy };
        wake.current();
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
