import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { type Now, RateLimiter, clientKey, safeEqual } from "./limits";
import type { License, Store } from "./plans";
import { type Counts, STAT_EVENTS, type StatEvent, type Stats, statDay } from "./stats";
import type { WaitlistTarget } from "./waitlist-store";

/**
 * /admin — the founder's dashboard (Japanese, one page): visitors → first photo → trial used up →
 * annual plan, the passes, and the waitlist emails (with a CSV download).
 * Login: the admin key (ADMIN_KEY, else generated once into the plan folder: plans/admin-key).
 */

export async function adminKey(dir: string, fromEnv?: string): Promise<string> {
  if (fromEnv?.trim()) return fromEnv.trim();
  const p = join(dir, "admin-key");
  try {
    const k = (await readFile(p, "utf8")).trim();
    if (k.length >= 12) return k;
  } catch {
    /* first start */
  }
  const k = randomBytes(9).toString("base64url"); // 12 characters
  await mkdir(dir, { recursive: true });
  await writeFile(p, k, { mode: 0o600 });
  return k;
}

export const LABELS: Record<StatEvent, string> = {
  lp_view: "LPの表示",
  device_new: "アプリを開いた新しい端末",
  first_photo: "はじめて撮った端末",
  photo_free: "撮影枚数（お試し）",
  photo_pass: "撮影枚数（年間プラン）",
  trial_out: "お試しを使い切った端末",
  unlock_order: "年間プラン有効化（注文番号）",
  unlock_code: "年間プラン有効化（コード）",
  waitlist: "先行登録メール",
};

interface Signup {
  email?: string;
  grade?: string;
  worry?: string;
  src?: string;
  variant?: string;
  at?: string;
}

