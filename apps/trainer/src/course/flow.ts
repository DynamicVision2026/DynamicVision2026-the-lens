// One problem in the course player: pick the lens → find the clue → play with the figure → aha.
// A pure reducer, so the order of the guided steps is testable without a DOM.

export type Phase = 'pick' | 'clue' | 'play' | 'aha';

export interface FlowState {
  phase: Phase;
  correct: string;
  /** Wrong options already tried (shown dimmed), and the last one, whose try-on feedback shows. */
  tried: string[];
  tryOn: string | null;
  /** Clue chips tapped that were not the clue. */
  wrongChips: string[];
  clueChip: string | null;
  misses: number;
}

export type FlowAction = { type: 'pick'; option: string } | { type: 'chip'; tag: string; real: boolean } | { type: 'play' } | { type: 'solved' };

export function initialFlow(correct: string): FlowState {
  return { phase: 'pick', correct, tried: [], tryOn: null, wrongChips: [], clueChip: null, misses: 0 };
}

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case 'pick':
      if (s.phase !== 'pick' || s.tried.includes(a.option)) return s;
      if (a.option === s.correct) return { ...s, phase: 'clue', tryOn: null };
      return { ...s, tried: [...s.tried, a.option], tryOn: a.option, misses: s.misses + 1 };
    case 'chip':
      if (s.phase !== 'clue' || s.clueChip || s.wrongChips.includes(a.tag)) return s;
      if (a.real) return { ...s, clueChip: a.tag };
      return { ...s, wrongChips: [...s.wrongChips, a.tag] };
    case 'play':
      // After the clue chip lights up, the figure unlocks (the view sends this after a beat).
      return s.phase === 'clue' && s.clueChip ? { ...s, phase: 'play' } : s;
    case 'solved':
      return s.phase === 'play' ? { ...s, phase: 'aha' } : s;
  }
}
