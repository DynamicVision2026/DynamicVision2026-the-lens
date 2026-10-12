// The Perspective Picker as a pure reducer (WO-003 Part B, PRD §4):
//   problem ──pick wrong──▶ feedback ──▶ problem   (option greyed; after 2 misses the trigger hint shows)
//   problem ──pick right──▶ clue ──confirm──▶ reveal ──next──▶ variant (timed, no hints) ──right──▶ report

export type Phase = 'problem' | 'feedback' | 'clue' | 'reveal' | 'variant' | 'report';

/** Misses after which the card's trigger sentence appears as a hint. */
export const HINT_AFTER_MISSES = 2;

export interface PickerState {
  phase: Phase;
  /** Options in the order shown (shuffled per attempt). */
  options: string[];
  correct: string;
  greyed: string[];
  misses: number;
  attempts: number;
  /** The option whose feedback is on screen. */
  feedbackFor: string | null;
  /** Clue chips in display order, and the ones the child has tapped. */
  chips: string[];
  realTags: string[];
  selected: string[];
  clueCorrect: boolean | null;
  /** Seconds from first render to the correct pick, for the card and for the variant. */
  seconds: number | null;
  variantStart: number | null;
  variantSeconds: number | null;
  variantGreyed: string[];
  variantMisses: number;
}

export type PickerAction =
  | { type: 'pick'; option: string; at: number; startedAt: number }
  | { type: 'dismissFeedback' }
  | { type: 'toggleChip'; tag: string }
  | { type: 'confirmClue' }
  | { type: 'startVariant'; at: number; options: string[] }
  | { type: 'pickVariant'; option: string; at: number };

export interface PickerInit {
  options: string[];
  correct: string;
  realTags: string[];
  chips: string[];
}

export function initialPickerState({ options, correct, realTags, chips }: PickerInit): PickerState {
  return {
    phase: 'problem',
    options,
    correct,
    greyed: [],
    misses: 0,
    attempts: 0,
    feedbackFor: null,
    chips,
    realTags,
    selected: [],
    clueCorrect: null,
    seconds: null,
    variantStart: null,
    variantSeconds: null,
    variantGreyed: [],
    variantMisses: 0,
  };
}

/** Clean clue = at least one real clue tapped and no decoy. */
export function isCleanClue(selected: string[], realTags: string[]): boolean {
  return selected.some((t) => realTags.includes(t)) && selected.every((t) => realTags.includes(t));
}

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case 'pick': {
      if (state.phase !== 'problem' || state.greyed.includes(action.option)) return state;
      const attempts = state.attempts + 1;
      if (action.option === state.correct) {
        return { ...state, attempts, phase: 'clue', seconds: Math.max(0, (action.at - action.startedAt) / 1000) };
      }
      return { ...state, attempts, phase: 'feedback', feedbackFor: action.option, misses: state.misses + 1, greyed: [...state.greyed, action.option] };
    }
    case 'dismissFeedback':
      return state.phase === 'feedback' ? { ...state, phase: 'problem', feedbackFor: null } : state;
    case 'toggleChip': {
      if (state.phase !== 'clue') return state;
      const selected = state.selected.includes(action.tag) ? state.selected.filter((t) => t !== action.tag) : [...state.selected, action.tag];
      return { ...state, selected };
    }
    case 'confirmClue':
      if (state.phase !== 'clue' || state.selected.length === 0) return state;
      return { ...state, phase: 'reveal', clueCorrect: isCleanClue(state.selected, state.realTags) };
    case 'startVariant':
      return state.phase === 'reveal' ? { ...state, phase: 'variant', options: action.options, variantStart: action.at, variantGreyed: [], variantMisses: 0 } : state;
    case 'pickVariant': {
      if (state.phase !== 'variant' || state.variantGreyed.includes(action.option)) return state;
      if (action.option === state.correct) {
        return { ...state, phase: 'report', variantSeconds: Math.max(0, (action.at - (state.variantStart ?? action.at)) / 1000) };
      }
      return { ...state, variantGreyed: [...state.variantGreyed, action.option], variantMisses: state.variantMisses + 1 };
    }
  }
}

/** Whether the trigger hint shows on the problem screen. */
export function showsHint(state: PickerState): boolean {
  return state.misses >= HINT_AFTER_MISSES;
}

/** A clean solve: right lens and a clean clue. */
export function isCleanSolve(state: PickerState): boolean {
  return state.clueCorrect === true;
}

/** Fisher–Yates with an injected random source (Math.random in the app, fixed in tests). */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
