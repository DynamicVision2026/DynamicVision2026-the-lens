import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createReader } from "../src/reader";
import { createApi } from "./app";

const port = Number(process.env.PORT ?? 8080);
const waitlistPath = process.env.WAITLIST_PATH ?? "./data-private/waitlist.jsonl";
const reader = createReader();

const app = new Hono();
app.route("/api", createApi({ reader, waitlistPath }));
app.use("/*", serveStatic({ root: "./dist" }));
// SPA fallback: every non-API route gets index.html.
let indexHtml: string | undefined;
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/")) return c.notFound();
  indexHtml ??= await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
  return c.html(indexHtml);
});

serve({ fetch: app.fetch, port }, () => {
  console.log(`Lens Snap listening on :${port} (reader: ${reader.name})`);
});
