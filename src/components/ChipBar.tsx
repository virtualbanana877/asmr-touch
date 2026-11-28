import type { ReactNode } from "react";

type Item = { id: string; label: string };
type Props = {
  items: readonly Item[];
  value: string;
  onSelect: (id: string) => void;
  children?: ReactNode;
};

/** 画面の上に重ねる素材えらび。ここを触っても、下の画面の操作は始まらない */
export default function ChipBar({ items, value, onSelect, children }: Props) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div
      className="absolute inset-x-3 top-3 z-10 flex flex-wrap gap-1.5"
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          aria-pressed={it.id === value}
          onClick={() => onSelect(it.id)}
          className={`rounded-full px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-film-lemon ${
            it.id === value ? "bg-film-cyan font-bold text-night" : "bg-shade/90 text-foam"
          }`}
        >
          {it.label}
        </button>
      ))}
      {children}
    </div>
  );
}
