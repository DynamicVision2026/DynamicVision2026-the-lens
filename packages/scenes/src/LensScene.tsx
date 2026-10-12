import { clamp01, parseEasing } from './easing';
import { answerText } from './format';
import { apexFor, boundingBox, boxCorners, centroid, cutX, enclosureGaps, horizontalBase, notchPieces } from './geometry';
import { sceneState, type SceneContext } from './keyframes';
import { ConstructionLine, FigurePolygon, GridLayer, makeFrame, RegionShade, StepLabel, toSvg } from './primitives';
import { wrapText } from './text';
import { motionViewBox, MotionScene } from './motion/MotionScene';
import type { Beat } from './motion/timeline';
import { color, fontFamily, fontSize, lensColor, themed, tokens as defaultTokens, type RenderMode, type ThemeName } from './tokens';
import type { LensCard, Point, Tokens } from './types';

/** Scene viewBox in px at 1x. Video renders it at 2x (1080 px wide frame ≈ 2.25x). */
export const SCENE_WIDTH = 480;
export const SCENE_HEIGHT = 600;
const PAD = 28;
const FIGURE_HEIGHT = 420;

export interface LensSceneProps {
  /** A card, or a variant merged onto its card with `withVariant`. */
  card: LensCard;
  /** Index into `card.animation.keyframes`. */
  keyframe: number;
  /** Progress 0–1 within that keyframe. */
  t: number;
  mode?: RenderMode;
  /** Snap t to 1 (the trainer passes prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Defaults to tokens/tokens.json. */
  tokens?: Tokens;
  /** 'base' (light, trainer and book) or a theme from `tokens.themes`, e.g. 'short_dark'. */
  theme?: ThemeName;
  /**
   * Motion preview beats (see motionPreviewTimeline). When set, `keyframe` indexes these beats
   * instead of `card.animation.keyframes`, and `t` is the raw progress within the beat.
   */
  motion?: Beat[] | null;
  /** Lens name for the motion preview's lens chip (from bundle.labels). */
  lensLabel?: string;
  className?: string;
}

const DEFAULT_KEYFRAMES = ['show_shape'];

/**
 * Draws a card at one animation moment. A pure function of its props: no timers, state or effects,
 * so the trainer (t from requestAnimationFrame) and Remotion (t from the frame) render the same SVG.
 */
