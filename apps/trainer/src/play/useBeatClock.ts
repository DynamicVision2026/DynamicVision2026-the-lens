import { beatAt, timelineDuration, type Beat } from '@lens/scenes';
import { useEffect, useState } from 'react';

/**
 * Drives (beat, t) from requestAnimationFrame, starting at beat `from`. With reduced motion it jumps
 * straight to the end state. The scene itself stays a pure function of what this returns.
 */
export function useBeatClock(beats: Beat[] | null, from: number, running: boolean, reducedMotion: boolean) {
  const offset = beats ? timelineDuration(beats.slice(0, from)) : 0;
  const total = beats ? timelineDuration(beats) : 0;
  const [ms, setMs] = useState(offset);

  useEffect(() => {
    if (!beats || !running) return;
    if (reducedMotion) {
      setMs(total);
      return;
    }
    let raf = 0;
    const start = performance.now() - (ms - offset);
    const tick = (now: number) => {
      const next = Math.min(total, offset + (now - start));
      setMs(next);
      if (next < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Restart only when the run starts or the beats change.
  }, [beats, running, reducedMotion]);

  const { index, t } = beats ? beatAt(beats, ms) : { index: 0, t: 1 };
  return { index, t, done: ms >= total };
}
