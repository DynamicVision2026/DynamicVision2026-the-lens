import type { TileStatus } from "../lib/review";
import type { ColorKey } from "../lib/territory";

/**
 * One territory tile as a small icon (legend, sheet): a hex column in the state's look —
 * まだ flat and pale, 復習ずみ raised in its colour, 復習が必要 raised with a red flag,
 * マスター taller in gold with a star. Colours come from tokens via CSS classes.
 */
export function TerrGlyph({ status, color = "num", size = 28 }: { status: TileStatus; color?: ColorKey; size?: number }) {
  const h = status === "empty" ? 1.5 : status === "gold" ? 9 : 6;
  const top = 15 - h; // top face centre y
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
    <svg className={`tg tg-${status} tc-${color}`} viewBox="0 0 28 28" width={size} height={size} aria-hidden focusable="false">
      <polygon className="tg-left" points={`${pt(top, 3)} ${pt(top, 4)} ${pt(top + h, 4)} ${pt(top + h, 3)}`} />
      <polygon className="tg-right" points={`${pt(top, 2)} ${pt(top, 3)} ${pt(top + h, 3)} ${pt(top + h, 2)}`} />
      <polygon className="tg-body" points={hex(top, 10)} />
      <polygon className="tg-cap" points={hex(top, 8.2)} />
      {status === "review" && (
        <g className="tg-flag">
          <path className="tg-pole" d={`M14 ${top}V1`} />
          <path d="M14.4 1h7l-2 2.6 2 2.6h-7z" />
        </g>
      )}
      {status === "gold" && <path className="tg-star" d={`M14 ${top - 4.5}l1.2 2.6 2.8.3-2.1 1.9.6 2.8L14 ${top + 1.2}l-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z`} />}
    </svg>
  );
}
