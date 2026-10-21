import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAdmin, orderEmailSnippet } from "../server/admin";
import { createApi } from "../server/app";
import { FileStore, MemStore, Plans, linkSignature, linkSignatureOk, shopifyLinkKey } from "../server/plans";
import { MockReader } from "../src/reader/mock";

const SECRET = "s".repeat(64);
const order = (o: object = {}) => ({
  id: "gid://shopify/Order/9",
  name: "#1001",
  email: "Mama@Example.jp",
  cancelledAt: null,
  processedAt: "2026-10-21T01:00:00Z",
  displayFinancialStatus: "PAID",
  lineItems: { nodes: [{ sku: "LENS-SNAP-1Y", quantity: 1 }] },
  ...o,
});

describe("the signed link in the store's order email", () => {
  it("matches Liquid's `order_number | hmac_sha256: key` (hex HMAC-SHA256 of the number)", () => {
    const key = shopifyLinkKey(SECRET);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(linkSignature(key, "1001")).toBe(createHmac("sha256", key).update("1001").digest("hex"));
    expect(linkSignatureOk(key, "#1001", linkSignature(key, "1001").toUpperCase())).toBe(true);
    expect(linkSignatureOk(key, "1002", linkSignature(key, "1001"))).toBe(false);
    expect(linkSignatureOk(key, "1001", "1001")).toBe(false); // what an unknown Liquid filter would print
    expect(shopifyLinkKey(SECRET, "override-key")).toBe("override-key");
  });

  it("the snippet only shows for the pass / course SKUs and carries the key and the link", () => {
    const s = orderEmailSnippet("abc123");
    expect(s).toContain("hmac_sha256: 'abc123'");
    expect(s).toContain("https://tsumazuki.domo-ai.com/app/claim?o={{ order_number }}&s={{ tz_sig }}");
    expect(s).toContain("line.sku == 'LENS-SNAP-1Y'");
    for (const sku of ["LENS-DJ-12M", "LENS-KJ-12M", "LENS-CJ-12M"]) expect(s).toContain(`line.sku == '${sku}'`);
    expect(s).not.toContain("LENS-COURSE");
    expect(s).toContain("{% if tz_pass %}");
  });

  function api(nodes: object[]) {
    const dir = mkdtempSync(join(tmpdir(), "link-"));
    const plans = new Plans({ store: new FileStore(dir), secret: SECRET, now: () => Date.parse("2026-10-21T03:00:00Z") });
    let lookups = 0;
    const shopifyFetch = async () => {
      lookups++;
      return { ok: true, status: 200, json: async () => ({ data: { orders: { nodes } } }) };
    };
    const key = shopifyLinkKey(SECRET);
    const app = createApi({
      reader: new MockReader(),
      waitlistPath: join(dir, "w.jsonl"),
      plans,
      linkKey: key,
      shopify: { store: "x.myshopify.com", token: "t", apiVersion: "2026-07", skus: ["LENS-SNAP-1Y", "LENS-KJ-12M"] },
      shopifyFetch,
    });
    const device = async () => ((await (await app.request("/device", { method: "POST" })).json()) as { device: string }).device;
    const claim = async (dev: string, o: string, sig: string) =>
      app.request("/claim-link", { method: "POST", headers: { "x-device": dev, "Content-Type": "application/json" }, body: JSON.stringify({ order: o, sig }) });
    return { app, key, device, claim, lookups: () => lookups };
  }

  it("unlocks with no email typed; the same link on a 2nd device gives the same plan; 4th device refused", async () => {
    const t = api([order()]);
    const sig = linkSignature(t.key, "1001");
    const d1 = await t.device();
    const r1 = await t.claim(d1, "1001", sig);
    expect(r1.status).toBe(200);
    const v1 = (await r1.json()) as { plan: string; license: string; expiresAt: string };
    expect(v1).toMatchObject({ plan: "pass", expiresAt: "2027-10-21T01:00:00.000Z" });
    const v2 = (await (await t.claim(await t.device(), "1001", sig)).json()) as { license: string };
    expect(v2.license).toBe(v1.license);
    expect(t.lookups()).toBe(1); // known order: no second store lookup
    await t.claim(await t.device(), "1001", sig);
    expect(await (await t.claim(await t.device(), "1001", sig)).json()).toEqual({ error: "device_limit" });
  });

  it("refuses a wrong signature, and orders that are unpaid or without the pass", async () => {
    expect(await (await api([order()]).claim(await api([order()]).device(), "1001", "0".repeat(64))).json()).toEqual({ error: "bad_link" });
    const unpaid = api([order({ displayFinancialStatus: "PENDING" })]);
    expect(await (await unpaid.claim(await unpaid.device(), "1001", linkSignature(unpaid.key, "1001"))).json()).toEqual({ error: "not_paid" });
    const other = api([order({ lineItems: { nodes: [{ sku: "KANJI-1", quantity: 1 }] } })]);
    expect(await (await other.claim(await other.device(), "1001", linkSignature(other.key, "1001"))).json()).toEqual({ error: "no_pass_item" });
    const none = api([]);
    expect(await (await none.claim(await none.device(), "1001", linkSignature(none.key, "1001"))).json()).toEqual({ error: "not_found" });
  });

  it("after the link, the same order also works by order number + email (same plan)", async () => {
    const t = api([order()]);
    const v1 = (await (await t.claim(await t.device(), "1001", linkSignature(t.key, "1001"))).json()) as { license: string };
    const r = await t.app.request("/claim", {
      method: "POST",
      headers: { "x-device": await t.device(), "Content-Type": "application/json" },
      body: JSON.stringify({ order: "1001", email: "mama@example.jp" }),
    });
    expect(((await r.json()) as { license: string }).license).toBe(v1.license);
  });
});

