// Which problems a lesson plays (WO-012). Everything comes from bundle.passes and the cards.
import { getCard, withVariant, type Bundle, type LensCard, type Lesson, type Pass } from '@lens/scenes';

/** Lenses with a hands-on interaction in the course player, and the figures each can play. */
const PLAYABLE: Record<string, (card: LensCard) => boolean> = {
  enclose: (c) => ((c.problem.figure.type === 'grid_polygon' || (c.problem.figure.type === 'coord_polygon' && c.problem.figure.shape !== 'axis_base')) && verticesOnBox(c)) || (c.problem.figure.type === 'parabola_area' && !c.problem.figure.bounds),
  slide: (c) => ['parallel_band', 'coord_equal_area', 'coord_quad_tri'].includes(c.problem.figure.type) || (c.problem.figure.type === 'parabola_tri' && ['px', 'max_area', 'equal_o'].includes(c.problem.figure.ask)),
  mirror: (c) =>
    ['mirror_path', 'mirror_corner'].includes(c.problem.figure.type) ||
    (c.problem.figure.type === 'coord_mirror_area' && c.problem.figure.side !== 'opposite') ||
    (c.problem.figure.type === 'line_mirror' && c.problem.figure.ask !== 'max_diff' && c.problem.figure.side !== 'opposite'),
  area: (c) => ['area_two_rect', 'area_average', 'area_shortfall'].includes(family(c) ?? '') || (c.problem.figure.type === 'dice_grid' && (c.problem.figure.dice ?? 2) === 2),
  constant: (c) => family(c) === 'diff_bars' || (c.problem.figure.type === 'const_sum' && c.problem.figure.x_min === undefined && c.problem.figure.ask !== 'given_diff'),
  balance: (c) => family(c) === 'lever' || (c.problem.figure.type === 'triangle_cevians' && c.problem.figure.ask !== 'area_abd'),
  freeze: (c) => family(c) === 'road' || (c.problem.figure.type === 'param_family' && (c.problem.figure.ask ?? 'point') === 'point'),
  unfold: (c) => c.problem.figure.type === 'box_unfold' || (c.problem.figure.type === 'cone_unfold' && c.problem.figure.ask !== 'side_area' && c.problem.figure.expect !== 'through_apex'),
};

/** The word problem's diagram family (WO-015: area and constant render by family, not by kind). */
function family(card: LensCard): string | null {
  const fig = card.problem.figure;
  return fig.type === 'word_problem' ? (fig.diagram?.family ?? null) : null;
}


/** Every vertex lies on the enclosing box (the corner-triangle Enclose interaction needs that). */
function verticesOnBox(card: LensCard): boolean {
  const fig = card.problem.figure;
  if (fig.type !== 'grid_polygon' && fig.type !== 'coord_polygon') return false;
  const xs = fig.points.map((p) => p[0]);
  const ys = fig.points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return fig.points.every(([x, y]) => x === x0 || x === x1 || y === y0 || y === y1);
}

export function hasInteraction(lens: string): boolean {
  return lens in PLAYABLE;
}

/** A card plays in the lesson when its lens is the best move and its figure has an interaction. */
export function isPlayable(card: LensCard, lens: string): boolean {
  return (card.best_move ?? card.lens) === lens && card.lens === lens && (PLAYABLE[lens]?.(card) ?? false);
}

export function findPass(bundle: Bundle, passId: string): Pass | undefined {
  return bundle.passes?.find((p) => p.id === passId);
}

export function findLesson(pass: Pass, lens: string): Lesson | undefined {
  return pass.lessons.find((l) => l.lens === lens);
}

/** How a problem plays: a drag interaction, the step-by-step walkthrough (WO-016), or stage by stage (ADR-003 chain). */
export type ProblemMode = 'scene' | 'walkthrough' | 'chain';

export interface LessonProblem {
  card: LensCard;
  mode: ProblemMode;
}

/** Cards with a drag interaction for this lens play as scenes; failure, no-lens and steps-only cards walk through. */
export function problemMode(card: LensCard, lens: string): ProblemMode {
  if (!isPlayable(card, lens)) return 'walkthrough';
  return card.chain?.length ? 'chain' : 'scene';
}

/**
 * The lesson's problems (WO-016): every anchor card in catalog order, boundary cards included. Only
 * when there are fewer anchors than lesson_target do variants of the scene cards top it up; otherwise
 * variants belong to the drill.
 */
export function lessonProblems(pass: Pass, lesson: Lesson): LessonProblem[] {
  const anchors = lesson.cards.map((id) => getCard(id)).filter((c): c is LensCard => !!c);
  const target = pass.lesson_target ?? anchors.length;
  const topUp =
    anchors.length < target
      ? anchors
          .filter((c) => isPlayable(c, lesson.lens))
          .flatMap((c) => c.variants.map((v) => withVariant(c, v)))
          .slice(0, target - anchors.length)
      : [];
  return [...anchors, ...topUp].map((card) => ({ card, mode: problemMode(card, lesson.lens) }));
}

/** A lesson's scene cards with their variants (the free check picks from these; never boundary cards). */
export function scenePool(lesson: Lesson): LensCard[] {
  return lesson.cards
    .map((id) => getCard(id))
    .filter((c): c is LensCard => !!c && c.kind === 'standard' && isPlayable(c, lesson.lens))
    .flatMap((c) => [c, ...c.variants.map((v) => withVariant(c, v))]);
}
