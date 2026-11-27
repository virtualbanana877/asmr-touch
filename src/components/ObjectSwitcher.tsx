import { UNLOCKS, type ObjectId } from "@/lib/game";

const OBJECTS = UNLOCKS.filter((u) => u.kind === "object");

type Props = { level: number; current: ObjectId; onSelect: (id: ObjectId) => void };

export default function ObjectSwitcher({ level, current, onSelect }: Props) {
  return (
    <nav aria-label="さわるもの" className="flex gap-2 overflow-x-auto px-5 pb-2">
      {OBJECTS.map((o) => {
        const open = o.level <= level;
        const active = o.id === current;
        return (
          <button
            key={o.id}
            type="button"
            disabled={!open}
            aria-pressed={active}
            onClick={() => onSelect(o.id as ObjectId)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-lemon ${
              active
                ? "bg-film-cyan font-bold text-night"
                : open
                  ? "bg-shade text-foam"
                  : "bg-white/5 text-white/30"
            }`}
          >
            {open ? o.name : `Lv.${o.level}`}
          </button>
        );
      })}
    </nav>
  );
}
