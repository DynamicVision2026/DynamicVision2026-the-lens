import { parseEasing } from '../easing';
import { answerText, formatExact } from '../format';
import { boundingBox, boxCorners, centroid, enclosureGaps, outwardDirection, partialPolyline, type Box } from '../geometry';
import { Bracket, ConstructionLine, FigurePolygon, GridLayer, LensIcon, makeFrame, svgPoints, toSvg, type Frame } from '../primitives';
import { wrapText } from '../text';
import { color, fontFamily, lensColor, type RenderMode } from '../tokens';
import type { GlowToken, LensCard, Point, ShortLayout, Step, StepDetail, Tokens } from '../types';
import { motionState, type MotionState } from './beats';
import type { Beat } from './timeline';

export interface MotionSceneProps {
  card: LensCard;
  beats: Beat[];
  beat: number;
  /** Raw progress 0–1 within the beat (each beat applies the easing token itself). */
  t: number;
  tokens: Tokens;
  glow: GlowToken | null;
  mode: RenderMode;
  /** Lens name for the chip in the title band (bundle.labels); icon only when absent. */
  lensLabel?: string;
}

/**
 * The study-pace Short lays out in px on the 1080×1920 frame (`tokens.layout.short`); its viewBox is
 * the safe area. Stroke tokens are px at 1x and the Short renders at 2x.
 */
const STROKE_SCALE = 2;
/** How far a corner slides outward while it is subtracted, in frame px. */
const SLIDE = 24;
const MINUS = ' − ';
const TIMES = ' × ';

type CornerDetail = Extract<StepDetail, { kind: 'corner' }>;

/** The viewBox for the motion preview: the Short's safe area, in frame px. */
export function motionViewBox(layout: ShortLayout): { x: number; y: number; width: number; height: number } {
  const [width, height] = layout.size_px;
  return { x: 0, y: layout.safe_top_px, width, height: height - layout.safe_top_px - layout.safe_bottom_px };
}

/** Stroke widths and dashes at the Short's 2x scale. */
function scaleStrokes(t: Tokens, k: number): Tokens {
  const scaleDash = (dash: string) => (dash === 'none' ? dash : dash.split(/\s+/).map((n) => Number(n) * k).join(' '));
  const stroke = { ...t.stroke } as Record<string, unknown>;
  for (const [name, token] of Object.entries(t.stroke)) {
    if (typeof token === 'object' && token && 'width' in token) {
      stroke[name] = { ...token, width: token.width * k, dash: scaleDash(token.dash) };
    }
  }
  return { ...t, stroke: stroke as Tokens['stroke'] };
}

/** Title of a corner step: its `ja` up to the first space (the formula is shown on its own card). */
function stepTitle(step: Step): string {
  return step.ja.split(/[\s　]/)[0] ?? step.ja;
}

/** Approximate text width in px: full width for CJK, ~0.58 em for Latin and digits. */
function textWidth(text: string, size: number): number {
  return [...text].reduce((w, ch) => w + (/[\u0000-ɏ -⁯]/.test(ch) ? 0.58 : 1) * size, 0);
}

/** Base and height legs of a corner, from its verified detail: positions only, no measuring. */
function cornerLegs(d: CornerDetail, box: Box) {
  const [cx, cy] = d.corner;
  const sx = cx === box.x1 ? -1 : 1;
  const sy = cy === box.y1 ? -1 : 1;
  return {
    base: { from: d.corner, to: [cx + sx * d.base, cy] as Point, normal: [0, cy === box.y1 ? -1 : 1] as [number, number] },
    height: { from: d.corner, to: [cx, cy + sy * d.height] as Point, normal: [cx === box.x1 ? 1 : -1, 0] as [number, number] },
  };
}

