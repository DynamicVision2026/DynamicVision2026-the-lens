import { randomBytes } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface WaitlistTarget {
  /** One small file per signup (Cloud Storage FUSE friendly: no appends). Wins over `path`. */
  dir?: string;
  /** JSONL file appended to (local / single disk). */
  path: string;
}

/** `2026-10-18T21:58:39.123Z` → `2026-10-18T21-58-39.123Z` (no colons: safe on every OS after export). */
export function signupFileName(at: string, rand = randomBytes(4).toString("hex")): string {
  return `${at.replace(/:/g, "-")}-${rand}.json`;
}

/** Stores one signup; returns where it went (a path; never logged with its content). */
export async function writeSignup(entry: object, target: WaitlistTarget, now = new Date()): Promise<string> {
  const at = now.toISOString();
  const record = JSON.stringify({ ...entry, at });
  if (target.dir) {
    await mkdir(target.dir, { recursive: true });
    const file = join(target.dir, signupFileName(at));
    await writeFile(file, record + "\n", { encoding: "utf8", flag: "wx" });
    return file;
  }
  await mkdir(dirname(target.path), { recursive: true });
  await appendFile(target.path, record + "\n", "utf8");
  return target.path;
}
