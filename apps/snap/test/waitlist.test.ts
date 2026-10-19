import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApi } from "../server/app";
import { copy } from "../src/copy";
import { WAITLIST_GRADES, WORRY_OPTIONS, WaitlistSchema } from "../src/lib/waitlist";
import { MockReader } from "../src/reader/mock";

describe("waitlist validation", () => {
  it("requires a valid email and a grade", () => {
    expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade: "小学5年生", worry: "毎回" }).success).toBe(true);
    expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade: "その他" }).success).toBe(true);
    expect(WaitlistSchema.safeParse({ email: "not-an-email", grade: "小学5年生" }).success).toBe(false);
    expect(WaitlistSchema.safeParse({ email: "a@b.jp" }).success).toBe(false);
    expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade: "" }).success).toBe(false);
    expect(WaitlistSchema.safeParse({ email: "", grade: "小学5年生" }).success).toBe(false);
    expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade: "小5" }).success).toBe(false); // must be a copy-file option
  });

  it("高校 is three options; the old 「高校生」 is still accepted (saved signups, open old forms)", () => {
    expect(WAITLIST_GRADES).toContain("高校1年生");
    expect(WAITLIST_GRADES).toContain("高校2年生");
    expect(WAITLIST_GRADES).toContain("高校3年生");
    expect(WAITLIST_GRADES as readonly string[]).not.toContain("高校生");
    for (const grade of ["高校1年生", "高校2年生", "高校3年生", "高校生"]) expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade }).success, grade).toBe(true);
  });

  it("options come from the copy file; variant defaults to 'default'", () => {
    expect(WAITLIST_GRADES).toEqual(copy.waitlist.gradeOptions);
    expect(WORRY_OPTIONS).toEqual(copy.waitlist.painOptions);
    expect(WaitlistSchema.parse({ email: "a@b.jp", grade: "その他" }).variant).toBe("default");
    expect(WaitlistSchema.parse({ email: "a@b.jp", grade: "その他", variant: "c" }).variant).toBe("c");
    expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade: "その他", variant: "z" }).success).toBe(false);
    expect(WaitlistSchema.safeParse({ email: "a@b.jp", grade: "小学5年生", worry: "sometimes" }).success).toBe(false);
  });
});

describe("API", () => {
  const dir = mkdtempSync(join(tmpdir(), "snap-"));
  const waitlistPath = join(dir, "sub", "waitlist.jsonl");
  const api = createApi({ reader: new MockReader(), waitlistPath });
  const post = (body: unknown) =>
    api.request("/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("POST /waitlist appends JSONL and rejects bad input", async () => {
    expect((await post({ email: "x@y.jp", grade: "小学5年生", worry: "よくある", variant: "a" })).status).toBe(200);
    const bad = await post({ email: "nope" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields.sort()).toEqual(["email", "grade"]);
    const lines = readFileSync(waitlistPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ email: "x@y.jp", grade: "小学5年生", worry: "よくある", variant: "a", src: "direct" });
  });

  it("POST /read returns a PageResult for a fixture photo", async () => {
    const fd = new FormData();
    fd.append("grade", "小5");
    fd.append("image", new File([readFileSync(new URL("../fixtures/photos/p01.jpg", import.meta.url))], "p01.jpg", { type: "image/jpeg" }));
    const r = await api.request("/read", { method: "POST", body: fd });
    expect(r.status).toBe(200);
    const page = await r.json();
    expect(page.problems.filter((p: any) => p.mark === "✕").map((p: any) => p.n)).toEqual([3, 4]);
  });

  it("POST /read reads the old combined 「高校」 as 高1", async () => {
    const fd = new FormData();
    fd.append("grade", "高校");
    fd.append("image", new File([readFileSync(new URL("../fixtures/photos/p01.jpg", import.meta.url))], "p01.jpg", { type: "image/jpeg" }));
    expect((await api.request("/read", { method: "POST", body: fd })).status).toBe(200);
  });

  it("POST /read requires grade and image", async () => {
    const fd = new FormData();
    fd.append("grade", "小7");
    expect((await api.request("/read", { method: "POST", body: fd })).status).toBe(400);
  });
});
