"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { playPop } from "@/lib/audio";
import {
  asEffect,
  EFFECT_STYLE,
  KIND_LABEL,
  KIND_ORDER,
  SECRETS,
  THEME_SWATCH,
  UNLOCKS,
  type ThemeId,
  type SoundId,
} from "@/lib/game";

export default function CollectionPage() {
  const { save, select } = useGame();

  const ownedCount = UNLOCKS.filter((u) => u.level <= save.level).length;
  const foundCount = SECRETS.filter((s) => save.found.includes(s.id)).length;
  const total = UNLOCKS.length + SECRETS.length;
  const currentEffect = asEffect(save.effect);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6">
      <Link href="/" className="text-sm text-white/70">
        ← 触りにいく
      </Link>
      <h1 className="mt-4 text-2xl font-bold">コレクション</h1>
      <p className="mt-1 text-sm text-white/60">
        {ownedCount + foundCount} / {total} 集めた ・ 最高 {save.bestCombo} コンボ
      </p>

      {KIND_ORDER.map((kind) => {
        const items = UNLOCKS.filter((u) => u.kind === kind);
        const open = items.filter((u) => u.level <= save.level).length;
        return (
          <section key={kind} className="mt-8">
            <h2 className="flex items-baseline justify-between text-lg font-bold">
              {KIND_LABEL[kind]}
              <span className="text-sm font-normal text-white/50">
                {open} / {items.length}
              </span>
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {items.map((u) => {
                const unlocked = u.level <= save.level;
                const inUse =
                  (kind === "theme" && save.theme === u.id) || (kind === "effect" && currentEffect === u.id);
                return (
                  <li key={u.id} className={`rounded-2xl p-4 ${unlocked ? "bg-shade" : "bg-white/5"}`}>
                    {unlocked ? (
                      <>
                        {kind === "theme" && (
                          <div
                            className="mb-2 h-8 rounded-lg border border-white/15"
                            style={{ background: THEME_SWATCH[u.id as ThemeId] }}
                          />
                        )}
                        {kind === "effect" && (
                          <p className="mb-1 text-2xl text-film-pink" aria-hidden>
                            {EFFECT_STYLE[u.id as keyof typeof EFFECT_STYLE].sample}
                          </p>
                        )}
                        <p className="font-bold text-film-cyan">{u.name}</p>
                        <p className="mt-1 text-sm text-white/70">{u.desc}</p>

                        {kind === "sound" && (
                          <button
                            type="button"
                            onClick={() => playPop(u.id as SoundId, 1)}
                            className="mt-3 rounded-full bg-white/10 px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-film-lemon"
                          >
                            聴く
                          </button>
                        )}
                        {(kind === "theme" || kind === "effect") &&
                          (inUse ? (
                            <p className="mt-3 text-sm text-film-lemon">つかっている</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => select(kind as "theme" | "effect", u.id)}
                              className="mt-3 rounded-full bg-white/10 px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-film-lemon"
                            >
                              つかう
                            </button>
                          ))}
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-white/30">？？？</p>
                        <p className="mt-1 text-sm text-white/40">Lv.{u.level} で解放</p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="mt-8">
        <h2 className="flex items-baseline justify-between text-lg font-bold">
          ひみつ
          <span className="text-sm font-normal text-white/50">
            {foundCount} / {SECRETS.length}
          </span>
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {SECRETS.map((s) => {
            const found = save.found.includes(s.id);
            return (
              <li key={s.id} className={`rounded-2xl p-4 ${found ? "bg-shade" : "bg-white/5"}`}>
                {found ? (
                  <>
                    <p className="font-bold text-film-lemon">{s.name}</p>
                    <p className="mt-1 text-sm text-white/70">{s.note}</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-white/30">？？？</p>
                    <p className="mt-1 text-sm text-white/40">ヒント: {s.hint}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
