import { apexXAt, bandTriangles, meetingX, type BandLayout } from '../band';
import { formatExact } from '../format';
import type { ParallelBandFigure, Tokens } from '../types';
import { Bracket } from './Bracket';

export interface BandFigureProps {
  fig: ParallelBandFigure;
  layout: BandLayout;
  tokens: Tokens;
  /** Colours already resolved for the theme. */
  ink: string;
  accent: string;
  palette: string[];
  font: string;
  weight: number;
  /** Sizes for this surface (scene units). */
  labelSize: number;
  figureStroke: number;
  lensStroke: number;
  bracket: { offset: number; tick: number; numberSize: number; strokeWidth: number };
  /** 0–1 fade-in of the whole figure. */
  show: number;
  /** 0–1: the ∥ marks pulse and the gap bracket turns to the lens colour. */
  parallel: number;
  /** Per apex, 0–1 of the way to the meeting point. */
  slid: number[];
  /** 0–1: the merged triangle's outline in the lens colour. */
  merged: number;
  /** Triangle on screen in a study beat (others dim), or -1. */
  focus: number;
  dim: number;
  /** Triangle style: a faint tint, plus stripes in the full colour when given (keeps hues true on navy). */
  tint: number;
  stripes?: { angle_deg: number; stripe_px: number; period_px: number; opacity: number };
  idPrefix: string;
  glowFilter?: string;
  glowOpacity?: number;
}

const PARALLEL_MARK = 0.9; // chevron size, in label sizes
/** Room to keep at each end of the lines (in label sizes) for the ∥ chevron and the line names. */
export const BAND_END_ROOM = 3.6;

/**
 * The parallel-band figure: lines ℓ and m with ∥ marks, the coloured triangles, the point labels,
 * and only the lengths the problem gives (AD below m, the gap beside the band). Never the
 * individual bases.
 */
