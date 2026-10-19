import { Hono } from "hono";
import { toGrade } from "../src/curriculum";
import { WaitlistSchema } from "../src/lib/waitlist";
import type { Reader } from "../src/reader";
import { DailyCap, type Now, RateLimiter, clientKey, safeEqual } from "./limits";
import { type WaitlistTarget, writeSignup } from "./waitlist-store";

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const HOUR = 60 * 60 * 1000;

export interface AppOptions {
  reader: Reader;
  /** JSONL path (used when waitlistDir is not set). */
  waitlistPath: string;
  /** One file per signup in this folder (e.g. a Cloud Storage FUSE mount). */
  waitlistDir?: string;
  /** When set, /api/read needs header x-pilot-code equal to it. */
  pilotCode?: string;
  readPerIpHour?: number;
  readDailyCap?: number;
  waitlistPerIpHour?: number;
  now?: Now;
}

/** @hono/node-server puts the Node request in c.env.incoming. */
type Env = { Bindings: { incoming?: { socket?: { remoteAddress?: string } } } };

/**
 * The /api routes. Privacy: images, request bodies, emails and names are never logged or stored
 * (the waitlist entry itself is the only thing written, to the waitlist target).
 * Limits are in memory: run one instance (Cloud Run --max-instances 1).
 */
export function createApi(opts: AppOptions) {
  const { reader, pilotCode } = opts;
  const now = opts.now ?? Date.now;
  const readIp = new RateLimiter(opts.readPerIpHour ?? 20, HOUR, now);
  const readDay = new DailyCap(opts.readDailyCap ?? 300, now);
  const waitIp = new RateLimiter(opts.waitlistPerIpHour ?? 10, HOUR, now);
  const target: WaitlistTarget = { dir: opts.waitlistDir || undefined, path: opts.waitlistPath };

  const api = new Hono<Env>();
  const keyOf = (c: { req: { header: (n: string) => string | undefined }; env: Env["Bindings"] | undefined }) =>
    clientKey(c.req.header("x-forwarded-for"), c.env?.incoming?.socket?.remoteAddress);

  api.get("/health", (c) => c.json({ ok: true, reader: reader.name, pilotGate: !!pilotCode }));

  api.post("/read", async (c) => {
    if (pilotCode && !safeEqual((c.req.header("x-pilot-code") ?? "").trim().toLowerCase(), pilotCode.trim().toLowerCase())) return c.json({ error: "pilot_code" }, 403);
    if (!readIp.hit(keyOf(c))) return c.json({ error: "rate_limited" }, 429);
    const len = Number(c.req.header("content-length") ?? 0);
    if (len > MAX_IMAGE_BYTES + 64 * 1024) return c.json({ error: "too_large" }, 413);
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }
    // toGrade: an app still holding the old combined 「高校」 is read as 高1.
    const grade = toGrade(form.get("grade"));
    const file = form.get("image");
    if (!grade) return c.json({ error: "grade_required" }, 400);
    if (!(file instanceof File)) return c.json({ error: "image_required" }, 400);
    if (file.size > MAX_IMAGE_BYTES) return c.json({ error: "too_large" }, 413);
    const mime = file.type || "image/jpeg";
    if (!IMAGE_TYPES.includes(mime)) return c.json({ error: "unsupported_type" }, 415);
    // The global cap counts only requests that will actually reach the model.
    if (!readDay.hit()) return c.json({ error: "daily_cap" }, 429);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const page = await reader.read(bytes, mime, grade);
      return c.json(page);
    } catch (e) {
      // Log only the error class/message, never the image or the reader's text.
      console.error("read failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
      return c.json({ error: "read_failed" }, 502);
    }
  });

  api.post("/waitlist", async (c) => {
    if (!waitIp.hit(keyOf(c))) return c.json({ error: "rate_limited" }, 429);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }
    const parsed = WaitlistSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
      return c.json({ error: "invalid", fields }, 400);
    }
    try {
      await writeSignup(parsed.data, target);
    } catch (e) {
      // Error code only: the message could contain the file name, never the email.
      console.error("waitlist write failed:", (e as NodeJS.ErrnoException)?.code ?? "unknown");
      return c.json({ error: "store_failed" }, 500);
    }
    return c.json({ ok: true });
  });

  return api;
}
