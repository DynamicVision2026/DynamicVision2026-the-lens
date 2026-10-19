import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** Load public/sw.js in a sandbox with fake caches/fetch and replay events. */
function loadSw() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  const keyOf = (r: string | Request) => new URL(typeof r === "string" ? r : r.url, "https://snap.test").pathname;
  const html = '<script type="module" src="/assets/index-abc123.js"></script><link href="/assets/index-def456.css">';
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (r: string | Request, res: Response) => void m.set(keyOf(r), res),
      add: async (r: string) => void m.set(keyOf(r), new Response("x")),
      keys: async () => [...m.keys()].map((k) => new Request(`https://snap.test${k}`)),
      delete: async (r: Request) => m.delete(keyOf(r)),
      match: async (r: string | Request) => m.get(keyOf(r)),
    };
  };
  const caches = {
    open: async (n: string) => store(n),
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (r: string | Request) => {
      for (const n of stores.keys()) {
        const hit = await store(n).match(r);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  let online = true;
  const fetch = async (r: string | Request) => {
    fetched.push(keyOf(r));
    if (!online) throw new TypeError("offline");
    return new Response(keyOf(r) === "/index.html" || (typeof r !== "string" && r.mode === "navigate") ? html : "x", {
      headers: { "content-type": keyOf(r).endsWith(".js") ? "text/javascript" : "text/html" },
    });
  };
  const self = {
    location: { origin: "https://snap.test" },
    addEventListener: (t: string, f: (e: unknown) => void) => (handlers[t] = f),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self, caches, fetch, URL, Response, Request, Promise, Set, console,
  });

  async function lifecycle(type: "install" | "activate") {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  }
  async function request(path: string, init: { method?: string; mode?: "navigate" } = {}) {
    let res: Promise<Response> | undefined;
    const req = { url: `https://snap.test${path}`, method: init.method ?? "GET", mode: init.mode ?? "cors" } as unknown as Request;
    const extra: Promise<unknown>[] = [];
    handlers.fetch({ request: req, respondWith: (r: Promise<Response>) => (res = r), waitUntil: (x: Promise<unknown>) => extra.push(x) });
    const out = res ? await res : undefined;
    await Promise.all(extra);
    return out;
  }
  return { stores, fetched, lifecycle, request, setOnline: (v: boolean) => (online = v) };
}

describe("service worker", () => {
  it("install caches index.html and its hashed assets; old versions are removed on activate", async () => {
    const sw = loadSw();
    sw.stores.set("lens-snap-v0", new Map([["/index.html", new Response("old")]]));
    await sw.lifecycle("install");
    const v1 = sw.stores.get("lens-snap-v1")!;
    expect([...v1.keys()]).toEqual(expect.arrayContaining(["/index.html", "/assets/index-abc123.js", "/assets/index-def456.css"]));
    await sw.lifecycle("activate");
    expect([...sw.stores.keys()]).toEqual(["lens-snap-v1"]);
  });

  it("never touches /api/*", async () => {
    const sw = loadSw();
    await sw.lifecycle("install");
    expect(await sw.request("/api/health")).toBeUndefined();
    expect(await sw.request("/api/read", { method: "POST" })).toBeUndefined();
    for (const m of sw.stores.values()) expect([...m.keys()].some((k) => k.startsWith("/api"))).toBe(false);
  });

  it("navigations: network first, cached shell when offline", async () => {
    const sw = loadSw();
    await sw.lifecycle("install");
    sw.fetched.length = 0;
    const online = await sw.request("/app/map", { mode: "navigate" });
    expect(sw.fetched).toEqual(["/app/map"]);
    expect(await online!.text()).toContain("/assets/index-abc123.js");
    sw.setOnline(false);
    const offline = await sw.request("/app/list", { mode: "navigate" });
    expect(await offline!.text()).toContain("/assets/index-abc123.js");
  });

  it("assets: cache first (no network once cached)", async () => {
    const sw = loadSw();
    await sw.lifecycle("install");
    sw.fetched.length = 0;
    sw.setOnline(false);
    expect(await sw.request("/assets/index-abc123.js")).toBeDefined();
    expect(sw.fetched).toEqual([]);
  });
});
