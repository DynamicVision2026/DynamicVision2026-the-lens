import { clamp01, parseEasing } from './easing';
import { answerText } from './format';
import { apexFor, boundingBox, boxCorners, centroid, cutX, enclosureGaps, horizontalBase, notchPieces } from './geometry';
import { sceneState, type SceneContext } from './keyframes';
import { ConstructionLine, FigurePolygon, GridLayer, makeFrame, RegionShade, StepLabel, toSvg } from './primitives';
import { wrapText } from './text';
import { motionViewBox, MotionScene } from './motion/MotionScene';
import type { Beat } from './motion/timeline';
import { color, fontFamily, fontSize, lensColor, themed, tokens as defaultTokens, type RenderMode, type ThemeName } from './tokens';
import { bandLayout } from './band';
import { bandState } from './keyframes/band';
import { mirrorState } from './keyframes/mirror';
import { unfoldState } from './keyframes/unfold';
import { wordState } from './keyframes/word';
import { mirrorLayout, touchX } from './mirror';
import { unfoldLayout } from './unfold';
import { hasScene } from './variant';
import { BAND_END_ROOM, BandFigure, MirrorFigure, StoryText, storyHeight, UnfoldFigure, WordDiagram } from './primitives';
import type { BoxUnfoldFigure, GlowToken, GridPolygonFigure, LensCard, MirrorPathFigure, ParallelBandFigure, Point, Tokens, WordProblemFigure } from './types';

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
  /** Button text per picker option, for the Short's freeze beat (from bundle.labels). */
  optionLabels?: Record<string, string>;
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
  optionLabels,
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
          optionLabels={optionLabels}
        />
      </svg>
    );
  }

  const keyframes = card.animation?.keyframes ?? DEFAULT_KEYFRAMES;
  const ease = parseEasing(tokens.motion.easing);
  const progress = reducedMotion ? 1 : ease(clamp01(t));
  const figure = card.problem.figure;

  if (figure.type === 'parallel_band') {
    return (
      <svg {...svgProps}>
        <BandKeyframeScene card={card} fig={figure} keyframes={keyframes} keyframe={keyframe} t={progress} tokens={tokens} glow={glow} mode={mode} />
      </svg>
    );
  }
  if (figure.type === 'mirror_path') {
    return (
      <svg {...svgProps}>
        <MirrorKeyframeScene card={card} fig={figure} keyframes={keyframes} keyframe={keyframe} t={progress} tokens={tokens} glow={glow} mode={mode} />
      </svg>
    );
  }
  if (figure.type === 'box_unfold') {
    return (
      <svg {...svgProps}>
        <UnfoldKeyframeScene card={card} fig={figure} keyframes={keyframes} keyframe={keyframe} t={progress} tokens={tokens} glow={glow} mode={mode} />
      </svg>
    );
  }
  if (figure.type === 'word_problem' && hasScene(card)) {
    return (
      <svg {...svgProps}>
        <WordKeyframeScene card={card} fig={figure} keyframes={keyframes} keyframe={keyframe} t={progress} tokens={tokens} mode={mode} />
      </svg>
    );
  }
  if (figure.type !== 'grid_polygon') {
    warnNoScene(figure.type === 'word_problem' ? `word_problem/${figure.diagram?.family ?? figure.kind}` : (figure as { type: string }).type);
    return <svg {...svgProps} />;
  }

  const { grid, points } = figure as GridPolygonFigure;
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

const noScene = new Set<string>();

/** Warns once per figure type that has no scene yet (later lenses' drafts). */
function warnNoScene(type: string) {
  if (noScene.has(type)) return;
  noScene.add(type);
  console.warn(`LensScene: no scene for figure type "${type}" yet.`);
}

interface BandKeyframeSceneProps {
  card: LensCard;
  fig: ParallelBandFigure;
  keyframes: string[];
  keyframe: number;
  t: number;
  tokens: Tokens;
  glow: GlowToken | null;
  mode: RenderMode;
}

