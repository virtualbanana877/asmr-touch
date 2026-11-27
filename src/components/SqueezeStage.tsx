"use client";

import { useEffect, useRef, useState } from "react";
import { useOnHidden } from "@/hooks/useOnHidden";
import { rand, useParticles } from "@/hooks/useParticles";
import { playCrack, playPuni, playWaxBreak } from "@/lib/audio";
import type { StageProps } from "./stage";

const STEPS = 12; // 握りこみを12段階に区切り、段階をまたぐたびに「パキッ」
const WAX_COLOR = "#f7c3d9";
const WAX_PER_CRACK = 0.016; // 強いパキッ1回で減るロウの量（約60回で全部割れる）
const RECOAT_MS = 4000; // 触らないままこの時間がたつと、ロウがまた塗られる
const MAX_CRACKS = 28;

/** ひび割れの線を1本つくる（0〜100の座標のSVGパス） */
const makeCrack = (): string => {
  let x = 15 + Math.random() * 70;
  let y = 12 + Math.random() * 76;
  let a = Math.random() * Math.PI * 2;
  let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  const segs = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < segs; i++) {
    a += (Math.random() - 0.5) * 1.4;
    const len = 6 + Math.random() * 10;
    x += Math.cos(a) * len;
    y += Math.sin(a) * len;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

export default function SqueezeStage({ onTouch, onDiscover, effect }: StageProps) {
  const { containerRef, canvasRef, sparkle, chips } = useParticles(effect);
  const ballRef = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);
  const depth = useRef(0); // 0=自然な形 / 1=いっぱいに握った
  const vel = useRef(0);
  const lastStep = useRef(0);
  const wake = useRef<() => void>(() => {});
  const total = useRef(0);
  const wiggle = useRef(0);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const crackRef = useRef<(strong: boolean) => void>(() => {});
  const waxLeft = useRef(1); // ロウの残り 1→0
  const touchedAt = useRef(0);
  const [wax, setWax] = useState(1);
  const [cracks, setCracks] = useState<string[]>([]);

  const crack = (strong: boolean) => {
    touchedAt.current = performance.now();
    const s = containerRef.current!.getBoundingClientRect();
    const b = ballRef.current!.getBoundingClientRect();
    const px = b.left - s.left + rand(0.2, 0.8) * b.width;
    const py = b.top - s.top + rand(0.15, 0.85) * b.height;

    if (waxLeft.current > 0) {
      playCrack(strong);
      if (strong) {
        waxLeft.current = Math.max(0, waxLeft.current - WAX_PER_CRACK);
        setWax(waxLeft.current);
        setCracks((c) => [...c.slice(-(MAX_CRACKS - 1)), makeCrack()]);
      }
      chips(px, py, strong ? 2 : 1, WAX_COLOR);

      if (waxLeft.current === 0) {
        // ロウが全部割れた
        playWaxBreak();
        chips(b.left - s.left + b.width / 2, b.top - s.top + b.height / 2, 16, WAX_COLOR);
        onTouch("hold", 10);
        onDiscover("waxbreak");
      }
    } else {
      playPuni(strong); // 中身のふにゅふにゅ
      sparkle(px, py, 2);
    }

    total.current += 1;
    if (strong && total.current % 2 === 0) onTouch("hold", 1); // 2回に1回、経験値
    if (total.current >= 100) onDiscover("pakipaki");
  };

  useEffect(() => {
    crackRef.current = crack;
  });

  // 握りこみのアニメーション
  useEffect(() => {
    let last = 0;
    let running = false;
    let raf = 0;

    const apply = () => {
      const el = ballRef.current;
      if (el) el.style.transform = `scale(${1 + depth.current * 0.26}, ${1 - depth.current * 0.32})`;
    };

    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.033);
      last = t;

      if (pressing.current) {
        depth.current = Math.min(1, depth.current + dt / 0.9); // 約0.9秒で握りきる
        vel.current = 0;
      } else {
        // 離すとバネで戻り、少しふくらんでから落ち着く
        const acc = -170 * depth.current - 11 * vel.current;
        vel.current += acc * dt;
        depth.current += vel.current * dt;
      }
      apply();

      const step = Math.max(0, Math.floor(depth.current * STEPS));
      if (step !== lastStep.current) {
        const diff = step - lastStep.current;
        const n = Math.min(3, Math.abs(diff));
        for (let i = 0; i < n; i++) crackRef.current(diff > 0); // 握る=強く、戻る=やさしく
        lastStep.current = step;
      }

      if (pressing.current || Math.abs(depth.current) > 0.003 || Math.abs(vel.current) > 0.02) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        depth.current = 0;
        lastStep.current = 0;
        apply();
      }
    };

    wake.current = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    return () => cancelAnimationFrame(raf);
  }, []);

  // ロウが全部とれたまま触らないでいると、ロウがまた塗られる
  useEffect(() => {
    const id = setInterval(() => {
      if (waxLeft.current === 0 && !pressing.current && performance.now() - touchedAt.current > RECOAT_MS) {
        waxLeft.current = 1;
        setWax(1);
        setCracks([]);
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  const press = (x: number, y: number) => {
    if (pressing.current) return;
    pressing.current = true;
    lastPos.current = { x, y };
    wiggle.current = 0;
    touchedAt.current = performance.now();
    onTouch("tap");
    crack(true);
    wake.current();
  };

  const release = () => {
    if (!pressing.current) return;
    pressing.current = false;
    lastPos.current = null;
    touchedAt.current = performance.now();
    wake.current();
  };

  // 別のタブに移ったら、握るのをやめる
  useOnHidden(release);

  return (
    <div ref={containerRef} className="relative flex-1 touch-none select-none overflow-hidden">
      <div className="absolute inset-0 grid place-items-center">
        <div
          ref={ballRef}
          role="button"
          tabIndex={0}
          aria-label="ロウつきスクイーズを握る"
          className="squeeze"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            press(e.clientX, e.clientY);
          }}
          // 握ったまま動かすと、ひねった分だけパキッと鳴る
          onPointerMove={(e) => {
            const prev = lastPos.current;
            if (!pressing.current || !prev) return;
            wiggle.current += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
            lastPos.current = { x: e.clientX, y: e.clientY };
            if (wiggle.current >= 40) {
              wiggle.current -= 40;
              crack(true);
            }
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              press(0, 0);
            }
          }}
          onKeyUp={release}
        >
          <div className="squeeze-wax" style={{ opacity: wax <= 0 ? 0 : 0.3 + 0.7 * wax }} aria-hidden>
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              {cracks.map((d, i) => (
                <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d={d} stroke="rgba(120,40,80,0.4)" strokeWidth="2" />
                  <path d={d} stroke="rgba(255,255,255,0.9)" strokeWidth="0.9" />
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
