"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UNLOCKS } from "@/lib/game";
import { DEFAULT_SAVE, loadSave, type SaveData } from "@/lib/storage";

const KIND_LABEL = { object: "オブジェクト", sound: "音" } as const;

export default function CollectionPage() {
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);

  useEffect(() => {
    setSave(loadSave());
  }, []);

  const owned = UNLOCKS.filter((u) => u.level <= save.level).length;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6">
      <Link href="/" className="text-sm text-white/70">
        ← 触りにいく
      </Link>
      <h1 className="mt-4 text-2xl font-bold">コレクション</h1>
      <p className="mt-1 text-sm text-white/60">
        {owned} / {UNLOCKS.length} 解放済み ・ 最高 {save.bestCombo} コンボ
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3">
        {UNLOCKS.map((u) => {
          const open = u.level <= save.level;
          return (
            <li key={u.id} className={`rounded-2xl p-4 ${open ? "bg-shade" : "bg-white/5"}`}>
              <p className="text-xs text-white/50">{KIND_LABEL[u.kind]}</p>
              {open ? (
                <>
                  <p className="mt-1 font-bold text-film-cyan">{u.name}</p>
                  <p className="mt-1 text-sm text-white/70">{u.desc}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 font-bold text-white/30">？？？</p>
                  <p className="mt-1 text-sm text-white/40">Lv.{u.level} で解放</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