/** The Slide lens on a parallel band, keyframe by keyframe (trainer and /dev/scenes). */
function BandKeyframeScene({ card, fig, keyframes, keyframe, t, tokens, glow, mode }: BandKeyframeSceneProps) {
  const state = bandState(keyframes, keyframe, t, card, fig);
  const label = fontSize(tokens, 'label', mode);
  const layout = bandLayout(fig, PAD, PAD, SCENE_WIDTH - 2 * PAD, FIGURE_HEIGHT - 2 * PAD - 30, Math.max(34, label * BAND_END_ROOM));
  const accent = lensColor(tokens, card.lens, mode);
  const glowId = `lens-glow-${card.id}`;
  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px / 2} />
          </filter>
        </defs>
      )}
      <BandFigure
        fig={fig}
        layout={layout}
        tokens={tokens}
        ink={color(tokens.color.ink, mode)}
        accent={accent}
        palette={tokens.color.step.palette.map((c) => color(c, mode))}
        font={fontFamily(tokens, undefined, 'family_num')}
        weight={tokens.type.scale.label.weight}
        labelSize={label}
        figureStroke={tokens.stroke.figure.width}
        lensStroke={tokens.stroke.lens.width}
        bracket={{ offset: 22, tick: 5, numberSize: label, strokeWidth: tokens.stroke.lens_construction.width }}
        show={state.show}
        parallel={state.parallel}
        slid={state.slid}
        merged={state.merged}
        focus={-1}
        dim={1}
        tint={tokens.color.step.tint_opacity}
        idPrefix={`lens-${card.id}`}
        glowFilter={glow ? `url(#${glowId})` : undefined}
        glowOpacity={glow?.opacity}
      />
      <TextBand
        card={card}
        tokens={tokens}
        mode={mode}
        caption={state.caption ? { text: state.caption.step.ja, t: state.caption.t, size: 'step' } : null}
        answer={state.answer}
        ink={color(tokens.color.ink, mode)}
        accent={accent}
      />
    </g>
  );
}

interface MirrorKeyframeSceneProps {
  card: LensCard;
  fig: MirrorPathFigure;
  keyframes: string[];
  keyframe: number;
  t: number;
  tokens: Tokens;
  glow: GlowToken | null;
  mode: RenderMode;
}

/** The Mirror lens on a shortest-path figure, keyframe by keyframe (trainer and /dev/scenes). */
function MirrorKeyframeScene({ card, fig, keyframes, keyframe, t, tokens, glow, mode }: MirrorKeyframeSceneProps) {
  const state = mirrorState(keyframes, keyframe, t, card);
  const label = fontSize(tokens, 'label', mode);
  const layout = mirrorLayout(fig, PAD, PAD, SCENE_WIDTH - 2 * PAD, FIGURE_HEIGHT - 2 * PAD - 3 * label, label * 2.5);
  const accent = lensColor(tokens, card.lens, mode);
  const glowId = `lens-glow-${card.id}`;
  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px / 2} />
          </filter>
        </defs>
      )}
      <MirrorFigure
        fig={fig}
        layout={layout}
        touchX={touchX(card)}
        tokens={tokens}
        ink={color(tokens.color.ink, mode)}
        chalk={color(tokens.color.trap.ink, mode)}
        accent={accent}
        palette={tokens.color.step.palette.map((c) => color(c, mode))}
        font={fontFamily(tokens, undefined, 'family_num')}
        weight={tokens.type.scale.label.weight}
        labelSize={label}
        figureStroke={tokens.stroke.figure.width}
        lensStroke={tokens.stroke.lens.width}
        dash={tokens.stroke.trap.dash}
        bracket={{ offset: label * 1.4, tick: 5, numberSize: label, strokeWidth: tokens.stroke.lens_construction.width }}
        show={state.show}
        tryPath={state.tryPath}
        tryDim={state.tryDim}
        reflect={state.reflect}
        straight={state.straight}
        similar={state.similar}
        tint={tokens.color.step.tint_opacity}
        idPrefix={`lens-${card.id}`}
        glowFilter={glow ? `url(#${glowId})` : undefined}
        glowOpacity={glow?.opacity}
      />
      <TextBand
        card={card}
        tokens={tokens}
        mode={mode}
        caption={state.caption ? { text: state.caption.step.ja, t: state.caption.t, size: 'step' } : null}
        answer={state.answer}
        ink={color(tokens.color.ink, mode)}
        accent={accent}
      />
    </g>
  );
}

interface UnfoldKeyframeSceneProps extends Omit<MirrorKeyframeSceneProps, 'fig'> {
  fig: BoxUnfoldFigure;
}

