"use client";

import { useEffect, useRef, useState } from "react";
import { rand } from "@/hooks/useParticles";
import { playCrinkle, playUnfold, type Sheet } from "@/lib/audio";
import ChipBar from "./ChipBar";
import type { StageProps } from "./stage";

const SHEETS = [
  { id: "paper", label: "紙" },
  { id: "plastic", label: "ビニール" },
  { id: "cellophane", label: "セロファン" },
] as const;
const M = 28; // 輪郭の点の数
const SEGS = 70; // しわの本数

type Seg = { x1: number; y1: number; x2: number; y2: number; light: boolean };

const LOOK: Record<Sheet, { fill: [string, string]; stroke: string; light: string; dark: string }> = {
  paper: { fill: ["#f7f2e8", "#e2d9c6"], stroke: "rgba(90,80,60,0.35)", light: "rgba(255,255,255,0.75)", dark: "rgba(90,80,60,0.28)" },
  plastic: { fill: ["rgba(235,248,255,0.7)", "rgba(180,215,235,0.55)"], stroke: "rgba(255,255,255,0.65)", light: "rgba(255,255,255,0.85)", dark: "rgba(70,110,135,0.28)" },
  cellophane: { fill: ["rgba(255,130,195,0.55)", "rgba(110,205,255,0.5)"], stroke: "rgba(255,255,255,0.75)", light: "rgba(255,255,255,0.85)", dark: "rgba(160,60,140,0.25)" },
};