/** The study-pace Enclose walkthrough: trap → lens → box step → one step per corner → subtract → answer. */
export function MotionScene({ card, beats, beat, t, tokens: baseTokens, glow, mode, lensLabel }: MotionSceneProps) {
  const tokens = scaleStrokes(baseTokens, STROKE_SCALE);
  const L = tokens.layout.short;
  const { regions: R, type_px: T, pieces: P, brackets: BR } = L;
  const [W] = L.size_px;
  const safeBottom = L.size_px[1] - L.safe_bottom_px;
  const margin = R.figure.min_margin_px;

  const { grid, points } = card.problem.figure;
  const gaps = enclosureGaps(points);
  const steps = card.lens_route.steps;
  const start = steps.find((s) => s.op === 'start');
  const subs = steps.filter((s) => s.op === 'sub');
  const result = steps.find((s) => s.op === 'result');
  const state = motionState(beats, beat, t, {
    corners: gaps.length,
    trapLines: card.trap_route.steps.length,
    tokens,
    ease: parseEasing(tokens.motion.easing),
    spring: tokens.motion.spring,
  });

  // Figure: centred, inside its region, leaving room for brackets and their numbers on every side
  // and above the formula card.
  const cardTop = R.formula_card.centre_y - R.formula_card.height / 2;
  const sideRoom = BR.offset_px + T.bracket_number * 1.6;
  const figW = Math.min(R.figure.max_width, W - 2 * (margin + sideRoom));
  const figH = Math.min(R.figure.max_height, cardTop - BR.offset_px - T.bracket_number * 1.3 - R.figure.y);
  const frame = makeFrame(grid, R.figure.centre_x - figW / 2, R.figure.y, figW, figH);

  const lens = card.lens;
  const accent = lensColor(tokens, lens, mode);
  const ink = color(tokens.color.ink, mode);
  const paper = color(tokens.color.paper, mode);
  const chalk = color(tokens.color.trap.ink, mode);
  const palette = tokens.color.step.palette;
  const stepColor = (i: number) => color(palette[i % palette.length]!, mode);
  const box = boundingBox(points);
  const boxPath: Point[] = [...boxCorners(box), boxCorners(box)[0]!];
  const [cx, cy] = toSvg(frame, centroid(points));
  const glowId = `lens-glow-${card.id}`;
  const glowFilter = glow ? `url(#${glowId})` : undefined;
  const pulse = glow
    ? glow.pulse_min_opacity +
      (glow.opacity - glow.pulse_min_opacity) * (0.5 + 0.5 * Math.cos((2 * Math.PI * state.pulseMs) / glow.pulse_period_ms))
    : 0;
  const tip = state.box > 0 && state.box < 1 ? partialPolyline(boxPath, state.box).at(-1) : undefined;
  const focus = state.focus;
  const focusIndex = focus?.kind === 'corner' ? focus.index : -1;
  const numFont = fontFamily(tokens, undefined, 'family_num');
  const jaFont = fontFamily(tokens, tokens.type.scale.title);
  const bold = tokens.type.scale.title.weight;
  const bandMid = R.title_band.y + R.title_band.height / 2;
  const showPieces = state.box >= 1;
  const bracketProps = { offset: BR.offset_px, tick: BR.tick_px / 2, numberSize: T.bracket_number, strokeWidth: tokens.stroke.lens_construction.width, tokens, mode };

  const pieceLayer = (layer: 'under' | 'over') =>
    gaps.map((gap, i) => (
      <CornerPiece
        key={`${layer}${i}`}
        layer={layer}
        i={i}
        gap={gap}
        frame={frame}
        center={[cx, cy]}
        state={state}
        visible={showPieces}
        focusIndex={focusIndex}
        stroke={stepColor(i)}
        value={subs[i]?.value}
        layout={L}
        font={numFont}
        weight={bold}
      />
    ));

  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px} />
          </filter>
        </defs>
      )}

      <g opacity={state.grid}>
        <GridLayer frame={frame} tokens={tokens} mode={mode} />
      </g>

      {/* Upcoming and current pieces sit under the box line; done pieces are drawn above it. */}
      {pieceLayer('under')}

      {state.core > 0 && (
        <polygon points={svgPoints(frame, points)} fill={accent} fillOpacity={tokens.color.lens_tint_opacity * state.core} stroke="none" />
      )}
      <FigurePolygon frame={frame} points={points} tokens={tokens} mode={mode} t={state.chalk * (1 - state.inked)} ink={chalk} dash={tokens.stroke.trap.dash} showLabels={false} />
      <FigurePolygon frame={frame} points={points} tokens={tokens} mode={mode} t={state.chalk * state.inked} showLabels={false} />
      {glow && state.coreGlow > 0 && (
        <g filter={glowFilter} opacity={pulse * state.coreGlow}>
          <polygon points={svgPoints(frame, points)} fill="none" stroke={accent} strokeWidth={tokens.stroke.lens.width} strokeLinejoin={tokens.stroke.join} />
        </g>
      )}

      {glow && state.glow > 0 && state.boxFade > 0 && (
        <g filter={glowFilter} opacity={glow.opacity * state.glow * state.boxFade}>
          <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} t={state.box} stroke={tokens.stroke.lens} />
        </g>
      )}
      <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} t={state.box} opacity={state.boxFade} />
      {tip && (
        <g>
          {glow && <circle cx={toSvg(frame, tip)[0]} cy={toSvg(frame, tip)[1]} r={tokens.stroke.lens.width * 1.6} fill={accent} filter={glowFilter} opacity={glow.opacity} />}
          <circle cx={toSvg(frame, tip)[0]} cy={toSvg(frame, tip)[1]} r={tokens.stroke.lens.width * 1.6} fill={accent} />
        </g>
      )}

      {pieceLayer('over')}

      <VertexLabels frame={frame} points={points} box={box} size={T.vertex_label} ink={ink} chalk={chalk} chalkP={state.chalk} inked={state.inked} font={numFont} weight={tokens.type.scale.label.weight} />

      {/* Marks for the step on screen: legs and brackets with numbers from `detail`. */}
      {focus?.kind === 'box' && start?.detail?.kind === 'box' && (
        <g>
          <Bracket from={toSvg(frame, [box.x0, box.y0])} to={toSvg(frame, [box.x1, box.y0])} normal={[0, 1]} label={String(start.detail.width)} color={accent} t={state.legs} {...bracketProps} />
          <Bracket from={toSvg(frame, [box.x1, box.y0])} to={toSvg(frame, [box.x1, box.y1])} normal={[1, 0]} label={String(start.detail.height)} color={accent} t={state.legs} {...bracketProps} />
        </g>
      )}
      {focusIndex >= 0 && subs[focusIndex]?.detail?.kind === 'corner' && (() => {
        const d = subs[focusIndex]!.detail as CornerDetail;
        const legs = cornerLegs(d, box);
        const c = stepColor(focusIndex);
        const legStroke = { ...tokens.stroke.lens, width: P.current.stroke_width };
        return (
          <g>
            <ConstructionLine frame={frame} path={[legs.base.from, legs.base.to]} lens={lens} tokens={tokens} mode={mode} t={state.legs} stroke={legStroke} color={c} />
            <ConstructionLine frame={frame} path={[legs.height.from, legs.height.to]} lens={lens} tokens={tokens} mode={mode} t={state.legs} stroke={legStroke} color={c} />
            <Bracket from={toSvg(frame, legs.base.from)} to={toSvg(frame, legs.base.to)} normal={legs.base.normal} label={String(d.base)} color={c} t={state.legs} {...bracketProps} />
            <Bracket from={toSvg(frame, legs.height.from)} to={toSvg(frame, legs.height.to)} normal={legs.height.normal} label={String(d.height)} color={c} t={state.legs} {...bracketProps} />
          </g>
        );
      })()}

      {/* Title band: step badge + title on the left, lens chip on the right. */}
      {focus?.kind === 'box' && start && (
        <text x={margin} y={bandMid} fill={accent} fontFamily={jaFont} fontSize={T.step_title} fontWeight={bold} dominantBaseline="central" opacity={state.enter}>
          {stepTitle(start)}
        </text>
      )}
      {focusIndex >= 0 && subs[focusIndex] && (() => {
        const step = subs[focusIndex]!;
        const d = step.detail as CornerDetail;
        const c = stepColor(focusIndex);
        const r = T.badge * 0.78;
        return (
          <g opacity={state.enter}>
            <circle cx={margin + r} cy={bandMid} r={r} fill={c} />
            <text x={margin + r} y={bandMid} fill={paper} fontFamily={numFont} fontSize={T.badge} fontWeight={bold} textAnchor="middle" dominantBaseline="central">
              {d.n}
            </text>
            <text x={margin + 2 * r + T.badge * 0.4} y={bandMid} fill={c} fontFamily={jaFont} fontSize={T.step_title} fontWeight={bold} dominantBaseline="central">
              {stepTitle(step)}
            </text>
          </g>
        );
      })()}
      {state.chip > 0 && (
        <LensChip x={W - margin} y={bandMid} label={lensLabel} lens={lens} accent={accent} size={T.lens_chip} t={state.chip * (1 - state.trigger)} tokens={tokens} mode={mode} font={jaFont} />
      )}

      {/* Trap text below the figure: newest lines stay, older ones scroll off. */}
      {state.trapOpacity > 0 && (
        <TrapText steps={card.trap_route.steps} reveal={state.trapReveal} opacity={Math.max(state.trapOpacity, 0)} top={cardTop - T.trap_text * 0.4} bottom={safeBottom} left={margin} width={W - 2 * margin} size={T.trap_text} color={chalk} tokens={tokens} />
      )}

      {/* Formula card for the step on screen. */}
      {focus?.kind === 'box' && start?.detail?.kind === 'box' && (
        <FormulaCard text={`${start.detail.width}${TIMES}${start.detail.height} = ${formatExact(start.value ?? '')}`} color={accent} paper={paper} layout={L} t={state.formula} font={numFont} weight={bold} />
      )}
      {focusIndex >= 0 && subs[focusIndex] && (() => {
        const step = subs[focusIndex]!;
        const d = step.detail as CornerDetail;
        return (
          <FormulaCard text={`${d.base}${TIMES}${d.height} ÷ 2 = ${formatExact(step.value ?? '')}`} color={stepColor(focusIndex)} paper={paper} layout={L} t={state.formula} font={numFont} weight={bold} />
        );
      })()}

      {/* The equation: centred, every term in its step colour; future terms are placeholders. */}
      {state.terms[0] !== undefined && (focus !== null || state.removed.some((r) => r > 0) || state.result > 0) && (
        <Equation
          terms={[start, ...subs]}
          joined={state.terms}
          lit={state.termLit}
          colorOf={(i) => (i === 0 ? accent : stepColor(i - 1))}
          layout={L}
          font={numFont}
          weight={bold}
          opacity={1 - state.result}
          glowFilter={glowFilter}
        />
      )}

      {/* Answer: result line in the equation row, display_ja in the card row, trigger in the title band. */}
      {result && state.result > 0 && (() => {
        const size = Math.min(T.equation, (W - 2 * margin) / Math.max(1, textWidth(result.ja, 1)));
        return (
          <text x={W / 2} y={R.equation.baseline_y} textAnchor="middle" fill={ink} fontFamily={numFont} fontSize={size} fontWeight={bold} opacity={state.result}>
            {result.ja}
          </text>
        );
      })()}
      {state.display > 0 && (
        <text
          x={W / 2}
          y={R.formula_card.centre_y}
          transform={`translate(${W / 2} ${R.formula_card.centre_y}) scale(${state.display}) translate(${-W / 2} ${-R.formula_card.centre_y})`}
          opacity={Math.min(1, state.display)}
          fill={accent}
          fontFamily={fontFamily(tokens, tokens.type.scale.display, 'family_num')}
          fontSize={T.answer}
          fontWeight={tokens.type.scale.display.weight}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {answerText(card)}
        </text>
      )}
      {state.trigger > 0 && (() => {
        const lines = wrapText(card.trigger.ja, W - 2 * margin, T.trigger);
        const lh = T.trigger * 1.35;
        return (
          <g opacity={state.trigger} fill={ink} fontFamily={fontFamily(tokens, tokens.type.scale.trigger)} fontSize={T.trigger} fontWeight={tokens.type.scale.trigger.weight} textAnchor="middle">
            {lines.map((line, i) => (
              <text key={i} x={W / 2} y={bandMid + (i - (lines.length - 1) / 2) * lh} dominantBaseline="central">
                {line}
              </text>
            ))}
          </g>
        );
      })()}
    </g>
  );
}

