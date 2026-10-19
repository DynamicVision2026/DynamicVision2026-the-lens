import { readPref, writePref } from "../state";

/** 招待コード (pilot gate). The server says whether it is needed via /api/health. */
const KEY = "pilot-code";

export function readPilotCode(): string {
  return readPref(KEY) ?? "";
}
export function writePilotCode(code: string) {
  writePref(KEY, code.trim().toLowerCase());
}
export function clearPilotCode() {
  writePref(KEY, "");
}

let health: Promise<{ pilotGate: boolean }> | null = null;
/** Cached once per page load. If the check fails the UI assumes no gate; the server still enforces it. */
export function fetchPilotGate(): Promise<boolean> {
  health ??= fetch("/api/health")
    .then((r) => (r.ok ? r.json() : { pilotGate: false }))
    .catch(() => ({ pilotGate: false }));
  return health.then((h) => h.pilotGate === true);
}

export type ReadFailure = "pilot_code" | "rate_limited" | "daily_cap" | "quota" | "pass_daily" | "device_limit" | "error";

/** Maps a failed /api/read response to what the snap screen should say. */
export function readFailure(status: number, body: unknown): ReadFailure {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  if (status === 403 && error === "pilot_code") return "pilot_code";
  if (status === 429) return error === "daily_cap" ? "daily_cap" : "rate_limited";
  if (status === 402) return error === "pass_daily" ? "pass_daily" : error === "device_limit" ? "device_limit" : "quota";
  return "error";
}
