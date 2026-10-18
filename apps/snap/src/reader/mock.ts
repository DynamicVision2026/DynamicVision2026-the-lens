import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Grade } from "../curriculum";
import { type PageResult, toPageResult } from "./schema";
import type { Reader } from "./types";

/**
 * MockReader: returns the recorded reader outputs in fixtures/reader-outputs.json.
 * The photo is matched to its fixture by SHA-256 of the bytes; an unknown photo gets a
 * fixed fallback entry (FALLBACK_ID) so the app is usable end-to-end with no API key.
 */
export class MockReader implements Reader {
  readonly name = "mock";
  private outputs: Record<string, unknown>;
  private byHash = new Map<string, string>();

  constructor(
    private fixturesDir = join(process.cwd(), "fixtures"),
    private fallbackId = "p01",
  ) {
    this.outputs = JSON.parse(readFileSync(join(fixturesDir, "reader-outputs.json"), "utf8"));
    const photos = join(fixturesDir, "photos");
    for (const f of readdirSync(photos)) {
      if (!/\.(jpe?g|png)$/i.test(f)) continue;
      this.byHash.set(sha256(readFileSync(join(photos, f))), f.replace(/\.\w+$/, ""));
    }
  }

  /** Fixture id for an image, or null if it is not one of the fixture photos. */
  idFor(image: Uint8Array): string | null {
    return this.byHash.get(sha256(image)) ?? null;
  }

  async read(image: Uint8Array, _mime: string, grade: Grade): Promise<PageResult> {
    const id = this.idFor(image) ?? this.fallbackId;
    const raw = this.outputs[id];
    if (!raw) throw new Error(`no recorded output for ${id}`);
    return toPageResult(raw, grade);
  }
}

function sha256(b: Uint8Array): string {
  return createHash("sha256").update(b).digest("hex");
}
