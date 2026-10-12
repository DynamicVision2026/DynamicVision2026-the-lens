import { parseEasing } from '../easing';
import { answerText, formatExact } from '../format';
import { boundingBox, boxCorners, centroid, enclosureGaps, outwardDirection, partialPolyline, type Box } from '../geometry';
import { BAND_END_ROOM, BandFigure, Bracket, ConstructionLine, MirrorFigure, StoryText, storyHeight, UnfoldFigure, WordDiagram, FigurePolygon, GridLayer, LensIcon, makeFrame, svgPoints, toSvg, type Frame } from '../primitives';
import { wrapText } from '../text';
import { color, fontFamily, lensColor, type LensOrDirect, type RenderMode } from '../tokens';
import { timeLabel } from '../format';
import type { BoxUnfoldFigure, GlowToken, GridPolygonFigure, LensCard, MirrorPathFigure, ParallelBandFigure, WordProblemFigure, Point, ShortLayout, Step, StepDetail, Tokens } from '../types';
import { bandLayout, bandTriangles } from '../band';
import { mirrorLayout, touchX } from '../mirror';
import { unfoldLayout } from '../unfold';
import { motionState, type MotionState } from './beats';
import { titleBandText } from './titleBand';
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
  /** Button text per picker option (bundle.labels.lenses[option].ja), for the freeze beat. */
  optionLabels?: Record<string, string>;
}

/** Fixed copy of the Short (WO-003): the freeze question and the series end card. */
export const SHORT_COPY = {
  freeze: 'どのレンズ？',
  series: '視点レンズ ― 無料で1レンズ試せます',
  url: 'lens.beyondculture.ai',
} as const;

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

