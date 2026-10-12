// A damped spring as a pure function of elapsed time, configured by `motion.spring`.
// Same physics as Remotion's spring(), but needs no frame context, so /dev/scenes and the
// Short evaluate it from the same t.
import type { SpringToken } from './types';

/** Position of a spring released from 0 towards 1, `ms` after release. 0 before release. */
export function springAt(ms: number, cfg: SpringToken): number {
  if (ms <= 0) return 0;
  const s = ms / 1000;
  const w0 = Math.sqrt(cfg.stiffness / cfg.mass);
  const zeta = cfg.damping / (2 * Math.sqrt(cfg.stiffness * cfg.mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * s) * (Math.cos(wd * s) + ((zeta * w0) / wd) * Math.sin(wd * s));
  }
  // Critically or over-damped: no overshoot.
  return 1 - Math.exp(-w0 * s) * (1 + w0 * s);
}
