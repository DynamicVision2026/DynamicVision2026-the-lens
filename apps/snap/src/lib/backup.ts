import { z } from "zod";
import { GRADES, type Grade } from "../curriculum";
import { MARKS } from "../reader/schema";
import type { SavedPage } from "./model";

/**
 * Backup / restore: one JSON file with every page (photos as base64).
 * Restore merges by page id: pages already on this device are kept as they are, new ones are added.
 */
export const BACKUP_APP = "lens-snap";
export const BACKUP_VERSION = 1;
/** Days after which ふりかえり gently suggests a new backup. */
export const BACKUP_REMIND_DAYS = 14;

const PhotoSchema = z.object({ mime: z.string().regex(/^image\//), base64: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/) });
const ProblemSchema = z.object({
  n: z.number().int().nonnegative(),
  q: z.string(),
  unit: z.string().nullable(),
  answer: z.string().nullable(),
  mark: z.enum(MARKS).nullable(),
  confidence: z.number().min(0).max(1),
  reviewed: z.boolean(),
});
const PageSchema = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "createdAt"),
  grade: z.enum(GRADES),
  pageType: z.enum(["test", "drill", "note", "other"]),
  score: z.string().nullable(),
  photo: PhotoSchema.optional(),
  problems: z.array(ProblemSchema),
});
export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  grade: z.enum(GRADES).nullable(),
  pages: z.array(PageSchema),
});
export type BackupFile = z.infer<typeof BackupSchema>;

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function makeBackup(pages: SavedPage[], grade: Grade | null, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    grade,
    pages: pages.map(({ photo, ...p }) => ({ ...p, ...(photo ? { photo: { mime: photo.mime, base64: toBase64(photo.bytes) } } : {}) })),
  };
}

/** `lens-snap-backup-YYYYMMDD.json` in the device's local date. */
export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `lens-snap-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}

export class BackupError extends Error {}

/** Parse and validate a backup file's text → pages ready for IndexedDB. Throws BackupError. */
export function parseBackup(text: string): SavedPage[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError("not json");
  }
  const r = BackupSchema.safeParse(json);
  if (!r.success) throw new BackupError(r.error.issues[0]?.message ?? "invalid");
  return r.data.pages.map(({ photo, ...p }) => ({
    ...p,
    ...(photo ? { photo: { mime: photo.mime, bytes: fromBase64(photo.base64) } } : {}),
  }));
}

/** Pages from the backup that this device does not have yet (by id; duplicates in the file count once). */
export function newPages(existingIds: Iterable<string>, incoming: SavedPage[]): SavedPage[] {
  const seen = new Set(existingIds);
  const out: SavedPage[] = [];
  for (const p of incoming) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/** Show the reminder: at least one page, and never backed up or the last backup is > 14 days old. */
export function needsBackupReminder(pageCount: number, lastBackupIso: string | null, now = new Date()): boolean {
  if (pageCount < 1) return false;
  if (!lastBackupIso) return true;
  const t = Date.parse(lastBackupIso);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > BACKUP_REMIND_DAYS * 86400000;
}