/** Stand-in grid for figures that are not grids (their drawing goes through BandLayer instead). */
const NO_GRID: { grid: GridPolygonFigure['grid']; points: Point[] } = { grid: { width: 1, height: 1, cell_cm: 1 }, points: [] };

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
export function MotionScene({ card, beats, beat, t, tokens: baseTokens, glow, mode, lensLabel, optionLabels }: MotionSceneProps) {
  const tokens = scaleStrokes(baseTokens, STROKE_SCALE);
  const L = tokens.layout.short;
  const { regions: R, type_px: T, pieces: P, brackets: BR } = L;
  const [W] = L.size_px;
  const safeBottom = L.size_px[1] - L.safe_bottom_px;
  const margin = R.figure.min_margin_px;

  const figure = card.problem.figure;
  const gridFig = figure.type === 'grid_polygon' ? figure : null;
  const bandFig = figure.type === 'parallel_band' ? figure : null;
  const mirrorFig = figure.type === 'mirror_path' ? figure : null;
  const unfoldFig = figure.type === 'box_unfold' ? figure : null;
  const wordFig = figure.type === 'word_problem' ? figure : null;
  const { grid, points } = gridFig ?? NO_GRID;
  const gaps = enclosureGaps(points);
  const steps = card.lens_route.steps;
  const start = steps.find((s) => s.op === 'start');
  const subs = steps.filter((s) => s.op === 'sub');
  const result = steps.find((s) => s.op === 'result');
  const state = motionState(beats, beat, t, {
    corners: gaps.length,
    apexes: bandFig ? bandTriangles(bandFig) : 0,
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
        patternPrefix={`lens-${card.id}`}
      />
    ));

  const content = 1 - state.endCard;
  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px} />
          </filter>
        </defs>
      )}

      <g opacity={content}>
      {gridFig && (
      <>
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

      </>
      )}

      {bandFig && (
        <BandLayer
          fig={bandFig}
          state={state}
          layout={L}
          tokens={tokens}
          ink={ink}
          chalk={chalk}
          accent={accent}
          palette={palette.map((c) => color(c, mode))}
          font={numFont}
          weight={tokens.type.scale.label.weight}
          idPrefix={`lens-${card.id}`}
          glowFilter={glowFilter}
          glowOpacity={state.coreGlow > 0 ? pulse : glow?.opacity}
          bottom={cardTop}
        />
      )}
      {mirrorFig && (
        <MirrorLayer
          card={card}
          fig={mirrorFig}
          state={state}
          layout={L}
          tokens={tokens}
          ink={ink}
          chalk={chalk}
          accent={accent}
          palette={palette.map((c) => color(c, mode))}
          font={numFont}
          weight={tokens.type.scale.label.weight}
          idPrefix={`lens-${card.id}`}
          glowFilter={glowFilter}
          glowOpacity={glow?.opacity}
          bottom={cardTop}
        />
      )}
      {unfoldFig && (
        <UnfoldLayer
          card={card}
          fig={unfoldFig}
          state={state}
          layout={L}
          tokens={tokens}
          ink={ink}
          chalk={chalk}
          accent={accent}
          palette={palette.map((c) => color(c, mode))}
          font={numFont}
          weight={tokens.type.scale.label.weight}
          idPrefix={`lens-${card.id}`}
          glowFilter={glowFilter}
          glowOpacity={glow?.opacity}
          bottom={cardTop}
        />
      )}
      {wordFig && (
        <WordLayer
          card={card}
          fig={wordFig}
          state={state}
          layout={L}
          tokens={tokens}
          ink={ink}
          chalk={chalk}
          accent={accent}
          palette={palette.map((c) => color(c, mode))}
          font={numFont}
          weight={tokens.type.scale.label.weight}
          idPrefix={`lens-${card.id}`}
          bottom={cardTop}
        />
      )}
      {/* The lens step being shown, in the formula-card row (these figures leave it free). */}
      {!gridFig && state.captionStep >= 0 && state.caption > 0 && card.lens_route.steps[state.captionStep] && (
        <CentredLines text={card.lens_route.steps[state.captionStep]!.ja} x={W / 2} y={R.formula_card.centre_y} width={W - 2 * margin} size={T.trigger} fill={accent} opacity={state.caption} font={jaFont} weight={bold} />
      )}

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
        <TrapText steps={card.trap_route.steps} reveal={state.trapReveal} opacity={Math.max(state.trapOpacity, 0)} top={cardTop - T.trap_text * 0.4} bottom={state.timeStrip > 0 ? safeBottom - T.trigger * 2.4 : safeBottom} left={margin} width={W - 2 * margin} size={T.trap_text} color={chalk} tokens={tokens} />
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
      {gridFig && state.terms[0] !== undefined && (focus !== null || state.removed.some((r) => r > 0) || state.result > 0) && (
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
      {state.trigger > 0 && (
        <TitleBandLines text={card.trigger.ja} x={W / 2} width={W - 2 * margin} layout={L} fill={ink} opacity={state.trigger} font={fontFamily(tokens, tokens.type.scale.trigger)} weight={tokens.type.scale.trigger.weight} />
      )}

      {/* Short only: the question (hook, trap), the trap time strip, the four lens buttons (freeze). */}
      {state.question > 0 && (
        <TitleBandLines text={card.problem.text_ja} x={W / 2} width={W - 2 * margin} layout={L} fill={ink} opacity={state.question} font={jaFont} weight={bold} />
      )}
      {state.timeStrip > 0 && (
        <TimeBar
          y={safeBottom - T.trigger}
          left={margin}
          width={W - 2 * margin}
          rows={[{ seconds: card.trap_route.time_cost_sec, fill: color(tokens.color.trap.flag, mode), template: tokens.time_cost.trap_label_ja, p: state.timeStrip }]}
          max={card.trap_route.time_cost_sec}
          badge={tokens.time_cost.source_badge[card.trap_route.time_source]}
          size={T.trigger}
          barHeight={tokens.time_cost.bar_height * STROKE_SCALE * 2}
          ink={ink}
          quiet={color(tokens.color.ink_quiet, mode)}
          font={numFont}
          jaFont={jaFont}
          weight={bold}
        />
      )}
      {state.freezeTitle > 0 && (
        <text x={W / 2} y={bandMid} fill={ink} fontFamily={jaFont} fontSize={T.step_title} fontWeight={bold} textAnchor="middle" dominantBaseline="central" opacity={state.freezeTitle}>
          {SHORT_COPY.freeze}
        </text>
      )}
      {state.buttons > 0 && state.buttonsOut < 1 && (
        <LensButtons
          options={card.picker.options as LensOrDirect[]}
          correct={card.picker.correct}
          labels={optionLabels ?? {}}
          appear={state.buttons}
          pick={state.pick}
          leave={state.buttonsOut}
          layout={L}
          accent={accent}
          ink={ink}
          paper={paper}
          tokens={tokens}
          mode={mode}
          font={jaFont}
          weight={bold}
        />
      )}
      </g>

      {state.endCard > 0 && (
        <g opacity={state.endCard}>
          <CentredLines text={card.trigger.ja} x={W / 2} y={R.figure.y + 160} width={W - 2 * margin} size={T.step_title} fill={accent} opacity={1} font={jaFont} weight={bold} />
          <TimeBar
            y={R.figure.y + 420}
            left={margin}
            width={W - 2 * margin}
            rows={[
              { seconds: card.trap_route.time_cost_sec, fill: color(tokens.color.trap.flag, mode), template: tokens.time_cost.trap_label_ja, p: 1 },
              { seconds: card.lens_route.time_cost_sec, fill: accent, template: tokens.time_cost.lens_label_ja, p: 1 },
            ]}
            max={card.trap_route.time_cost_sec}
            badge={tokens.time_cost.source_badge[card.lens_route.time_source]}
            saved={timeLabel(tokens.time_cost.saved_label_ja, card.trap_route.time_cost_sec - card.lens_route.time_cost_sec)}
            size={T.trigger}
            barHeight={tokens.time_cost.bar_height * STROKE_SCALE * 2}
            ink={ink}
            quiet={color(tokens.color.ink_quiet, mode)}
            font={numFont}
            jaFont={jaFont}
            weight={bold}
          />
          <text x={W / 2} y={R.formula_card.centre_y} fill={ink} fontFamily={jaFont} fontSize={T.step_title} fontWeight={bold} textAnchor="middle" dominantBaseline="central">
            {SHORT_COPY.series}
          </text>
          <text x={W / 2} y={R.equation.baseline_y} fill={accent} fontFamily={numFont} fontSize={T.trigger} fontWeight={bold} textAnchor="middle">
            {SHORT_COPY.url}
          </text>
        </g>
      )}
    </g>
  );
}

