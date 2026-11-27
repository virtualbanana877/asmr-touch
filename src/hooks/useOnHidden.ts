"use client";

import { useEffect, useRef } from "react";

/** 別のタブ・アプリに移ったとき（や、ウィンドウがフォーカスを失ったとき）に呼ばれる */
export function useOnHidden(cb: () => void) {
  const ref = useRef(cb);

  useEffect(() => {
    ref.current = cb;
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) ref.current();
    };
    const onBlur = () => ref.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onBlur);
    };
  }, []);
}
