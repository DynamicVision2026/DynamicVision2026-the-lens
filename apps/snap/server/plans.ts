import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Now } from "./limits";

/**
 * Plans: the free trial (FREE_TRIAL photos per device, once: no monthly reset, no signup) and the 1-year pass
 * (¥5,800 on the Shopify store, or bundled with the course: PASS_MONTHLY photos a month per pass,
 * shared by its devices; reset on the 1st of the month, 00:00 Japan time). No accounts and no personal data:
 * - a device is a random id signed by the server (header x-device), issued once by POST /api/device;
 * - a pass is a license key (header x-license) shared by up to MAX_DEVICES family devices;
 * - a Shopify order is stored only as its id, expiry and a keyed hash of the buyer's email.
 * Everything lives as small JSON files in one folder (the Cloud Storage FUSE mount in production).
 */

/** The free trial: photos per device, in total (not per month). */
export const FREE_TRIAL = 30;
export const PASS_DAYS = 365;
export const MAX_DEVICES = 3;
/** A pass: photos per month, counted per license (all its devices share one count). */
export const PASS_MONTHLY = 200;
const DAY = 24 * 60 * 60 * 1000;
const JST = 9 * 60 * 60 * 1000;

// ---------------------------------------------------------------- storage

export interface Store {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown): Promise<void>;
  /** Names (without .json) of the keys directly under `prefix` (e.g. "lic"), for the dashboard. */
  list(prefix: string): Promise<string[]>;
}

/** One JSON file per key under `dir` (keys are validated, never user paths). */
export class FileStore implements Store {
  constructor(private dir: string) {}
  private path(key: string) {
    if (!/^[a-z]+(\/[A-Za-z0-9_-]+)+$/.test(key)) throw new Error("bad key");
    return join(this.dir, `${key}.json`);
  }
  async get<T>(key: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.path(key), "utf8")) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async put(key: string, value: unknown) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    const tmp = `${p}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, p);
  }
  async list(prefix: string) {
    if (!/^[a-z]+(\/[A-Za-z0-9_-]+)*$/.test(prefix)) throw new Error("bad prefix");
    try {
      return (await readdir(join(this.dir, prefix))).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
}

export class MemStore implements Store {
  m = new Map<string, string>();
  async get<T>(key: string) {
    const v = this.m.get(key);
    return v === undefined ? null : (JSON.parse(v) as T);
  }
  async put(key: string, value: unknown) {
    this.m.set(key, JSON.stringify(value));
  }
  async list(prefix: string) {
    const out: string[] = [];
    for (const k of this.m.keys()) if (k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes("/")) out.push(k.slice(prefix.length + 1));
    return out;
  }
}

/** The signing secret: SIGNING_KEY, else one generated once and kept next to the plan files. */
export async function signingKey(dir: string, fromEnv?: string): Promise<string> {
  if (fromEnv?.trim()) return fromEnv.trim();
  const p = join(dir, "signing-key");
  try {
    const k = (await readFile(p, "utf8")).trim();
    if (k.length >= 32) return k;
  } catch {
    /* first start */
  }
  const k = randomBytes(32).toString("hex");
  await mkdir(dir, { recursive: true });
  await writeFile(p, k, { mode: 0o600 });
  return k;
}

// ---------------------------------------------------------------- ids

const b64url = (b: Buffer) => b.toString("base64url");
const sign = (secret: string, s: string) => b64url(createHmac("sha256", secret).update(s).digest()).slice(0, 22);
const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function newDeviceToken(secret: string): string {
  const id = b64url(randomBytes(12));
  return `d1.${id}.${sign(secret, `device:${id}`)}`;
}
/** The device id inside a valid token, else null. */
export function deviceId(secret: string, token: string | undefined | null): string | null {
  const m = /^d1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22})$/.exec((token ?? "").trim());
  if (!m) return null;
  return eq(m[2], sign(secret, `device:${m[1]}`)) ? m[1] : null;
}

/** Crockford-ish alphabet: no 0/O, 1/I/L, so a code read aloud or typed from paper works. */
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newLicenseKey(): string {
  const b = randomBytes(12);
  const chars = [...b].map((x) => ALPHA[x % ALPHA.length]);
  return `LS-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}
