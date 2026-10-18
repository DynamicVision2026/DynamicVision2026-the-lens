import { createHash, timingSafeEqual } from "node:crypto";

/**
 * In-memory limits. They count per process, so the service must run as ONE instance
 * (Cloud Run --max-instances 1, as deploy.sh does). A restart resets the counts.
 */
export type Now = () => number;

/** At most `limit` hits per key in any rolling `windowMs`. A refused hit is not counted. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private now: Now = Date.now,
  ) {}

  hit(key: string): boolean {
    const t = this.now();
    const from = t - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((x) => x > from);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 5000) this.sweep(from);
    return true;
  }

  private sweep(from: number) {
    for (const [k, v] of this.hits) if (!v.some((x) => x > from)) this.hits.delete(k);
  }
}

/** Global cap per UTC day (resets at 00:00 UTC). */
export class DailyCap {
  private day = "";
  private used = 0;
  constructor(
    readonly cap: number,
    private now: Now = Date.now,
  ) {}

  hit(): boolean {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.used = 0;
    }
    if (this.used >= this.cap) return false;
    this.used++;
    return true;
  }
}

/**
 * Client key: the first address in x-forwarded-for, else the socket's remote address. The first
 * entry can be set by the client, so this limit is a courtesy; the pilot code and the global daily
 * cap are what bound spending.
 */
export function clientKey(forwardedFor: string | undefined | null, remote: string | undefined | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || remote || "unknown";
}

/** Constant-time string comparison (hashing first makes the lengths equal). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Positive integer from an env var, else the default. */
export function envInt(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : dflt;
}
