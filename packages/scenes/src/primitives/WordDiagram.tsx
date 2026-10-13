import type { ReactElement } from 'react';
import { formatExact } from '../format';
import { wrapText } from '../text';
import type { LensCard, Tokens, WordDiagramSpec, WordFamily, WordProblemFigure } from '../types';
import { afterEquals, allAfterEquals, answerNumber, expressionIn, ratioIn, wordFamily } from '../wordProblem';
import { Bracket } from './Bracket';
import { LensIcon } from './LensIcon';

/** Fixed copy in the diagrams (everything else comes from the card). */
const COPY = { unknown: '?', blank: '□', same: 'ずっと同じ', parts: 'つ分', age: '才', yen: '円', percent: '%', ratio: ' : ', perMinute: '分速', metre: 'm', meet: '出会う', point: '点', person: '人', average: '平均', excess: 'はみ出し', dent: 'へこみ', extra: 'あまり', short: 'たりない' } as const;

/** The figure's diagram, narrowed to one family (callers are routed by family, so it matches). */
function spec<F extends WordFamily>(fig: WordProblemFigure, _family: F): Extract<WordDiagramSpec, { family: F }> {
  return fig.diagram as Extract<WordDiagramSpec, { family: F }>;
}

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
  /** The answer reveal, 0–1 (the □ on the lever becomes the answer; the road marks where they meet). */
  answer?: number;
  /** Chalk colour for trap marks (the halfway guess on the road). */
  chalk?: string;
}

/** One picture per diagram family (WO-015): a new story type with an existing family needs no code. */
const DIAGRAMS: Partial<Record<WordFamily, (p: WordDiagramProps) => ReactElement>> = {
  area_two_rect: AreaDiagram,
  area_average: AverageDiagram,
  area_shortfall: ShortfallDiagram,
  diff_bars: AgeDiagram,
  lever: BalanceDiagram,
  road: RoadDiagram,
};

export function WordDiagram(props: WordDiagramProps) {
  if (props.show <= 0) return null;
  const family = wordFamily(props.fig);
  const Diagram = family ? DIAGRAMS[family] : undefined;
  return <g opacity={props.show}>{Diagram && <Diagram {...props} />}</g>;
}

const label = (x: number, y: number, text: string, size: number, fill: string, font: string, weight: number, opacity = 1, anchor: 'start' | 'middle' | 'end' = 'middle') => (
  <text x={x} y={y} fill={fill} opacity={opacity} fontFamily={font} fontSize={size} fontWeight={weight} textAnchor={anchor} dominantBaseline="central">
    {text}
  </text>
);

