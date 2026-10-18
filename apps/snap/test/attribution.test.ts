import { describe, expect, it } from "vitest";
import { normalizeSrc, resolveVariant } from "../src/lib/attribution";
import { WaitlistSchema } from "../src/lib/waitlist";

describe("traffic source (?src=)", () => {
  it("allow-lists sources; unknown → other; missing → direct", () => {
    for (const s of ["yt", "x", "tiktok", "survey", "book", "other"]) expect(normalizeSrc(s)).toBe(s);
    expect(normalizeSrc("YT")).toBe("yt");
    expect(normalizeSrc("facebook")).toBe("other");
    expect(normalizeSrc(normalizeSrc(null))).toBe("direct"); // idempotent: client → server keeps it
    expect(normalizeSrc(null)).toBe("direct");
    expect(normalizeSrc(undefined)).toBe("direct");
    expect(normalizeSrc("")).toBe("direct");
  });

  it("is stored in the waitlist entry and never rejects a signup", () => {
    expect(WaitlistSchema.parse({ email: "a@b.jp", grade: "その他" }).src).toBe("direct");
    expect(WaitlistSchema.parse({ email: "a@b.jp", grade: "その他", src: "direct" }).src).toBe("direct");
    expect(WaitlistSchema.parse({ email: "a@b.jp", grade: "その他", src: "tiktok" }).src).toBe("tiktok");
    expect(WaitlistSchema.parse({ email: "a@b.jp", grade: "その他", src: "evil<script>" }).src).toBe("other");
  });
});

describe("hero A/B variant", () => {
  it("an explicit ?h= wins and is not stored", () => {
    expect(resolveVariant("a", "c")).toEqual({ variant: "a", store: false });
    expect(resolveVariant("default", "b")).toEqual({ variant: "default", store: false });
  });

  it("no ?h= → the stored variant, sticky", () => {
    expect(resolveVariant(null, "c")).toEqual({ variant: "c", store: false });
    expect(resolveVariant("zzz", "b")).toEqual({ variant: "b", store: false });
  });

  it("no ?h= and nothing stored → random over default/a/b/c, then stored", () => {
    const seen = [0, 0.25, 0.5, 0.75, 0.9999].map((r) => resolveVariant(null, null, () => r));
    expect(seen.map((s) => s.variant)).toEqual(["default", "a", "b", "c", "c"]);
    expect(seen.every((s) => s.store)).toBe(true);
    expect(resolveVariant(null, "garbage", () => 0.3)).toEqual({ variant: "a", store: true });
  });
});
