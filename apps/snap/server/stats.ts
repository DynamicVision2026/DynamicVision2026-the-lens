import type { Now } from "./limits";
import type { Store } from "./plans";

/**
 * Counters for the founder's dashboard: how many people come, try, use up the trial and buy.
 * Counts only (no ids, no emails, no photos): one small JSON file per day (JST) plus a running total.
 */
export const STAT_EVENTS = [
  "lp_view", // the landing page was opened (bots skipped)
  "device_new", // a phone or tablet opened the app's camera / plan screen for the first time
  "first_photo", // a device read its first photo
  "photo_free", // photos read on the free trial
  "photo_pass", // photos read on the annual plan
  "trial_out", // a device used up its free trial
  "unlock_order", // the annual plan unlocked by order number (each device counts)
  "unlock_code", // the annual plan unlocked by a code (course, gifts)
  "waitlist", // an email left on the landing page
] as const;
export type StatEvent = (typeof STAT_EVENTS)[number];
export type Counts = Partial<Record<StatEvent, number>>;

const JST = 9 * 60 * 60 * 1000;
export const statDay = (t: number) => new Date(t + JST).toISOString().slice(0, 10);

export class Stats {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(
    private store: Store,
    private now: Now = Date.now,
  ) {}

  /** Counts one event (in the background: never slows down or fails a request). */
  bump(ev: StatEvent): Promise<void> {
    const day = statDay(this.now());
    const run = this.chain.then(async () => {
      for (const key of [`stats/${day}`, "stats/total"]) {
        const c = (await this.store.get<Counts>(key)) ?? {};
        c[ev] = (c[ev] ?? 0) + 1;
        await this.store.put(key, c);
      }
    });
    this.chain = run.catch((e) => console.error("stats write failed:", (e as NodeJS.ErrnoException)?.code ?? "unknown"));
    return this.chain as Promise<void>;
  }

  /** Each of the last `days` days (newest first) and their sum. */
  async recent(days: number): Promise<{ days: { day: string; c: Counts }[]; sum: Counts }> {
    const t = this.now();
    const list: { day: string; c: Counts }[] = [];
    const sum: Counts = {};
    for (let i = 0; i < days; i++) {
      const day = statDay(t - i * 24 * 60 * 60 * 1000);
      const c = (await this.store.get<Counts>(`stats/${day}`)) ?? {};
      list.push({ day, c });
      for (const ev of STAT_EVENTS) sum[ev] = (sum[ev] ?? 0) + (c[ev] ?? 0);
    }
    return { days: list, sum };
  }

  async total(): Promise<Counts> {
    return (await this.store.get<Counts>("stats/total")) ?? {};
  }
}

/** Crawlers and link previews are not visitors. */
export const isBot = (ua: string | undefined) => !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|headless|lighthouse/i.test(ua);
