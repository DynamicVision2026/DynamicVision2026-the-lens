import type { Bundle, LensCard, Variant } from './types';

/**
 * A variant drawn as a card: its figure, answer and lens steps replace the parent's.
 * The variant has no display_ja, so scenes show its exact answer plus the unit (see answerText).
 * Trap steps and timings stay the parent's.
 */
export function withVariant(card: LensCard, variant: Variant): LensCard {
  return {
    ...card,
    id: variant.id,
    problem: {
      ...card.problem,
      figure: { ...card.problem.figure, grid: variant.grid, points: variant.points },
    },
    answer: { value: variant.answer, expr: card.answer.expr },
    lens_route: { ...card.lens_route, steps: variant.lens_route.steps },
  };
}

/** Every card followed by its variants, each as a drawable card. */
export function allSceneCards(bundle: Bundle): LensCard[] {
  return bundle.cards.flatMap((card) => [card, ...card.variants.map((v) => withVariant(card, v))]);
}
