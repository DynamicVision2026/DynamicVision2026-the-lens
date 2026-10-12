import { fontFamily, fontSize, type RenderMode } from '../tokens';
import type { Tokens } from '../types';

interface Props {
  /** Ends of the measured segment, in SVG units, lying on a box edge. */
  from: [number, number];
  to: [number, number];
  /** Unit vector pointing away from the box (SVG coordinates). */
  normal: [number, number];
  /** The number printed beside the bracket (from the bundle). */
  label: string;
  color: string;
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1: the bracket draws from `from` to `to`, then its number fades in. */
  t?: number;
  /** Distance from the box edge to the bracket line. */
  offset?: number;
  tick?: number;
  numberSize?: number;
  strokeWidth?: number;
}

/** Default distance from the box edge to the bracket line: clear of vertex letters by more than a tick. */
export const BRACKET_OFFSET = 34;

/** A dimension bracket outside the box, with its number, e.g. the base or height of a corner. */
export function Bracket({ from, to, normal, label, color, tokens, mode, t = 1, offset = BRACKET_OFFSET, tick = 5, numberSize, strokeWidth }: Props) {
  if (t <= 0) return null;
  const [nx, ny] = normal;
  const at = (p: [number, number], d: number): [number, number] => [p[0] + nx * d, p[1] + ny * d];
  const a = at(from, offset);
  const bFull = at(to, offset);
  const draw = Math.min(1, t / 0.7);
  const b: [number, number] = [a[0] + (bFull[0] - a[0]) * draw, a[1] + (bFull[1] - a[1]) * draw];
  const size = numberSize ?? fontSize(tokens, 'label', mode);
  // Beside a vertical bracket the number needs room for its width; above or below, for its height.
  const gap = nx !== 0 ? size * 0.3 + [...label].length * size * 0.32 : size * 0.75;
  const mid = at([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], offset + gap);
  return (
    <g stroke={color} strokeWidth={strokeWidth ?? tokens.stroke.lens_construction.width} strokeLinecap={tokens.stroke.cap} fill="none">
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      <line x1={a[0] - nx * tick} y1={a[1] - ny * tick} x2={a[0] + nx * tick} y2={a[1] + ny * tick} />
      {draw >= 1 && <line x1={bFull[0] - nx * tick} y1={bFull[1] - ny * tick} x2={bFull[0] + nx * tick} y2={bFull[1] + ny * tick} />}
      <text
        x={mid[0]}
        y={mid[1]}
        stroke="none"
        fill={color}
        opacity={Math.max(0, (t - 0.7) / 0.3)}
        fontFamily={fontFamily(tokens, undefined, 'family_num')}
        fontSize={size}
        fontWeight={tokens.type.scale.title.weight}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}