export interface AdminOptions {
  key: string;
  secret: string;
  stats: Stats;
  store: Store;
  waitlist: WaitlistTarget;
  now?: Now;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
const jst = (iso: string | undefined) => (iso ? new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") : "");
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

async function readSignups(t: WaitlistTarget): Promise<Signup[]> {
  const rows: Signup[] = [];
  if (t.dir) {
    let files: string[] = [];
    try {
      files = (await readdir(t.dir)).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    files.sort().reverse(); // file names start with the time
    for (const f of files.slice(0, 2000)) {
      try {
        rows.push(JSON.parse(await readFile(join(t.dir, f), "utf8")) as Signup);
      } catch {
        /* skip a broken file */
      }
    }
    return rows;
  }
  try {
    const lines = (await readFile(t.path, "utf8")).split("\n").filter(Boolean);
    for (const l of lines.reverse()) rows.push(JSON.parse(l) as Signup);
  } catch {
    /* none yet */
  }
  return rows;
}

async function passSummary(store: Store, now: number) {
  const s = { active: 0, order: 0, code: 0, unusedCodes: 0, expired: 0, devices: 0, endingSoon: 0 };
  for (const name of (await store.list("lic")).slice(0, 5000)) {
    const lic = await store.get<License>(`lic/${name}`);
    if (!lic) continue;
    if (!lic.expiresAt) {
      s.unusedCodes++;
      continue;
    }
    const end = Date.parse(lic.expiresAt);
    if (end <= now) {
      s.expired++;
      continue;
    }
    s.active++;
    s[lic.kind]++;
    s.devices += lic.devices.length;
    if (end - now < 30 * 24 * 3600 * 1000) s.endingSoon++;
  }
  return s;
}

const n = (c: Counts, ev: StatEvent) => c[ev] ?? 0;

function page(body: string) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>つまずきマップ 管理</title><style>
:root{--ink:rgb(29,36,51);--muted:rgb(93,103,121);--line:rgb(228,222,211);--bg:rgb(247,244,238);--card:white;--accent:rgb(201,100,59);--navy:rgb(30,45,74)}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;background:var(--bg);color:var(--ink);font-size:15px}
main{max-width:1100px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}
.muted{color:var(--muted);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.card b{display:block;font-size:26px;color:var(--navy)}
.card span{font-size:12px;color:var(--muted)}.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}thead th{background:var(--bg);font-weight:600}.left td,.left th{text-align:left}
.funnel td:last-child{color:var(--accent);font-weight:700}a{color:var(--navy)}input,button{font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line)}
button{background:var(--navy);color:white;border:0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
</style></head><body><main>${body}</main></body></html>`;
}

export function createAdmin(o: AdminOptions) {
  const now = o.now ?? Date.now;
  const admin = new Hono();
  const loginIp = new RateLimiter(10, 60 * 60 * 1000, now);
  const token = createHmac("sha256", o.secret).update(`admin:${o.key}`).digest("base64url");
  const authed = (c: Parameters<typeof getCookie>[0]) => safeEqual(getCookie(c, "adm") ?? "", token);

  admin.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Robots-Tag", "noindex, nofollow");
  });

  admin.post("/login", async (c) => {
    const ip = clientKey(c.req.header("x-forwarded-for"), undefined);
    if (!loginIp.hit(ip)) return c.html(page(`<p>試行回数が多すぎます。1時間ほどあけてください。</p>`), 429);
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const key = typeof form.key === "string" ? form.key.trim() : "";
    if (!safeEqual(key, o.key)) return c.html(loginPage("キーが正しくありません。"), 401);
    setCookie(c, "adm", token, { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", path: "/admin", maxAge: 60 * 60 * 24 * 30 });
    return c.redirect("/admin");
  });

  admin.get("/waitlist.csv", async (c) => {
    if (!authed(c)) return c.redirect("/admin");
    const rows = await readSignups(o.waitlist);
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["日時(JST),メール,学年,悩み,流入元,見出し", ...rows.map((r) => [jst(r.at), r.email, r.grade, r.worry, r.src, r.variant].map(q).join(","))].join("\r\n");
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="waitlist-${statDay(now())}.csv"`);
    return c.body(`﻿${csv}`); // BOM: Excel opens the Japanese correctly
  });

  admin.get("/", async (c) => {
    if (!authed(c)) return c.html(loginPage());
    const t = now();
    const [week, month, total, passes, signups] = await Promise.all([o.stats.recent(7), o.stats.recent(30), o.stats.total(), passSummary(o.store, t), readSignups(o.waitlist)]);
    const today = week.days[0].c;
    const card = (v: number, label: string) => `<div class="card"><b>${v.toLocaleString("ja-JP")}</b><span>${esc(label)}</span></div>`;
    const funnelRow = (label: string, ev: StatEvent, base?: StatEvent) =>
      `<tr><td>${esc(label)}</td><td>${n(today, ev)}</td><td>${n(week.sum, ev)}</td><td>${n(month.sum, ev)}</td><td>${n(total, ev)}</td><td>${base ? pct(n(total, ev), n(total, base)) : ""}</td></tr>`;
    const unlocks = (c: Counts) => n(c, "unlock_order") + n(c, "unlock_code");
    const daily = month.days
      .filter(({ c }) => STAT_EVENTS.some((ev) => n(c, ev) > 0))
      .map(
        ({ day, c }) =>
          `<tr><td>${day}</td>${STAT_EVENTS.map((ev) => `<td>${n(c, ev) || ""}</td>`).join("")}</tr>`,
      )
      .join("");
    const recent = signups
      .slice(0, 50)
      .map((r) => `<tr><td>${esc(jst(r.at))}</td><td>${esc(r.email)}</td><td>${esc(r.grade)}</td><td>${esc(r.worry)}</td><td>${esc(r.src)}</td></tr>`)
      .join("");
    return c.html(
      page(`<div class="top"><div><h1>つまずきマップ 管理画面</h1><p class="muted">${esc(jst(new Date(t).toISOString()))}（日本時間）時点。数字は件数のみで、個人は特定しません（メールは先行登録だけ）。</p></div>
<a href="/admin">更新</a></div>
<h2>今日</h2><div class="cards">${card(n(today, "lp_view"), LABELS.lp_view)}${card(n(today, "device_new"), LABELS.device_new)}${card(n(today, "first_photo"), LABELS.first_photo)}${card(n(today, "photo_free") + n(today, "photo_pass"), "撮影枚数（合計）")}${card(n(today, "trial_out"), LABELS.trial_out)}${card(unlocks(today), "年間プラン有効化")}${card(n(today, "waitlist"), LABELS.waitlist)}</div>
<h2>お客さまの流れ</h2><div class="wrap"><table class="funnel"><thead><tr><th></th><th>今日</th><th>7日間</th><th>30日間</th><th>累計</th><th>前の段階から</th></tr></thead><tbody>
${funnelRow("① LPを見た", "lp_view")}
${funnelRow("② アプリを開いた（新しい端末）", "device_new", "lp_view")}
${funnelRow("③ はじめて撮った", "first_photo", "device_new")}
${funnelRow("④ お試し30枚を使い切った", "trial_out", "first_photo")}
<tr><td>⑤ 年間プランを有効にした（端末）</td><td>${unlocks(today)}</td><td>${unlocks(week.sum)}</td><td>${unlocks(month.sum)}</td><td>${unlocks(total)}</td><td>${pct(unlocks(total), n(total, "trial_out"))}</td></tr>
${funnelRow("先行登録メール", "waitlist")}
</tbody></table></div>
<p class="muted">⑤は「購入済みの方」やコードで有効にした端末の数です（1つのプランを2台目・3台目で有効にしても数えます）。</p>
<h2>年間プラン</h2><div class="cards">${card(passes.active, "有効なプラン")}${card(passes.order, "うち ストアで購入")}${card(passes.code, "うち コード（講座など）")}${card(passes.devices, "使っている端末")}${card(passes.endingSoon, "30日以内に期限切れ")}${card(passes.unusedCodes, "未使用のコード")}${card(passes.expired, "期限切れ")}</div>
<h2>日別（30日間・動きのあった日）</h2><div class="wrap"><table><thead><tr><th>日付</th>${STAT_EVENTS.map((ev) => `<th>${esc(LABELS[ev])}</th>`).join("")}</tr></thead><tbody>${daily || `<tr><td colspan="${STAT_EVENTS.length + 1}">まだありません</td></tr>`}</tbody></table></div>
<h2>先行登録メール（${signups.length.toLocaleString("ja-JP")}件）</h2><p><a href="/admin/waitlist.csv">CSVでダウンロード</a>（Excel対応）</p>
<div class="wrap"><table class="left"><thead><tr><th>日時（日本時間）</th><th>メール</th><th>学年</th><th>悩み</th><th>流入元</th></tr></thead><tbody>${recent || `<tr><td colspan="5">まだありません</td></tr>`}</tbody></table></div>
<p class="muted">新しい50件を表示しています。すべてはCSVでご覧ください。</p>`),
    );
  });

  return admin;
}

function loginPage(error?: string) {
  return page(`<h1>つまずきマップ 管理画面</h1><form method="post" action="/admin/login" style="display:grid;gap:10px;max-width:360px;margin-top:16px">
<label>管理キー<br><input name="key" type="password" autocomplete="current-password" required style="width:100%"></label>
${error ? `<p style="color:var(--accent)">${esc(error)}</p>` : ""}<button type="submit">ひらく</button></form>`);
}
