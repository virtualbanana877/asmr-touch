"use client";

import { useEffect, useRef, useState } from "react";
import { playPageLand, playPageTurn, setPan } from "@/lib/audio";
import type { StageProps } from "./stage";

const PAGES = 40;
const LAST = PAGES / 2 - 1; // 最後の見開き
const BLOCKS = ["#cfe3ee", "#f2d4c4", "#d9e6c8", "#e1d3ee"];

/** ページ1枚ぶん。文字の代わりに、ページ番号から決まる線と色のブロックを置く */
function PageFace({ n, side }: { n: number; side: "left" | "right" }) {
  const hasBlock = n % 4 === 1;
  return (
    <div className={`page-face ${side === "left" ? "page-left" : "page-right"}`}>
      <div className="page-bar" style={{ width: `${45 + ((n * 17) % 25)}%`, height: 8, marginBottom: 12, opacity: 0.8 }} />
      {hasBlock && (
        <div
          className="mb-3 rounded-md"
          style={{ height: "26%", background: BLOCKS[n % BLOCKS.length], opacity: 0.8 }}
        />
      )}
      {Array.from({ length: hasBlock ? 5 : 9 }, (_, i) => (
        <div key={i} className="page-bar" style={{ width: `${55 + ((n * 53 + i * 31) % 40)}%` }} />
      ))}
      <div className="page-num">{n + 1}</div>
    </div>
  );
}

type Anim = { dir: "next" | "prev"; dur: number };

export default function PagesStage({ onTouch, onDiscover }: StageProps) {
  const [spread, setSpread] = useState(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [go, setGo] = useState(false);
  const spreadRef = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const startRef = useRef<(dir: "next" | "prev", speed: number) => void>(() => {});
  const discoverRef = useRef(onDiscover);

  useEffect(() => {
    discoverRef.current = onDiscover;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  // 動き始めは角度を変えずに描いておき、次のフレームで変える（CSSの動きを起こすため）
  useEffect(() => {
    if (!anim) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    return () => cancelAnimationFrame(id);
  }, [anim]);

  const startFlip = (dir: "next" | "prev", speed: number) => {
    if (busy.current) return;
    const s = spreadRef.current;
    if (dir === "next" && s >= LAST) return;
    if (dir === "prev" && s <= 0) return;
    busy.current = true;

    const dur = Math.round(Math.max(320, Math.min(800, 700 - speed * 0.25))); // 速くめくるほど速く動く
    setPan(dir === "next" ? 0.5 : -0.5); // めくり始めは、めくる側から
    playPageTurn(speed / 1500);
    onTouch("hold", 2);
    setGo(false);
    setAnim({ dir, dur });

    timer.current = setTimeout(() => {
      const ns = dir === "next" ? s + 1 : s - 1;
      spreadRef.current = ns;
      setSpread(ns);
      setAnim(null);
      setGo(false);
      busy.current = false;
      setPan(dir === "next" ? -0.5 : 0.5); // 落ち着くのは反対側
      playPageLand();
      if (ns === LAST) discoverRef.current("bookend");
    }, dur + 40);
  };

  useEffect(() => {
    startRef.current = startFlip;
  });

  // PCでは矢印キーでもめくれる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") startRef.current("next", 400);
      else if (e.key === "ArrowLeft") startRef.current("prev", 400);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // いま見せるページ。めくっている間は、下から現れるページに差し替える
  const leftN = anim?.dir === "prev" ? 2 * spread - 2 : 2 * spread;
  const rightN = anim?.dir === "next" ? 2 * spread + 3 : 2 * spread + 1;
  const leaf =
    anim?.dir === "next"
      ? { front: 2 * spread + 1, back: 2 * spread + 2, from: 0, to: -180 }
      : { front: 2 * spread - 1, back: 2 * spread, from: -180, to: 0 };

  return (
    <div
      className="relative flex flex-1 touch-none select-none flex-col items-center justify-center overflow-hidden px-4"
      role="application"
      aria-label="本のページをめくる"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        const dt = Math.max(performance.now() - d.t, 1);
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          // スワイプ：左へ=次のページ、右へ=前のページ
          startFlip(dx < 0 ? "next" : "prev", (Math.abs(dx) / dt) * 1000);
        } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          // タップ：右半分=次、左半分=前
          const r = e.currentTarget.getBoundingClientRect();
          startFlip(e.clientX - r.left > r.width / 2 ? "next" : "prev", 400);
        }
      }}
      onPointerCancel={() => {
        down.current = null;
      }}
    >
      <div className="book-stage">
        <div className="book" style={{ width: "min(100%, 420px)", aspectRatio: "2 / 1.35" }}>
          <div className="book-cover" aria-hidden />
          <div className="page-slot" style={{ left: 0 }}>
            <PageFace n={leftN} side="left" />
          </div>
          <div className="page-slot" style={{ left: "50%" }}>
            <PageFace n={rightN} side="right" />
          </div>
          {anim && (
            <div
              className="leaf"
              style={{
                transform: `rotateY(${go ? leaf.to : leaf.from}deg)`,
                transition: go ? `transform ${anim.dur}ms cubic-bezier(0.45, 0.05, 0.3, 1)` : "none",
              }}
            >
              <div className="leaf-face">
                <PageFace n={leaf.front} side="right" />
              </div>
              <div className="leaf-face leaf-back">
                <PageFace n={leaf.back} side="left" />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-white/40">
        {spread * 2 + 1} – {spread * 2 + 2} / {PAGES}
      </p>
    </div>
  );
}
