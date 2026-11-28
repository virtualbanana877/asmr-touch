"use client";

import { useEffect, useRef } from "react";
import { playKey, setPan } from "@/lib/audio";
import type { StageProps } from "./stage";

const ROWS = [
  { label: "リニア", keys: ["ぷ", "ち", "ぽ", "こ"] },
  { label: "クリッキー", keys: ["か", "た", "ん", "ぴ"] },
  { label: "タクタイル", keys: ["と", "ろ", "ふ", "わ"] },
];
const RATES = [1, 1.122, 1.26, 1.498];
const SPACE = 12;

export default function KeysStage({ onTouch, onDiscover }: StageProps) {
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const count = useRef(0);
  const pressRef = useRef<(id: number) => void>(() => {});

  const press = (id: number) => {
    const res = onTouch("tap");
    const row = id === SPACE ? 3 : Math.floor(id / 4);
    setPan(id === SPACE ? 0 : ((id % 4) / 3) * 1.4 - 0.7); // 列の位置から聞こえる
    playKey(row, res.combo, id === SPACE ? 0.8 : RATES[id % 4]);
    count.current += 1;
    if (count.current >= 50) onDiscover("typist");
  };

  useEffect(() => {
    pressRef.current = press;
  });

  // PCでは実際のキーボードでも打てる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      let id: number;
      if (e.code === "Space") id = SPACE;
      else if (e.key.length === 1) id = e.key.toLowerCase().charCodeAt(0) % 12;
      else return;
      pressRef.current(id);
      const el = els.current[id];
      if (el) {
        el.dataset.down = "1";
        setTimeout(() => {
          delete el.dataset.down;
        }, 90);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const keyProps = (id: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      els.current[id] = el;
    },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.dataset.down = "1";
      press(id);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      delete e.currentTarget.dataset.down;
    },
    onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
      delete e.currentTarget.dataset.down;
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      delete e.currentTarget.dataset.down;
    },
  });

  return (
    <div className="flex flex-1 touch-none select-none flex-col justify-center gap-4 px-5">
      {ROWS.map((row, ri) => (
        <div key={row.label}>
          <p className="mb-1.5 text-xs text-white/45">{row.label}</p>
          <div className="grid grid-cols-4 gap-2">
            {row.keys.map((k, ci) => (
              <button key={k + ci} type="button" className="keycap" aria-label={`${row.label}のキー ${k}`} {...keyProps(ri * 4 + ci)}>
                {k}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-1.5 text-xs text-white/45">ことん</p>
        <button type="button" className="keycap w-full" aria-label="スペースキー" {...keyProps(SPACE)}>
          &nbsp;
        </button>
      </div>
    </div>
  );
}