interface BandLayerProps {
  fig: ParallelBandFigure;
  state: MotionState;
  layout: ShortLayout;
  tokens: Tokens;
  ink: string;
  chalk: string;
  accent: string;
  palette: string[];
  font: string;
  weight: number;
  idPrefix: string;
  glowFilter?: string;
  glowOpacity?: number;
  /** Lowest y the figure may use (the formula-card row). */
  bottom: number;
}

/** The parallel band at Short size: chalk while the trap plays, then ink, triangles striped in their colours. */
function BandLayer({ fig, state, layout: L, tokens, ink, chalk, accent, palette, font, weight, idPrefix, glowFilter, glowOpacity, bottom }: BandLayerProps) {
  const { regions: R, type_px: T, pieces: P, brackets: BR } = L;
  const [W] = L.size_px;
  const margin = R.figure.min_margin_px;
  const inset = Math.max(BR.offset_px + T.bracket_number * 1.4, T.vertex_label * BAND_END_ROOM);
  const layout = bandLayout(fig, margin, R.figure.y + T.vertex_label, W - 2 * margin, bottom - R.figure.y - 3 * T.vertex_label - BR.offset_px, inset);
  const common = {
    fig,
    layout,
    tokens,
    accent,
    font,
    weight,
    labelSize: T.vertex_label,
    figureStroke: tokens.stroke.figure.width,
    lensStroke: P.current.stroke_width,
    bracket: { offset: BR.offset_px, tick: BR.tick_px / 2, numberSize: T.bracket_number, strokeWidth: tokens.stroke.lens_construction.width },
    parallel: state.parallel,
    slid: state.slid,
    merged: state.merged,
    focus: state.bandFocus,
    dim: tokens.motion.study.dim_others_opacity,
    tint: P.current.fill_opacity,
    stripes: P.current.stripes,
    glowFilter,
    glowOpacity,
  };
  return (
    <g>
      <g opacity={1 - state.inked}>
        <BandFigure {...common} ink={chalk} palette={palette.map(() => chalk)} show={state.chalk} idPrefix={`${idPrefix}-chalk`} />
      </g>
      <g opacity={state.inked}>
        <BandFigure {...common} ink={ink} palette={palette} show={state.chalk} idPrefix={idPrefix} />
      </g>
    </g>
  );
}

