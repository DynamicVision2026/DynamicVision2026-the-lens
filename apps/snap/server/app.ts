import { Hono } from "hono";
import { toGrade } from "../src/curriculum";
import { WaitlistSchema } from "../src/lib/waitlist";
import type { Reader } from "../src/reader";
import { DailyCap, type Now, RateLimiter, clientKey, safeEqual } from "./limits";
import { type Fetch, type Plans, type ShopifyConfig, linkSignatureOk, lookupShopifyOrder } from "./plans";
import type { StatEvent, Stats } from "./stats";
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
  /** Free plan + 1-year pass. When unset (older tests), /read is not metered. */
  plans?: Plans;
  shopify?: ShopifyConfig;
  shopifyFetch?: Fetch;
  /** Where the ¥5,800 pass is bought (Shopify product page). */
  buyUrl?: string;
  /** Counters for the founder's dashboard (/admin). */
  stats?: Stats;
  /** Key of the signed link in the store's order confirmation email (see shopifyLinkKey). */
  linkKey?: string;
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
  const readDay = new DailyCap(opts.readDailyCap ?? 3000, now);
  const waitIp = new RateLimiter(opts.waitlistPerIpHour ?? 10, HOUR, now);
  const deviceIp = new RateLimiter(10, HOUR, now);
  const claimIp = new RateLimiter(10, HOUR, now);
  const { plans } = opts;
  const target: WaitlistTarget = { dir: opts.waitlistDir || undefined, path: opts.waitlistPath };
  const count = (ev: StatEvent) => void opts.stats?.bump(ev);

  const api = new Hono<Env>();
  const keyOf = (c: { req: { header: (n: string) => string | undefined }; env: Env["Bindings"] | undefined }) =>
    clientKey(c.req.header("x-forwarded-for"), c.env?.incoming?.socket?.remoteAddress);

  // commit: the git commit this revision was built from (set by the auto-deploy; null when deployed by hand)
  api.get("/health", (c) => c.json({ ok: true, reader: reader.name, pilotGate: !!pilotCode, commit: process.env.APP_COMMIT?.trim() || null }));

  // ---- plans: free (per device, per month) and the 1-year pass ----
  api.post("/device", (c) => {
    if (!plans) return c.json({ error: "not_configured" }, 404);
    if (!deviceIp.hit(keyOf(c))) return c.json({ error: "rate_limited" }, 429);
    count("device_new");
    return c.json({ device: plans.newDevice() });
  });
  const devOf = (c: { req: { header: (n: string) => string | undefined } }) => plans?.device(c.req.header("x-device")) ?? null;
  const planJson = async (dev: string, license: string | null | undefined) => ({ ...(await plans!.view(dev, license)), buyUrl: opts.buyUrl ?? null });
  api.get("/plan", async (c) => {
    if (!plans) return c.json({ error: "not_configured" }, 404);
    const dev = devOf(c);
    if (!dev) return c.json({ error: "device_required" }, 401);
    return c.json(await planJson(dev, c.req.header("x-license")));
  });
  api.post("/claim", async (c) => {
    if (!plans) return c.json({ error: "not_configured" }, 404);
    const dev = devOf(c);
    if (!dev) return c.json({ error: "device_required" }, 401);
    if (!claimIp.hit(keyOf(c))) return c.json({ error: "rate_limited" }, 429);
    const body = (await c.req.json().catch(() => null)) as { order?: unknown; email?: unknown } | null;
    const order = typeof body?.order === "string" ? body.order.replace(/\D/g, "").slice(0, 12) : "";
    const email = typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "";
    if (!order || !email.includes("@")) return c.json({ error: "invalid" }, 400);
    const r = await plans.claimOrder(dev, email, () => (opts.shopify ? lookupShopifyOrder(opts.shopify, order, email, opts.shopifyFetch) : Promise.resolve("not_configured" as const)), order);
    if (!r.ok) return c.json({ error: r.error }, r.error === "verify_failed" || r.error === "not_configured" ? 503 : 400);
    count("unlock_order");
    return c.json({ ...r.view, buyUrl: opts.buyUrl ?? null });
  });
  // The link in the store's order confirmation email: /app/claim?o=<order number>&s=<signature>
  api.post("/claim-link", async (c) => {
    if (!plans || !opts.linkKey) return c.json({ error: "not_configured" }, 404);
    const dev = devOf(c);
    if (!dev) return c.json({ error: "device_required" }, 401);
    if (!claimIp.hit(keyOf(c))) return c.json({ error: "rate_limited" }, 429);
    const body = (await c.req.json().catch(() => null)) as { order?: unknown; sig?: unknown } | null;
    const order = typeof body?.order === "string" ? body.order.replace(/\D/g, "").slice(0, 12) : "";
    const sig = typeof body?.sig === "string" ? body.sig.slice(0, 80) : "";
    if (!order || !linkSignatureOk(opts.linkKey, order, sig)) return c.json({ error: "bad_link" }, 400);
    const r = await plans.claimByLink(dev, order, () => (opts.shopify ? lookupShopifyOrder(opts.shopify, order, null, opts.shopifyFetch) : Promise.resolve("not_configured" as const)));
    if (!r.ok) return c.json({ error: r.error }, r.error === "verify_failed" || r.error === "not_configured" ? 503 : 400);
    count("unlock_order");
    return c.json({ ...r.view, buyUrl: opts.buyUrl ?? null });
  });

  api.post("/redeem", async (c) => {
    if (!plans) return c.json({ error: "not_configured" }, 404);
    const dev = devOf(c);
    if (!dev) return c.json({ error: "device_required" }, 401);
    if (!claimIp.hit(keyOf(c))) return c.json({ error: "rate_limited" }, 429);
    const body = (await c.req.json().catch(() => null)) as { code?: unknown } | null;
    const r = await plans.redeem(dev, typeof body?.code === "string" ? body.code.slice(0, 40) : "");
    if (!r.ok) return c.json({ error: r.error }, 400);
    count("unlock_code");
    return c.json({ ...r.view, buyUrl: opts.buyUrl ?? null });
  });

  api.post("/read", async (c) => {
    if (pilotCode && !safeEqual((c.req.header("x-pilot-code") ?? "").trim().toLowerCase(), pilotCode.trim().toLowerCase())) return c.json({ error: "pilot_code" }, 403);
    const dev = devOf(c);
    if (plans && !dev) return c.json({ error: "device_required" }, 401);
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
    // The plan (free: FREE_TRIAL in total per device; pass: PASS_MONTHLY a month per pass), counted only for successful reads.
    const gate = plans && dev ? await plans.gate(dev, c.req.header("x-license")) : null;
    if (gate && !gate.ok) return c.json({ error: gate.error }, 402);
    // The global cap counts only requests that will actually reach the model.
    if (!readDay.hit()) return c.json({ error: "daily_cap" }, 429);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const page = await reader.read(bytes, mime, grade);
      if (gate?.ok) {
        const used = await gate.charge().catch((e) => {
          console.error("usage write failed:", (e as NodeJS.ErrnoException)?.code ?? "unknown");
          return 0;
        });
        if (gate.plan === "pass") count("photo_pass");
        else {
          count("photo_free");
          if (used === 1) count("first_photo");
          if (plans && used === plans.freeTrial) count("trial_out");
        }
      }
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
    count("waitlist");
    return c.json({ ok: true });
  });

  return api;
}
