import type { TouchMode, TouchResult } from "@/hooks/useGame";
import type { EffectId } from "@/lib/game";

/** すべてのオブジェクト画面が受け取る共通のprops */
export type StageProps = {
  /** amount は hold のときに入るXP（省略時1） */
  onTouch: (mode: TouchMode, amount?: number) => TouchResult;
  onDiscover: (id: string) => void;
  effect: EffectId;
};
