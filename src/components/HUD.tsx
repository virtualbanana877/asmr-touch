import type { CSSProperties } from "react";

type Props = {
  level: number;
  title: string;
  xp: number;
  need: number;
  combo: number;
  windowMs: number;
};

export default function HUD({ level, title, xp, need, combo, windowMs }: Props) {
  const pct = Math.min(100, Math.round((xp / need) * 100));
  return (
    <header className="px-5 pt-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold">Lv.{level}</p>
          {title && <p className="text-sm text-white/55">{title}</p>}
        </div>
        <p className="text-sm text-white/60">
          {xp} / {need} XP
        </p>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={xp}
        aria-label="経験値"
      >
        <div
          className="h-full rounded-full bg-film-cyan transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 高さを固定してコンボ表示の出入りでレイアウトが動かないようにする */}
      <div className="mt-3 flex h-9 items-center gap-3">
        {combo >= 2 && (
          <>
            <p key={combo} className="combo-num text-2xl font-bold text-film-lemon">
              {combo}
              <span className="ml-1 text-sm font-normal text-white/70">コンボ</span>
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                key={combo}
                className="combo-timer h-full w-full origin-left rounded-full bg-film-lemon"
                style={{ "--combo-ms": `${windowMs}ms` } as CSSProperties}
              />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
