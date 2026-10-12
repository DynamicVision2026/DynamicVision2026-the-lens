import { formatExact } from '../format';
import { wrapText } from '../text';
import type { LensCard, Tokens, WordProblemFigure } from '../types';
import { afterEquals, answerNumber } from '../wordProblem';
import { Bracket } from './Bracket';

/** Fixed copy in the diagrams (everything else comes from the card). */
const COPY = { unknown: '?', same: 'ずっと同じ', parts: 'つ分', age: '才', yen: '円' } as const;

export interface WordDiagramProps {
  card: LensCard;
  fig: WordProblemFigure;
  /** Region for the diagram (below the story). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Progress per diagram keyframe name, 0–1. */
  prog: Record<string, number>;
  tokens: Tokens;
  ink: string;
  accent: string;
  palette: string[];
  font: string;
  jaFont: string;
  weight: number;
  labelSize: number;
  numberSize: number;
  figureStroke: number;
  lensStroke: number;
  dash: string;
  bracket: { offset: number; tick: number; strokeWidth: number };
  tint: number;
  show: number;
}

export function WordDiagram(props: WordDiagramProps) {
  if (props.show <= 0) return null;
  return <g opacity={props.show}>{props.fig.kind === 'two_kinds_total' ? <AreaDiagram {...props} /> : <AgeDiagram {...props} />}</g>;
}

const label = (x: number, y: number, text: string, size: number, fill: string, font: string, weight: number, opacity = 1, anchor: 'start' | 'middle' | 'end' = 'middle') => (
  <text x={x} y={y} fill={fill} opacity={opacity} fontFamily={font} fontSize={size} fontWeight={weight} textAnchor={anchor} dominantBaseline="central">
    {text}
  </text>
);

/** 面積図: two rectangles on one baseline; width = count, height = value per item. */
function AreaDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, jaFont, weight, labelSize: size, numberSize: num } = p;
  const { n = 0, a = 0, b = 0 } = fig.params;
  const steps = card.lens_route.steps;
  const result = steps.find((s) => s.op === 'result');
  const unit = fig.names.measure === '金額' ? COPY.yen : '';
  const leftRoom = num * 3.2;
  const rightRoom = num * 3.2;
  const topRoom = num * 1.8;
  const bottomRoom = p.bracket.offset + num * 1.6;
  const sx = (p.w - leftRoom - rightRoom) / Math.max(1, n);
  const sy = (p.h - topRoom - bottomRoom) / Math.max(1, a);
  const x0 = p.x + leftRoom;
  const base = p.y + p.h - bottomRoom;
  const xa = answerNumber(card); // drawing only: the left rectangle's width
  const yA = base - a * sy;
  const yB = base - b * sy;
  const xMid = x0 + xa * sx;
  const xEnd = x0 + n * sx;
  const rects = prog.draw_rectangles ?? 0;
  const assume = prog.assume_all_b ?? 0;
  const strip = prog.show_gap_strip ?? 0;
  const divide = prog.divide_strip ?? 0;
  const bk = { tokens: p.tokens, offset: p.bracket.offset, tick: p.bracket.tick, numberSize: num, strokeWidth: p.bracket.strokeWidth };
  return (
    <g>
      {rects > 0 && (
        <g opacity={rects}>
          <rect x={x0} y={yA} width={xa * sx} height={a * sy} fill={palette[0]} fillOpacity={p.tint} stroke={palette[0]} strokeWidth={p.figureStroke} />
          <rect x={xMid} y={yB} width={(n - xa) * sx} height={b * sy} fill={palette[1]} fillOpacity={p.tint} stroke={palette[1]} strokeWidth={p.figureStroke} />
          {label(x0 + (xa * sx) / 2, (yB + base) / 2, fig.names.a ?? '', size, palette[0]!, jaFont, weight)}
          {label(xMid + ((n - xa) * sx) / 2, (yB + base) / 2, fig.names.b ?? '', size, palette[1]!, jaFont, weight)}
          {label(x0 + (xa * sx) / 2, base - size * 0.9, COPY.unknown, num, ink, font, weight, 1 - divide)}
          {label(xMid + ((n - xa) * sx) / 2, base - size * 0.9, COPY.unknown, num, ink, font, weight)}
          {label(x0 - num * 0.3, yA, `${a}${unit}`, num * 0.8, palette[0]!, font, weight, 1, 'end')}
          {label(xEnd + num * 0.3, yB, `${b}${unit}`, num * 0.8, palette[1]!, font, weight, 1, 'start')}
          <Bracket from={[x0, base]} to={[xEnd, base]} normal={[0, 1]} label={`${n}${fig.names.counter ?? ''}`} color={ink} {...bk} />
        </g>
      )}
      {assume > 0 && (
        <line x1={x0} y1={yB} x2={x0 + (xEnd - x0) * assume} y2={yB} stroke={ink} strokeWidth={p.lensStroke} strokeDasharray={p.dash} />
      )}
      {strip > 0 && (
        <g opacity={strip}>
          <rect x={x0} y={yA} width={xa * sx} height={(a - b) * sy} fill={accent} fillOpacity={p.tint * 2} stroke={accent} strokeWidth={p.lensStroke} />
          {afterEquals(steps[2]) && label(x0 + (xa * sx) / 2, (yA + yB) / 2, afterEquals(steps[2])!, num, accent, font, weight)}
        </g>
      )}
      {divide > 0 && (
        <g opacity={divide}>
          {afterEquals(steps[3]) && <Bracket from={[xMid, yB]} to={[xMid, yA]} normal={[1, 0]} label={afterEquals(steps[3])!} color={accent} {...bk} />}
          {result?.value && <Bracket from={[x0, yA]} to={[xMid, yA]} normal={[0, -1]} label={formatExact(result.value)} color={accent} {...bk} />}
        </g>
      )}
    </g>
  );
}

