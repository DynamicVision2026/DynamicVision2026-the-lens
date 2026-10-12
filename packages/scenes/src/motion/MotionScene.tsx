import { parseEasing } from '../easing';
import { answerText, formatExact } from '../format';
import { boundingBox, boxCorners, centroid, enclosureGaps, partialPolyline, type Box } from '../geometry';
import { Bracket, ConstructionLine, FigurePolygon, GridLayer, LensIcon, makeFrame, svgPoints, toSvg, TrapScratch, type Frame } from '../primitives';
import { wrapText } from '../text';
import { color, fontFamily, fontSize, lensColor, type RenderMode } from '../tokens';
import type { GlowToken, LensCard, Point, Step, StepDetail, Tokens } from '../types';
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
  width: number;
  /** Lens name for the chip beside the icon (bundle.labels); icon only when absent. */
  lensLabel?: string;
}

/**
 * Figure area for the study layout: room above for the lens chip, and around the box for
 * brackets and their numbers, so letters, numbers and badges never overlap.
 */
const FIG = { left: 52, top: 92, right: 52, bottom: 64, bandTop: 420 };
const ROW = { title: 452, formula: 497, equation: 544, display: 504, result: 544, trigger: 590 };
/** How far a corner slides outward while it is subtracted, in scene units (~24 px in the Short). */
const SLIDE = 11;
const MINUS = ' − ';
const TIMES = ' × ';

type CornerDetail = Extract<StepDetail, { kind: 'corner' }>;

/** Title of a corner step: its `ja` up to the first space (the formula is shown on its own card). */
function stepTitle(step: Step): string {
  return step.ja.split(/[\s　]/)[0] ?? step.ja;
}

