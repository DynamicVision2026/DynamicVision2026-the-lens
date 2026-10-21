import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createReader } from "../src/reader";
import { adminKey, createAdmin } from "./admin";
import { createApi } from "./app";
import { envInt } from "./limits";
import { FileStore, Plans, signingKey } from "./plans";
import { Stats, isBot } from "./stats";

const port = Number(process.env.PORT ?? 8080);
const waitlistPath = process.env.WAITLIST_PATH ?? "./data-private/waitlist.jsonl";
const reader = createReader();

const app = new Hono();
const waitlistDir = process.env.WAITLIST_DIR || undefined;
// The invite gate (招待コード) is off unless INVITE_ONLY=1: the app is open to everyone.
const pilotCode = process.env.INVITE_ONLY === "1" ? process.env.PILOT_CODE?.trim() || undefined : undefined;
// Plans (free per month / 1-year pass) are files next to the waitlist (the bucket mount in production).
const planDir = process.env.PLAN_DIR || (waitlistDir ? join(waitlistDir, "..", "plans") : "./data-private/plans");
const store = new FileStore(planDir);
const secret = await signingKey(planDir, process.env.SIGNING_KEY);
const testNow = !process.env.K_SERVICE && process.env.PLANS_TEST_NOW ? () => Date.parse(process.env.PLANS_TEST_NOW as string) : undefined;
const stats = new Stats(store, testNow);
const plans = new Plans({
  store,
  secret,
  freeTrial: envInt(process.env.FREE_TRIAL, 30),
  passMonthly: envInt(process.env.PASS_MONTHLY, 200),
  // Local screenshot runs only (never on Cloud Run): pretend it is this time, to show the monthly reset.
  now: testNow,
});
const shopify = {
  store: process.env.SHOPIFY_STORE?.trim() || "soul-id-2.myshopify.com",
  token: process.env.SHOPIFY_TOKEN?.trim() || undefined,
  base: process.env.SHOPIFY_BASE?.trim() || undefined, // local tests only
  apiVersion: process.env.SHOPIFY_API_VERSION?.trim() || "2026-07",
  skus: (process.env.PASS_SKUS ?? "LENS-SNAP-1Y,LENS-COURSE").split(","),
};
const buyUrl = process.env.BUY_URL?.trim() || "https://soul-id-2.myshopify.com/products/lens-snap-annual";
// Limits are counted in memory: deploy with Cloud Run --max-instances 1.
const api = createApi({
  plans,
  stats,
  shopify,
  buyUrl,
  reader,
  waitlistPath,
  waitlistDir,
  pilotCode,
  readPerIpHour: envInt(process.env.READ_PER_IP_HOUR, 20),
  readDailyCap: envInt(process.env.READ_DAILY_CAP, 3000),
});
app.route("/api", api);
// The founder's dashboard (key: ADMIN_KEY, else plans/admin-key in the bucket).
app.route("/admin", createAdmin({ key: await adminKey(planDir, process.env.ADMIN_KEY), secret, stats, store, waitlist: { dir: waitlistDir, path: waitlistPath } }));
// Landing page views for the dashboard (people only: crawlers and link previews skipped).
app.use("*", async (c, next) => {
  if (c.req.method === "GET" && c.req.path === "/" && !isBot(c.req.header("user-agent"))) void stats.bump("lp_view");
  await next();
});
// Home-screen app files: the right type for the manifest, and the service worker always revalidated.
app.use("/manifest.webmanifest", async (c, next) => {
  await next();
  if (c.res.ok) c.res.headers.set("Content-Type", "application/manifest+json");
});
app.use("/sw.js", async (c, next) => {
  await next();
  if (c.res.ok) c.res.headers.set("Cache-Control", "no-cache");
});
app.use("/*", serveStatic({ root: "./dist" }));
// SPA fallback: every non-API route gets index.html.
let indexHtml: string | undefined;
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/")) return c.notFound();
  indexHtml ??= await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
  return c.html(indexHtml);
});

serve({ fetch: app.fetch, port }, () => {
    // Config summary only — never the pilot code, emails or paths with personal data.
  console.log(
    `Lens Snap listening on :${port} (reader: ${reader.name}, pilot gate: ${pilotCode ? "on" : "off"}, shopify: ${shopify.token ? "on" : "off"}, waitlist: ${waitlistDir ? "dir" : "jsonl"})`,
  );
});
