// How a problem plays outside the guided ladder (Steps 3–4): no trap hint, no ladder progress, and a
// clean / not-clean result for the streak or the timer.
export interface PlayResult {
  /** The first pick and the first clue were both right. */
  clean: boolean;
}

export interface PlayOpts {
  /** Steps 3–4: the pick card shows no trap hint. */
  practice?: boolean;
  /** Count the problem in the lesson's ladder progress (default true). */
  record?: boolean;
  onResult?: (r: PlayResult) => void;
  /** Label of the aha card's main button (default: next problem / back to the case). */
  nextLabel?: string;
  /** Show 「もう一度さわる」 (default true). */
  again?: boolean;
  /** The ladder's last problem: show today's median decision time for this lens (WO-019). */
  summary?: boolean;
}

export const isClean = (s: { misses: number; wrongChips: string[] }) => s.misses === 0 && s.wrongChips.length === 0;