/** Base and height marks for a corner, from its verified detail: positions only, no measuring. */
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
export function MotionScene({ card, beats, beat, t, tokens, glow, mode, width, lensLabel }: MotionSceneProps) {
  const { grid, points } = card.problem.figure;
  const gaps = enclosureGaps(points);
  const steps = card.lens_route.steps;
  const start = steps.find((s) => s.op === 'start');
  const subs = steps.filter((s) => s.op === 'sub');
  const result = steps.find((s) => s.op === 'result');
  const trapLines = card.trap_route.steps;
  const state = motionState(beats, beat, t, {
    corners: gaps.length,
    trapLines: trapLines.length,
    tokens,
    ease: parseEasing(tokens.motion.easing),
    spring: tokens.motion.spring,
  });

  const frame = makeFrame(grid, FIG.left, FIG.top, width - FIG.left - FIG.right, FIG.bandTop - FIG.top - FIG.bottom);
  const lens = card.lens;
  const accent = lensColor(tokens, lens, mode);
  const ink = color(tokens.color.ink, mode);
  const paper = color(tokens.color.paper, mode);
  const chalk = color(tokens.color.trap.ink, mode);
  const palette = tokens.color.step.palette;
  const stepColor = (i: number) => color(palette[i % palette.length]!, mode);
  const dim = tokens.motion.study.dim_others_opacity;
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
  const titleSize = fontSize(tokens, 'title', mode);
  const labelSize = fontSize(tokens, 'label', mode);

  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px / 2} />
          </filter>
        </defs>
      )}

      <g opacity={state.grid}>
        <GridLayer frame={frame} tokens={tokens} mode={mode} />
      </g>

      {gaps.map((gap, i) => (
        <CornerPiece key={`piece${i}`} i={i} gap={gap} frame={frame} center={[cx, cy]} state={state} focusIndex={focusIndex} fill={stepColor(i)} tintOpacity={tokens.color.step.tint_opacity} dim={dim} tokens={tokens} />
      ))}

      {state.core > 0 && (
        <polygon points={svgPoints(frame, points)} fill={accent} fillOpacity={tokens.color.lens_tint_opacity * state.core} stroke="none" />
      )}
      <FigurePolygon frame={frame} points={points} tokens={tokens} mode={mode} t={state.chalk * (1 - state.inked)} ink={chalk} dash={tokens.stroke.trap.dash} />
      <FigurePolygon frame={frame} points={points} tokens={tokens} mode={mode} t={state.chalk * state.inked} />
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

      {/* Marks for the step on screen: brackets with numbers from `detail`. */}
      {focus?.kind === 'box' && start?.detail?.kind === 'box' && (
        <g>
          <Bracket from={toSvg(frame, [box.x0, box.y0])} to={toSvg(frame, [box.x1, box.y0])} normal={[0, 1]} label={String(start.detail.width)} color={accent} tokens={tokens} mode={mode} t={state.legs} />
          <Bracket from={toSvg(frame, [box.x1, box.y0])} to={toSvg(frame, [box.x1, box.y1])} normal={[1, 0]} label={String(start.detail.height)} color={accent} tokens={tokens} mode={mode} t={state.legs} />
        </g>
      )}
      {focusIndex >= 0 && subs[focusIndex]?.detail?.kind === 'corner' && (() => {
        const d = subs[focusIndex]!.detail as CornerDetail;
        const legs = cornerLegs(d, box);
        const c = stepColor(focusIndex);
        return (
          <g>
            <ConstructionLine frame={frame} path={[legs.base.from, legs.base.to]} lens={lens} tokens={tokens} mode={mode} t={state.legs} stroke={tokens.stroke.lens} color={c} />
            <ConstructionLine frame={frame} path={[legs.height.from, legs.height.to]} lens={lens} tokens={tokens} mode={mode} t={state.legs} stroke={tokens.stroke.lens} color={c} />
            <Bracket from={toSvg(frame, legs.base.from)} to={toSvg(frame, legs.base.to)} normal={legs.base.normal} label={String(d.base)} color={c} tokens={tokens} mode={mode} t={state.legs} />
            <Bracket from={toSvg(frame, legs.height.from)} to={toSvg(frame, legs.height.to)} normal={legs.height.normal} label={String(d.height)} color={c} tokens={tokens} mode={mode} t={state.legs} />
          </g>
        );
      })()}

      {/* Lens chip: icon and its name, above the figure. */}
      {state.chip > 0 && (
        <g transform={`translate(${width / 2} 24) scale(${state.chip}) translate(${-width / 2} -24)`} opacity={Math.min(1, state.chip)}>
          <LensIcon lens={lens} tokens={tokens} mode={mode} x={lensLabel ? width / 2 - 34 : width / 2 - 14} y={10} size={28} />
          {lensLabel && (
            <text x={width / 2 + 2} y={24} fill={accent} fontFamily={jaFont} fontSize={titleSize} fontWeight={tokens.type.scale.title.weight} dominantBaseline="central">
              {lensLabel}
            </text>
          )}
        </g>
      )}

      {state.trapOpacity > 0 && (
        <g opacity={state.trapOpacity}>
          <TrapScratch steps={trapLines} x={FIG.left} y={FIG.bandTop + 6} width={width - 2 * FIG.left} tokens={tokens} mode={mode} t={state.trapReveal} />
        </g>
      )}

      {/* Title row and formula card for the step on screen. */}
      {focus?.kind === 'box' && start?.detail?.kind === 'box' && (
        <g opacity={state.enter}>
          <text x={width / 2} y={ROW.title} fill={accent} fontFamily={jaFont} fontSize={titleSize} fontWeight={tokens.type.scale.title.weight} textAnchor="middle">
            {stepTitle(start)}
          </text>
          <FormulaCard text={`${start.detail.width}${TIMES}${start.detail.height} = ${formatExact(start.value ?? '')}`} color={accent} paper={paper} x={width / 2} y={ROW.formula} t={state.formula} font={numFont} size={titleSize} tokens={tokens} />
        </g>
      )}
      {focusIndex >= 0 && subs[focusIndex] && (() => {
        const step = subs[focusIndex]!;
        const d = step.detail as CornerDetail;
        const c = stepColor(focusIndex);
        const title = stepTitle(step);
        const titleW = [...title].length * titleSize;
        const r = labelSize * 0.85;
        const bx = width / 2 - titleW / 2 - r - 8;
        return (
          <g opacity={state.enter}>
            <circle cx={bx} cy={ROW.title - titleSize * 0.35} r={r} fill={c} />
            <text x={bx} y={ROW.title - titleSize * 0.35} fill={paper} fontFamily={numFont} fontSize={labelSize} fontWeight={tokens.type.scale.title.weight} textAnchor="middle" dominantBaseline="central">
              {d.n}
            </text>
            <text x={width / 2 + r / 2} y={ROW.title} fill={c} fontFamily={jaFont} fontSize={titleSize} fontWeight={tokens.type.scale.title.weight} textAnchor="middle">
              {title}
            </text>
            <FormulaCard text={`${d.base}${TIMES}${d.height} ÷ 2 = ${formatExact(step.value ?? '')}`} color={c} paper={paper} x={width / 2} y={ROW.formula} t={state.formula} font={numFont} size={titleSize} tokens={tokens} />
          </g>
        );
      })()}

      {/* The equation: each term in its step colour, never a running total. */}
      <text x={width / 2} y={ROW.equation} textAnchor="middle" fontFamily={numFont} fontSize={titleSize} fontWeight={tokens.type.scale.title.weight} opacity={1 - state.result}>
        {[start, ...subs].map((step, i) => (
          <tspan key={i} fill={i === 0 ? accent : stepColor(i - 1)} opacity={(state.terms[i] ?? 0) * (0.6 + 0.4 * (state.termLit[i] ?? 0))}>
            {(i === 0 ? '' : MINUS) + (step?.value !== undefined ? formatExact(step.value) : '')}
          </tspan>
        ))}
      </text>

      {result && state.result > 0 && (
        <text x={width / 2} y={ROW.result} textAnchor="middle" fill={ink} fontFamily={numFont} fontSize={titleSize} fontWeight={tokens.type.scale.title.weight} opacity={state.result}>
          {result.ja}
        </text>
      )}
      {state.display > 0 && (
        <text
          x={width / 2}
          y={ROW.display}
          transform={`translate(${width / 2} ${ROW.display - 14}) scale(${state.display}) translate(${-width / 2} ${-(ROW.display - 14)})`}
          opacity={Math.min(1, state.display)}
          fill={accent}
          fontFamily={fontFamily(tokens, tokens.type.scale.display, 'family_num')}
          fontSize={fontSize(tokens, 'display', mode) * 1.5}
          fontWeight={tokens.type.scale.display.weight}
          textAnchor="middle"
        >
          {answerText(card)}
        </text>
      )}
      {state.trigger > 0 && <TriggerLines text={card.trigger.ja} width={width} tokens={tokens} mode={mode} opacity={state.trigger} ink={ink} />}
    </g>
  );
}