/** Normalises what a person typed (spaces, lowercase, missing dashes or the LS- prefix). */
export function normLicense(s: string | undefined | null): string | null {
  const raw = (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.length === 14 && raw.startsWith("LS") ? raw.slice(2) : raw;
  if (body.length !== 12 || [...body].some((c) => !ALPHA.includes(c))) return null;
  return `LS-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}
const licKey = (k: string) => `lic/${k.replace(/-/g, "")}`;

export function emailHash(secret: string, email: string): string {
  return createHmac("sha256", secret).update(`email:${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------- records

export interface License {
  key: string;
  /** "order" = a Shopify order (pass or course), "code" = a code handed out (course sold elsewhere, gifts). */
  kind: "order" | "code";
  /** ISO time the pass ends; null for a code not used yet (its year starts at first use). */
  expiresAt: string | null;
  devices: string[];
  createdAt: string;
  /** Shopify order id (gid) for kind "order". */
  order?: string;
  note?: string;
}

interface OrderRecord {
  license: string;
  email: string; // keyed hash, never the address
}

export function monthKey(now: number): string {
  return new Date(now + JST).toISOString().slice(0, 7);
}
/** The next 1st of the month, 00:00 in Japan. */
export function monthResetsAt(now: number): string {
  const d = new Date(now + JST);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - JST;
  return new Date(next).toISOString();
}

export type PlanView =
  | { plan: "free"; used: number; limit: number; remaining: number; expired?: string }
  | {
      plan: "pass";
      kind: License["kind"];
      expiresAt: string;
      license: string;
      used: number;
      limit: number;
      remaining: number;
      resetsAt: string;
    };

/** charge() counts the photo and returns the new count (for the dashboard: first photo, trial used up). */
export type Gate = { ok: true; plan: "free" | "pass"; charge: () => Promise<number> } | { ok: false; error: "quota" | "pass_monthly" | "device_limit" };

export interface PlansOptions {
  store: Store;
  secret: string;
  now?: Now;
  freeTrial?: number;
  passMonthly?: number;
}

/** A usage file: photos read, and when the first and the last one were read (ISO). */
export interface Usage {
  n: number;
  first?: string;
  last?: string;
}

/** The free trial's count for a device: one file, never reset. */
export const trialKey = (dev: string) => `usage/trial/${dev}`;
/** The month's count for a pass: one file per license per month (JST). */
const passUsageKey = (now: number, license: string) => `usage/pass/${monthKey(now)}/${license.replace(/-/g, "")}`;

export class Plans {
  private store: Store;
  private secret: string;
  private now: Now;
  readonly freeTrial: number;
  readonly passMonthly: number;
  /** One write at a time per usage file (two family devices reading at the same moment). */
  private locks = new Map<string, Promise<unknown>>();
  constructor(o: PlansOptions) {
    this.store = o.store;
    this.secret = o.secret;
    this.now = o.now ?? Date.now;
    this.freeTrial = o.freeTrial ?? FREE_TRIAL;
    this.passMonthly = o.passMonthly ?? PASS_MONTHLY;
  }

  newDevice() {
    return newDeviceToken(this.secret);
  }
  device(token: string | undefined | null) {
    return deviceId(this.secret, token);
  }

  private async usage(key: string) {
    return (await this.store.get<{ n: number }>(key))?.n ?? 0;
  }
  private bump(key: string): Promise<number> {
    const run = (this.locks.get(key) ?? Promise.resolve()).then(async () => {
      const prev = await this.store.get<Usage>(key);
      const n = (prev?.n ?? 0) + 1;
      const at = new Date(this.now()).toISOString();
      // first / last: when this device (or plan) first and last read a photo, for the dashboard
      await this.store.put(key, { n, first: prev?.first ?? at, last: at } satisfies Usage);
      return n;
    });
    const tail = run.catch(() => {});
    this.locks.set(key, tail);
    void tail.then(() => {
      if (this.locks.get(key) === tail) this.locks.delete(key);
    });
    return run;
  }

  /** The license for this header, if it exists, is active and this device may use it (joins when there is room). */
  private async activeLicense(dev: string, header: string | undefined | null): Promise<License | "device_limit" | "expired" | null> {
    const k = normLicense(header);
    if (!k) return null;
    const lic = await this.store.get<License>(licKey(k));
    if (!lic) return null;
    const now = this.now();
    if (lic.expiresAt && Date.parse(lic.expiresAt) <= now) return "expired";
    if (!lic.devices.includes(dev)) {
      if (lic.devices.length >= MAX_DEVICES) return "device_limit";
      lic.devices.push(dev);
    }
    if (!lic.expiresAt) lic.expiresAt = new Date(now + PASS_DAYS * DAY).toISOString(); // a code's year starts now
    await this.store.put(licKey(k), lic);
    return lic;
  }

  async view(dev: string, licenseHeader?: string | null): Promise<PlanView> {
    const lic = await this.activeLicense(dev, licenseHeader);
    const now = this.now();
    if (lic && typeof lic === "object") {
      const used = await this.usage(passUsageKey(now, lic.key));
      return {
        plan: "pass",
        kind: lic.kind,
        expiresAt: lic.expiresAt as string,
        license: lic.key,
        used,
        limit: this.passMonthly,
        remaining: Math.max(0, this.passMonthly - used),
        resetsAt: monthResetsAt(now),
      };
    }
    const used = await this.usage(trialKey(dev));
    const v: PlanView = {
      plan: "free",
      used,
      limit: this.freeTrial,
      remaining: Math.max(0, this.freeTrial - used),
    };
    if (lic === "expired") v.expired = normLicense(licenseHeader) ?? undefined;
    return v;
  }

  /** May this device read one more photo now? `charge()` counts it (call it after a successful read). */
  async gate(dev: string, licenseHeader?: string | null): Promise<Gate> {
    const now = this.now();
    const lic = await this.activeLicense(dev, licenseHeader);
    if (lic === "device_limit") return { ok: false, error: "device_limit" };
    if (lic && typeof lic === "object") {
      const key = passUsageKey(now, lic.key);
      if ((await this.usage(key)) >= this.passMonthly) return { ok: false, error: "pass_monthly" };
      return { ok: true, plan: "pass", charge: () => this.bump(key) };
    }
    const key = trialKey(dev);
    if ((await this.usage(key)) >= this.freeTrial) return { ok: false, error: "quota" };
    return { ok: true, plan: "free", charge: () => this.bump(key) };
  }

  /** Activates a typed code (handed out for the course, gifts, pilot families). */
  async redeem(dev: string, code: string): Promise<{ ok: true; view: PlanView } | { ok: false; error: "bad_code" | "expired" | "device_limit" }> {
    const k = normLicense(code);
    const lic = k ? await this.store.get<License>(licKey(k)) : null;
    if (!lic || !k) return { ok: false, error: "bad_code" };
    const r = await this.activeLicense(dev, k);
    if (r === "expired" || r === "device_limit") return { ok: false, error: r };
    return { ok: true, view: await this.view(dev, k) };
  }

  /**
   * A verified Shopify order → its pass (one license per order; claiming again, e.g. on the second
   * family device, returns the same license after the same email check).
   */
  async claimOrder(
    dev: string,
    email: string,
    lookup: () => Promise<VerifiedOrder | OrderProblem>,
    orderNumber: string,
  ): Promise<{ ok: true; view: PlanView } | { ok: false; error: OrderProblem | "device_limit" | "expired" }> {
    const eh = emailHash(this.secret, email);
    const idx = `order/n${orderNumber.replace(/\D/g, "")}`;
    const known = await this.store.get<OrderRecord>(idx);
    if (known) {
      if (!eq(known.email, eh)) return { ok: false, error: "not_found" };
      const r = await this.activeLicense(dev, known.license);
      if (r === "expired" || r === "device_limit") return { ok: false, error: r };
      return { ok: true, view: await this.view(dev, known.license) };
    }
    const found = await lookup();
    if (typeof found === "string") return { ok: false, error: found };
    return this.passFromOrder(dev, found, eh, idx);
  }

  /**
   * The signed link in the store's order confirmation email (/app/claim?o=<number>&s=<signature>):
   * the signature (checked by the caller) proves the store sent it, so no email needs typing. The pass
   * is the same one as when claiming by order number + email (one license per order, 3 devices).
   */
  async claimByLink(
    dev: string,
    orderNumber: string,
    lookup: () => Promise<VerifiedOrder | OrderProblem>,
  ): Promise<{ ok: true; view: PlanView } | { ok: false; error: OrderProblem | "device_limit" | "expired" }> {
    const idx = `order/n${orderNumber.replace(/\D/g, "")}`;
    const known = await this.store.get<OrderRecord>(idx);
    if (known) {
      const r = await this.activeLicense(dev, known.license);
      if (r === "expired" || r === "device_limit") return { ok: false, error: r };
      return { ok: true, view: await this.view(dev, known.license) };
    }
    const found = await lookup();
    if (typeof found === "string") return { ok: false, error: found };
    return this.passFromOrder(dev, found, emailHash(this.secret, found.email ?? ""), idx);
  }

  private async passFromOrder(
    dev: string,
    found: VerifiedOrder,
    eh: string,
    idx: string,
  ): Promise<{ ok: true; view: PlanView } | { ok: false; error: "expired" }> {
    const expires = Date.parse(found.paidAt) + PASS_DAYS * DAY;
    if (expires <= this.now()) return { ok: false, error: "expired" };
    const key = newLicenseKey();
    const lic: License = {
      key,
      kind: "order",
      expiresAt: new Date(expires).toISOString(),
      devices: [dev],
      createdAt: new Date(this.now()).toISOString(),
      order: found.id,
    };
    await this.store.put(licKey(key), lic);
    await this.store.put(idx, { license: key, email: eh } satisfies OrderRecord);
    return { ok: true, view: await this.view(dev, key) };
  }
}

// ---------------------------------------------------------------- the link in the store's email

/**
 * The key the store's order confirmation email signs its link with (Shopify Liquid:
 * `{{ order_number | hmac_sha256: '<key>' }}`). Derived from the server's secret, so nothing new to
 * store; SHOPIFY_LINK_KEY overrides it. Shown to the owner on /admin with the ready-made snippet.
 */
export function shopifyLinkKey(secret: string, fromEnv?: string): string {
  return fromEnv?.trim() || createHmac("sha256", secret).update("shopify-link").digest("hex").slice(0, 32);
}
/** The signature for an order number: hex HMAC-SHA256, exactly what Liquid's hmac_sha256 prints. */
export function linkSignature(key: string, orderNumber: string): string {
  return createHmac("sha256", key).update(orderNumber.replace(/\D/g, "")).digest("hex");
}
export function linkSignatureOk(key: string, orderNumber: string, sig: string): boolean {
  const s = sig.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(s) && eq(s, linkSignature(key, orderNumber));
}

// ---------------------------------------------------------------- Shopify

export interface VerifiedOrder {
  id: string;
  paidAt: string;
  /** The buyer's email on the order (only used to make its keyed hash; never stored or logged). */
  email?: string;
}
export type OrderProblem = "not_found" | "not_paid" | "no_pass_item" | "not_configured" | "verify_failed";

export interface ShopifyConfig {
  store: string; // xxx.myshopify.com
  /** Only for local tests (a stand-in Shopify): defaults to https://<store>. */
  base?: string;
  token?: string; // Admin API access token (read_orders)
  apiVersion: string;
  /** SKUs that grant the pass: the ¥5,800 annual plan and the course. */
  skus: string[];
}

interface ShopifyOrderNode {
  id: string;
  name: string;
  email: string | null;
  cancelledAt: string | null;
  processedAt: string;
  displayFinancialStatus: string | null;
  lineItems: { nodes: { sku: string | null; quantity: number }[] };
}

/** The pure part of the check (unit-tested): which order, if any, grants a pass. */
export function pickOrder(nodes: ShopifyOrderNode[], number: string, email: string | null, skus: string[]): VerifiedOrder | OrderProblem {
  const want = `#${number.replace(/\D/g, "")}`;
  const mail = email?.trim().toLowerCase();
  // email null: the order came from the signed link in the store's own email, so the number is enough
  const o = nodes.find((n) => n.name.replace(/\s/g, "") === want && (mail === undefined || (n.email ?? "").trim().toLowerCase() === mail));
  if (!o) return "not_found";
  if (o.cancelledAt || !["PAID", "PARTIALLY_REFUNDED"].includes(o.displayFinancialStatus ?? "")) return "not_paid";
  const set = new Set(skus.map((s) => s.trim().toUpperCase()).filter(Boolean));
  if (!o.lineItems.nodes.some((li) => li.quantity > 0 && set.has((li.sku ?? "").trim().toUpperCase()))) return "no_pass_item";
  return { id: o.id, paidAt: o.processedAt, email: o.email ?? undefined };
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * The Admin API token. SHOPIFY_TOKEN is either a legacy custom-app token (shpat_…, permanent) or
 * "<client id>:<client secret>" of a Dev Dashboard app (since 2026): then a token is asked with the
 * client credentials grant and reused until shortly before it expires (24 h).
 */
const tokenCache = new Map<string, { token: string; until: number }>();
export async function shopifyToken(cfg: ShopifyConfig, f: Fetch, now = Date.now()): Promise<string | null> {
  const t = cfg.token?.trim();
  if (!t) return null;
  const i = t.indexOf(":");
  if (t.startsWith("shpat_") || i < 0) return t;
  const hit = tokenCache.get(t);
  if (hit && hit.until > now) return hit.token;
  const r = await f(`${cfg.base ?? `https://${cfg.store}`}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: t.slice(0, i), client_secret: t.slice(i + 1) }),
  });
  if (!r.ok) {
    console.error("shopify token failed: http", r.status);
    return null;
  }
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  tokenCache.set(t, { token: j.access_token, until: now + Math.max(60, (j.expires_in ?? 86399) - 600) * 1000 });
  return j.access_token;
}

export async function lookupShopifyOrder(cfg: ShopifyConfig, number: string, email: string | null, f: Fetch = fetch as unknown as Fetch): Promise<VerifiedOrder | OrderProblem> {
  if (!cfg.token) return "not_configured";
  const digits = number.replace(/\D/g, "");
  if (!digits) return "not_found";
  const query = `query($q: String!) { orders(first: 5, query: $q) { nodes { id name email cancelledAt processedAt displayFinancialStatus lineItems(first: 50) { nodes { sku quantity } } } } }`;
  try {
    const token = await shopifyToken(cfg, f);
    if (!token) return "verify_failed";
    const r = await f(`${cfg.base ?? `https://${cfg.store}`}/admin/api/${cfg.apiVersion}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables: { q: `name:${digits}` } }),
    });
    if (!r.ok) {
      console.error("shopify lookup failed: http", r.status);
      return "verify_failed";
    }
    const j = (await r.json()) as { data?: { orders?: { nodes?: ShopifyOrderNode[] } }; errors?: unknown };
    const nodes = j.data?.orders?.nodes;
    if (!nodes) {
      console.error("shopify lookup failed: no data", JSON.stringify(j.errors ?? null).slice(0, 200));
      return "verify_failed";
    }
    return pickOrder(nodes, digits, email, cfg.skus);
  } catch (e) {
    console.error("shopify lookup failed:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return "verify_failed";
  }
}

/** Stable short id for logs (never log the email or the license). */
export const shortHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);
