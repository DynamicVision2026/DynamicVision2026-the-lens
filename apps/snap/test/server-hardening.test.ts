import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../server/app";
import { DailyCap, RateLimiter, clientKey, envInt, safeEqual } from "../server/limits";
import { signupFileName, writeSignup } from "../server/waitlist-store";
import { MockReader } from "../src/reader/mock";

const HOUR = 3600_000;
const fixture = () => readFileSync(new URL("../fixtures/photos/p01.jpg", import.meta.url));

function readForm() {
  const fd = new FormData();
  fd.append("grade", "小5");
  fd.append("image", new File([fixture()], "p01.jpg", { type: "image/jpeg" }));
  return fd;
}

describe("limiter (pure, injectable clock)", () => {
  it("allows `limit` hits per rolling window per key; refused hits do not count", () => {
    let t = 0;
    const rl = new RateLimiter(3, HOUR, () => t);
    expect([rl.hit("a"), rl.hit("a"), rl.hit("a"), rl.hit("a")]).toEqual([true, true, true, false]);
    expect(rl.hit("b")).toBe(true); // other key unaffected
    t = HOUR - 1;
    expect(rl.hit("a")).toBe(false);
    t = HOUR + 1; // the first three fall out of the window
    expect(rl.hit("a")).toBe(true);
  });

  it("daily cap resets at UTC midnight", () => {
    let t = Date.parse("2026-10-18T23:59:00Z");
    const cap = new DailyCap(2, () => t);
    expect([cap.hit(), cap.hit(), cap.hit()]).toEqual([true, true, false]);
    t = Date.parse("2026-10-19T00:00:01Z");
    expect(cap.hit()).toBe(true);
  });

  it("client key = first x-forwarded-for address, else remote address", () => {
    expect(clientKey("203.0.113.5, 10.0.0.1", "10.0.0.9")).toBe("203.0.113.5");
    expect(clientKey(" 203.0.113.5 ", null)).toBe("203.0.113.5");
    expect(clientKey(undefined, "10.0.0.9")).toBe("10.0.0.9");
    expect(clientKey("", undefined)).toBe("unknown");
  });

  it("safeEqual and envInt", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abc123")).toBe(false);
    expect(envInt("50", 20)).toBe(50);
    expect(envInt(undefined, 20)).toBe(20);
    expect(envInt("x", 20)).toBe(20);
    expect(envInt("0", 20)).toBe(20);
  });
});

describe("/api/read hardening", () => {
  const dir = mkdtempSync(join(tmpdir(), "snap-h-"));
  const base = { reader: new MockReader(), waitlistPath: join(dir, "w.jsonl") };

  it("per-IP limit → 429 rate_limited", async () => {
    const api = createApi({ ...base, readPerIpHour: 2 });
    const send = (ip: string) => api.request("/read", { method: "POST", body: readForm(), headers: { "x-forwarded-for": ip } });
    expect((await send("1.1.1.1")).status).toBe(200);
    expect((await send("1.1.1.1, 9.9.9.9")).status).toBe(200);
    const r = await send("1.1.1.1");
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "rate_limited" });
    expect((await send("2.2.2.2")).status).toBe(200);
  });

  it("global daily cap → 429 daily_cap, reset next UTC day", async () => {
    let t = Date.parse("2026-10-18T12:00:00Z");
    const api = createApi({ ...base, readDailyCap: 2, now: () => t });
    const send = (ip: string) => api.request("/read", { method: "POST", body: readForm(), headers: { "x-forwarded-for": ip } });
    expect((await send("1.1.1.1")).status).toBe(200);
    expect((await send("2.2.2.2")).status).toBe(200);
    const r = await send("3.3.3.3");
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "daily_cap" });
    t = Date.parse("2026-10-19T00:00:05Z");
    expect((await send("3.3.3.3")).status).toBe(200);
  });

  it("pilot gate: 403 pilot_code without the right header; /health reports it", async () => {
    const gated = createApi({ ...base, pilotCode: "kumo42" });
    expect(await (await gated.request("/health")).json()).toMatchObject({ pilotGate: true });
    const none = await gated.request("/read", { method: "POST", body: readForm() });
    expect(none.status).toBe(403);
    expect(await none.json()).toEqual({ error: "pilot_code" });
    expect((await gated.request("/read", { method: "POST", body: readForm(), headers: { "x-pilot-code": "kumo43" } })).status).toBe(403);
    expect((await gated.request("/read", { method: "POST", body: readForm(), headers: { "x-pilot-code": "kumo42" } })).status).toBe(200);

    const open = createApi(base);
    expect(await (await open.request("/health")).json()).toMatchObject({ pilotGate: false });
    expect((await open.request("/read", { method: "POST", body: readForm() })).status).toBe(200);
  });
});

