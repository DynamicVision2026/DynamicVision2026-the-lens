// ADR-003 §2: chained lenses. A chained card plays stage by stage on one figure; each stage owns a
// slice of lens_route.steps. Scenes read their steps through stageSteps, never by absolute index.
import type { LensCard, Step } from './types';

/** The steps a stage captions: chain[k].steps [from, to] inclusive, or the whole route (k = null or no chain). */
export function stageSteps(card: LensCard, k: number | null): Step[] {
  const steps = card.lens_route.steps;
  const stage = k === null ? undefined : card.chain?.[k];
  if (!stage) return steps;
  return steps.slice(stage.steps[0], stage.steps[1] + 1);
}