interface MirrorLayerProps extends Omit<BandLayerProps, 'fig'> {
  card: LensCard;
  fig: MirrorPathFigure;
}

/** The shortest-path figure at Short size: chalk while the trap plays (with the midpoint guess), then ink. */
function MirrorLayer({ card, fig, state, layout: L, tokens, ink, chalk, accent, palette, font, weight, idPrefix, glowFilter, glowOpacity, bottom }: MirrorLayerProps) {
  const { regions: R, type_px: T, pieces: P, brackets: BR } = L;
  const [W] = L.size_px;
  const margin = R.figure.min_margin_px;
  const layout = mirrorLayout(fig, margin, R.figure.y + T.vertex_label, W - 2 * margin, bottom - R.figure.y - 2 * T.vertex_label - BR.offset_px - 1.5 * T.bracket_number, T.vertex_label * 3);
  const common = {
    fig,
    layout,
    touchX: touchX(card),
    tokens,
    chalk,
    accent,
    font,
    weight,
    labelSize: T.vertex_label,
    figureStroke: tokens.stroke.figure.width,
    lensStroke: P.current.stroke_width,
    dash: tokens.stroke.trap.dash,
    bracket: { offset: BR.offset_px, tick: BR.tick_px / 2, numberSize: T.bracket_number, strokeWidth: tokens.stroke.lens_construction.width },
    show: state.chalk,
    tryPath: state.trapDemo,
    tryDim: state.trapDemoDim,
    reflect: state.reflect,
    straight: state.straight,
    similar: state.similar,
    tint: P.current.fill_opacity,
    stripes: P.current.stripes,
    glowFilter,
    glowOpacity,
  };
  return (
    <g>
      <g opacity={1 - state.inked}>
        <MirrorFigure {...common} ink={chalk} palette={palette.map(() => chalk)} idPrefix={`${idPrefix}-chalk`} />
      </g>
      <g opacity={state.inked}>
        <MirrorFigure {...common} ink={ink} palette={palette} idPrefix={idPrefix} />
      </g>
    </g>
  );
}

interface TitleBandLinesProps {
  text: string;
  x: number;
  width: number;
  layout: ShortLayout;
  fill: string;
  opacity: number;
  font: string;
  weight: number;
}

/** Long text in the title band: anchored at its top, growing downward (see titleBand.ts). */
function TitleBandLines({ text, x, width, layout, fill, opacity, font, weight }: TitleBandLinesProps) {
  const block = titleBandText(text, width, layout);
  return (
    <g opacity={opacity} fill={fill} fontFamily={font} fontSize={block.size} fontWeight={weight} textAnchor="middle">
      {block.lines.map((line, i) => (
        <text key={i} x={x} y={block.ys[i]} dominantBaseline="central">
          {line}
        </text>
      ))}
    </g>
  );
}