/** 面積図: two rectangles on one baseline; width = count, height = value per item. */
function AreaDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, jaFont, weight, labelSize: size, numberSize: num } = p;
  const { n, a, b, unit } = spec(fig, 'area_two_rect');
  const steps = card.lens_route.steps;
  const result = steps.find((s) => s.op === 'result');
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
          {label(x0 + (xa * sx) / 2, (yB + base) / 2, (fig.names ?? {}).a ?? '', size, palette[0]!, jaFont, weight)}
          {label(xMid + ((n - xa) * sx) / 2, (yB + base) / 2, (fig.names ?? {}).b ?? '', size, palette[1]!, jaFont, weight)}
          {/* The unknown counts: inside the tall rectangle above its name (until the strip fills it), above the short one. */}
          {label(x0 + (xa * sx) / 2, (yA + yB) / 2, COPY.unknown, num, ink, font, weight, (1 - divide) * (1 - strip))}
          {label(xMid + ((n - xa) * sx) / 2, yB - num * 0.8, COPY.unknown, num, ink, font, weight)}
          {label(x0 - num * 0.3, yA, `${a}${unit}`, num * 0.8, palette[0]!, font, weight, 1, 'end')}
          {label(xEnd + num * 0.3, yB, `${b}${unit}`, num * 0.8, palette[1]!, font, weight, 1, 'start')}
          <Bracket from={[x0, base]} to={[xEnd, base]} normal={[0, 1]} label={`${n}${(fig.names ?? {}).counter ?? ''}`} color={ink} {...bk} />
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
  const { big: older, small: younger, r, dir, measure } = spec(fig, 'diff_bars');
  const unit = measure === 'yen' ? COPY.yen : COPY.age;
  const steps = card.lens_route.steps;
  // Drawing only: how far the bars grow (dir 1) or shrink (dir −1), in the measure's units.
  const years = answerNumber(card) * dir;
  const nameRoom = size * 5;
  const x0 = p.x + nameRoom;
  const scale = (p.w - nameRoom - num * 3) / Math.max(1, older + Math.max(0, years));
  const th = size * 1.3;
  const yP = p.y + p.h * 0.32;
  const yC = p.y + p.h * 0.68;
  const draw = Math.max(prog.draw_age_bars ?? 0, prog.draw_money_bars ?? 0);
  const diff = prog.mark_difference ?? 0;
  const grow = Math.max(prog.grow_bars ?? 0, prog.shrink_bars ?? 0);
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
      {label(x0 - size * 0.5, yP, (fig.names ?? {}).older ?? '', size, palette[0]!, jaFont, weight, draw, 'end')}
      {label(x0 - size * 0.5, yC, (fig.names ?? {}).younger ?? '', size, palette[1]!, jaFont, weight, draw, 'end')}
      {bar(yP, lenP, palette[0]!)}
      {bar(yC, lenC, palette[1]!)}
      {/* Today's amounts, from the story; they leave once the bars start to change (no new amounts are printed). */}
      {label(x0 + lenP * draw + num * 0.3, yP, `${older}${unit}`, num * 0.8, palette[0]!, font, weight, draw * (1 - grow), 'start')}
      {label(x0 + lenC * draw + num * 0.3, yC, `${younger}${unit}`, num * 0.8, palette[1]!, font, weight, draw * (1 - grow), 'start')}

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

/**
 * 平均の面積図: two rectangles (height = average, width = head count). The overall average is a line;
 * the excess of the first group above it equals the dent of the second below it. Only the band near
 * the averages is drawn (from h2 − 4 to h1 + 4) so small differences stay visible.
 */
function AverageDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, jaFont, weight, labelSize: size, numberSize: num } = p;
  const { w1, h1, h2, level } = spec(fig, 'area_average');
  const steps = card.lens_route.steps;
  const result = steps.find((s) => s.op === 'result');
  const w2 = answerNumber(card); // drawing only: the second rectangle's width
  const lo = h2 - 4;
  const hi = h1 + 4;
  const leftRoom = num * 3.2;
  const rightRoom = num * 3.6;
  const topRoom = num * 1.8;
  const bottomRoom = p.bracket.offset + num * 1.6;
  const sx = (p.w - leftRoom - rightRoom) / Math.max(1, w1 + w2);
  const sy = (p.h - topRoom - bottomRoom) / Math.max(1, hi - lo);
  const x0 = p.x + leftRoom;
  const base = p.y + p.h - bottomRoom;
  const Y = (v: number) => base - (v - lo) * sy;
  const xMid = x0 + w1 * sx;
  const xEnd = xMid + w2 * sx;
  const rects = prog.draw_rectangles ?? 0;
  const line = prog.draw_average_line ?? 0;
  const excess = prog.show_excess ?? 0;
  const dent = prog.fill_dent ?? 0;
  const divide = prog.divide_dent ?? 0;
  const excessText = afterEquals(steps[1]);
  const dentText = afterEquals(steps[2]);
  const bk = { tokens: p.tokens, offset: p.bracket.offset, tick: p.bracket.tick, numberSize: num, strokeWidth: p.bracket.strokeWidth };
  return (
    <g>
      {rects > 0 && (
        <g opacity={rects}>
          <rect x={x0} y={Y(h1)} width={w1 * sx} height={(h1 - lo) * sy} fill={palette[0]} fillOpacity={p.tint} stroke={palette[0]} strokeWidth={p.figureStroke} />
          <rect x={xMid} y={Y(h2)} width={w2 * sx} height={(h2 - lo) * sy} fill={palette[1]} fillOpacity={p.tint} stroke={palette[1]} strokeWidth={p.figureStroke} />
          {label(x0 - num * 0.3, Y(h1), `${h1}${COPY.point}`, num * 0.8, palette[0]!, font, weight, 1, 'end')}
          {label(xEnd + num * 0.3, Y(h2), `${h2}${COPY.point}`, num * 0.8, palette[1]!, font, weight, 1, 'start')}
          <Bracket from={[x0, base]} to={[xMid, base]} normal={[0, 1]} label={`${w1}${COPY.person}`} color={palette[0]!} {...bk} />
          {label(xMid + (w2 * sx) / 2, base + p.bracket.offset + num * 0.6, `${COPY.unknown}${COPY.person}`, num, palette[1]!, font, weight, 1 - divide)}
        </g>
      )}
      {line > 0 && (
        <g opacity={line}>
          <line x1={x0 - num * 0.4} y1={Y(level)} x2={x0 + (xEnd + num * 0.4 - x0) * line} y2={Y(level)} stroke={ink} strokeWidth={p.lensStroke} strokeDasharray={p.dash} />
          {label(xEnd + num * 0.3, Y(level), `${COPY.average}${level}${COPY.point}`, size, ink, jaFont, weight, 1, 'start')}
        </g>
      )}
      {excess > 0 && (
        <g opacity={excess}>
          <rect data-part="excess" x={x0} y={Y(h1)} width={w1 * sx} height={(h1 - level) * sy} fill={accent} fillOpacity={p.tint * 2} stroke={accent} strokeWidth={p.lensStroke} />
          {excessText && label(x0 + (w1 * sx) / 2, (Y(h1) + Y(level)) / 2, excessText, num, accent, font, weight)}
        </g>
      )}
      {dent > 0 && (
        <g opacity={dent}>
          <rect data-part="dent" x={xMid} y={Y(level)} width={w2 * sx} height={(level - h2) * sy} fill={accent} fillOpacity={p.tint * 2} stroke={accent} strokeWidth={p.lensStroke} strokeDasharray={p.dash} />
          {excessText && label(xMid + (w2 * sx) / 2, (Y(level) + Y(h2)) / 2, excessText, num * 0.8, accent, font, weight)}
        </g>
      )}
      {divide > 0 && (
        <g opacity={divide}>
          {dentText && <Bracket from={[xEnd, Y(h2)]} to={[xEnd, Y(level)]} normal={[1, 0]} label={dentText} color={accent} {...bk} offset={num * 0.8} />}
          {result?.value && <Bracket from={[xMid, base]} to={[xEnd, base]} normal={[0, 1]} label={formatExact(result.value)} color={accent} {...bk} />}
        </g>
      )}
    </g>
  );
}

/**
 * 過不足の面積図: height = items per person, width = people. Plan A (a each) leaves s over, plan B
 * (b each) is d short; the strip between them is s + d, and its height is b − a.
 */
function ShortfallDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, jaFont, weight, labelSize: size, numberSize: num } = p;
  const { a, b, s: extra, d: short } = spec(fig, 'area_shortfall');
  const steps = card.lens_route.steps;
  const result = steps.find((st) => st.op === 'result');
  const n = answerNumber(card); // drawing only: the rectangle's width
  const leftRoom = num * 2.4;
  const rightRoom = p.w * 0.3;
  const topRoom = num * 1.6;
  const bottomRoom = p.bracket.offset + num * 1.6;
  const sx = (p.w - leftRoom - rightRoom) / Math.max(1, n);
  const sy = (p.h - topRoom - bottomRoom) / Math.max(1, b);
  const x0 = p.x + leftRoom;
  const base = p.y + p.h - bottomRoom;
  const xEnd = x0 + n * sx;
  const yA = base - a * sy;
  const yB = base - b * sy;
  const planA = prog.draw_plan_a ?? 0;
  const planB = prog.draw_plan_b ?? 0;
  const gap = prog.show_gap ?? 0;
  const divide = prog.divide_gap ?? 0;
  const gapText = afterEquals(steps[1]);
  const heightText = afterEquals(steps[2]);
  // The leftover and missing items as dots beside the rectangle; they fly into the strip with show_gap.
  const r = Math.max(2, Math.min(num * 0.22, (rightRoom - num) / 22));
  const pitch = r * 2.6;
  const dots = (count: number, x: number, y: number, filled: boolean, c: string) =>
    Array.from({ length: count }, (_, i) => {
      const cx = x + (i % 8) * pitch;
      const cy = y + Math.floor(i / 8) * pitch;
      const tx = x0 + ((i % 8) + 0.5) * ((n * sx) / 8);
      const ty = lerp(yB, yA, (Math.floor(i / 8) + 0.5) / Math.max(1, Math.ceil(count / 8)));
      return <circle key={i} cx={lerp(cx, tx, gap)} cy={lerp(cy, ty, gap)} r={r} fill={filled ? c : 'none'} stroke={c} strokeWidth={p.bracket.strokeWidth} opacity={1 - gap * 0.6} />;
    });
  const dotX = xEnd + num * 1.2;
  const bk = { tokens: p.tokens, offset: p.bracket.offset, tick: p.bracket.tick, numberSize: num, strokeWidth: p.bracket.strokeWidth };
  return (
    <g>
      {planA > 0 && (
        <g opacity={planA}>
          <rect x={x0} y={yA} width={n * sx} height={a * sy} fill={palette[0]} fillOpacity={p.tint} stroke={palette[0]} strokeWidth={p.figureStroke} />
          {label(x0 - num * 0.3, yA, String(a), num * 0.8, palette[0]!, font, weight, 1, 'end')}
          {label(dotX, yA - num * 0.6, `${COPY.extra} ${extra}`, size, palette[0]!, jaFont, weight, 1 - gap, 'start')}
          {dots(extra, dotX, yA, true, palette[0]!)}
          {label(x0 + (n * sx) / 2, base + p.bracket.offset + num * 0.6, `${COPY.unknown}${COPY.person}`, num, ink, font, weight, 1 - divide)}
        </g>
      )}
      {planB > 0 && (
        <g opacity={planB}>
          <rect x={x0} y={yB} width={n * sx} height={b * sy} fill="none" stroke={palette[1]} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {label(x0 - num * 0.3, yB, String(b), num * 0.8, palette[1]!, font, weight, 1, 'end')}
          {label(dotX, yB - num * 0.6, `${COPY.short} ${short}`, size, palette[1]!, jaFont, weight, 1 - gap, 'start')}
          {dots(short, dotX, yB, false, palette[1]!)}
        </g>
      )}
      {gap > 0 && (
        <g opacity={gap}>
          <rect data-part="gap" x={x0} y={yB} width={n * sx} height={(b - a) * sy} fill={accent} fillOpacity={p.tint * 2} stroke={accent} strokeWidth={p.lensStroke} />
          {gapText && label(x0 + (n * sx) / 2, (yA + yB) / 2, gapText, num, accent, font, weight)}
        </g>
      )}
      {divide > 0 && (
        <g opacity={divide}>
          {heightText && <Bracket from={[xEnd, yA]} to={[xEnd, yB]} normal={[1, 0]} label={heightText} color={accent} {...bk} offset={num * 0.6} />}
          {result?.value && <Bracket from={[x0, base]} to={[xEnd, base]} normal={[0, 1]} label={formatExact(result.value)} color={accent} {...bk} />}
        </g>
      )}
    </g>
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** てんびん: a beam on a number line of strengths; the weights hang at the ends, the pivot at the mix. */
function BalanceDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, weight, labelSize: size, numberSize: num } = p;
  const { w1, p1, p2, pt } = spec(fig, 'lever');
  const steps = card.lens_route.steps;
  const unit = card.problem.unit ?? '';
  const answer = p.answer ?? 0;
  const w2 = answerNumber(card); // drawing only: the right weight's size
  const margin = num * 2.6;
  const L = p.w - 2 * margin;
  const X = (v: number) => p.x + margin + ((v - p1) / Math.max(1e-9, p2 - p1)) * L;
  const yb = p.y + p.h * 0.34;
  const px = X(pt);
  const draw = prog.draw_lever ?? 0;
  const place = prog.place_strengths ?? 0;
  const arms = prog.mark_arms ?? 0;
  const invert = prog.invert_ratio ?? 0;
  // Tipped towards the known weight until the ratio is found, then it settles level.
  const tilt = (8 * Math.PI) / 180 * place * (1 - invert);
  const onBeam = (x: number): [number, number] => [px + (x - px) * Math.cos(tilt), yb - (x - px) * Math.sin(tilt)];
  const [lx, ly] = onBeam(X(p1));
  const [rx, ry] = onBeam(X(p2));
  const normal: [number, number] = [-Math.sin(tilt), -Math.cos(tilt)];
  const hang = size * 1.6;
  const big = Math.max(w1, w2, 1);
  const side = (w: number) => num * (1.6 + 1.6 * Math.sqrt(w / big));
  const [s1, s2] = [side(w1), side(w2)];
  const armText = allAfterEquals(steps[1]);
  const ratio = ratioIn(steps[2]);
  const right = answer > 0 ? card.answer.display_ja ?? `${formatExact(card.answer.value)}${unit}` : `${COPY.blank}${unit}`;
  const weightBox = (x: number, y: number, sz: number, c: string, text: string, part: string, textOpacity = 1) => (
    <g data-part={part} data-x={x}>
      <line x1={x} y1={y} x2={x} y2={y + hang} stroke={ink} strokeWidth={p.figureStroke} />
      <rect x={x - sz / 2} y={y + hang} width={sz} height={sz} rx={sz / 8} fill={c} fillOpacity={p.tint * 1.5} stroke={c} strokeWidth={p.figureStroke} />
      {label(x, y + hang + sz / 2, text, num * 0.8, c, font, weight, textOpacity)}
    </g>
  );
  const yRatio = Math.max(ly, ry) + hang + Math.max(s1, s2) + num * 1.1;
  const bk = { tokens: p.tokens, offset: p.bracket.offset, tick: p.bracket.tick, numberSize: num, strokeWidth: p.bracket.strokeWidth };
  return (
    <g>
      {draw > 0 && (
        <g opacity={draw}>
          <line x1={lerp(px, lx, draw)} y1={lerp(yb, ly, draw)} x2={lerp(px, rx, draw)} y2={lerp(yb, ry, draw)} stroke={ink} strokeWidth={p.figureStroke * 2} strokeLinecap="round" />
          <path data-part="pivot" data-x={px} d={`M${px} ${yb} l${-size * 0.8} ${size * 1.4} h${size * 1.6} z`} fill={ink} fillOpacity={0.15} stroke={ink} strokeWidth={p.figureStroke} />
        </g>
      )}
      {place > 0 && (
        <g opacity={place}>
          {label(lx, ly - num * 0.9, `${p1}${COPY.percent}`, num, palette[0]!, font, weight)}
          {label(rx, ry - num * 0.9, `${p2}${COPY.percent}`, num, palette[1]!, font, weight)}
          {label(px, yb + size * 1.4 + num * 0.8, `${pt}${COPY.percent}`, num, accent, font, weight)}
          {weightBox(lx, ly, s1, palette[0]!, `${w1}${unit}`, 'weight-left')}
          {weightBox(rx, ry, s2, palette[1]!, right, 'weight-right')}
        </g>
      )}
      {arms > 0 && (
        <g opacity={arms}>
          <line x1={lx} y1={ly} x2={px} y2={yb} stroke={palette[0]} strokeWidth={p.lensStroke * 2} strokeLinecap="round" />
          <line x1={px} y1={yb} x2={rx} y2={ry} stroke={palette[1]} strokeWidth={p.lensStroke * 2} strokeLinecap="round" />
          {armText[0] && <Bracket from={[lx, ly]} to={[px, yb]} normal={normal} label={armText[0]} color={palette[0]!} {...bk} offset={num * 2.2} />}
          {armText[1] && <Bracket from={[px, yb]} to={[rx, ry]} normal={normal} label={armText[1]} color={palette[1]!} {...bk} offset={num * 2.2} />}
        </g>
      )}
      {invert > 0 && ratio && (
        <g opacity={invert}>
          {/* Each weight takes the other arm's length: the ratio of the weights is the arms' ratio reversed. */}
          {label(lx, yRatio, ratio[0], num, palette[1]!, font, weight)}
          {label(rx, yRatio, ratio[1], num, palette[0]!, font, weight)}
          <path d={`M${(px + rx) / 2} ${(yb + ry) / 2} Q${px} ${yRatio + num * 2} ${lx + num * 0.9} ${yRatio}`} fill="none" stroke={palette[1]} strokeWidth={p.lensStroke} strokeDasharray={p.dash} opacity={0.7} />
          <path d={`M${(lx + px) / 2} ${(ly + yb) / 2} Q${px} ${yRatio + num * 2} ${rx - num * 0.9} ${yRatio}`} fill="none" stroke={palette[0]} strokeWidth={p.lensStroke} strokeDasharray={p.dash} opacity={0.7} />
          {label(p.x + p.w / 2, yRatio + num * 1.6, `${w1}${unit}${COPY.ratio}${right}  =  ${ratio[0]}${COPY.ratio}${ratio[1]}`, num * 0.9, accent, font, weight)}
        </g>
      )}
    </g>
  );
}

