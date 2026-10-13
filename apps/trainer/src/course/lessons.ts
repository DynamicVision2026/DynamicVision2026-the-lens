// Which problems a lesson plays (WO-012). Everything comes from bundle.passes and the cards.
import { getCard, withVariant, type Bundle, type LensCard, type Lesson, type Pass } from '@lens/scenes';

/** Lenses with a hands-on interaction in the course player, and the figures each can play. */
const PLAYABLE: Record<string, (card: LensCard) => boolean> = {
  enclose: (c) => c.problem.figure.type === 'grid_polygon' && verticesOnBox(c),
  slide: (c) => c.problem.figure.type === 'parallel_band',
  mirror: (c) => c.problem.figure.type === 'mirror_path',
  area: (c) => ['area_two_rect', 'area_average', 'area_shortfall'].includes(family(c) ?? ''),
  constant: (c) => family(c) === 'diff_bars',
  balance: (c) => family(c) === 'lever',
  freeze: (c) => family(c) === 'road',
  unfold: (c) => c.problem.figure.type === 'box_unfold',
};

/** The word problem's diagram family (WO-015: area and constant render by family, not by kind). */
function family(card: LensCard): string | null {
  const fig = card.problem.figure;
  return fig.type === 'word_problem' ? (fig.diagram?.family ?? null) : null;
}


/** Every vertex lies on the enclosing box (the corner-triangle Enclose interaction needs that). */
function verticesOnBox(card: LensCard): boolean {
  const fig = card.problem.figure;
  if (fig.type !== 'grid_polygon') return false;
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

/** How a problem plays: a drag interaction, or the step-by-step walkthrough (WO-016). */
export type ProblemMode = 'scene' | 'walkthrough';

export interface LessonProblem {
  card: LensCard;
  mode: ProblemMode;
}

/** Cards with a drag interaction for this lens play as scenes; failure, no-lens and steps-only cards walk through. */
export function problemMode(card: LensCard, lens: string): ProblemMode {
  return isPlayable(card, lens) ? 'scene' : 'walkthrough';
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