/** 線分図: the older and younger ages as bars; their difference never changes. */
function AgeDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, jaFont, weight, labelSize: size, numberSize: num } = p;
  const { p: older = 0, c: younger = 0, r = 1 } = fig.params;
  const steps = card.lens_route.steps;
  const years = answerNumber(card); // drawing only: how far the bars grow
  const nameRoom = size * 5;
  const x0 = p.x + nameRoom;
  const scale = (p.w - nameRoom - num * 3) / Math.max(1, older + years);
  const th = size * 1.3;
  const yP = p.y + p.h * 0.32;
  const yC = p.y + p.h * 0.68;
  const draw = prog.draw_age_bars ?? 0;
  const diff = prog.mark_difference ?? 0;
  const grow = prog.grow_bars ?? 0;
  const split = prog.split_difference ?? 0;
  const lenP = (older + years * grow) * scale;
  const lenC = (younger + years * grow) * scale;
  const bar = (y: number, len: number, c: string) => (
    <rect x={x0} y={y - th / 2} width={Math.max(0, len * draw)} height={th} rx={th / 4} fill={c} fillOpacity={p.tint * 1.5} stroke={c} strokeWidth={p.figureStroke} />
  );
  const diffText = afterEquals(steps[0]);
  const partsText = afterEquals(steps[1]);
  const partText = afterEquals(steps[2]);
  return (
    <g>
      {label(x0 - size * 0.5, yP, fig.names.older ?? '', size, palette[0]!, jaFont, weight, draw, 'end')}
      {label(x0 - size * 0.5, yC, fig.names.younger ?? '', size, palette[1]!, jaFont, weight, draw, 'end')}
      {bar(yP, lenP, palette[0]!)}
      {bar(yC, lenC, palette[1]!)}
      {/* Today's ages, from params; they leave once the bars start to grow (no new ages are printed). */}
      {label(x0 + lenP * draw + num * 0.3, yP, `${older}${COPY.age}`, num * 0.8, palette[0]!, font, weight, draw * (1 - grow), 'start')}
      {label(x0 + lenC * draw + num * 0.3, yC, `${younger}${COPY.age}`, num * 0.8, palette[1]!, font, weight, draw * (1 - grow), 'start')}

      {/* The difference: the part of the older bar beyond the younger one. It keeps its length. */}
      {diff > 0 && (
        <g opacity={diff}>
          <rect data-part="difference" x={x0 + lenC} y={yP - th / 2} width={lenP - lenC} height={th} rx={th / 4} fill={accent} fillOpacity={p.tint * 2.5} stroke={accent} strokeWidth={p.lensStroke} />
          {diffText && label(x0 + (lenC + lenP) / 2, yP - th * 1.6, diffText, num, accent, font, weight)}
          {label(x0 + (lenC + lenP) / 2, yP + th * 1.3, COPY.same, size, accent, jaFont, weight, 1 - split)}
        </g>
      )}

      {/* At r times: the younger bar is one part; the older bar is r parts, so the difference is r − 1 parts. */}
      {split > 0 && (
        <g opacity={split}>
          {Array.from({ length: Math.max(0, Math.round(r) - 1) }, (_, k) => (
            <line key={k} x1={x0 + lenC * (k + 1)} y1={yP - th * 0.75} x2={x0 + lenC * (k + 1)} y2={yP + th * 0.75} stroke={ink} strokeWidth={p.lensStroke} />
          ))}
          {partText && <Bracket from={[x0, yC]} to={[x0 + lenC, yC]} normal={[0, 1]} label={partText} color={palette[1]!} tokens={p.tokens} offset={th} tick={p.bracket.tick} numberSize={num} strokeWidth={p.bracket.strokeWidth} />}
          {partsText && label(x0 + (lenC + lenP) / 2, yP + th * 1.3, `${partsText}${COPY.parts}`, size, accent, jaFont, weight)}
        </g>
      )}
    </g>
  );
}

export interface StoryTextProps {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  ink: string;
  accent: string;
  font: string;
  weight: number;
  highlight: number;
  opacity: number;
}

/** The problem sentence in large type, its numbers highlighted in the lens colour. */
export function StoryText({ text, x, y, width, size, ink, accent, font, weight, highlight, opacity }: StoryTextProps) {
  if (opacity <= 0) return null;
  const lh = size * 1.45;
  return (
    <g opacity={opacity} fontFamily={font} fontSize={size}>
      {wrapText(text, width, size).map((line, i) => (
        <text key={i} x={x} y={y + (i + 0.8) * lh} fill={ink}>
          {line.split(/([\d.]+)/).map((part, j) =>
            /^[\d.]+$/.test(part) ? (
              <tspan key={j} fill={highlight > 0 ? accent : ink} fontWeight={weight}>
                {part}
              </tspan>
            ) : (
              <tspan key={j}>{part}</tspan>
            ),
          )}
        </text>
      ))}
    </g>
  );
}

/** Height the story takes at a given width and size (for laying out the diagram below it). */
export function storyHeight(text: string, width: number, size: number): number {
  return wrapText(text, width, size).length * size * 1.45 + size * 0.5;
}
