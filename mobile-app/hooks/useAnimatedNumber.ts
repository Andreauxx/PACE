// ============================================================
// AgriSweep — useAnimatedNumber
// Eases a number toward its target using requestAnimationFrame.
// Used for SVG gauges, which can't be driven by Animated values
// identically on iOS, Android and web.
// ============================================================

import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, durationMs: number = 700): number {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const from = currentRef.current;
    if (from === target) return;
    const startedAt = Date.now();
    let frame = 0;

    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from + (target - from) * eased;
      currentRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