export default function CrumpleStage({ onTouch, onDiscover }: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sheet, setSheet] = useState<Sheet>("paper");
  const sheetRef = useRef<Sheet>("paper");
  const lv = useRef(0); // くしゃくしゃ度 0〜1（目標）
  const shown = useRef(0); // 見た目（なめらかに追いかける）
  const pressing = useRef(false);
  const activeId = useRef<number | null>(null); // いま握っている指
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const acc = useRef(0);
  const xpAcc = useRef(0);
  const lastSound = useRef(0);
  const noise = useRef<number[]>([]);
  const segs = useRef<Seg[]>([]);
  const wake = useRef<() => void>(() => {});
  const done = useRef(new Set<Sheet>());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const ctx = canvas.getContext("2d")!;
    noise.current = Array.from({ length: M }, () => Math.random());
    segs.current = Array.from({ length: SEGS }, () => {
      const x1 = rand(-1, 1);
      const y1 = rand(-1, 1);
      const a = rand(0, Math.PI * 2);
      const len = rand(0.12, 0.35);
      return { x1, y1, x2: x1 + Math.cos(a) * len, y2: y1 + Math.sin(a) * len, light: Math.random() < 0.5 };
    });
    let w = 0;
    let h = 0;
    let lastT = 0;
    let running = false;
    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const e = shown.current;
      const cx = w / 2;
      const cy = h / 2 + 16;
      const hw = Math.min(w * 0.34, 125);
      const hh = hw * 0.72;
      const rb = hw * 0.42; // くしゃくしゃになったときの玉の大きさ
      const look = LOOK[sheetRef.current];

      // 平らなシートの輪郭と、丸めた玉の輪郭のあいだを動かす
      const pts: [number, number][] = [];
      for (let i = 0; i < M; i++) {
        const th = (i / M) * Math.PI * 2;
        const co = Math.cos(th);
        const si = Math.sin(th);
        const sx = hw * Math.sign(co) * Math.abs(co) ** (1 / 3);
        const sy = hh * Math.sign(si) * Math.abs(si) ** (1 / 3);
        const n1 = noise.current[i] ?? 0.5;
        const r = rb * (0.85 + 0.35 * n1);
        const jag = 1 + (n1 - 0.5) * 0.3 * Math.min(1, e * 2);
        pts.push([cx + (sx + (r * co - sx) * e) * jag, cy + (sy + (r * si - sy) * e) * jag]);
      }

      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + hh * (1 - e * 0.45) + 8, hw * (1 - e * 0.5), 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      const g = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
      g.addColorStop(0, look.fill[0]);
      g.addColorStop(1, look.fill[1]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = look.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // しわ：くしゃくしゃ度に応じて増える
      ctx.save();
      ctx.clip();
      const ext = (hw + (rb - hw) * e) * 0.95;
      const visible = Math.floor(e * SEGS);
      ctx.lineCap = "round";
      ctx.lineWidth = 1.3;
      for (let i = 0; i < visible; i++) {
        const s = segs.current[i];
        ctx.strokeStyle = s.light ? look.light : look.dark;
        ctx.beginPath();
        ctx.moveTo(cx + s.x1 * ext, cy + s.y1 * ext * 0.8);
        ctx.lineTo(cx + s.x2 * ext, cy + s.y2 * ext * 0.8);
        ctx.stroke();
      }
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
      draw();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    const frame = (t: number) => {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      shown.current += (lv.current - shown.current) * Math.min(1, dt * 10);
      draw();
      if (Math.abs(lv.current - shown.current) > 0.002) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        shown.current = lv.current;
        draw();
      }
    };
    wake.current = () => {
      if (running) return;
      running = true;
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    };

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** 握っている状態を終わらせる */
  const release = () => {
    pressing.current = false;
    activeId.current = null;
    last.current = null;
  };

  const choose = (id: string) => {
    release();
    sheetRef.current = id as Sheet;
    setSheet(id as Sheet);
    lv.current = 0; // 新しい素材に替える
    xpAcc.current = 0;
    acc.current = 0;
    wake.current();
  };

  const flatten = () => {
    release(); // 握ったままだと、すぐまた丸まってしまうので
    lv.current = 0;
    xpAcc.current = 0;
    acc.current = 0;
    playUnfold(sheetRef.current);
    wake.current();
  };

  const endPress = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === activeId.current) release();
  };

  return (
    <div
      ref={boxRef}
      className="relative flex-1 touch-none select-none overflow-hidden"
      role="application"
      aria-label="シートを握ってくしゃくしゃにする"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pressing.current = true;
        activeId.current = e.pointerId;
        last.current = { ...local(e), t: performance.now() };
        acc.current = 0;
        playCrinkle(sheetRef.current, 0.6); // 経験値は、潰したときに入る
      }}
      onPointerMove={(e) => {
        const prev = last.current;
        if (!pressing.current || !prev || e.pointerId !== activeId.current) return;
        if (e.pointerType === "mouse" && e.buttons === 0) {
          release(); // ボタンを離したのに、離した合図が届かなかった場合
          return;
        }
        const p = local(e);
        const now = performance.now();
        const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
        last.current = { ...p, t: now };
        if (dist === 0) return;

        // 動かした分だけ、くしゃくしゃになる（約900pxで完全に丸まる）
        const before = lv.current;
        lv.current = Math.min(1, lv.current + dist / 900);
        const delta = lv.current - before;
        xpAcc.current += delta;
        const units = Math.floor(xpAcc.current / 0.1);
        if (units > 0) {
          xpAcc.current -= units * 0.1;
          onTouch("hold", units);
        }
        if (before < 1 && lv.current >= 1) {
          onTouch("hold", 8); // 完全に潰したら、そのたびにボーナス
          done.current.add(sheetRef.current);
          if (done.current.size >= 3) onDiscover("crumpler");
        }

        // 16px動くごとに「くしゃっ」
        acc.current += dist;
        if (acc.current >= 16 && now - lastSound.current > 40) {
          acc.current = 0;
          lastSound.current = now;
          const speed = (dist / Math.max(now - prev.t, 1)) * 1000;
          playCrinkle(sheetRef.current, speed / 800);
        }
        wake.current();
      }}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onLostPointerCapture={endPress}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <ChipBar items={SHEETS} value={sheet} onSelect={choose}>
        <button
          type="button"
          onClick={flatten}
          className="rounded-full bg-white/15 px-3 py-1.5 text-sm text-foam focus-visible:outline-2 focus-visible:outline-film-lemon"
        >
          のばす
        </button>
      </ChipBar>
    </div>
  );
}