interface CornerPieceProps {
  i: number;
  gap: Point[];
  frame: Frame;
  center: [number, number];
  state: MotionState;
  focusIndex: number;
  fill: string;
  tintOpacity: number;
  dim: number;
  tokens: Tokens;
}

/** One corner gap: bright while its step is on screen, dimmed while another is, tinted after. */
function CornerPiece({ i, gap, frame, center, state, focusIndex, fill, tintOpacity, dim, tokens }: CornerPieceProps) {
  const [gx, gy] = toSvg(frame, centroid(gap));
  const len = Math.hypot(gx - center[0], gy - center[1]) || 1;
  const removed = state.removed[i] ?? 0;
  const dx = ((gx - center[0]) / len) * SLIDE * removed;
  const dy = ((gy - center[1]) / len) * SLIDE * removed;
  const focused = focusIndex === i;
  // Focused: fades in fully. Another step on screen: dim. Otherwise: tinted at the dim level once done.
  const level = focused
    ? state.enter
    : focusIndex >= 0
      ? (state.done[i] ?? 0) * dim
      : (state.done[i] ?? 0) * (dim + (1 - dim) * (state.lit[i] ?? 0));
  const opacity = level * (1 - removed);
  if (opacity <= 0) return null;
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <polygon points={svgPoints(frame, gap)} fill={fill} fillOpacity={tintOpacity * 2 * opacity} stroke={fill} strokeOpacity={opacity} strokeWidth={tokens.stroke.lens_construction.width} strokeLinejoin={tokens.stroke.join} />
    </g>
  );
}

interface FormulaCardProps {
  text: string;
  color: string;
  paper: string;
  x: number;
  y: number;
  t: number;
  font: string;
  size: number;
  tokens: Tokens;
}

/** A rounded card holding one formula, e.g. "5 × 2 ÷ 2 = 5", in the step colour. */
function FormulaCard({ text, color: c, paper, x, y, t, font, size, tokens }: FormulaCardProps) {
  if (t <= 0) return null;
  const w = [...text].length * size * 0.56 + size * 1.6;
  const h = size * 1.7;
  return (
    <g opacity={t} transform={`translate(0 ${(1 - t) * 6})`}>
      <rect x={x - w / 2} y={y - h * 0.68} width={w} height={h} rx={h / 2} fill={paper} stroke={c} strokeWidth={tokens.stroke.lens_construction.width} />
      <text x={x} y={y} fill={c} fontFamily={font} fontSize={size} fontWeight={tokens.type.scale.title.weight} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function TriggerLines({ text, width, tokens, mode, opacity, ink }: { text: string; width: number; tokens: Tokens; mode: RenderMode; opacity: number; ink: string }) {
  const size = fontSize(tokens, 'trigger', mode);
  const lines = wrapText(text, width - 2 * FIG.left, size);
  const lh = size * tokens.type.scale.trigger.line;
  return (
    <g opacity={opacity} fill={ink} fontFamily={fontFamily(tokens, tokens.type.scale.trigger)} fontSize={size} fontWeight={tokens.type.scale.trigger.weight} textAnchor="middle">
      {lines.map((line, i) => (
        <text key={i} x={width / 2} y={ROW.trigger - (lines.length - 1 - i) * lh}>
          {line}
        </text>
      ))}
    </g>
  );
}