interface UnfoldLayerProps extends Omit<BandLayerProps, 'fig'> {
  card: LensCard;
  fig: BoxUnfoldFigure;
}

/** The box-net figure at Short size: chalk while the trap plays (with the midpoint guess), then ink. */
function UnfoldLayer({ card, fig, state, layout: L, tokens, ink, chalk, accent, palette, font, weight, idPrefix, glowFilter, glowOpacity, bottom }: UnfoldLayerProps) {
  const { regions: R, type_px: T, pieces: P, brackets: BR } = L;
  const [W] = L.size_px;
  const margin = R.figure.min_margin_px;
  const layout = unfoldLayout(fig, margin, R.figure.y, W - 2 * margin, bottom - R.figure.y, T.vertex_label * 2.2, BR.offset_px + T.vertex_label * 1.2 + T.bracket_number * 4);
  const common = {
    fig,
    layout,
    crossY: touchX(card),
    answerText: answerText(card),
    tokens,
    chalk,
    accent,
    font,
    weight,
    labelSize: T.vertex_label,
    figureStroke: tokens.stroke.figure.width,
    lensStroke: P.current.stroke_width,
    dash: tokens.stroke.trap.dash,
    bracket: { offset: BR.offset_px, tick: BR.tick_px / 2, numberSize: T.bracket_number, strokeWidth: tokens.stroke.lens_construction.width },
    show: state.chalk,
    tryPath: state.trapDemo,
    tryDim: state.trapDemoDim,
    unfold: state.unfold,
    straight: state.straight,
    similar: state.similar,
    answer: state.core,
    tint: P.current.fill_opacity,
    stripes: P.current.stripes,
    glowFilter,
    glowOpacity,
  };
  return (
    <g>
      <g opacity={1 - state.inked}>
        <UnfoldFigure {...common} ink={chalk} palette={palette.map(() => chalk)} idPrefix={`${idPrefix}-chalk`} />
      </g>
      <g opacity={state.inked}>
        <UnfoldFigure {...common} ink={ink} palette={palette} idPrefix={idPrefix} />
      </g>
    </g>
  );
}

interface WordLayerProps extends Omit<BandLayerProps, 'fig' | 'glowFilter' | 'glowOpacity'> {
  card: LensCard;
  fig: WordProblemFigure;
}

/**
 * A word problem at Short size: the story (numbers highlighted) on top of the figure region, the
 * diagram below it. In the full Short the hook shows the question in the title band, so the story
 * waits until that has gone.
 */
function WordLayer({ card, fig, state, layout: L, tokens, ink, chalk, accent, palette, font, weight, bottom }: WordLayerProps) {
  const { regions: R, type_px: T, pieces: P, brackets: BR } = L;
  const [W] = L.size_px;
  const margin = R.figure.min_margin_px;
  const width = W - 2 * margin;
  const top = storyHeight(card.problem.text_ja, width, T.trigger);
  const jaFont = fontFamily(tokens, tokens.type.scale.title);
  // The story steps aside while the title band holds the question (hook) or the trigger (answer).
  const storyOpacity = state.chalk * (1 - state.question) * (1 - state.trigger);
  const anyStep = Object.values(state.figureProg).some((v) => v > 0);
  return (
    <g>
      <StoryText text={card.problem.text_ja} x={margin} y={R.figure.y - T.trigger} width={width} size={T.trigger} ink={state.inked > 0.5 ? ink : chalk} accent={accent} font={jaFont} weight={tokens.type.scale.title.weight} highlight={state.inked} opacity={storyOpacity} />
      <WordDiagram
        card={card}
        fig={fig}
        x={margin}
        y={R.figure.y - T.trigger + top}
        w={width}
        h={bottom - (R.figure.y - T.trigger + top) - BR.offset_px}
        prog={state.figureProg}
        tokens={tokens}
        ink={ink}
        accent={accent}
        palette={palette}
        font={font}
        jaFont={jaFont}
        weight={weight}
        labelSize={T.vertex_label}
        numberSize={T.bracket_number}
        figureStroke={tokens.stroke.figure.width}
        lensStroke={P.current.stroke_width}
        dash={tokens.stroke.trap.dash}
        bracket={{ offset: BR.offset_px, tick: BR.tick_px / 2, strokeWidth: tokens.stroke.lens_construction.width }}
        tint={P.current.fill_opacity * 2}
        show={anyStep ? 1 : 0}
        answer={state.core}
        chalk={chalk}
      />
    </g>
  );
}

