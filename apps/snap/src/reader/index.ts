import { ClaudeReader } from "./claude";
import { MockReader } from "./mock";
import type { Reader } from "./types";

export type ReaderKind = "mock" | "claude";

/**
 * READER=mock|claude overrides; otherwise Claude when ANTHROPIC_API_KEY is set, else mock.
 * MOCK_FALLBACK=<fixture id> picks the mock's answer for photos it cannot match by hash (browsers
 * re-encode large uploads, so a journey run pins its page this way; default p01).
 */
export function createReader(kind?: ReaderKind): Reader {
  const k = kind ?? (process.env.READER as ReaderKind | undefined) ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "mock");
  return k === "claude" ? new ClaudeReader() : new MockReader(undefined, process.env.MOCK_FALLBACK?.trim() || undefined);
}

export type { Reader } from "./types";
export * from "./schema";