export function BandFigure(p: BandFigureProps) {
  const { fig, layout: L, ink, accent, palette, labelSize: size } = p;
  if (p.show <= 0) return null;
  const n = bandTriangles(fig);
  const apexX = (i: number) => L.x(apexXAt(fig, i, p.slid[i] ?? 0));
  const tri = (i: number) => `${L.x(fig.bottom_x[i]!)},${L.mY} ${L.x(fig.bottom_x[i + 1]!)},${L.mY} ${apexX(i)},${L.lY}`;
  const colour = (i: number) => palette[i % palette.length]!;
  const chevron = (y: number) => {
    const cx = L.lineRight - size * 2.4;
    const c = size * PARALLEL_MARK * (1 + 0.25 * Math.sin(Math.PI * p.parallel));
    return `M ${cx - c / 2} ${y - c / 2} L ${cx + c / 2} ${y} L ${cx - c / 2} ${y + c / 2}`;
  };
  const left = Math.min(...fig.bottom_x.map(L.x), ...fig.apex_x.map(L.x));
  const labelGap = size * 0.9;

  return (
    <g opacity={p.show}>
      {/* Triangles first, so the lines and labels sit on top. */}
      {Array.from({ length: n }, (_, i) => {
        const c = colour(i);
        const level = p.focus >= 0 && p.focus !== i ? p.dim : 1;
        const id = `${p.idPrefix}-band-${i}`;
        return (
          <g key={`t${i}`} opacity={level}>
            {p.stripes && (
              <defs>
                <pattern id={id} patternUnits="userSpaceOnUse" width={p.stripes.period_px} height={p.stripes.period_px} patternTransform={`rotate(${p.stripes.angle_deg})`}>
                  <rect x={0} y={0} width={p.stripes.stripe_px} height={p.stripes.period_px} fill={c} />
                </pattern>
              </defs>
            )}
            <polygon points={tri(i)} fill={c} fillOpacity={p.tint} stroke="none" />
            {p.stripes && <polygon points={tri(i)} fill={`url(#${id})`} opacity={p.stripes.opacity} stroke="none" />}
            <polygon points={tri(i)} fill="none" stroke={c} strokeWidth={p.focus === i ? p.lensStroke : p.figureStroke} strokeLinejoin="round" />
          </g>
        );
      })}

      {/* The two parallel lines, full width, with ∥ chevrons and their names. */}
      <g stroke={ink} strokeWidth={p.figureStroke} strokeLinecap="round" fill="none">
        <line x1={L.lineLeft} y1={L.lY} x2={L.lineRight} y2={L.lY} />
        <line x1={L.lineLeft} y1={L.mY} x2={L.lineRight} y2={L.mY} />
        <path d={chevron(L.lY)} stroke={p.parallel > 0 ? accent : ink} />
        <path d={chevron(L.mY)} stroke={p.parallel > 0 ? accent : ink} />
      </g>
      <g fill={ink} fontFamily={p.font} fontSize={size} fontStyle="italic" dominantBaseline="central">
        <text x={L.lineRight - size * 0.4} y={L.lY - size * 0.8} textAnchor="end">ℓ</text>
        <text x={L.lineRight - size * 0.4} y={L.mY + size * 0.8} textAnchor="end">m</text>
      </g>

      {/* The merged triangle: base AD, apex at the meeting point. */}
      {p.merged > 0 && (
        <g filter={p.glowFilter} opacity={p.merged * (p.glowFilter ? (p.glowOpacity ?? 1) : 1)}>
          <polygon
            points={`${L.x(fig.bottom_x[0]!)},${L.mY} ${L.x(fig.bottom_x[n]!)},${L.mY} ${L.x(meetingX(fig))},${L.lY}`}
            fill="none"
            stroke={accent}
            strokeWidth={p.lensStroke}
            strokeLinejoin="round"
          />
        </g>
      )}
      {p.merged > 0 && p.glowFilter && (
        <polygon
          points={`${L.x(fig.bottom_x[0]!)},${L.mY} ${L.x(fig.bottom_x[n]!)},${L.mY} ${L.x(meetingX(fig))},${L.lY}`}
          fill="none"
          stroke={accent}
          strokeWidth={p.lensStroke}
          strokeLinejoin="round"
          opacity={p.merged}
        />
      )}

      {/* Point labels: A, B, C, D below m; P, Q, R above ℓ (sliding apexes fade into the first). */}
      <g fill={ink} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
        {fig.bottom_x.map((x, i) => (
          <text key={`b${i}`} x={L.x(x)} y={L.mY + labelGap}>
            {fig.point_labels.bottom[i] ?? ''}
          </text>
        ))}
        {fig.apex_x.slice(0, n).map((_, i) => (
          <text key={`a${i}`} x={apexX(i)} y={L.lY - labelGap} opacity={i === 0 ? 1 : 1 - (p.slid[i] ?? 0)}>
            {fig.point_labels.apex[i] ?? ''}
          </text>
        ))}
      </g>

      {/* Only the lengths the problem gives. */}
      {fig.shown.total_base && (
        <Bracket
          from={[L.x(fig.bottom_x[0]!), L.mY]}
          to={[L.x(fig.bottom_x[n]!), L.mY]}
          normal={[0, 1]}
          label={formatExact(fig.total_base)}
          color={ink}
          tokens={p.tokens}
          offset={Math.max(p.bracket.offset, labelGap + size)}
          tick={p.bracket.tick}
          numberSize={p.bracket.numberSize}
          strokeWidth={p.bracket.strokeWidth}
        />
      )}
      {fig.shown.band_height && (
        <g>
          <g opacity={1 - p.parallel}>
            <Bracket from={[left, L.mY]} to={[left, L.lY]} normal={[-1, 0]} label={String(fig.band_height)} color={ink} tokens={p.tokens} offset={p.bracket.offset} tick={p.bracket.tick} numberSize={p.bracket.numberSize} strokeWidth={p.bracket.strokeWidth} />
          </g>
          {p.parallel > 0 && (
            <g opacity={p.parallel}>
              <Bracket from={[left, L.mY]} to={[left, L.lY]} normal={[-1, 0]} label={String(fig.band_height)} color={accent} tokens={p.tokens} offset={p.bracket.offset} tick={p.bracket.tick} numberSize={p.bracket.numberSize} strokeWidth={p.bracket.strokeWidth * 1.5} />
            </g>
          )}
        </g>
      )}
    </g>
  );
}
