import { ClaudeReader } from "./claude";
import { MockReader } from "./mock";
import type { Reader } from "./types";

export type ReaderKind = "mock" | "claude";

/** READER=mock|claude overrides; otherwise Claude when ANTHROPIC_API_KEY is set, else mock. */
export function createReader(kind?: ReaderKind): Reader {
  const k = kind ?? (process.env.READER as ReaderKind | undefined) ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "mock");
  return k === "claude" ? new ClaudeReader() : new MockReader();
}

export type { Reader } from "./types";
export * from "./schema";
