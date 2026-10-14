import type { Bundle, Figure, LensCard, Variant } from './types';
import { wordFamily } from './wordProblem';

/** The variant's figure over the card's: points/grid for grids, a figure object for other types. */
function mergeFigure(figure: Figure, variant: Variant): Figure {
  if (variant.figure) return { ...figure, ...variant.figure } as Figure;
  if (figure.type === 'grid_polygon') {
    return { ...figure, grid: variant.grid ?? figure.grid, points: variant.points ?? figure.points };
  }
  if (figure.type === 'coord_polygon' && variant.points) return { ...figure, points: variant.points };
  return figure;
}

/**
 * A variant drawn as a card: its figure, answer and lens steps replace the parent's.
 * The variant has no display_ja, so scenes show its exact answer plus the unit (see answerText). A variant
 * with its own sentence (text_ja) replaces the card's, since its numbers differ.
 * Trap steps and timings stay the parent's.
 */
export function withVariant(card: LensCard, variant: Variant): LensCard {
  return {
    ...card,
    id: variant.id,
    problem: {
      ...card.problem,
      text_ja: variant.text_ja ?? card.problem.text_ja,
      figure: mergeFigure(card.problem.figure, variant),
    },
    answer: { value: variant.answer, expr: card.answer.expr },
    lens_route: { ...card.lens_route, steps: variant.lens_route.steps },
  };
}

/** Every card followed by its variants, each as a drawable card. */
export function allSceneCards(bundle: Bundle): LensCard[] {
  return bundle.cards.flatMap((card) => [card, ...card.variants.map((v) => withVariant(card, v))]);
}

/** Figure types that have a scene. Later lenses' drafts may carry others until their WO lands. */
export const SCENE_FIGURE_TYPES = ['grid_polygon', 'parallel_band', 'mirror_path', 'mirror_corner', 'river_bridge', 'word_problem', 'box_unfold', 'coord_polygon', 'coord_equal_area', 'coord_mirror_area', 'triangle_cevians'] as const;

export function hasScene(card: LensCard): boolean {
  const figure = card.problem.figure;
  if (!(SCENE_FIGURE_TYPES as readonly string[]).includes(figure.type)) return false;
  // Word problems also need a diagram family the shared scenes can draw.
  return figure.type !== 'word_problem' || wordFamily(figure) !== null;
}
