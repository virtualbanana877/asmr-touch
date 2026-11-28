"use client";

import { useEffect, useRef, useState } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import {
  playGolden,
  playPeelTick,
  playTapeOff,
  playZipTicks,
  startTear,
  stopAllStreams,
  type AudioStream,
} from "@/lib/audio";
import ChipBar from "./ChipBar";
import type { StageProps } from "./stage";

type Mode = "zipper" | "tape";
const MODES = [
  { id: "zipper", label: "ジッパー" },
  { id: "tape", label: "テープ" },
] as const;
type ModeProps = Pick<StageProps, "onTouch" | "onDiscover">;

const PITCH = 9; // ジッパーの歯の間隔(px)

/** キャンバスを大きさに合わせて用意する。大きさが変わるたびに onLayout が呼ばれる */
function setupCanvas(canvas: HTMLCanvasElement, box: HTMLElement, onLayout: (w: number, h: number) => void) {
  const ctx = canvas.getContext("2d")!;
  const layout = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = box.getBoundingClientRect();
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onLayout(r.width, r.height);
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(box);
  return { ctx, dispose: () => ro.disconnect() };
}

/* ======================= ジッパー ======================= */
function ZipperMode({ onTouch, onDiscover }: ModeProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geom = useRef({ x0: 24, x1: 300, cy: 200 });
  const pos = useRef(40); // つまみの位置
  const drag = useRef<{ id: number; off: number; last: number; t: number } | null>(null);
  const redraw = useRef<() => void>(() => {});
  const moved = useRef(0);
  const full = useRef(false);

  useEffect(() => {
    const size = { w: 0, h: 0 };
    const { ctx, dispose } = setupCanvas(canvasRef.current!, boxRef.current!, (w, h) => {
      size.w = w;
      size.h = h;
      const x0 = 24;
      const x1 = w - 24;
      geom.current = { x0, x1, cy: h / 2 };
      pos.current = Math.min(Math.max(pos.current, x0 + 16), x1 - 16);
      redraw.current();
    });

    const draw = () => {
      const { x0, x1, cy } = geom.current;
      const sx = pos.current;
      ctx.clearRect(0, 0, size.w, size.h);
      // つまみより左は開いていて、V字にひらく
      const gapAt = (x: number) => Math.max(0, Math.min(26, (sx - x) * 0.3));

      // 開いたすき間
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      for (let x = x0; x <= sx; x += 6) ctx.lineTo(x, cy - gapAt(x));
      for (let x = sx; x >= x0; x -= 6) ctx.lineTo(x, cy + gapAt(x));
      ctx.closePath();
      ctx.fill();

      // 上と下の布
      ctx.fillStyle = "#5f7fb8";
      ctx.beginPath();
      ctx.moveTo(x0, cy - 64);
      ctx.lineTo(x1, cy - 64);
      for (let x = x1; x >= x0; x -= 6) ctx.lineTo(x, cy - gapAt(x));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#4f6ca3";
      ctx.beginPath();
      ctx.moveTo(x0, cy + 64);
      ctx.lineTo(x1, cy + 64);
      for (let x = x1; x >= x0; x -= 6) ctx.lineTo(x, cy + gapAt(x));
      ctx.closePath();
      ctx.fill();

      // 歯（閉じているところは互い違いにかみ合う）
      ctx.fillStyle = "#d7dce4";
      for (let x = x0 + 4; x < x1; x += PITCH) {
        const gh = gapAt(x);
        ctx.fillRect(x - 3.5, cy - gh - 6, 7, 6);
        ctx.fillRect(x + PITCH / 2 - 3.5, cy + gh, 7, 6);
      }

      // つまみと引き手
      const g = ctx.createLinearGradient(sx - 14, 0, sx + 14, 0);
      g.addColorStop(0, "#f2f4f8");
      g.addColorStop(0.5, "#aab2c0");
      g.addColorStop(1, "#e4e8ef");
      ctx.fillStyle = g;
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.fillRect(sx - 14, cy - 20, 28, 40);
      ctx.strokeRect(sx - 14.5, cy - 20.5, 29, 41);
      ctx.fillRect(sx - 6, cy + 20, 12, 30);
      ctx.beginPath();
      ctx.arc(sx, cy + 58, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(sx, cy + 58, 4, 0, Math.PI * 2);
      ctx.fill();
    };
    redraw.current = draw;
    draw();
    return dispose;
  }, []);

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const end = () => {
    drag.current = null;
  };
  useOnHidden(end);

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none select-none"
      role="application"
      aria-label="ジッパーのつまみをひっぱる"
      onPointerDown={(e) => {
        const p = local(e);
        const { cy } = geom.current;
        if (Math.abs(p.x - pos.current) > 40 || p.y < cy - 40 || p.y > cy + 80) return; // つまみの近くだけつかめる
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, off: pos.current - p.x, last: pos.current, t: performance.now() };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        const { x0, x1 } = geom.current;
        const p = local(e);
        const nx = Math.min(Math.max(p.x + d.off, x0 + 16), x1 - 16);
        const now = performance.now();
        const dist = Math.abs(nx - d.last);
        if (dist > 0) {
          // 歯をまたいだ数だけ「カチカチ」
          const a = Math.floor((d.last - x0) / PITCH);
          const b = Math.floor((nx - x0) / PITCH);
          const ticks = Math.abs(b - a);
          if (ticks > 0) playZipTicks(ticks, ((dist / Math.max(now - d.t, 1)) * 1000) / 1500);

          // ひっぱった距離に応じて経験値（120pxごとに+1）
          moved.current += dist;
          const units = Math.floor(moved.current / 120);
          if (units > 0) {
            moved.current -= units * 120;
            onTouch("hold", units);
          }
          // 端まで開けきったらボーナス
          if (nx >= x1 - 18 && !full.current) {
            full.current = true;
            onTouch("hold", 5);
            onDiscover("zipfull");
          }
          if (nx <= x0 + 20) full.current = false;
        }
        pos.current = nx;
        d.last = nx;
        d.t = now;
        redraw.current();
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/* ======================= テープ ======================= */
type Strip = { color: string; p: number; state: "stuck" | "leaving" | "gone"; gone: number };
const TAPE_COLORS = ["#e8d3a1", "#9ec5e8", "#f2b6c8", "#b7dfae"];
const STRIP_H = 44;

function TapeMode({ onTouch, onDiscover }: ModeProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strips = useRef<Strip[]>([]);
  const geom = useRef({ x0: 28, x1: 300, ys: [0, 0, 0, 0] });
  const grab = useRef<{ i: number; id: number; startX: number; startP: number; t: number } | null>(null);
  const stream = useRef<AudioStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastMove = useRef(0);
  const moved = useRef(0);
  const wake = useRef<() => void>(() => {});
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const size = { w: 0, h: 0 };
    const reset = () => {
      strips.current = TAPE_COLORS.map((color) => ({ color, p: 0, state: "stuck" as const, gone: 0 }));
    };
    reset();

    const { ctx, dispose } = setupCanvas(canvasRef.current!, boxRef.current!, (w, h) => {
      size.w = w;
      size.h = h;
      const sp = Math.min(78, Math.max(56, (h - 100) / 4));
      geom.current = {
        x0: 28,
        x1: w - 28,
        ys: [0, 1, 2, 3].map((i) => h / 2 + (i - 1.5) * sp),
      };
      redraw.current();
    });

    const draw = () => {
      const { x0, x1, ys } = geom.current;
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(12, 14, size.w - 24, size.h - 28);

      strips.current.forEach((s, i) => {
        if (s.state === "gone") return;
        const y = ys[i];
        const dy = -s.gone * 70;
        const alpha = 1 - s.gone;
        const front = x0 + s.p;
        ctx.globalAlpha = alpha;

        // 台に残っているテープ
        if (front < x1) {
          ctx.fillStyle = s.color;
          ctx.fillRect(front, y - STRIP_H / 2 + dy, x1 - front, STRIP_H);
          ctx.fillStyle = "rgba(255,255,255,0.28)";
          ctx.fillRect(front, y - STRIP_H / 2 + dy, x1 - front, 3);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(front, y + STRIP_H / 2 - 3 + dy, x1 - front, 3);
        }
        // めくれ上がった部分
        if (s.p > 2) {
          const len = s.p * 0.85;
          const lift = Math.min(28, s.p * 0.35);
          ctx.fillStyle = "rgba(0,0,0,0.16)";
          ctx.fillRect(front - len, y - STRIP_H / 2 + dy + 5, len, STRIP_H);
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.moveTo(front, y - STRIP_H / 2 + dy);
          ctx.lineTo(front, y + STRIP_H / 2 + dy);
          ctx.lineTo(front - len, y + STRIP_H / 2 + dy - lift);
          ctx.lineTo(front - len, y - STRIP_H / 2 + dy - lift);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(front, y - STRIP_H / 2 + dy);
          ctx.lineTo(front - len, y - STRIP_H / 2 + dy - lift);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    };
    redraw.current = draw;

    // はがれたテープが飛んでいくアニメーション
    let last = 0;
    let running = false;
    let raf = 0;
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      let leaving = false;
      for (const s of strips.current) {
        if (s.state !== "leaving") continue;
        s.gone += dt * 2.2;
        if (s.gone >= 1) {
          s.gone = 1;
          s.state = "gone";
        } else {
          leaving = true;
        }
      }
      draw();
      if (leaving) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        // 全部はがし終えたら、ごほうびのあとに新しいテープを貼る
        if (strips.current.every((s) => s.state === "gone") && !resetTimer.current) {
          resetTimer.current = setTimeout(() => {
            resetTimer.current = undefined;
            reset();
            draw();
            onTouch("hold", 10);
            onDiscover("tapes");
            playGolden();
          }, 500);
        }
      }
    };
    wake.current = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    draw();
    return () => {
      dispose();
      cancelAnimationFrame(raf);
      clearTimeout(resetTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const end = () => {
    grab.current = null;
    clearInterval(timer.current);
    stream.current?.stop();
    stream.current = null;
  };
  useOnHidden(end);

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none select-none"
      role="application"
      aria-label="テープをなぞってはがす"
      onPointerDown={(e) => {
        if (grab.current) return;
        const p = local(e);
        const { ys } = geom.current;
        const i = ys.findIndex((y, k) => Math.abs(p.y - y) <= STRIP_H / 2 + 6 && strips.current[k]?.state === "stuck");
        if (i < 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        grab.current = { i, id: e.pointerId, startX: p.x, startP: strips.current[i].p, t: performance.now() };
        lastMove.current = performance.now();
        clearInterval(timer.current);
        stream.current?.stop();
        stream.current = startTear();
        timer.current = setInterval(() => {
          if (performance.now() - lastMove.current > 150) stream.current?.set(0);
        }, 100);
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g || e.pointerId !== g.id) return;
        const { x0, x1 } = geom.current;
        const L = x1 - x0;
        const s = strips.current[g.i];
        const p = local(e);
        const now = performance.now();
        const np = Math.min(Math.max(g.startP + (p.x - g.startX), 0), L);
        const dp = np - s.p;
        if (dp > 0) {
          // 16pxはがれるごとに「ぺり」
          const crossings = Math.floor(np / 16) - Math.floor(s.p / 16);
          for (let k = 0; k < Math.min(3, crossings); k++) playPeelTick();
          stream.current?.set(Math.min(1, ((dp / Math.max(now - g.t, 1)) * 1000) / 1000));
          lastMove.current = now;
          // はがした距離に応じて経験値（100pxごとに+1）
          moved.current += dp;
          const units = Math.floor(moved.current / 100);
          if (units > 0) {
            moved.current -= units * 100;
            onTouch("hold", units);
          }
        } else if (dp < 0) {
          stream.current?.set(0.15); // 貼りなおしている
          lastMove.current = now;
        }
        s.p = np;
        g.t = now;

        if (np >= L - 4) {
          // 完全にはがれた
          s.state = "leaving";
          playTapeOff();
          onTouch("hold", 5);
          end();
          wake.current();
        }
        redraw.current();
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/* ======================= 切り替え ======================= */
export default function ZipStage({ onTouch, onDiscover }: StageProps) {
  const [mode, setMode] = useState<Mode>("zipper");
  return (
    <div className="relative flex-1 overflow-hidden">
      {mode === "zipper" ? (
        <ZipperMode onTouch={onTouch} onDiscover={onDiscover} />
      ) : (
        <TapeMode onTouch={onTouch} onDiscover={onDiscover} />
      )}
      <ChipBar items={MODES} value={mode} onSelect={(id) => setMode(id as Mode)} />
    </div>
  );
}
