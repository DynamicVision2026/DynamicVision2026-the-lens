import { type Level, keyOf } from "../lib/ladder";
import type { ColorKey } from "../lib/territory";

/** Column height of the glyph per ladder step: rises with the step, as on the map. */
const GLYPH_H: Record<Level, number> = { 0: 1.5, 1: 3.5, 2: 5.5, 3: 7.5, 4: 9.5 };

/**
 * One territory tile as a small icon (legend, sheet): a hex column in the step's look —
 * まだ flat and pale, 挑戦中 low with a red flag, 復習ずみ mid in its colour,
 * マスター tall in gold with a star, 定着 tallest in gold with a crown and a light cap.
 * Colours come from tokens via CSS classes.
 */
export function TerrGlyph({ level, color = "num", size = 28 }: { level: Level; color?: ColorKey; size?: number }) {
  const h = GLYPH_H[level];
  const top = 20 - h; // top face centre y (the base stays at the same place for every step)
  const hex = (cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = ((-90 + 60 * i) * Math.PI) / 180;
      return `${(14 + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r * 0.72).toFixed(2)}`;
    }).join(" ");
  const pt = (cy: number, i: number, r = 10) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return `${(14 + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r * 0.72).toFixed(2)}`;
  };
  return (
    <svg className={`tg tg-${keyOf(level)} tc-${color}`} viewBox="0 0 28 28" width={size} height={size} aria-hidden focusable="false" data-level={level}>
      {level === 4 && <polygon className="tg-glow" points={hex(top, 12.6)} />}
      <polygon className="tg-left" points={`${pt(top, 3)} ${pt(top, 4)} ${pt(top + h, 4)} ${pt(top + h, 3)}`} />
      <polygon className="tg-right" points={`${pt(top, 2)} ${pt(top, 3)} ${pt(top + h, 3)} ${pt(top + h, 2)}`} />
      <polygon className="tg-body" points={hex(top, 10)} />
      <polygon className="tg-cap" points={hex(top, 8.2)} />
      {level === 1 && (
        <g className="tg-flag">
          <path className="tg-pole" d={`M14 ${top}V1`} />
          <path d="M14.4 1h7l-2 2.6 2 2.6h-7z" />
        </g>
      )}
      {level === 3 && <path className="tg-star" d={`M14 ${top - 4.5}l1.2 2.6 2.8.3-2.1 1.9.6 2.8L14 ${top + 1.2}l-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z`} />}
      {level === 4 && <path className="tg-crown" d={`M9 ${top + 1.2}l-.6-5 2.9 2.3L14 ${top - 5.6}l2.7 4.9 2.9-2.3-.6 5z`} />}
    </svg>
  );
}
