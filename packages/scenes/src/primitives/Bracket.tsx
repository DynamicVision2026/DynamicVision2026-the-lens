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
}

/** Distance from the box edge to the bracket line: clear of vertex letters by more than a tick. */
export const BRACKET_OFFSET = 34;
const TICK = 5;

/** A dimension bracket outside the box, with its number, e.g. the base or height of a corner. */
export function Bracket({ from, to, normal, label, color, tokens, mode, t = 1 }: Props) {
  if (t <= 0) return null;
  const [nx, ny] = normal;
  const at = (p: [number, number], d: number): [number, number] => [p[0] + nx * d, p[1] + ny * d];
  const a = at(from, BRACKET_OFFSET);
  const bFull = at(to, BRACKET_OFFSET);
  const draw = Math.min(1, t / 0.7);
  const b: [number, number] = [a[0] + (bFull[0] - a[0]) * draw, a[1] + (bFull[1] - a[1]) * draw];
  const size = fontSize(tokens, 'label', mode);
  const mid = at([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], BRACKET_OFFSET + size * 0.9);
  const width = tokens.stroke.lens_construction.width;
  return (
    <g stroke={color} strokeWidth={width} strokeLinecap={tokens.stroke.cap} fill="none">
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      <line x1={a[0] - nx * TICK} y1={a[1] - ny * TICK} x2={a[0] + nx * TICK} y2={a[1] + ny * TICK} />
      {draw >= 1 && (
        <line x1={bFull[0] - nx * TICK} y1={bFull[1] - ny * TICK} x2={bFull[0] + nx * TICK} y2={bFull[1] + ny * TICK} />
      )}
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
