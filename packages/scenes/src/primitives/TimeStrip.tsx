import { clamp01 } from '../easing';
import { timeLabel } from '../format';
import { color, fontFamily, fontSize, lensColor, type LensOrDirect, type RenderMode } from '../tokens';
import type { Route, Tokens } from '../types';

interface Props {
  trap: Route;
  lens: Route;
  lensId: LensOrDirect;
  x: number;
  y: number;
  width: number;
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1: the trap bar grows to its time, then the lens bar. */
  t?: number;
}

/** Trap vs lens time bars with labels and the 目安 / 実測 source badge. */
export function TimeStrip({ trap, lens, lensId, x, y, width, tokens, mode, t = 1 }: Props) {
  const tc = tokens.time_cost;
  const size = fontSize(tokens, 'label', mode);
  const labelW = size * 6;
  const barW = width - labelW;
  const max = Math.max(trap.time_cost_sec, lens.time_cost_sec, 1);
  const rowH = Math.max(tc.bar_height * 2, size) + size * 0.6;
  const trapP = clamp01(t * 2);
  const lensP = clamp01(t * 2 - 1);
  const numFont = fontFamily(tokens, undefined, 'family_num');
  const jaFont = fontFamily(tokens, undefined, 'family_ja');
  const rows = [
    { route: trap, p: trapP, fill: color(tokens.color.trap.flag, mode), label: timeLabel(tc.trap_label_ja, trap.time_cost_sec) },
    { route: lens, p: lensP, fill: lensColor(tokens, lensId, mode), label: timeLabel(tc.lens_label_ja, lens.time_cost_sec) },
  ];
  const sources = new Set([trap.time_source, lens.time_source]);
  const badge = [...sources].map((s) => tc.source_badge[s]).join(' / ');
  const ink = color(tokens.color.ink, mode);
  return (
    <g>
      {rows.map(({ route, p, fill, label }, i) => {
        const cy = y + i * rowH + rowH / 2;
        return (
          <g key={i}>
            <rect x={x} y={cy - tc.bar_height} width={(barW * route.time_cost_sec * p) / max} height={tc.bar_height * 2} fill={fill} />
            {p > 0 && (
              <text x={x + (barW * route.time_cost_sec * p) / max + size * 0.4} y={cy} fill={ink} fontFamily={numFont} fontSize={size} dominantBaseline="central">
                {label}
              </text>
            )}
          </g>
        );
      })}
      <g opacity={lensP}>
        <rect x={x + width - size * 3.2} y={y + rowH * 2} width={size * 3.2} height={size * 1.5} rx={size * 0.3} fill="none" stroke={color(tokens.color.ink_quiet, mode)} strokeWidth={tokens.stroke.grid_major.width} />
        <text x={x + width - size * 1.6} y={y + rowH * 2 + size * 0.75} fill={color(tokens.color.ink_quiet, mode)} fontFamily={jaFont} fontSize={size} textAnchor="middle" dominantBaseline="central">
          {badge}
        </text>
        <text x={x} y={y + rowH * 2 + size * 0.75} fill={ink} fontFamily={jaFont} fontSize={size} fontWeight={tokens.type.scale.label.weight} dominantBaseline="central">
          {timeLabel(tc.saved_label_ja, trap.time_cost_sec - lens.time_cost_sec)}
        </text>
      </g>
    </g>
  );
}