interface CentredLinesProps {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  fill: string;
  opacity: number;
  font: string;
  weight: number;
}

/** Wrapped text, centred horizontally and vertically on y. */
function CentredLines({ text, x, y, width, size, fill, opacity, font, weight }: CentredLinesProps) {
  const lines = wrapText(text, width, size);
  const lh = size * 1.35;
  return (
    <g opacity={opacity} fill={fill} fontFamily={font} fontSize={size} fontWeight={weight} textAnchor="middle">
      {lines.map((line, i) => (
        <text key={i} x={x} y={y + (i - (lines.length - 1) / 2) * lh} dominantBaseline="central">
          {line}
        </text>
      ))}
    </g>
  );
}

interface TimeBarRow {
  seconds: number;
  fill: string;
  template: string;
  /** 0–1 growth of the bar. */
  p: number;
}

interface TimeBarProps {
  y: number;
  left: number;
  width: number;
  rows: TimeBarRow[];
  max: number;
  badge: string;
  saved?: string;
  size: number;
  barHeight: number;
  ink: string;
  quiet: string;
  font: string;
  jaFont: string;
  weight: number;
}

/** Time strip at Short size: bars grow to each route's time, labels from the time_cost templates. */
function TimeBar({ y, left, width, rows, max, badge, saved, size, barHeight, ink, quiet, font, jaFont, weight }: TimeBarProps) {
  const labelRoom = size * 4.2;
  const barW = width - labelRoom;
  const rowH = size * 1.5;
  return (
    <g>
      {rows.map((row, i) => {
        const cy = y + i * rowH;
        const w = (barW * row.seconds * row.p) / Math.max(1, max);
        return (
          <g key={i}>
            <rect x={left} y={cy - barHeight / 2} width={w} height={barHeight} rx={barHeight / 2} fill={row.fill} />
            <text x={left + w + size * 0.3} y={cy} fill={ink} fontFamily={font} fontSize={size} dominantBaseline="central">
              {timeLabel(row.template, row.seconds * row.p)}
            </text>
          </g>
        );
      })}
      <text x={left + width} y={y - rowH * 0.8} fill={quiet} fontFamily={jaFont} fontSize={size * 0.8} textAnchor="end" dominantBaseline="central">
        {badge}
      </text>
      {saved && (
        <text x={left} y={y + rows.length * rowH + size * 0.2} fill={ink} fontFamily={jaFont} fontSize={size} fontWeight={weight} dominantBaseline="central">
          {saved}
        </text>
      )}
    </g>
  );
}

interface LensButtonsProps {
  options: LensOrDirect[];
  correct: string;
  labels: Record<string, string>;
  appear: number;
  pick: number;
  leave: number;
  layout: ShortLayout;
  accent: string;
  ink: string;
  paper: string;
  tokens: Tokens;
  mode: RenderMode;
  font: string;
  weight: number;
}

