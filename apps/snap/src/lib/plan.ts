import { useCallback, useEffect, useState } from "react";
import { readPref, writePref } from "../state";
import { readPilotCode } from "./pilot";

/**
 * The free plan and the 1-year pass, seen from the app. The server decides everything; the app only
 * keeps two strings: this device's signed id (made once by the server) and the pass code, if any.
 */

export type PlanView =
  | { plan: "free"; used: number; limit: number; remaining: number; resetsAt: string; expired?: string; buyUrl: string | null }
  | {
      plan: "pass";
      kind: "order" | "code";
      expiresAt: string;
      license: string;
      used: number;
      limit: number;
      remaining: number;
      resetsAt: string;
      buyUrl: string | null;
    };

export type PlanError =
  | "not_found"
  | "not_paid"
  | "no_pass_item"
  | "expired"
  | "device_limit"
  | "bad_code"
  | "invalid"
  | "rate_limited"
  | "unavailable"
  | "error";

const DEVICE = "device";
const LICENSE = "license";

export const readLicense = () => readPref(LICENSE) ?? "";
const writeLicense = (k: string) => writePref(LICENSE, k);

let devicePromise: Promise<string | null> | null = null;
/** This device's id, asked from the server once and kept. null when the server has no plans (offline: try again later). */
export function ensureDevice(): Promise<string | null> {
  const have = readPref(DEVICE);
  if (have) return Promise.resolve(have);
  devicePromise ??= fetch("/api/device", { method: "POST" })
    .then(async (r) => {
      if (!r.ok) return null;
      const { device } = (await r.json()) as { device?: string };
      if (device) writePref(DEVICE, device);
      return device ?? null;
    })
    .catch(() => null)
    .finally(() => {
      devicePromise = null;
    });
  return devicePromise;
}

/** Headers every metered call sends. */
export async function planHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  const dev = await ensureDevice();
  if (dev) h["x-device"] = dev;
  const lic = readLicense();
  if (lic) h["x-license"] = lic;
  const code = readPilotCode();
  if (code) h["x-pilot-code"] = code;
  return h;
}

export async function fetchPlan(): Promise<PlanView | null> {
  try {
    const r = await fetch("/api/plan", { headers: await planHeaders() });
    if (r.status === 401) {
      // the stored device id is no longer valid (e.g. the server's key changed): get a new one once
      writePref(DEVICE, "");
      const again = await fetch("/api/plan", { headers: await planHeaders() });
      return again.ok ? ((await again.json()) as PlanView) : null;
    }
    return r.ok ? ((await r.json()) as PlanView) : null;
  } catch {
    return null;
  }
}

async function post(path: string, body: object): Promise<{ ok: true; view: PlanView } | { ok: false; error: PlanError }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { ...(await planHeaders()), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string } & Partial<PlanView>;
    if (r.ok && j.plan) {
      if (j.plan === "pass" && "license" in j && j.license) writeLicense(j.license);
      return { ok: true, view: j as PlanView };
    }
    return { ok: false, error: planError(r.status, j.error) };
  } catch {
    return { ok: false, error: "error" };
  }
}

export function planError(status: number, error: string | undefined): PlanError {
  if (status === 429) return "rate_limited";
  if (status === 503) return "unavailable";
  const known: PlanError[] = ["not_found", "not_paid", "no_pass_item", "expired", "device_limit", "bad_code", "invalid"];
  return known.includes(error as PlanError) ? (error as PlanError) : "error";
}

export const claimOrder = (order: string, email: string) => post("/api/claim", { order, email });
export const redeemCode = (code: string) => post("/api/redeem", { code });

/** The plan, loaded on mount; `reload` after a read, a claim or a code. */
export function usePlan() {
  const [plan, setPlan] = useState<PlanView | null>(null);
  const reload = useCallback(async () => setPlan(await fetchPlan()), []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { plan, setPlan, reload };
}

/** 2027年10月18日 */
export function jaDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
/** The day the count comes back: resetsAt is 00:00 JST on the 1st, so show that date (11月1日). */
export const resetDay = (iso: string) => jaDate(iso).replace(/^\d+年/, "");

/** Share of the month used, and the warning level: "low" from 80%, "out" at the limit. */
export function monthUse(plan: { used: number; limit: number }): { pct: number; level: "ok" | "low" | "out" } {
  const pct = Math.min(100, Math.round((plan.used / Math.max(1, plan.limit)) * 100));
  const level = plan.used >= plan.limit ? "out" : plan.used >= plan.limit * 0.8 ? "low" : "ok";
  return { pct, level };
}
