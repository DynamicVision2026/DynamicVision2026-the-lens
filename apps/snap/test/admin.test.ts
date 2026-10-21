import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAdmin } from "../server/admin";
import { createApi } from "../server/app";
import { MemStore, Plans } from "../server/plans";
import { Stats, isBot } from "../server/stats";
import { MockReader } from "../src/reader/mock";

const T0 = Date.parse("2026-10-21T03:00:00Z"); // 12:00 JST
const photo = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe("stats", () => {
  it("counts per JST day and in total", async () => {
    let now = Date.parse("2026-10-21T14:59:00Z"); // 23:59 JST
    const s = new Stats(new MemStore(), () => now);
    await s.bump("device_new");
    now = Date.parse("2026-10-21T15:00:00Z"); // 00:00 JST next day
    await s.bump("device_new");
    await s.bump("first_photo");
    const r = await s.recent(7);
    expect(r.days[0]).toEqual({ day: "2026-10-22", c: { device_new: 1, first_photo: 1 } });
    expect(r.days[1]).toEqual({ day: "2026-10-21", c: { device_new: 1 } });
    expect(r.sum.device_new).toBe(2);
    expect(await s.total()).toEqual({ device_new: 2, first_photo: 1 });
  });
  it("skips crawlers", () => {
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe(false);
  });
});

describe("the customer's path is counted", () => {
  it("new device → first photo → trial used up; no gate without INVITE_ONLY", async () => {
    const store = new MemStore();
    const stats = new Stats(store, () => T0);
    const plans = new Plans({ store, secret: "s".repeat(64), now: () => T0, freeTrial: 2 });
    const api = createApi({ reader: new MockReader(), waitlistPath: join(mkdtempSync(join(tmpdir(), "adm-")), "w.jsonl"), plans, stats, now: () => T0 });
    const { device } = (await (await api.request("/device", { method: "POST" })).json()) as { device: string };
    for (let i = 0; i < 3; i++) {
      const fd = new FormData();
      fd.append("grade", "小5");
      fd.append("image", new File([photo()], "p.jpg", { type: "image/jpeg" }));
      const r = await api.request("/read", { method: "POST", body: fd, headers: { "x-device": device } });
      expect(r.status).toBe(i < 2 ? 200 : 402);
    }
    await stats.bump("lp_view"); // flushes the background writes
    expect(await stats.total()).toEqual({ device_new: 1, photo_free: 2, first_photo: 1, trial_out: 1, lp_view: 1 });
  });
});

describe("/admin", () => {
  it("needs the key; shows the funnel and the waitlist; CSV download", async () => {
    const store = new MemStore();
    const stats = new Stats(store, () => T0);
    await stats.bump("lp_view");
    await stats.bump("device_new");
    const dir = mkdtempSync(join(tmpdir(), "wl-"));
    writeFileSync(join(dir, "2026-10-21T03-00-00.000Z-ab12.json"), JSON.stringify({ email: "mama@example.jp", grade: "小5", src: "yt", at: "2026-10-21T03:00:00.000Z" }));
    const admin = createAdmin({ key: "k".repeat(12), secret: "s".repeat(64), stats, store, waitlist: { dir, path: "" }, now: () => T0 });

    const anon = await admin.request("/");
    expect(await anon.text()).toContain("管理キー");
    expect(await (await admin.request("/waitlist.csv")).text()).not.toContain("mama@");

    const bad = await admin.request("/login", { method: "POST", body: new URLSearchParams({ key: "wrong" }) });
    expect(bad.status).toBe(401);
    const ok = await admin.request("/login", { method: "POST", body: new URLSearchParams({ key: "k".repeat(12) }) });
    expect(ok.status).toBe(302);
    const cookie = (ok.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toMatch(/^adm=/);

    const html = await (await admin.request("/", { headers: { cookie } })).text();
    expect(html).toContain("お客さまの流れ");
    expect(html).toContain("mama@example.jp");
    expect(html).toContain("<td>① LPを見た</td><td>1</td>");
    const csv = await admin.request("/waitlist.csv", { headers: { cookie } });
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain('"mama@example.jp","小5"');
  });
});

describe("/admin users and languages", () => {
  it("lists each trial device by a short random ID, and switches 日本語 / English / 中文", async () => {
    const store = new MemStore();
    const stats = new Stats(store, () => T0);
    const plans = new Plans({ store, secret: "s".repeat(64), now: () => T0, freeTrial: 2 });
    for (const dev of ["AAAAAAxxxxxxxxxx", "BBBBBByyyyyyyyyy"]) {
      const g = await plans.gate(dev);
      if (g.ok) await g.charge();
    }
    const g = await plans.gate("BBBBBByyyyyyyyyy");
    if (g.ok) await g.charge(); // B used up its trial of 2
    const admin = createAdmin({ key: "k".repeat(12), secret: "s".repeat(64), stats, store, waitlist: { path: "/nonexistent" }, freeTrial: 2, now: () => T0 });
    const login = await admin.request("/login", { method: "POST", body: new URLSearchParams({ key: "k".repeat(12) }) });
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    const ja = await (await admin.request("/", { headers: { cookie } })).text();
    expect(ja).toContain("利用者（端末ごと）");
    expect(ja).toContain("<code>AAAAAA</code></td><td>1／2</td><td class=\"st-trying\">お試し中");
    expect(ja).toContain("<code>BBBBBB</code></td><td>2／2</td><td class=\"st-out\">使い切り");
    expect(ja).not.toContain("xxxxxxxxxx"); // never the full id

    const enRes = await admin.request("/?lang=en", { headers: { cookie } });
    const en = await enRes.text();
    expect(en).toContain("Customer funnel");
    expect(en).toContain("Trial used up");
    const langCookie = (enRes.headers.get("set-cookie") ?? "").split(";")[0];
    expect(langCookie).toBe("adm_lang=en");
    // remembered: the next visit without ?lang= stays English
    expect(await (await admin.request("/", { headers: { cookie: `${cookie}; ${langCookie}` } })).text()).toContain("Users (by device)");

    const zh = await (await admin.request("/?lang=zh", { headers: { cookie } })).text();
    expect(zh).toContain("客户转化漏斗");
    expect(zh).toContain("试用中");

    const csv = await (await admin.request("/users.csv?lang=en", { headers: { cookie } })).text();
    expect(csv).toContain("ID,Photos,Status");
    expect(csv).toContain('"BBBBBB","2","Trial used up","2026-10-21 12:00"');
  });
});
