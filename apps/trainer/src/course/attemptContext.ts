// Which mode a problem is played in, for the decision-speed log (WO-019). Views provide it; the pick
// step (usePickClue) logs the first pick against it. No provider = nothing is logged.
import { createContext, useMemo } from 'react';
import { newSid, type AttemptCtx } from './attempts';

export interface AttemptScope {
  ctx: AttemptCtx;
  pass: string;
  /** One sitting: a check run, a lesson visit. */
  sid: string;
}

export const AttemptContext = createContext<AttemptScope | null>(null);

/** A scope for one sitting of a view (a new sid each mount, or when `key` changes). */
export function useAttemptScope(ctx: AttemptCtx, pass: string, key: unknown = null): AttemptScope {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ctx, pass, sid: newSid() }), [ctx, pass, key]);
}
