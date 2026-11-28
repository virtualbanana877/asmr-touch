"use client";

import { useEffect, useRef } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import { rand } from "@/hooks/useParticles";
import { playWoodClick, setPan, startRoll, stopAllStreams, type AudioStream } from "@/lib/audio";
import type { StageProps } from "./stage";

const N = 36; // 木のボールの数
const WOODS = ["#d2a56b", "#c1925a", "#b0824d", "#dcb27a", "#9c6f3f"];
const SPOON_R = 17;

type Ball = { x: number; y: number; vx: number; vy: number; r: number; k: number };
type Spoon = { x: number; y: number; vx: number; vy: number; t: number; id: number };

export default function WoodSoupStage({ onTouch, onDiscover }: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balls = useRef<Ball[]>([]);
  const geom = useRef({ cx: 0, cy: 0, R: 120 });
  const spoon = useRef<Spoon | null>(null);
  const wake = useRef<() => void>(() => {});
  const stream = useRef<AudioStream | null>(null);
  const moved = useRef(0);
  const total = useRef(0);
  const discoverRef = useRef(onDiscover);

  useEffect(() => {
    discoverRef.current = onDiscover;
  });

  // 木の器の中を、ボールが転がるシミュレーション
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

    const draw = () => {
      const { cx, cy, R } = geom.current;
      ctx.clearRect(0, 0, w, h);

      // 器の外側と木目
      const og = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.2);
      og.addColorStop(0, "#b98d58");
      og.addColorStop(1, "#7a5530");
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,35,15,0.22)";
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.03 + k * 0.035), 0, Math.PI * 2);
        ctx.stroke();
      }

      // 器の内側と、うっすら水
      ctx.fillStyle = "#4a3420";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      const ig = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
      ig.addColorStop(0, "rgba(190,220,235,0.30)");
      ig.addColorStop(1, "rgba(110,150,175,0.38)");
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // 木のボール
      for (const b of balls.current) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.arc(b.x + 1.5, b.y + 2, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = WOODS[b.k % WOODS.length];
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 木のスプーン
      const sp = spoon.current;
      if (sp) {
        ctx.strokeStyle = "#b48552";
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x + 64, sp.y - 80);
        ctx.stroke();
        ctx.fillStyle = "#d2a56b";
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, 20, 14, -0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(60,35,15,0.35)";
        ctx.lineWidth = 1.5;
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
      const R = Math.max(100, Math.min(w * 0.42, h * 0.42, 170));
      geom.current = { cx: w / 2, cy: h / 2, R };
      if (balls.current.length === 0) {
        balls.current = Array.from({ length: N }, (_, i) => {
          const r2 = rand(9, 13);
          const a = rand(0, Math.PI * 2);
          const d = (R - 20 - r2) * Math.sqrt(Math.random());
          return { x: w / 2 + Math.cos(a) * d, y: h / 2 + Math.sin(a) * d, vx: 0, vy: 0, r: r2, k: i % 8 };
        });
      }
      draw();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.033);
      last = t;
      const { cx, cy, R } = geom.current;
      const list = balls.current;
      const sp = spoon.current;

      let sounds = 0;
      const click = (intensity: number, idx: number, x: number) => {
        if (sounds < 5 && intensity > 0.06) {
          sounds++;
          setPan((x / Math.max(w, 1)) * 1.7 - 0.85); // ぶつかった場所から聞こえる
          playWoodClick(Math.min(1, intensity), idx);
        }
      };

      const damp = Math.exp(-dt * 1.6);
      for (const b of list) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= damp;
        b.vy *= damp;
      }
      if (sp) {
        // 止まっているあいだは、スプーンの速さをゼロに近づける
        sp.vx *= Math.exp(-dt * 8);
        sp.vy *= Math.exp(-dt * 8);
      }

      for (let it = 0; it < 2; it++) {
        // ボールどうし
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
              const imp = (1.5 * approach) / 2;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              b.vx += imp * nx;
              b.vy += imp * ny;
              if (it === 0) click(approach / 700, a.k, a.x);
            }
          }
        }
        // 器のふち
        for (const b of list) {
          const dx = b.x - cx;
          const dy = b.y - cy;
          const d = Math.hypot(dx, dy);
          const lim = R - b.r;
          if (d > lim && d > 0) {
            const nx = dx / d;
            const ny = dy / d;
            b.x = cx + nx * lim;
            b.y = cy + ny * lim;
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              b.vx -= 1.5 * vn * nx;
              b.vy -= 1.5 * vn * ny;
              if (it === 0) click(vn / 700, b.k, b.x);
            }
          }
        }
        // スプーン
        if (sp) {
          for (const b of list) {
            const dx = b.x - sp.x;
            const dy = b.y - sp.y;
            const d = Math.hypot(dx, dy);
            const min = b.r + SPOON_R;
            if (d < min && d > 0) {
              const nx = dx / d;
              const ny = dy / d;
              b.x = sp.x + nx * min;
              b.y = sp.y + ny * min;
              const rel = (b.vx - sp.vx) * nx + (b.vy - sp.vy) * ny;
              if (rel < 0) {
                b.vx -= 1.6 * rel * nx;
                b.vy -= 1.6 * rel * ny;
                if (it === 0) click(-rel / 700, b.k, b.x);
              }
            }
          }
        }
      }

      // 転がっている勢いに合わせて、ゴロゴロ音を調整
      let energy = 0;
      for (const b of list) energy += Math.hypot(b.vx, b.vy);
      stream.current?.set(Math.min(1, energy / 1800));
      calm = !sp && energy < 25 ? calm + dt : 0;

      draw();
      if (calm < 0.5) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        stream.current?.stop();
        stream.current = null;
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

  useEffect(
    () => () => {
      stream.current?.stop();
      stopAllStreams();
    },
    [],
  );

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current!.getBoundingClientRect();
    const { cx, cy, R } = geom.current;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // 器からあまり遠くには動かせない
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    const lim = R + 4;
    return d > lim ? { x: cx + (dx / d) * lim, y: cy + (dy / d) * lim } : { x, y };
  };

  const end = () => {
    spoon.current = null;
    stream.current?.stop();
    stream.current = null;
  };

  useOnHidden(end);

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="木のスプーンでかき混ぜる"
      onPointerDown={(e) => {
        if (spoon.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        spoon.current = { ...p, vx: 0, vy: 0, t: performance.now(), id: e.pointerId };
        if (!stream.current) stream.current = startRoll();
        wake.current();
      }}
      onPointerMove={(e) => {
        const sp = spoon.current;
        if (!sp || e.pointerId !== sp.id) return;
        const p = local(e);
        const now = performance.now();
        const dtm = Math.max(now - sp.t, 1);
        const dist = Math.hypot(p.x - sp.x, p.y - sp.y);
        sp.vx = sp.vx * 0.5 + ((p.x - sp.x) / dtm) * 1000 * 0.5;
        sp.vy = sp.vy * 0.5 + ((p.y - sp.y) / dtm) * 1000 * 0.5;
        sp.x = p.x;
        sp.y = p.y;
        sp.t = now;

        // かき混ぜた距離に応じて経験値（100pxごとに+1）
        moved.current += dist;
        total.current += dist;
        const units = Math.floor(moved.current / 100);
        if (units > 0) {
          moved.current -= units * 100;
          onTouch("hold", units);
        }
        if (total.current >= 8000) discoverRef.current("woodstir");
        wake.current();
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
