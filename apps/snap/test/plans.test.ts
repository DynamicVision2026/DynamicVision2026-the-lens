import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApi } from "../server/app";
import {
  FileStore,
  MAX_DEVICES,
  MemStore,
  PASS_MONTHLY,
  Plans,
  deviceId,
  monthKey,
  monthResetsAt,
  newDeviceToken,
  normLicense,
  pickOrder,
  signingKey,
} from "../server/plans";
import { MockReader } from "../src/reader/mock";

const SECRET = "s".repeat(64);
const T0 = Date.parse("2026-10-19T03:00:00Z"); // 12:00 JST

function plans(now = () => T0, store = new MemStore()) {
  return { p: new Plans({ store, secret: SECRET, now, freeTrial: 3 }), store };
}

describe("ids", () => {
  it("device tokens are signed: a forged or edited token is refused", () => {
    const t = newDeviceToken(SECRET);
    expect(deviceId(SECRET, t)).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(deviceId("x".repeat(64), t)).toBeNull();
    expect(deviceId(SECRET, t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(deviceId(SECRET, "")).toBeNull();
  });
  it("codes survive how people type them", () => {
    expect(normLicense("ls-f3bj-d3fg-n7f7")).toBe("LS-F3BJ-D3FG-N7F7");
    expect(normLicense(" F3BJ D3FG N7F7 ")).toBe("LS-F3BJ-D3FG-N7F7");
    expect(normLicense("LS-F3BJ-D3FG")).toBeNull();
  });
  it("months are Japan months", () => {
    expect(monthKey(Date.parse("2026-10-31T15:30:00Z"))).toBe("2026-11"); // 00:30 JST on 1 Nov
    expect(monthResetsAt(T0)).toBe("2026-10-31T15:00:00.000Z"); // 1 Nov 00:00 JST
  });
  it("the signing key is made once and kept", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plans-"));
    const a = await signingKey(dir);
    expect(await signingKey(dir)).toBe(a);
    expect(readFileSync(join(dir, "signing-key"), "utf8")).toBe(a);
    expect(await signingKey(dir, "from-env")).toBe("from-env");
  });
});

describe("free plan", () => {
  it("a one-time trial per device: counted only when charged, never reset by a new month", async () => {
    let now = T0;
    const { p } = plans(() => now);
    for (let i = 0; i < 3; i++) {
      const g = await p.gate("devA");
      expect(g.ok).toBe(true);
      if (g.ok) await g.charge();
    }
    expect(await p.gate("devA")).toEqual({ ok: false, error: "quota" });
    expect(await p.view("devA")).toMatchObject({ plan: "free", used: 3, limit: 3, remaining: 0 });
    // another device still has its own 3; an uncharged gate (failed read) costs nothing
    const other = await p.gate("devB");
    expect(other.ok).toBe(true);
    expect(await p.view("devB")).toMatchObject({ used: 0, remaining: 3 });
    // next month (and next year): still used up
    now = Date.parse("2026-10-31T15:00:00Z");
    expect(await p.gate("devA")).toEqual({ ok: false, error: "quota" });
    now = Date.parse("2027-11-15T00:00:00Z");
    expect(await p.view("devA")).toMatchObject({ plan: "free", used: 3, remaining: 0 });
    expect(await p.view("devA")).not.toHaveProperty("resetsAt");
  });
});

describe("pass", () => {
  it("a code: its year starts at first use, 3 family devices, then device_limit", async () => {
    let now = T0;
    const { p, store } = plans(() => now);
    await store.put("lic/LSF3BJD3FGN7F7", { key: "LS-F3BJ-D3FG-N7F7", kind: "code", expiresAt: null, devices: [], createdAt: "x" });
    const r = await p.redeem("d1", "f3bj d3fg n7f7");
    expect(r).toMatchObject({ ok: true, view: { plan: "pass", kind: "code", expiresAt: "2027-10-19T03:00:00.000Z" } });
    for (const d of ["d2", "d3"]) expect((await p.redeem(d, "LS-F3BJ-D3FG-N7F7")).ok).toBe(true);
    expect(await p.redeem("d4", "LS-F3BJ-D3FG-N7F7")).toEqual({ ok: false, error: "device_limit" });
    expect(MAX_DEVICES).toBe(3);
    expect(await p.redeem("d1", "LS-AAAA-AAAA-AAAA")).toEqual({ ok: false, error: "bad_code" });
    // 200 a month per pass, shared by its 3 devices: every device sees the same count
    expect(PASS_MONTHLY).toBe(200);
    const devs = ["d1", "d2", "d3"];
    for (let i = 0; i < PASS_MONTHLY; i++) {
      const g = await p.gate(devs[i % 3], "LS-F3BJ-D3FG-N7F7");
      if (!g.ok) throw new Error(`blocked at ${i}`);
      await g.charge();
      if (i === 159) {
        for (const d of devs) expect(await p.view(d, "LS-F3BJ-D3FG-N7F7")).toMatchObject({ plan: "pass", used: 160, limit: 200, remaining: 40 });
      }
    }
    expect(await p.gate("d2", "LS-F3BJ-D3FG-N7F7")).toEqual({ ok: false, error: "pass_monthly" });
    expect(await p.view("d3", "LS-F3BJ-D3FG-N7F7")).toMatchObject({ used: 200, remaining: 0, resetsAt: "2026-10-31T15:00:00.000Z" });
    // the 1st of the month, 00:00 JST: back to 0
    now = Date.parse("2026-10-31T14:59:59Z");
    expect((await p.gate("d1", "LS-F3BJ-D3FG-N7F7")).ok).toBe(false);
    now = Date.parse("2026-10-31T15:00:00Z");
    expect(await p.view("d1", "LS-F3BJ-D3FG-N7F7")).toMatchObject({ used: 0, remaining: 200, resetsAt: "2026-11-30T15:00:00.000Z" });
    expect((await p.gate("d1", "LS-F3BJ-D3FG-N7F7")).ok).toBe(true);
    // two charges at the same moment (two family devices) are both counted
    const [g1, g2] = await Promise.all([p.gate("d1", "LS-F3BJ-D3FG-N7F7"), p.gate("d2", "LS-F3BJ-D3FG-N7F7")]);
    if (!g1.ok || !g2.ok) throw new Error("gate");
    await Promise.all([g1.charge(), g2.charge()]);
    expect(await p.view("d3", "LS-F3BJ-D3FG-N7F7")).toMatchObject({ used: 2 });
    // after a year: back to the free plan, marked expired
    now = Date.parse("2027-10-20T00:00:00Z");
    expect(await p.view("d1", "LS-F3BJ-D3FG-N7F7")).toMatchObject({ plan: "free", expired: "LS-F3BJ-D3FG-N7F7" });
    expect(await p.redeem("d1", "LS-F3BJ-D3FG-N7F7")).toEqual({ ok: false, error: "expired" });
  });

  it("a Shopify order: one license per order; the second device gets the same one after the same email", async () => {
    const { p } = plans();
    let lookups = 0;
    const found = async () => {
      lookups++;
      return { id: "gid://shopify/Order/1", paidAt: "2026-10-18T10:00:00Z" };
    };
    const a = await p.claimOrder("d1", "Mama@Example.jp", found, "#1001");
    if (!a.ok || a.view.plan !== "pass") throw new Error("claim failed");
    expect(a.view.expiresAt).toBe("2027-10-18T10:00:00.000Z");
    const b = await p.claimOrder("d2", "mama@example.jp ", found, "1001");
    expect(b).toMatchObject({ ok: true, view: { plan: "pass", license: a.view.license } });
    expect(lookups).toBe(1); // the second device did not need Shopify again
    expect(await p.claimOrder("d3", "someone@else.jp", found, "1001")).toEqual({ ok: false, error: "not_found" });
    expect(await p.claimOrder("d1", "x@y.jp", async () => "not_paid" as const, "1002")).toEqual({ ok: false, error: "not_paid" });
  });
});

describe("Shopify order check", () => {
  const node = (over: object = {}) => ({
    id: "gid://shopify/Order/9",
    name: "#1001",
    email: "mama@example.jp",
    cancelledAt: null,
    processedAt: "2026-10-18T10:00:00Z",
    displayFinancialStatus: "PAID",
    lineItems: { nodes: [{ sku: "LENS-SNAP-1Y", quantity: 1 }] },
    ...over,
  });
  const skus = ["LENS-SNAP-1Y", "LENS-KJ-12M"];
  it("paid, right email, a pass or course item → the pass", () => {
    expect(pickOrder([node()], "1001", "MAMA@example.jp", skus)).toEqual({ id: "gid://shopify/Order/9", paidAt: "2026-10-18T10:00:00Z", email: "mama@example.jp" });
    expect(pickOrder([node({ lineItems: { nodes: [{ sku: "lens-kj-12m", quantity: 1 }] } })], "#1001", "mama@example.jp", skus)).toMatchObject({ id: expect.any(String) });
  });
  it("wrong email / number, unpaid, refunded, cancelled, other products → refused", () => {
    expect(pickOrder([node()], "1001", "papa@example.jp", skus)).toBe("not_found");
    expect(pickOrder([node()], "1002", "mama@example.jp", skus)).toBe("not_found");
    expect(pickOrder([node({ displayFinancialStatus: "PENDING" })], "1001", "mama@example.jp", skus)).toBe("not_paid");
    expect(pickOrder([node({ displayFinancialStatus: "REFUNDED" })], "1001", "mama@example.jp", skus)).toBe("not_paid");
    expect(pickOrder([node({ cancelledAt: "2026-10-19T00:00:00Z" })], "1001", "mama@example.jp", skus)).toBe("not_paid");
    expect(pickOrder([node({ lineItems: { nodes: [{ sku: "KANJI-1", quantity: 1 }] } })], "1001", "mama@example.jp", skus)).toBe("no_pass_item");
  });
});

describe("Shopify token", () => {
  it("shpat_ is used as is; client id:secret is exchanged once and reused until near expiry", async () => {
    const calls: string[] = [];
    const f = async (url: string, init: { body: string }) => {
      calls.push(url + " " + init.body);
      return { ok: true, status: 200, json: async () => ({ access_token: "tok-1", expires_in: 86399 }) };
    };
    const { shopifyToken } = await import("../server/plans");
    const base = { store: "s.myshopify.com", apiVersion: "2026-07", skus: [] };
    expect(await shopifyToken({ ...base, token: "shpat_abc" }, f, 0)).toBe("shpat_abc");
    expect(calls).toHaveLength(0);
    expect(await shopifyToken({ ...base, token: "cid:csecret" }, f, 0)).toBe("tok-1");
    expect(await shopifyToken({ ...base, token: "cid:csecret" }, f, 3600_000)).toBe("tok-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("https://s.myshopify.com/admin/oauth/access_token");
    expect(JSON.parse(calls[0].split(" ").slice(1).join(" "))).toEqual({ grant_type: "client_credentials", client_id: "cid", client_secret: "csecret" });
    expect(await shopifyToken({ ...base, token: "cid:csecret" }, f, 86_000_000)).toBe("tok-1");
    expect(calls).toHaveLength(2); // refreshed ~10 min before the 24 h are up
  });
});

describe("API", () => {
  const photo = () => readFileSync(new URL("../fixtures/photos/p01.jpg", import.meta.url));
  const form = () => {
    const fd = new FormData();
    fd.append("grade", "小5");
    fd.append("image", new File([photo()], "p.jpg", { type: "image/jpeg" }));
    return fd;
  };
  function api(shopNodes?: object[]) {
    const dir = mkdtempSync(join(tmpdir(), "plans-api-"));
    const p = new Plans({ store: new FileStore(dir), secret: SECRET, freeTrial: 2 });
    const shopifyFetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { orders: { nodes: shopNodes ?? [] } } }) });
    return createApi({
      reader: new MockReader(),
      waitlistPath: join(dir, "w.jsonl"),
      plans: p,
      buyUrl: "https://shop.example/products/lens-snap-annual",
      shopify: { store: "x.myshopify.com", token: "t", apiVersion: "2026-07", skus: ["LENS-SNAP-1Y"] },
      shopifyFetch,
    });
  }

  it("device → plan → 2 free reads → 402 quota; buy link in the plan", async () => {
    const a = api();
    expect((await a.request("/read", { method: "POST", body: form() })).status).toBe(401);
    const { device } = (await (await a.request("/device", { method: "POST" })).json()) as { device: string };
    const h = { "x-device": device };
    expect(await (await a.request("/plan", { headers: h })).json()).toMatchObject({ plan: "free", remaining: 2, buyUrl: "https://shop.example/products/lens-snap-annual" });
    for (let i = 0; i < 2; i++) expect((await a.request("/read", { method: "POST", body: form(), headers: h })).status).toBe(200);
    const r = await a.request("/read", { method: "POST", body: form(), headers: h });
    expect(r.status).toBe(402);
    expect(await r.json()).toEqual({ error: "quota" });
    expect(await (await a.request("/plan", { headers: h })).json()).toMatchObject({ remaining: 0 });
  });

  it("claim by order number + email → pass → reads past the free limit", async () => {
    const a = api([
      {
        id: "gid://shopify/Order/7",
        name: "#1007",
        email: "mama@example.jp",
        cancelledAt: null,
        processedAt: new Date().toISOString(),
        displayFinancialStatus: "PAID",
        lineItems: { nodes: [{ sku: "LENS-SNAP-1Y", quantity: 1 }] },
      },
    ]);
    const { device } = (await (await a.request("/device", { method: "POST" })).json()) as { device: string };
    const bad = await a.request("/claim", { method: "POST", headers: { "x-device": device, "Content-Type": "application/json" }, body: JSON.stringify({ order: "1007", email: "nope@example.jp" }) });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "not_found" });
    const ok = await a.request("/claim", { method: "POST", headers: { "x-device": device, "Content-Type": "application/json" }, body: JSON.stringify({ order: "#1007", email: "mama@example.jp" }) });
    const view = (await ok.json()) as { plan: string; license: string };
    expect(view.plan).toBe("pass");
    const h = { "x-device": device, "x-license": view.license };
    for (let i = 0; i < 3; i++) expect((await a.request("/read", { method: "POST", body: form(), headers: h })).status).toBe(200);
  });

  it("claim without a Shopify token says so (503), codes still work", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plans-api-"));
    const store = new FileStore(dir);
    await store.put("lic/LSF3BJD3FGN7F7", { key: "LS-F3BJ-D3FG-N7F7", kind: "code", expiresAt: null, devices: [], createdAt: "x" });
    const a = createApi({ reader: new MockReader(), waitlistPath: join(dir, "w"), plans: new Plans({ store, secret: SECRET }), shopify: { store: "x", apiVersion: "v", skus: [] } });
    const { device } = (await (await a.request("/device", { method: "POST" })).json()) as { device: string };
    const c = await a.request("/claim", { method: "POST", headers: { "x-device": device, "Content-Type": "application/json" }, body: JSON.stringify({ order: "1", email: "a@b.jp" }) });
    expect(c.status).toBe(503);
    const r = await a.request("/redeem", { method: "POST", headers: { "x-device": device, "Content-Type": "application/json" }, body: JSON.stringify({ code: "ls f3bj d3fg n7f7" }) });
    expect(await r.json()).toMatchObject({ plan: "pass", kind: "code" });
  });
});