/** The Unfold lens on a box-net figure, keyframe by keyframe (trainer and /dev/scenes). */
function UnfoldKeyframeScene({ card, fig, keyframes, keyframe, t, tokens, glow, mode }: UnfoldKeyframeSceneProps) {
  const state = unfoldState(keyframes, keyframe, t, card);
  const label = fontSize(tokens, 'label', mode);
  const layout = unfoldLayout(fig, PAD, PAD, SCENE_WIDTH - 2 * PAD, FIGURE_HEIGHT - 2 * PAD, label * 2.2, label * 5.8);
  const accent = lensColor(tokens, card.lens, mode);
  const glowId = `lens-glow-${card.id}`;
  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px / 2} />
          </filter>
        </defs>
      )}
      <UnfoldFigure
        fig={fig}
        layout={layout}
        crossY={touchX(card)}
        answerText={answerText(card)}
        halo={color(tokens.color.paper, mode)}
        tokens={tokens}
        ink={color(tokens.color.ink, mode)}
        chalk={color(tokens.color.trap.ink, mode)}
        accent={accent}
        palette={tokens.color.step.palette.map((c) => color(c, mode))}
        font={fontFamily(tokens, undefined, 'family_num')}
        weight={tokens.type.scale.label.weight}
        labelSize={label}
        figureStroke={tokens.stroke.figure.width}
        lensStroke={tokens.stroke.lens.width}
        dash={tokens.stroke.trap.dash}
        bracket={{ offset: label * 0.6, tick: 5, numberSize: label, strokeWidth: tokens.stroke.lens_construction.width }}
        show={state.show}
        tryPath={state.tryPath}
        tryDim={state.tryDim}
        unfold={state.unfold}
        straight={state.straight}
        similar={state.similar}
        answer={state.answer}
        tint={tokens.color.step.tint_opacity}
        idPrefix={`lens-${card.id}`}
        glowFilter={glow ? `url(#${glowId})` : undefined}
        glowOpacity={glow?.opacity}
      />
      <TextBand
        card={card}
        tokens={tokens}
        mode={mode}
        caption={state.caption ? { text: state.caption.step.ja, t: state.caption.t, size: 'step' } : null}
        answer={state.answer}
        ink={color(tokens.color.ink, mode)}
        accent={accent}
      />
    </g>
  );
}

interface WordKeyframeSceneProps {
  card: LensCard;
  fig: WordProblemFigure;
  keyframes: string[];
  keyframe: number;
  t: number;
  tokens: Tokens;
  mode: RenderMode;
}

/** A word problem: the story on top, the diagram the lens draws below (trainer and /dev/scenes). */
function WordKeyframeScene({ card, fig, keyframes, keyframe, t, tokens, mode }: WordKeyframeSceneProps) {
  const state = wordState(keyframes, keyframe, t, card, fig);
  const ink = color(tokens.color.ink, mode);
  const accent = lensColor(tokens, card.lens, mode);
  const size = fontSize(tokens, 'problem', mode);
  const label = fontSize(tokens, 'label', mode);
  const width = SCENE_WIDTH - 2 * PAD;
  const top = storyHeight(card.problem.text_ja, width, size);
  const ja = fontFamily(tokens, tokens.type.scale.problem);
  return (
    <g>
      <StoryText text={card.problem.text_ja} x={PAD} y={PAD / 2} width={width} size={size} ink={ink} accent={accent} font={ja} weight={tokens.type.scale.title.weight} highlight={state.story} opacity={Math.max(0.25, state.story)} />
      <WordDiagram
        card={card}
        fig={fig}
        x={PAD}
        y={PAD / 2 + top}
        w={width}
        h={FIGURE_HEIGHT - PAD / 2 - top}
        prog={state.prog}
        tokens={tokens}
        ink={ink}
        accent={accent}
        palette={tokens.color.step.palette.map((c) => color(c, mode))}
        font={fontFamily(tokens, undefined, 'family_num')}
        jaFont={ja}
        weight={tokens.type.scale.title.weight}
        labelSize={label}
        numberSize={fontSize(tokens, 'step', mode)}
        figureStroke={tokens.stroke.figure.width}
        lensStroke={tokens.stroke.lens.width}
        dash={tokens.stroke.trap.dash}
        bracket={{ offset: label * 0.9, tick: 5, strokeWidth: tokens.stroke.lens_construction.width }}
        tint={tokens.color.step.tint_opacity}
        show={1}
        answer={state.answer}
        chalk={color(tokens.color.trap.ink, mode)}
      />
      <TextBand
        card={card}
        tokens={tokens}
        mode={mode}
        caption={state.caption ? { text: state.caption.step.ja, t: state.caption.t, size: 'step' } : null}
        answer={state.answer}
        ink={ink}
        accent={accent}
      />
    </g>
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