describe("paid customers on /admin", () => {
  it("lists the buyer's email from the store order, the product and the plan's devices", async () => {
    const store = new MemStore();
    const plans = new Plans({ store, secret: SECRET, now: () => Date.parse("2026-10-21T03:00:00Z") });
    const nodes = [order({ lineItems: { nodes: [{ sku: "LENS-KJ-12M", quantity: 1 }] } })];
    const key = shopifyLinkKey(SECRET);
    const app = createApi({
      reader: new MockReader(),
      waitlistPath: "/nonexistent/w.jsonl",
      plans,
      linkKey: key,
      shopify: { store: "x.myshopify.com", token: "t", apiVersion: "2026-07", skus: ["LENS-SNAP-1Y", "LENS-KJ-12M"] },
      shopifyFetch: async () => ({ ok: true, status: 200, json: async () => ({ data: { orders: { nodes } } }) }),
    });
    const dev = ((await (await app.request("/device", { method: "POST" })).json()) as { device: string }).device;
    const r = await app.request("/claim-link", { method: "POST", headers: { "x-device": dev, "Content-Type": "application/json" }, body: JSON.stringify({ order: "1001", sig: linkSignature(key, "1001") }) });
    expect(r.status).toBe(200);
    const { Stats } = await import("../server/stats");
    const admin = createAdmin({ key: "k".repeat(12), secret: SECRET, stats: new Stats(store), store, waitlist: { path: "/nonexistent" }, now: () => Date.parse("2026-10-21T03:00:00Z") });
    const cookie = ((await admin.request("/login", { method: "POST", body: new URLSearchParams({ key: "k".repeat(12) }) })).headers.get("set-cookie") ?? "").split(";")[0];
    const html = await (await admin.request("/", { headers: { cookie } })).text();
    expect(html).toContain("有料のお客さま（1件）");
    expect(html).toContain("<td>mama@example.jp</td><td>#1001</td><td>視点レンズ 高校受験パス</td>");
    const csv = await (await admin.request("/paid.csv", { headers: { cookie } })).text();
    expect(csv).toContain('"mama@example.jp","#1001","視点レンズ 高校受験パス"');
  });
});
