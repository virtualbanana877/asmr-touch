"use client";

import { useEffect, useRef } from "react";
import {
  playSlimeBubble,
  playSlimePress,
  playSlimeRelease,
  startSlime,
  type SlimeStream,
} from "@/lib/audio";
import type { StageProps } from "./stage";

const N = 32; // 輪郭の点の数

type Pt = { rx: number; ry: number; x: number; y: number; vx: number; vy: number };
type Grab = { sx: number; sy: number; px: number; py: number; w: number[] };

export default function SlimeStage({ onTouch, onDiscover }: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pts = useRef<Pt[]>([]);
  const geom = useRef({ cx: 0, cy: 0, R: 90 });
  const grab = useRef<Grab | null>(null);
  const wake = useRef<() => void>(() => {});
  const stream = useRef<SlimeStream | null>(null);
  const lastMove = useRef(0);
  const moved = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const discoverRef = useRef(onDiscover);

  useEffect(() => {
    discoverRef.current = onDiscover;
  });

  // スライムのシミュレーション（輪郭の点がバネでつながっている）
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
      const list = pts.current;
      if (list.length === 0) return;
      const { cx, cy, R } = geom.current;
      ctx.clearRect(0, 0, w, h);

      let mx = 0;
      let my = 0;
      for (const p of list) {
        mx += p.x;
        my += p.y;
      }
      mx /= N;
      my /= N;

      // 影
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + R * 0.9, R * 1.1, R * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();

      // 本体（点の中点をなめらかにつなぐ）
      ctx.beginPath();
      const a0 = list[N - 1];
      const b0 = list[0];
      ctx.moveTo((a0.x + b0.x) / 2, (a0.y + b0.y) / 2);
      for (let i = 0; i < N; i++) {
        const c = list[i];
        const n = list[(i + 1) % N];
        ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(mx - R * 0.3, my - R * 0.4, R * 0.1, mx, my, R * 1.4);
      grad.addColorStop(0, "rgba(255,222,238,0.95)");
      grad.addColorStop(0.55, "rgba(205,176,255,0.9)");
      grad.addColorStop(1, "rgba(140,200,255,0.85)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 内側の陰とツヤ
      ctx.save();
      ctx.clip();
      const sh = ctx.createLinearGradient(0, my, 0, my + R);
      sh.addColorStop(0, "rgba(16,36,58,0)");
      sh.addColorStop(1, "rgba(16,36,58,0.28)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, my, w, h - my);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.beginPath();
      ctx.ellipse(mx - R * 0.4, my - R * 0.35, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.max(70, Math.min(110, Math.min(w, h) * 0.26));
      geom.current = { cx: w / 2, cy: h / 2, R };
      pts.current = Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2;
        const rx = w / 2 + R * 1.15 * Math.cos(a);
        const ry = h / 2 + R * 0.85 * Math.sin(a);
        return { rx, ry, x: rx, y: ry, vx: 0, vy: 0 };
      });
      draw();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.033);
      last = t;
      const g = grab.current;
      const list = pts.current;
      const R = geom.current.R;

      let dx = 0;
      let dy = 0;
      if (g) {
        dx = g.px - g.sx;
        dy = g.py - g.sy;
        const len = Math.hypot(dx, dy);
        const max = R * 3.2; // のびる限界
        if (len > max) {
          dx *= max / len;
          dy *= max / len;
        }
      }

      let energy = 0;
      for (let i = 0; i < N; i++) {
        const p = list[i];
        const tx = p.rx + (g ? dx * g.w[i] : 0);
        const ty = p.ry + (g ? dy * g.w[i] : 0);
        const k = g ? 220 : 120; // つかんでいる間は強く引かれる
        const damp = g ? 16 : 5.5; // 離すとゆるく減衰してぷるぷる揺れる
        const a = list[(i + N - 1) % N];
        const b = list[(i + 1) % N];
        p.vx += ((tx - p.x) * k - p.vx * damp + ((a.x + b.x) / 2 - p.x) * 60) * dt;
        p.vy += ((ty - p.y) * k - p.vy * damp + ((a.y + b.y) / 2 - p.y) * 60) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        energy += Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.x - p.rx) + Math.abs(p.y - p.ry);
      }
      draw();

      if (g || energy > 1.5) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        for (const p of list) {
          p.x = p.rx;
          p.y = p.ry;
          p.vx = 0;
          p.vy = 0;
        }
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

  const end = () => {
    const g = grab.current;
    if (!g) return;
    const R = geom.current.R;
    const stretch = Math.hypot(g.px - g.sx, g.py - g.sy);
    grab.current = null;
    clearInterval(timer.current);
    stream.current?.stop();
    stream.current = null;
    playSlimeRelease(Math.min(1, stretch / (R * 2.2)));
    wake.current();
  };

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="スライムをつかんでのばす"
      onPointerDown={(e) => {
        const p = local(e);
        const { cx, cy, R } = geom.current;
        const nx = (p.x - cx) / (R * 1.7);
        const ny = (p.y - cy) / (R * 1.3);
        if (nx * nx + ny * ny > 1) return; // スライムの近くだけつかめる
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);

        // つかんだ位置に近い点ほど強く引かれる
        const sigma = R * 0.55;
        const raw = pts.current.map((pt) =>
          Math.exp(-((pt.rx - p.x) ** 2 + (pt.ry - p.y) ** 2) / (2 * sigma * sigma)),
        );
        const max = Math.max(...raw, 1e-6);
        grab.current = { sx: p.x, sy: p.y, px: p.x, py: p.y, w: raw.map((v) => v / max) };
        moved.current = 0;
        lastMove.current = performance.now();

        stream.current = startSlime();
        playSlimePress();
        onTouch("tap");
        // 止まっている間は音を消す
        timer.current = setInterval(() => {
          if (performance.now() - lastMove.current > 150) stream.current?.set(0);
        }, 100);
        wake.current();
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g) return;
        const p = local(e);
        const now = performance.now();
        const dist = Math.hypot(p.x - g.px, p.y - g.py);
        const dtm = Math.max(now - lastMove.current, 1);
        g.px = p.x;
        g.py = p.y;
        if (dist > 0) {
          const R = geom.current.R;
          lastMove.current = now;
          moved.current += dist;
          stream.current?.set(Math.min(((dist / dtm) * 1000) / 900, 1));

          const stretch = Math.hypot(g.px - g.sx, g.py - g.sy);
          if (stretch > R * 0.8 && Math.random() < 0.06) playSlimeBubble();
          if (stretch >= R * 2.6) discoverRef.current("longslime");

          // のばした距離に応じて経験値（80pxごとに+1）
          const units = Math.floor(moved.current / 80);
          if (units > 0) {
            moved.current -= units * 80;
            onTouch("hold", units);
          }
        }
        wake.current();
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