interface CornerPieceProps {
  layer: 'under' | 'over';
  i: number;
  gap: Point[];
  frame: Frame;
  center: [number, number];
  state: MotionState;
  visible: boolean;
  focusIndex: number;
  stroke: string;
  value?: string;
  layout: ShortLayout;
  font: string;
  weight: number;
}

/**
 * One corner gap. Current: filled in its colour. Done: outline only, above the box line, with its
 * value. Upcoming: a faint outline. In subtract, done pieces slide outward and fade in order.
 */
function CornerPiece({ layer, i, gap, frame, center, state, visible, focusIndex, stroke, value, layout, font, weight }: CornerPieceProps) {
  if (!visible) return null;
  const { current, done, upcoming } = layout.pieces;
  const isCurrent = focusIndex === i;
  const isDone = !isCurrent && (state.done[i] ?? 0) > 0;
  const kind = isCurrent ? 'current' : isDone ? 'done' : 'upcoming';
  const wantsOver = kind === 'done' && done.draw_above_box;
  if ((layer === 'over') !== wantsOver) return null;

  const [gx, gy] = toSvg(frame, centroid(gap));
  const len = Math.hypot(gx - center[0], gy - center[1]) || 1;
  const removed = state.removed[i] ?? 0;
  const dx = ((gx - center[0]) / len) * SLIDE * removed;
  const dy = ((gy - center[1]) / len) * SLIDE * removed;
  const fade = 1 - removed;
  if (fade <= 0) return null;
  const pts = svgPoints(frame, gap);

  if (kind === 'current') {
    return (
      <polygon points={pts} fill={stroke} fillOpacity={current.fill_opacity * state.enter} stroke={stroke} strokeOpacity={state.enter} strokeWidth={current.stroke_width} strokeLinejoin="round" />
    );
  }
  if (kind === 'upcoming') {
    return <polygon points={pts} fill="none" stroke={stroke} strokeOpacity={upcoming.stroke_opacity} strokeWidth={upcoming.stroke_width} strokeLinejoin="round" />;
  }
  const lit = state.lit[i] ?? 0;
  return (
    <g transform={`translate(${dx} ${dy})`} opacity={fade}>
      <polygon points={pts} fill={stroke} fillOpacity={done.fill_opacity} stroke={stroke} strokeOpacity={done.stroke_opacity + (1 - done.stroke_opacity) * lit} strokeWidth={done.stroke_width} strokeLinejoin="round" />
      {value !== undefined && (
        <text x={gx} y={gy} fill={stroke} fontFamily={font} fontSize={layout.type_px.bracket_number * 0.9} fontWeight={weight} textAnchor="middle" dominantBaseline="central">
          {formatExact(value)}
        </text>
      )}
    </g>
  );
}