describe("waitlist storage", () => {
  const entry = { email: "p@example.jp", grade: "小学5年生", worry: "毎回", variant: "b", src: "yt" };

  it("WAITLIST_DIR: one file per signup, directory created if missing", async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "snap-wd-")), "data", "waitlist");
    await writeSignup(entry, { dir, path: "/nonexistent/never.jsonl" }, new Date("2026-10-18T09:00:00.000Z"));
    await writeSignup({ ...entry, email: "q@example.jp" }, { dir, path: "/nonexistent/never.jsonl" }, new Date("2026-10-18T09:00:00.000Z"));
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(2); // same timestamp, different random suffix
    for (const f of files) expect(f).toMatch(/^2026-10-18T09-00-00\.000Z-[0-9a-f]{8}\.json$/);
    const rows = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
    expect(rows.map((r) => r.email).sort()).toEqual(["p@example.jp", "q@example.jp"]);
    expect(rows[0]).toMatchObject({ grade: "小学5年生", src: "yt", at: "2026-10-18T09:00:00.000Z" });
    expect(signupFileName("2026-01-02T03:04:05.006Z", "abcd1234")).toBe("2026-01-02T03-04-05.006Z-abcd1234.json");
  });

  it("WAITLIST_PATH: JSONL append when no dir is set", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "snap-wp-")), "sub", "w.jsonl");
    await writeSignup(entry, { path });
    await writeSignup({ ...entry, email: "q@example.jp" }, { path });
    const lines = readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.email)).toEqual(["p@example.jp", "q@example.jp"]);
  });

  it("POST /waitlist writes to the dir, rate-limits 10/hour per IP, never logs the email", async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "snap-wa-")), "wl");
    const api = createApi({ reader: new MockReader(), waitlistPath: join(dir, "unused.jsonl"), waitlistDir: dir });
    const log = vi.spyOn(console, "log");
    const err = vi.spyOn(console, "error");
    const post = (body: unknown, ip = "5.5.5.5") =>
      api.request("/waitlist", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
    for (let i = 0; i < 10; i++) expect((await post({ email: `u${i}@example.jp`, grade: "その他", src: "tiktok" })).status).toBe(200);
    const r = await post({ email: "u10@example.jp", grade: "その他" });
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "rate_limited" });
    expect((await post({ email: "v@example.jp", grade: "その他" }, "6.6.6.6")).status).toBe(200);
    expect(readdirSync(dir)).toHaveLength(11);
    const logged = [...log.mock.calls, ...err.mock.calls].flat().join(" ");
    expect(logged).not.toContain("@example.jp");
    log.mockRestore();
    err.mockRestore();
  });

  it("scripts/waitlist-export.mjs merges a dir or a JSONL into CSV", async () => {
    const root = mkdtempSync(join(tmpdir(), "snap-ex-"));
    const dir = join(root, "wl");
    await writeSignup({ email: "b@example.jp", grade: "小学6年生", worry: "よくある", variant: "a", src: "yt" }, { dir, path: "" }, new Date("2026-10-18T10:00:00Z"));
    await writeSignup({ email: "a@example.jp", grade: "その他", variant: "default", src: "direct" }, { dir, path: "" }, new Date("2026-10-18T09:00:00Z"));
    writeFileSync(join(dir, "not-json.txt"), "ignore me");
    const script = new URL("../scripts/waitlist-export.mjs", import.meta.url).pathname;
    const csv = execFileSync(process.execPath, [script, dir], { encoding: "utf8" });
    expect(csv.trim().split("\n")).toEqual([
      "email,grade,worry,variant,src,at",
      "a@example.jp,その他,,default,direct,2026-10-18T09:00:00.000Z",
      "b@example.jp,小学6年生,よくある,a,yt,2026-10-18T10:00:00.000Z",
    ]);

    const jsonl = join(root, "w.jsonl");
    writeFileSync(
      jsonl,
      [
        JSON.stringify({ email: "c@example.jp", grade: "小学5年生", worry: "毎回", variant: "c", at: "2026-10-17T00:00:00.000Z" }),
        "",
        JSON.stringify({ email: 'q"uote,@example.jp', grade: "その他", variant: "b", src: "x", at: "2026-10-18T00:00:00.000Z" }),
      ].join("\n"),
    );
    const csv2 = execFileSync(process.execPath, [script, jsonl], { encoding: "utf8" });
    expect(csv2.trim().split("\n")).toEqual([
      "email,grade,worry,variant,src,at",
      "c@example.jp,小学5年生,毎回,c,direct,2026-10-17T00:00:00.000Z", // old rows without src → direct
      '"q""uote,@example.jp",その他,,b,x,2026-10-18T00:00:00.000Z',
    ]);
  });
});