export function LensScene({
  card,
  keyframe,
  t,
  mode = 'screen',
  reducedMotion = false,
  tokens: baseTokens = defaultTokens,
  theme = 'base',
  motion,
  lensLabel,
  className,
}: LensSceneProps) {
  const { tokens, glow } = themed(baseTokens, theme);
  const svgProps = {
    className,
    viewBox: `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`,
    xmlns: 'http://www.w3.org/2000/svg',
    role: 'img',
    'aria-label': card.problem.text_ja,
    style: { background: color(tokens.color.paper, mode), display: 'block', width: '100%', height: 'auto' },
  };

  if (motion && motion.length > 0) {
    const vb = motionViewBox(tokens.layout.short);
    return (
      <svg {...svgProps} viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}>
        <MotionScene
          card={card}
          beats={motion}
          beat={keyframe}
          t={reducedMotion ? 1 : t}
          tokens={tokens}
          glow={glow}
          mode={mode}
          lensLabel={lensLabel}
        />
      </svg>
    );
  }

  const keyframes = card.animation?.keyframes ?? DEFAULT_KEYFRAMES;
  const ease = parseEasing(tokens.motion.easing);
  const progress = reducedMotion ? 1 : ease(clamp01(t));

  const { grid, points } = card.problem.figure;
  const ctx: SceneContext = {
    card,
    points,
    gaps: enclosureGaps(points),
    gapSteps: card.lens_route.steps.filter((s) => s.op === 'sub'),
    pieces: notchPieces(points),
    pieceSteps: card.lens_route.steps.filter((s) => s.op === 'start' || s.op === 'add'),
  };
  const state = sceneState(keyframes, keyframe, progress, ctx);

  const frame = makeFrame(grid, PAD, PAD, SCENE_WIDTH - 2 * PAD, FIGURE_HEIGHT - 2 * PAD);
  const lens = card.lens;
  const accent = lensColor(tokens, lens, mode);
  const ink = color(tokens.color.ink, mode);
  const flag = color(tokens.color.trap.flag, mode);
  const box = boundingBox(points);
  const boxPath: Point[] = [...boxCorners(box), boxCorners(box)[0]!];
  const base = horizontalBase(points);
  const apex = base ? apexFor(points, base) : null;
  const labelAt = (pts: Point[]) => toSvg(frame, centroid(pts));
  const irregular = ctx.gaps.find((g) => g.length > 3);
  const strikeLen = Math.min(box.x1 - box.x0, box.y1 - box.y0) * 0.25;
  const ghostStrike: Point[] = [[box.x1 - strikeLen, box.y1], [box.x1, box.y1 - strikeLen]];

  return (
    <svg {...svgProps}>
      {glow && (
        <defs>
          <filter id={`lens-glow-${card.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px / 2} />
          </filter>
        </defs>
      )}
      <GridLayer frame={frame} tokens={tokens} mode={mode} />

      {ctx.gaps.map((gap, i) => (
        <RegionShade key={`gap${i}`} frame={frame} points={gap} lens={lens} tokens={tokens} mode={mode} t={(state.gapShade[i] ?? 0) * state.boxFade} />
      ))}
      {irregular && state.irregularGap > 0 && (
        <RegionShade
          frame={frame}
          points={irregular}
          lens={lens}
          tokens={tokens}
          mode={mode}
          color={flag}
          t={state.boxFade}
          strength={2 + 2 * Math.abs(Math.sin(state.irregularGap * Math.PI * 3))}
        />
      )}
      {ctx.pieces?.map((piece, i) => (
        <RegionShade key={`piece${i}`} frame={frame} points={piece} lens={lens} tokens={tokens} mode={mode} t={state.pieces[i] ?? 0} strength={i === 0 ? 1 : 1.6} />
      ))}

      <FigurePolygon
        frame={frame}
        points={points}
        tokens={tokens}
        mode={mode}
        t={state.shape}
        tint={state.answerTint > 0 ? { color: accent, opacity: tokens.color.lens_tint_opacity * 2 * state.answerTint } : undefined}
      />

      {glow && state.box > 0 && state.boxFade > 0 && (
        <g filter={`url(#lens-glow-${card.id})`} opacity={glow.opacity * state.boxFade}>
          <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} t={state.box} stroke={tokens.stroke.lens} />
        </g>
      )}
      <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} t={state.box} opacity={state.boxFade} />
      <ConstructionLine
        frame={frame}
        path={[[cutX(points), box.y0], [cutX(points), box.y1]]}
        lens={lens}
        tokens={tokens}
        mode={mode}
        t={state.cut}
        stroke={tokens.stroke.lens}
      />
      {base && (
        <ConstructionLine frame={frame} path={base} lens={lens} tokens={tokens} mode={mode} t={state.base} stroke={tokens.stroke.lens} />
      )}
      {base && apex && (
        <ConstructionLine frame={frame} path={[apex, [apex[0], base[0][1]]]} lens={lens} tokens={tokens} mode={mode} t={state.height} />
      )}
      {state.ghostBox > 0 && (
        <g opacity={state.ghostBox}>
          <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} color={color(tokens.color.trap.ink, mode)} stroke={tokens.stroke.trap} opacity={0.5} />
          {/* A short strike across the box's top-right corner only: the triangle stays untouched. */}
          <ConstructionLine
            frame={frame}
            path={ghostStrike}
            lens={lens}
            tokens={tokens}
            mode={mode}
            t={state.ghostBox}
            color={flag}
            stroke={tokens.stroke.lens}
          />
        </g>
      )}

      {ctx.gaps.map((gap, i) => {
        const step = ctx.gapSteps[i];
        if (!step) return null;
        const [x, y] = labelAt(gap);
        return <StepLabel key={`gl${i}`} step={step} x={x} y={y} tokens={tokens} mode={mode} t={(state.gapLabel[i] ?? 0) * state.boxFade} />;
      })}
      {ctx.pieces?.map((piece, i) => {
        const step = ctx.pieceSteps[i];
        if (!step) return null;
        const [x, y] = labelAt(piece);
        return <StepLabel key={`pl${i}`} step={step} x={x} y={y} tokens={tokens} mode={mode} t={state.pieces[i] ?? 0} />;
      })}

      <TextBand card={card} tokens={tokens} mode={mode} caption={state.caption} answer={state.answer} ink={ink} accent={accent} />
    </svg>
  );
}

interface TextBandProps {
  card: LensCard;
  tokens: Tokens;
  mode: RenderMode;
  caption: { text: string; t: number; size: 'step' | 'title' } | null;
  answer: number;
  ink: string;
  accent: string;
}

function TextBand({ card, tokens, mode, caption, answer, ink, accent }: TextBandProps) {
  const top = FIGURE_HEIGHT;
  const width = SCENE_WIDTH - 2 * PAD;
  const stepScale = tokens.type.scale.step;
  const stepSize = fontSize(tokens, 'step', mode);
  const lines = caption ? wrapText(caption.text, width, stepSize) : [];
  const displayScale = tokens.type.scale.display;
  const displaySize = fontSize(tokens, 'display', mode) * 1.5;
  return (
    <g>
      {caption && caption.t > 0 && (
        <g opacity={caption.t} fill={ink} fontFamily={fontFamily(tokens, stepScale)} fontSize={stepSize} fontWeight={tokens.type.scale.problem.weight}>
          {lines.slice(0, 3).map((line, i) => (
            <text key={i} x={SCENE_WIDTH / 2} y={top + stepSize * stepScale.line * (i + 0.8)} textAnchor="middle">
              {line}
            </text>
          ))}
        </g>
      )}
      {answer > 0 && (
        <text
          x={SCENE_WIDTH / 2}
          y={SCENE_HEIGHT - PAD - displaySize * 0.2}
          opacity={answer}
          fill={accent}
          fontFamily={fontFamily(tokens, displayScale, 'family_num')}
          fontSize={displaySize}
          fontWeight={displayScale.weight}
          textAnchor="middle"
        >
          {answerText(card)}
        </text>
      )}
    </g>
  );
}
