import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import type { Grade } from "../curriculum";
import { readerPrompt } from "./prompt";
import { type PageResult, toPageResult } from "./schema";
import type { Reader } from "./types";

export const DEFAULT_READER_MODEL = "claude-haiku-5-5"; // cheapest current vision model; set READER_MODEL=claude-sonnet-5-5 if accuracy needs it
const MAX_EDGE = 1600;

/** ClaudeReader: one Messages API call per photo. Never logs the image or its content. */
export class ClaudeReader implements Reader {
  readonly name: string;
  private client: Anthropic;

  constructor(
    apiKey = process.env.ANTHROPIC_API_KEY,
    private model = process.env.READER_MODEL || DEFAULT_READER_MODEL,
  ) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.client = new Anthropic({ apiKey });
    this.name = `claude:${this.model}`;
  }

  /** The model id (for eval output file names). */
  get modelId(): string {
    return this.model;
  }

  async read(image: Uint8Array, _mime: string, grade: Grade): Promise<PageResult> {
    const jpeg = await downscale(image);
    const meta = await sharp(jpeg).metadata();
    return this.ask(
      [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
        { type: "text", text: readerPrompt(grade, "photo") },
      ],
      grade,
      4096,
      { w: meta.width ?? 0, h: meta.height ?? 0 },
    );
  }

  /**
   * Same prompt and schema with a problem's text instead of a photo (the unit-tagging eval:
   * tagging depends on the text, so the eval needs no images).
   */
  async readText(problemText: string, grade: Grade): Promise<PageResult> {
    return this.ask(
      [
        { type: "text", text: readerPrompt(grade, "text") },
        { type: "text", text: `Problem text:\n${problemText}` },
      ],
      grade,
      1024,
    );
  }

  private async ask(
    content: Anthropic.MessageParam["content"],
    grade: Grade,
    maxTokens: number,
    img?: { w: number; h: number },
  ): Promise<PageResult> {
    const t0 = Date.now();
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const result = toPageResult(extractJson(text), grade);
    logUsage(msg, grade, img, Date.now() - t0, result);
    return result;
  }
}

/**
 * One JSON line per read for cost tracking (Cloud Run turns it into jsonPayload).
 * Token counts and sizes only: never the image, the prompt or the model's answer.
 */
export function logUsage(
  msg: Pick<Anthropic.Message, "model" | "usage" | "stop_reason">,
  grade: Grade,
  img: { w: number; h: number } | undefined,
  ms: number,
  result?: PageResult,
): void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  const u = msg.usage as Anthropic.Usage & { cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
  console.log(
    JSON.stringify({
      event: "read_usage",
      model: msg.model,
      grade,
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      img_w: img?.w ?? 0,
      img_h: img?.h ?? 0,
      problems: result?.problems.length ?? 0,
      stop_reason: msg.stop_reason,
      ms,
    }),
  );
}

/** Rotate by EXIF, fit within 1600 px on the long edge, re-encode as JPEG. */
export async function downscale(image: Uint8Array): Promise<Buffer> {
  return sharp(image)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("reader returned no JSON");
  return JSON.parse(body.slice(start, end + 1));
}