/** The four lens buttons in a 2 × 2 grid below the figure; the correct one lights up on the pick. */
function LensButtons({ options, correct, labels, appear, pick, leave, layout, accent, ink, paper, tokens, mode, font, weight }: LensButtonsProps) {
  const W = layout.size_px[0];
  const margin = layout.regions.figure.min_margin_px;
  const gap = margin / 2;
  const w = (W - 2 * margin - gap) / 2;
  const h = layout.regions.formula_card.height * 0.85;
  // Two rows that end inside the safe area, under the figure.
  const safeBottom = layout.size_px[1] - layout.safe_bottom_px;
  const top = safeBottom - 2 * h - gap - gap / 2;
  const size = layout.type_px.trigger;
  return (
    <g opacity={Math.min(1, appear) * (1 - leave)}>
      {options.map((opt, i) => {
        const x = margin + (i % 2) * (w + gap);
        const y = top + Math.floor(i / 2) * (h + gap);
        const isCorrect = opt === correct;
        const dim = isCorrect ? 1 : 1 - 0.65 * pick;
        const stroke = isCorrect ? accent : ink;
        const icon = size * 1.1;
        const cx = x + w / 2;
        const cy = y + h / 2;
        return (
          <g key={opt} opacity={dim} transform={`translate(${cx} ${cy}) scale(${Math.min(1, appear) + (isCorrect ? 0.06 * pick : 0)}) translate(${-cx} ${-cy})`}>
            <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={isCorrect && pick > 0 ? accent : paper} fillOpacity={isCorrect ? 0.18 * pick : 1} stroke={stroke} strokeOpacity={isCorrect ? 0.5 + 0.5 * pick : 0.5} strokeWidth={tokens.stroke.lens_construction.width * (isCorrect ? 1 + pick : 1)} />
            {/* Icons in ink, so no button stands out before the pick; only the correct one lights up. */}
            <LensIcon lens={opt} tokens={tokens} mode={mode} x={x + h * 0.35} y={cy - icon / 2} size={icon} color={isCorrect && pick > 0 ? accent : ink} />
            <text x={x + h * 0.35 + icon + size * 0.4} y={cy} fill={isCorrect && pick > 0 ? accent : ink} fontFamily={font} fontSize={size} fontWeight={weight} dominantBaseline="central">
              {labels[opt] ?? opt}
            </text>
          </g>
        );
      })}
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
  /** Prefix for this scene's SVG ids (pattern per piece). */
  patternPrefix: string;
}

/**
 * One corner gap. Current: a faint tint with diagonal stripes in its full colour (keeps the hue true on navy). Done: outline only, above the box line, with its
 * value. Upcoming: a faint outline. In subtract, done pieces slide outward and fade in order.
 */
function CornerPiece({ layer, i, gap, frame, center, state, visible, focusIndex, stroke, value, layout, font, weight, patternPrefix }: CornerPieceProps) {
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
    const stripes = current.stripes;
    const patternId = `${patternPrefix}-stripes-${i}`;
    return (
      <g>
        {stripes && (
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={stripes.period_px} height={stripes.period_px} patternTransform={`rotate(${stripes.angle_deg})`}>
              <rect x={0} y={0} width={stripes.stripe_px} height={stripes.period_px} fill={stroke} />
            </pattern>
          </defs>
        )}
        <polygon points={pts} fill={stroke} fillOpacity={current.fill_opacity * state.enter} stroke="none" />
        {stripes && <polygon points={pts} fill={`url(#${patternId})`} opacity={stripes.opacity * state.enter} stroke="none" />}
        <polygon points={pts} fill="none" stroke={stroke} strokeOpacity={state.enter} strokeWidth={current.stroke_width} strokeLinejoin="round" />
      </g>
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
  // Keep whole steps only: the newest steps that fit, never half a sentence.
  const fit = Math.max(1, Math.floor((bottom - top) / lh));
  const blocks = steps.slice(0, shown).map((s, i) => wrapText(s.ja, width, size).map((text) => ({ text, step: i })));
  const kept: typeof blocks = [];
  let used = 0;
  for (let b = blocks.length - 1; b >= 0; b--) {
    if (used + blocks[b]!.length > fit && kept.length > 0) break;
    kept.unshift(blocks[b]!);
    used += blocks[b]!.length;
  }
  const visible = kept.flat();
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
