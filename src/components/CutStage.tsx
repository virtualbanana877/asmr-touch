"use client";

import { useEffect, useRef, useState } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import { useParticles } from "@/hooks/useParticles";
import {
  playCut,
  playGolden,
  startScrape,
  stopAllStreams,
  type AudioStream,
  type Material,
} from "@/lib/audio";
import ChipBar from "./ChipBar";
import type { StageProps } from "./stage";

const COLS = 28;
const ROWS = 16;
const TOTAL = COLS * ROWS;
const MATERIALS = [
  { id: "soap", label: "石けん" },
  { id: "sand", label: "キネティックサンド" },
  { id: "ice", label: "氷" },
] as const;

const LOOK: Record<Material, { rgb: [number, number, number]; amp: number; alpha: number; crumb: string }> = {
  soap: { rgb: [247, 196, 220], amp: 16, alpha: 1, crumb: "#f7c4dc" },
  sand: { rgb: [226, 196, 138], amp: 22, alpha: 1, crumb: "#e2c48a" },
  ice: { rgb: [190, 235, 245], amp: 14, alpha: 0.82, crumb: "#cdeef7" },
};
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export default function CutStage({ onTouch, onDiscover, effect }: StageProps) {
  const { containerRef, canvasRef: fxRef, chips } = useParticles(effect);
  const blockRef = useRef<HTMLCanvasElement>(null);
  const [mat, setMat] = useState<Material>("soap");
  const matRef = useRef<Material>("soap");
  const alive = useRef(new Uint8Array(TOTAL));
  const shade = useRef(new Uint8Array(TOTAL));
  const remaining = useRef(TOTAL);
  const geo = useRef({ x0: 0, y0: 0, cs: 11 });
  const redraw = useRef<() => void>(() => {});
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const stream = useRef<AudioStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const regenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastMove = useRef(0);
  const lastAccent = useRef(0);
  const cutAcc = useRef(0);
  const locked = useRef(false);

  // ブロックの描画（残っているマスだけ塗る）
  useEffect(() => {
    const canvas = blockRef.current!;
    const box = containerRef.current!;
    const ctx = canvas.getContext("2d")!;
    alive.current.fill(1);
    for (let i = 0; i < TOTAL; i++) shade.current[i] = Math.floor(Math.random() * 256);
    let w = 0;
    let h = 0;

    const draw = () => {
      const { x0, y0, cs } = geo.current;
      const look = LOOK[matRef.current];
      ctx.clearRect(0, 0, w, h);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (!alive.current[i]) continue;
          const sh = shade.current[i] / 255;
          const k = (sh - 0.5) * 2 * look.amp;
          const x = x0 + c * cs;
          const y = y0 + r * cs;
          ctx.fillStyle = `rgba(${clamp(look.rgb[0] + k)},${clamp(look.rgb[1] + k)},${clamp(look.rgb[2] + k)},${look.alpha})`;
          ctx.fillRect(x, y, cs + 0.6, cs + 0.6);
          if (matRef.current === "ice" && sh > 0.92) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fillRect(x + cs * 0.25, y + cs * 0.25, cs * 0.4, cs * 0.4);
          }
          // 上が空いているマスは明るく、下が空いているマスは暗くして立体感を出す
          if (r === 0 || !alive.current[i - COLS]) {
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(x, y, cs + 0.6, 1.5);
          }
          if (r === ROWS - 1 || !alive.current[i + COLS]) {
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            ctx.fillRect(x, y + cs - 1.5, cs + 0.6, 1.5);
          }
        }
      }
    };
    redraw.current = draw;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = Math.max(8, Math.floor(Math.min(w - 48, 360) / COLS));
      geo.current = {
        cs,
        x0: (w - COLS * cs) / 2,
        y0: Math.max(60, (h - ROWS * cs) / 2),
      };
      draw();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);
    return () => ro.disconnect();
  }, [containerRef]);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      clearTimeout(regenTimer.current);
      stream.current?.stop();
      stopAllStreams();
    },
    [],
  );

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** (px,py)の周りのマスを削る。削った数を返す */
  const carve = (px: number, py: number): number => {
    const { x0, y0, cs } = geo.current;
    const rad = cs * 1.9;
    const c0 = Math.max(0, Math.floor((px - rad - x0) / cs));
    const c1 = Math.min(COLS - 1, Math.floor((px + rad - x0) / cs));
    const r0 = Math.max(0, Math.floor((py - rad - y0) / cs));
    const r1 = Math.min(ROWS - 1, Math.floor((py + rad - y0) / cs));
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * COLS + c;
        if (!alive.current[i]) continue;
        const cx = x0 + (c + 0.5) * cs;
        const cy = y0 + (r + 0.5) * cs;
        if ((cx - px) ** 2 + (cy - py) ** 2 <= rad * rad) {
          alive.current[i] = 0;
          n++;
          if (n <= 3) chips(cx, cy, 1, LOOK[matRef.current].crumb); // かけらが落ちる
        }
      }
    }
    remaining.current -= n;
    return n;
  };

  const carveLine = (ax: number, ay: number, bx: number, by: number) => {
    const step = geo.current.cs * 0.8;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    let n = 0;
    for (let i = 1; i <= steps; i++) n += carve(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
    return n;
  };

  /** 削ったあとの共通処理：描き直し、経験値、削りきったごほうび */
  const after = (n: number) => {
    if (n <= 0) return;
    redraw.current();
    cutAcc.current += n;
    const units = Math.floor(cutAcc.current / 30); // 30マス削るごとに経験値+1
    if (units > 0) {
      cutAcc.current -= units * 30;
      onTouch("hold", units);
    }
    if (!locked.current && remaining.current <= TOTAL * 0.12) {
      locked.current = true;
      playGolden();
      onTouch("hold", 10);
      onDiscover("shaved");
      const r = containerRef.current!.getBoundingClientRect();
      chips(r.width / 2, r.height / 2, 18, LOOK[matRef.current].crumb);
      regenTimer.current = setTimeout(() => {
        alive.current.fill(1);
        remaining.current = TOTAL;
        locked.current = false;
        redraw.current();
      }, 700);
    }
  };

  const choose = (id: string) => {
    const m = id as Material;
    matRef.current = m;
    setMat(m);
    stream.current?.stop();
    clearTimeout(regenTimer.current);
    alive.current.fill(1); // 新しいブロックに替える
    remaining.current = TOTAL;
    locked.current = false;
    redraw.current();
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
      ref={containerRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="ブロックを削る"
      onPointerDown={(e) => {
        if (pointer.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        pointer.current = p;
        lastMove.current = performance.now();
        clearInterval(timer.current);
        stream.current?.stop();
        stream.current = startScrape(matRef.current);
        const n = carve(p.x, p.y);
        if (n > 0) {
          playCut(matRef.current, n >= 6);
          stream.current?.set(0.6);
        }
        after(n);
        timer.current = setInterval(() => {
          if (performance.now() - lastMove.current > 150) stream.current?.set(0);
        }, 100);
      }}
      onPointerMove={(e) => {
        const prev = pointer.current;
        if (!prev) return;
        const p = local(e);
        const n = carveLine(prev.x, prev.y, p.x, p.y);
        pointer.current = p;
        if (n > 0) {
          const now = performance.now();
          lastMove.current = now;
          stream.current?.set(Math.min(1, 0.25 + n / 14));
          if (n >= 6 && now - lastAccent.current > 140) {
            lastAccent.current = now;
            playCut(matRef.current, true);
          }
        }
        after(n);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={blockRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={fxRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <ChipBar items={MATERIALS} value={mat} onSelect={choose} />
    </div>
  );
}