/** 線分図 of a road: two walkers start at the ends. The lens freezes one of them. */
function RoadDiagram(p: WordDiagramProps) {
  const { card, fig, prog, ink, accent, palette, font, jaFont, weight, labelSize: size, numberSize: num } = p;
  const chalk = p.chalk ?? ink;
  const { d, u, v } = spec(fig, 'road');
  const steps = card.lens_route.steps;
  const minutes = answerNumber(card); // drawing only: how far the walkers get, and the block count
  const answer = p.answer ?? 0;
  const margin = num * 1.6;
  const xL = p.x + margin;
  const xR = p.x + p.w - margin;
  const L = xR - xL;
  const at = (metres: number) => xL + (metres / Math.max(1, d)) * L;
  const yr = p.y + p.h * 0.5;
  const r = size * 0.45;
  const road = prog.draw_road ?? 0;
  const walk = prog.both_walk ?? 0;
  const freeze = prog.freeze_one ?? 0;
  const combine = prog.combine_speeds ?? 0;
  // The trap walk covers 60% of the time to meet (their trails show unequal paces); freezing rewinds them.
  const walked = minutes * 0.6 * walk * (1 - freeze);
  const xa = combine > 0 ? lerp(xL, xR - 2 * r, combine) : at(u * walked);
  const xb = at(d - v * walked);
  const closing = expressionIn(steps[0]);
  const closingSpeed = afterEquals(steps[0]);
  const blocks = Math.max(1, Math.round(minutes));
  const blockW = L / blocks;
  const passed = combine * blocks;
  const meetX = at((u / Math.max(1e-9, u + v)) * d); // drawing only
  const tag = (x: number, text: string, c: string, opacity: number) => label(x, yr + r + num * 0.9, text, num * 0.75, c, jaFont, weight, opacity);
  return (
    <g>
      {road > 0 && (
        <g opacity={road}>
          <line x1={xL} y1={yr} x2={lerp(xL, xR, road)} y2={yr} stroke={ink} strokeWidth={p.figureStroke * 2} strokeLinecap="round" />
          <Bracket from={[xL, yr]} to={[xR, yr]} normal={[0, -1]} label={`${d}${COPY.metre}`} color={ink} tokens={p.tokens} offset={r + num * 1.9} tick={p.bracket.tick} numberSize={num} strokeWidth={p.bracket.strokeWidth} />
        </g>
      )}
      {combine > 0 && (
        <g>
          {Array.from({ length: blocks }, (_, i) => {
            const fill = Math.max(0, Math.min(1, passed - i));
            return fill > 0 ? <rect key={i} data-part="block" x={xL + i * blockW} y={yr - r * 0.45} width={blockW * fill} height={r * 0.9} fill={i % 2 ? palette[0] : accent} fillOpacity={p.tint * 2} stroke={accent} strokeWidth={p.bracket.strokeWidth} /> : null;
          })}
          {closingSpeed && label(xL + blockW / 2, yr - r - num * 0.6, `${closingSpeed}${COPY.metre}`, num * 0.7, accent, font, weight, Math.min(1, passed))}
        </g>
      )}
      {walk > 0 && freeze < 1 && (
        <g opacity={1 - freeze}>
          <line x1={xL} y1={yr} x2={at(u * walked)} y2={yr} stroke={palette[0]} strokeWidth={p.lensStroke * 2} strokeLinecap="round" />
          <line x1={at(d - v * walked)} y1={yr} x2={xR} y2={yr} stroke={palette[1]} strokeWidth={p.lensStroke * 2} strokeLinecap="round" />
        </g>
      )}
      {walk > 0 && (
        <g opacity={Math.min(walk * 2, 1) * (answer > 0 ? 0.5 : 1)}>
          {/* The trap: they meet halfway? They don't — the faster one gets further. */}
          <line data-part="halfway" data-x={at(d / 2)} x1={at(d / 2)} y1={yr - r * 1.6} x2={at(d / 2)} y2={yr + r * 1.6} stroke={chalk} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {label(at(d / 2), yr - r * 2.4, COPY.unknown, num, chalk, font, weight)}
        </g>
      )}
      {answer > 0 && (
        <g opacity={answer} data-part="meet" data-x={meetX}>
          <circle cx={meetX} cy={yr} r={r * 0.45} fill={accent} />
          {label(meetX, yr + r + num * 2.1, COPY.meet, size, accent, jaFont, weight)}
        </g>
      )}
      {road > 0 && (
        <g opacity={road}>
          <circle cx={xa} cy={yr} r={r} fill={palette[0]} fillOpacity={0.9} stroke={palette[0]} strokeWidth={p.figureStroke} />
          <circle cx={xb} cy={yr} r={r} fill={palette[1]} fillOpacity={0.9} stroke={freeze > 0 ? accent : palette[1]} strokeWidth={p.figureStroke + p.lensStroke * freeze} />
          {label(xa - size * 0.7 * combine, yr - r - size * 0.7, (fig.names ?? {}).a ?? '', size, palette[0]!, jaFont, weight)}
          {label(xb, yr - r - size * 0.7, (fig.names ?? {}).b ?? '', size, palette[1]!, jaFont, weight)}
          {tag(xa, `${COPY.perMinute}${u}${COPY.metre}`, palette[0]!, 1 - freeze)}
          {closing && tag(xa, closing, accent, freeze * (1 - combine))}
          {closingSpeed && tag(xa - num * 1.2 * combine, `${COPY.perMinute}${closingSpeed}${COPY.metre}`, accent, combine)}
          {tag(xb, `${COPY.perMinute}${v}${COPY.metre}`, palette[1]!, 1 - freeze)}
          {freeze > 0 && <LensIcon lens="freeze" tokens={p.tokens} mode="screen" x={xb + r + size * 0.15} y={yr - size * 0.6} size={size * 1.2} color={accent} />}
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