interface VertexLabelsProps {
  frame: Frame;
  points: Point[];
  box: Box;
  size: number;
  ink: string;
  chalk: string;
  chalkP: number;
  inked: number;
  font: string;
  weight: number;
}

/**
 * Vertex letters A, B, C…: outside the figure, but kept inside the enclosing box, so brackets
 * (which sit outside the box) never touch them.
 */
function VertexLabels({ frame, points, box, size, ink, chalk, chalkP, inked, font, weight }: VertexLabelsProps) {
  if (chalkP <= 0) return null;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return (
    <g fontFamily={font} fontSize={size} fontWeight={weight} textAnchor="middle" opacity={chalkP}>
      {points.map((p, i) => {
        let [dx, dy] = outwardDirection(points, i);
        // A vertex on the box: turn the offset back inside the box on that side.
        if ((p[0] === box.x0 && dx < 0) || (p[0] === box.x1 && dx > 0)) dx = -dx;
        if ((p[1] === box.y0 && dy < 0) || (p[1] === box.y1 && dy > 0)) dy = -dy;
        const len = Math.hypot(dx, dy) || 1;
        const [x, y] = toSvg(frame, p);
        const off = size * 0.95;
        const lx = x + (dx / len) * off;
        const ly = y - (dy / len) * off;
        return (
          <g key={i}>
            <text x={lx} y={ly} fill={chalk} opacity={1 - inked} dominantBaseline="central">
              {letters[i] ?? String(i + 1)}
            </text>
            <text x={lx} y={ly} fill={ink} opacity={inked} dominantBaseline="central">
              {letters[i] ?? String(i + 1)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface LensChipProps {
  x: number;
  y: number;
  label?: string;
  lens: LensCard['lens'];
  accent: string;
  size: number;
  t: number;
  tokens: Tokens;
  mode: RenderMode;
  font: string;
}

/** The lens chip `▣ 囲む`: icon + name in an outlined pill, right-aligned at x. */
function LensChip({ x, y, label, lens, accent, size, t, tokens, mode, font }: LensChipProps) {
  if (t <= 0) return null;
  const icon = size * 1.1;
  const pad = size * 0.5;
  const labelW = label ? textWidth(label, size) + size * 0.3 : 0;
  const w = pad + icon + labelW + pad;
  const h = size * 1.7;
  const left = x - w;
  return (
    <g transform={`translate(${x - w / 2} ${y}) scale(${t}) translate(${-(x - w / 2)} ${-y})`} opacity={Math.min(1, t)}>
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h / 2} fill="none" stroke={accent} strokeWidth={tokens.stroke.lens_construction.width} />
      <LensIcon lens={lens} tokens={tokens} mode={mode} x={left + pad} y={y - icon / 2} size={icon} />
      {label && (
        <text x={left + pad + icon + size * 0.3} y={y} fill={accent} fontFamily={font} fontSize={size} fontWeight={tokens.type.scale.title.weight} dominantBaseline="central">
          {label}
        </text>
      )}
    </g>
  );
}

interface FormulaCardProps {
  text: string;
  color: string;
  paper: string;
  layout: ShortLayout;
  t: number;
  font: string;
  weight: number;
}

/** A pill holding one formula, e.g. "5 × 2 ÷ 2 = 5", centred in the formula-card region. */
function FormulaCard({ text, color: c, paper, layout, t, font, weight }: FormulaCardProps) {
  if (t <= 0) return null;
  const { centre_y: y, width: w, height: h } = layout.regions.formula_card;
  const x = layout.size_px[0] / 2;
  return (
    <g opacity={t} transform={`translate(0 ${(1 - t) * 12})`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={paper} stroke={c} strokeWidth={4} />
      <text x={x} y={y} fill={c} fontFamily={font} fontSize={layout.type_px.formula} fontWeight={weight} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </g>
  );
}

interface EquationProps {
  terms: (Step | undefined)[];
  joined: number[];
  lit: number[];
  colorOf: (i: number) => string;
  layout: ShortLayout;
  font: string;
  weight: number;
  opacity: number;
  glowFilter?: string;
}

/** `36 − 5 − 4 − 6 − 1.5`, centred; each term joins in its colour, future terms show as `?`. */
function Equation({ terms, joined, lit, colorOf, layout, font, weight, opacity, glowFilter }: EquationProps) {
  if (opacity <= 0) return null;
  const { future_placeholder: placeholder, future_opacity: futureOpacity } = layout.equation_terms;
  const x = layout.size_px[0] / 2;
  const y = layout.regions.equation.baseline_y;
  const parts = terms.map((step, i) => {
    const j = joined[i] ?? 0;
    const shown = j >= 0.5 && step?.value !== undefined;
    const text = shown ? formatExact(step!.value!) : placeholder;
    return {
      prefix: i === 0 ? '' : MINUS,
      text,
      fill: colorOf(i),
      opacity: shown ? futureOpacity + (1 - futureOpacity) * Math.min(1, (j - 0.5) * 2) : futureOpacity,
    };
  });
  const common = { x, y, textAnchor: 'middle' as const, fontFamily: font, fontSize: layout.type_px.equation, fontWeight: weight };
  return (
    <g opacity={opacity}>
      {glowFilter && lit.some((l) => l > 0) && (
        <text {...common} filter={glowFilter}>
          {parts.map((p, i) => (
            <tspan key={i} fill={p.fill} opacity={lit[i] ?? 0}>
              {p.prefix + p.text}
            </tspan>
          ))}
        </text>
      )}
      <text {...common}>
        {parts.map((p, i) => (
          <tspan key={i} fill={p.fill} opacity={p.opacity}>
            {p.prefix + p.text}
          </tspan>
        ))}
      </text>
    </g>
  );
}

interface TrapTextProps {
  steps: Step[];
  reveal: number;
  opacity: number;
  top: number;
  bottom: number;
  left: number;
  width: number;
  size: number;
  color: string;
  tokens: Tokens;
}

/** Trap lines one by one in the chalk hand. When they don't all fit, the oldest scroll off. */
function TrapText({ steps, reveal, opacity, top, bottom, left, width, size, color: c, tokens }: TrapTextProps) {
  const lh = size * 1.4;
  const shown = Math.min(steps.length, Math.ceil(reveal * steps.length - 1e-9));
  if (shown <= 0) return null;
  const newest = reveal * steps.length - (shown - 1);
  const lines = steps.slice(0, shown).flatMap((s, i) => wrapText(s.ja, width, size).map((text) => ({ text, step: i })));
  const fit = Math.max(1, Math.floor((bottom - top) / lh));
  const visible = lines.slice(-fit);
  return (
    <g opacity={opacity} fill={c} fontFamily={fontFamily(tokens, tokens.type.scale.scratch)} fontSize={size}>
      {visible.map((line, i) => (
        <text key={`${line.step}-${i}`} x={left} y={top + (i + 0.8) * lh} opacity={line.step === shown - 1 ? Math.min(1, newest * 2) : 1}>
          {line.text}
        </text>
      ))}
    </g>
  );
}
