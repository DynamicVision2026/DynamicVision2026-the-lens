import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Hono } from "hono";
import { isGrade } from "../src/curriculum";
import { WaitlistSchema } from "../src/lib/waitlist";
import type { Reader } from "../src/reader";

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface AppOptions {
  reader: Reader;
  waitlistPath: string;
}

/** The /api routes. Privacy: images and request bodies are never logged or stored. */
export function createApi({ reader, waitlistPath }: AppOptions) {
  const api = new Hono();

  api.get("/health", (c) => c.json({ ok: true, reader: reader.name }));

  api.post("/read", async (c) => {
    const len = Number(c.req.header("content-length") ?? 0);
    if (len > MAX_IMAGE_BYTES + 64 * 1024) return c.json({ error: "too_large" }, 413);
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }
    const grade = form.get("grade");
    const file = form.get("image");
    if (!isGrade(grade)) return c.json({ error: "grade_required" }, 400);
    if (!(file instanceof File)) return c.json({ error: "image_required" }, 400);
    if (file.size > MAX_IMAGE_BYTES) return c.json({ error: "too_large" }, 413);
    const mime = file.type || "image/jpeg";
    if (!IMAGE_TYPES.includes(mime)) return c.json({ error: "unsupported_type" }, 415);
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
    await mkdir(dirname(waitlistPath), { recursive: true });
    await appendFile(waitlistPath, JSON.stringify({ ...parsed.data, at: new Date().toISOString() }) + "\n", "utf8");
    return c.json({ ok: true });
  });

  return api;
}
