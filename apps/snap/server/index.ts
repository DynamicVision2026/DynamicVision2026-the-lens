import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createReader } from "../src/reader";
import { createApi } from "./app";
import { envInt } from "./limits";

const port = Number(process.env.PORT ?? 8080);
const waitlistPath = process.env.WAITLIST_PATH ?? "./data-private/waitlist.jsonl";
const reader = createReader();

const app = new Hono();
const waitlistDir = process.env.WAITLIST_DIR || undefined;
const pilotCode = process.env.PILOT_CODE?.trim() || undefined;
// Limits are counted in memory: deploy with Cloud Run --max-instances 1.
const api = createApi({
  reader,
  waitlistPath,
  waitlistDir,
  pilotCode,
  readPerIpHour: envInt(process.env.READ_PER_IP_HOUR, 20),
  readDailyCap: envInt(process.env.READ_DAILY_CAP, 300),
});
app.route("/api", api);
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
    `Lens Snap listening on :${port} (reader: ${reader.name}, pilot gate: ${pilotCode ? "on" : "off"}, waitlist: ${waitlistDir ? "dir" : "jsonl"})`,
  );
});
