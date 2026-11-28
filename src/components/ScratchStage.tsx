"use client";

import { useEffect, useRef, useState } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import { playCrinkle, startScratch, stopAllStreams, type AudioStream, type Pen } from "@/lib/audio";
import type { StageProps } from "./stage";

const TOOLS: { id: Pen; label: string }[] = [
  { id: "pencil", label: "えんぴつ" },
  { id: "crayon", label: "クレヨン" },
  { id: "marker", label: "ペン" },
];
const COLORS = ["#2b2f3a", "#e4572e", "#f2a93b", "#4caf7d", "#3f7fd9", "#9b5de5"];
const PAPER = "#f6efe0";

// 別のオブジェクトに切り替えても、描いた絵が消えないように覚えておく
let savedDrawing: string | null = null;

export default function ScratchStage({ onTouch, onDiscover }: StageProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState<Pen>("pencil");
  const toolRef = useRef<Pen>("pencil");
  const [color, setColor] = useState(COLORS[0]);
  const colorRef = useRef(COLORS[0]);
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const stream = useRef<AudioStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastMove = useRef(0);
  const acc = useRef(0);
  const total = useRef(0);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const paper = paperRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctxRef.current = ctx;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = paper.getBoundingClientRect();
      const nw = Math.floor(r.width * dpr);
      const nh = Math.floor(r.height * dpr);
      if (nw === canvas.width && nh === canvas.height) return;
      // 大きさが変わっても絵が消えないように、いったん写しておく
      let snap: HTMLCanvasElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        snap = document.createElement("canvas");
        snap.width = canvas.width;
        snap.height = canvas.height;
        snap.getContext("2d")!.drawImage(canvas, 0, 0);
      }
      canvas.width = nw;
      canvas.height = nh;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (snap) ctx.drawImage(snap, 0, 0, snap.width / dpr, snap.height / dpr);
    };
    resize();

    if (savedDrawing) {
      const img = new Image();
      img.onload = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
        dirty.current = true;
      };
      img.src = savedDrawing;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(paper);
    return () => {
      ro.disconnect();
      try {
        savedDrawing = dirty.current ? canvas.toDataURL() : null;
      } catch {
        // 保存できなくても続行
      }
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
    const r = paperRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** 2点のあいだに線を引く。道具ごとに質感が違う */
  const drawSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = toolRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorRef.current;
    const len = Math.hypot(b.x - a.x, b.y - a.y);

    if (t === "pencil") {
      // 細い線を少しずらして3本重ねる
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 3; k++) {
        const j = () => (Math.random() - 0.5) * 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x + j(), a.y + j());
        ctx.lineTo(b.x + j(), b.y + j());
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (t === "crayon") {
      // 太い線に、ざらざらの粒をぬいて紙の地を見せる
      ctx.lineWidth = 9;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const n = Math.ceil(len / 1.5) + 2;
      for (let k = 0; k < n; k++) {
        const u = Math.random();
        ctx.fillRect(
          a.x + (b.x - a.x) * u + (Math.random() - 0.5) * 10,
          a.y + (b.y - a.y) * u + (Math.random() - 0.5) * 10,
          1.6,
          1.6,
        );
      }
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    dirty.current = true;
  };

  const end = () => {
    pointer.current = null;
    clearInterval(timer.current);
    stream.current?.stop();
    stream.current = null;
  };

  useOnHidden(end);

  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    dirty.current = false;
    savedDrawing = null;
    playCrinkle("paper", 0.8);
  };

  const savePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext("2d")!;
    o.fillStyle = PAPER;
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "karikari-drawing.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-film-lemon ${
      on ? "bg-film-cyan font-bold text-night" : "bg-shade text-foam"
    }`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 pt-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === tool}
            onClick={() => {
              toolRef.current = t.id;
              setTool(t.id);
            }}
            className={chip(t.id === tool)}
          >
            {t.label}
          </button>
        ))}
        <span className="w-1" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`色 ${c}`}
            aria-pressed={c === color}
            onClick={() => {
              colorRef.current = c;
              setColor(c);
            }}
            className={`h-6 w-6 rounded-full border-2 ${c === color ? "border-film-lemon" : "border-white/30"}`}
            style={{ background: c }}
          />
        ))}
        <button type="button" onClick={clearAll} className="rounded-full bg-white/15 px-3 py-1.5 text-sm text-foam">
          けす
        </button>
        <button type="button" onClick={savePng} className="rounded-full bg-white/15 px-3 py-1.5 text-sm text-foam">
          ほぞん
        </button>
      </div>

      <div
        ref={paperRef}
        className="relative mx-3 mb-2 flex-1 touch-none select-none overflow-hidden rounded-2xl"
        style={{ background: PAPER }}
        role="application"
        aria-label="お絵かきの紙"
        onPointerDown={(e) => {
          if (pointer.current) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = local(e);
          pointer.current = { ...p, t: performance.now() };
          lastMove.current = performance.now();
          acc.current = 0;
          drawSeg(p, { x: p.x + 0.01, y: p.y });
          clearInterval(timer.current);
          stream.current?.stop();
          stream.current = startScratch(toolRef.current);
          timer.current = setInterval(() => {
            if (performance.now() - lastMove.current > 150) stream.current?.set(0);
          }, 100);
        }}
        onPointerMove={(e) => {
          const prev = pointer.current;
          if (!prev) return;
          const p = local(e);
          const now = performance.now();
          const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
          if (dist > 0) {
            drawSeg(prev, p);
            lastMove.current = now;
            const speed = (dist / Math.max(now - prev.t, 1)) * 1000;
            stream.current?.set(Math.min(speed / 1200, 1));

            // 線の長さに応じて経験値（120pxごとに+1）
            acc.current += dist;
            total.current += dist;
            const units = Math.floor(acc.current / 120);
            if (units > 0) {
              acc.current -= units * 120;
              onTouch("hold", units);
            }
            if (total.current >= 6000) onDiscover("artist");
          }
          pointer.current = { ...p, t: now };
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
