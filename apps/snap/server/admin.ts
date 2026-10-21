import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Context, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { type Now, RateLimiter, clientKey, safeEqual } from "./limits";
import { type License, type Store, type Usage, linkSignatureOk } from "./plans";
import { type Counts, STAT_EVENTS, type StatEvent, type Stats, statDay } from "./stats";
import type { WaitlistTarget } from "./waitlist-store";

/**
 * /admin — the team's dashboard, in 日本語 / English / 中文 (switch at the top, remembered in a cookie):
 * visitors → first photo → trial used up → annual plan; every trial user by their random device ID
 * (no names, no emails); the passes; and the waitlist emails (CSV downloads for both lists).
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

// ---------------------------------------------------------------- languages

export const LANGS = ["ja", "en", "zh"] as const;
export type Lang = (typeof LANGS)[number];
const LANG_NAMES: Record<Lang, string> = { ja: "日本語", en: "English", zh: "中文" };

type Dict = {
  htmlLang: string;
  locale: string;
  title: string;
  asOf: (t: string) => string;
  refresh: string;
  keyLabel: string;
  open: string;
  badKey: string;
  tooMany: string;
  ev: Record<StatEvent, string>;
  today: string;
  photosTotal: string;
  unlocks: string;
  funnel: string;
  cols: [string, string, string, string, string];
  fromPrev: string;
  steps: [string, string, string, string, string];
  unlockNote: string;
  users: string;
  usersNote: string;
  usersCards: [string, string, string, string];
  userCols: [string, string, string, string, string];
  status: { trying: string; out: string; pass: string };
  usersShown: (shown: number, all: number) => string;
  passes: string;
  passCards: [string, string, string, string, string, string, string];
  daily: string;
  date: string;
  none: string;
  waitlist: (n: string) => string;
  csv: string;
  excel: string;
  waitCols: [string, string, string, string, string];
  newest50: string;
  csvWaitHead: string;
  csvUserHead: string;
  mailTitle: string;
  mailSteps: string[];
  copy: string;
  copied: string;
  checkTitle: string;
  checkBtn: string;
  checkOk: (order: string) => string;
  checkBad: string;
};

const T: Record<Lang, Dict> = {
  ja: {
    htmlLang: "ja",
    locale: "ja-JP",
    title: "つまずきマップ 管理画面",
    asOf: (t) => `${t}（日本時間）時点。お名前・メールは集めていません（メールは先行登録のみ）。`,
    refresh: "更新",
    keyLabel: "管理キー",
    open: "ひらく",
    badKey: "キーが正しくありません。",
    tooMany: "試行回数が多すぎます。1時間ほどあけてください。",
    ev: {
      lp_view: "LPの表示",
      device_new: "アプリを開いた新しい端末",
      first_photo: "はじめて撮った端末",
      photo_free: "撮影枚数（お試し）",
      photo_pass: "撮影枚数（年間プラン）",
      trial_out: "お試しを使い切った端末",
      unlock_order: "年間プラン有効化（注文番号）",
      unlock_code: "年間プラン有効化（コード）",
      waitlist: "先行登録メール",
    },
    today: "今日",
    photosTotal: "撮影枚数（合計）",
    unlocks: "年間プラン有効化",
    funnel: "お客さまの流れ",
    cols: ["今日", "7日間", "30日間", "累計", "前の段階から"],
    fromPrev: "前の段階から",
    steps: ["① LPを見た", "② アプリを開いた（新しい端末）", "③ はじめて撮った", "④ お試しを使い切った", "⑤ 年間プランを有効にした（端末）"],
    unlockNote: "⑤は「購入済みの方」やコードで有効にした端末の数です（1つのプランを2台目・3台目で有効にしても数えます）。",
    users: "利用者（端末ごと）",
    usersNote: "登録やメールは不要なので、利用者は端末ごとのランダムなID（先頭6文字）で表示します。1台のスマホ・タブレット＝1人として数えます。",
    usersCards: ["お試しを使った利用者", "この7日間に撮った利用者", "お試しを使い切った利用者", "年間プランの利用者"],
    userCols: ["ID", "撮影枚数", "状態", "はじめて撮った日時", "最後に撮った日時"],
    status: { trying: "お試し中", out: "使い切り", pass: "年間プラン" },
    usersShown: (s, a) => `最近撮った${s}人を表示しています（全${a}人）。すべてはCSVでご覧ください。`,
    passes: "年間プラン",
    passCards: ["有効なプラン", "うち ストアで購入", "うち コード（講座など）", "使っている端末", "30日以内に期限切れ", "未使用のコード", "期限切れ"],
    daily: "日別（30日間・動きのあった日）",
    date: "日付",
    none: "まだありません",
    waitlist: (n) => `先行登録メール（${n}件）`,
    csv: "CSVでダウンロード",
    excel: "（Excel対応）",
    waitCols: ["日時（日本時間）", "メール", "学年", "悩み", "流入元"],
    newest50: "新しい50件を表示しています。すべてはCSVでご覧ください。",
    csvWaitHead: "日時(JST),メール,学年,悩み,流入元,見出し",
    csvUserHead: "ID,撮影枚数,状態,はじめて撮った日時(JST),最後に撮った日時(JST)",
    mailTitle: "ストアの注文確認メール（年間プランを1タップで有効に）",
    mailSteps: [
      "Shopify管理画面 →「設定」→「通知」→「注文の確認」→「コードを編集」を開きます。",
      "本文の最初の方（「ご注文ありがとうございます」の下など）に、下のコードをそのまま貼り付けて保存します。",
      "年間プラン（LENS-SNAP-1Y）か講座（LENS-COURSE）を含む注文のメールにだけ、ようこそメッセージと「つまずきマップを開いて有効にする」ボタンが入ります。ほかの商品のメールは変わりません。",
      "「テストメールを送信」で届いたメールのボタンは押さずに、長押しして「リンクをコピー」し、下の「リンクの確認」に貼り付けてください（テストの注文番号が実在の注文と重なることがあるため）。",
    ],
    copy: "コードをコピー",
    copied: "コピーしました",
    checkTitle: "リンクの確認（メールのボタンのリンクを貼り付け）",
    checkBtn: "確認する",
    checkOk: (o) => `正しく設定されています（注文番号 ${o} のリンクとして有効です）。`,
    checkBad: "リンクを確認できません。コードを貼り付け直してください（キーの部分が変わっていないか確認してください）。",
  },
  en: {
    htmlLang: "en",
    locale: "en-US",
    title: "Tsumazuki Map — Dashboard",
    asOf: (t) => `As of ${t} (Japan time). No names or emails are collected (emails only from the waitlist).`,
    refresh: "Refresh",
    keyLabel: "Admin key",
    open: "Open",
    badKey: "That key is not correct.",
    tooMany: "Too many attempts. Please wait about an hour.",
    ev: {
      lp_view: "Landing page views",
      device_new: "New devices that opened the app",
      first_photo: "Devices that took a first photo",
      photo_free: "Photos (free trial)",
      photo_pass: "Photos (annual plan)",
      trial_out: "Devices that used up the trial",
      unlock_order: "Plan unlocked (order number)",
      unlock_code: "Plan unlocked (code)",
      waitlist: "Waitlist emails",
    },
    today: "Today",
    photosTotal: "Photos (total)",
    unlocks: "Annual plan unlocked",
    funnel: "Customer funnel",
    cols: ["Today", "7 days", "30 days", "All time", "From previous step"],
    fromPrev: "From previous step",
    steps: ["① Saw the landing page", "② Opened the app (new device)", "③ Took a first photo", "④ Used up the free trial", "⑤ Unlocked the annual plan (devices)"],
    unlockNote: "⑤ counts devices unlocked with an order number or a code (the 2nd and 3rd device on one plan count too).",
    users: "Users (by device)",
    usersNote: "No signup or email is needed, so each user is shown by their device's random ID (first 6 characters). One phone or tablet = one user.",
    usersCards: ["Users who tried it", "Users who took photos in the last 7 days", "Users who used up the trial", "Annual plan users"],
    userCols: ["ID", "Photos", "Status", "First photo", "Last photo"],
    status: { trying: "On trial", out: "Trial used up", pass: "Annual plan" },
    usersShown: (s, a) => `Showing the ${s} most recent users (of ${a}). See the CSV for everyone.`,
    passes: "Annual plans",
    passCards: ["Active plans", "Bought on the store", "From a code (course etc.)", "Devices in use", "Ending within 30 days", "Unused codes", "Expired"],
    daily: "Daily (last 30 days, days with activity)",
    date: "Date",
    none: "Nothing yet",
    waitlist: (n) => `Waitlist emails (${n})`,
    csv: "Download CSV",
    excel: " (opens in Excel)",
    waitCols: ["Time (JST)", "Email", "Grade", "Worry", "Source"],
    newest50: "Showing the newest 50. See the CSV for all.",
    csvWaitHead: "Time (JST),Email,Grade,Worry,Source,Headline",
    csvUserHead: "ID,Photos,Status,First photo (JST),Last photo (JST)",
    mailTitle: "Store order confirmation email (one-tap unlock of the annual plan)",
    mailSteps: [
      "In Shopify admin open Settings → Notifications → Order confirmation → Edit code.",
      "Paste the code below near the top of the body (e.g. under the thank-you line) and save.",
      "Only emails for orders with the annual plan (LENS-SNAP-1Y) or the course (LENS-COURSE) get the welcome message and the button; other products' emails are unchanged.",
      "Send yourself the test email but don't tap its button: long-press it, copy the link and paste it into \"Check a link\" below (the test order number can match a real order).",
    ],
    copy: "Copy code",
    copied: "Copied",
    checkTitle: "Check a link (paste the link of the email's button)",
    checkBtn: "Check",
    checkOk: (o) => `Set up correctly (valid link for order ${o}).`,
    checkBad: "This link is not valid. Paste the code again (check the key was not changed).",
  },
  zh: {
    htmlLang: "zh-Hans",
    locale: "zh-CN",
    title: "つまずきマップ 管理后台",
    asOf: (t) => `截至 ${t}（日本时间）。不收集姓名和邮箱（邮箱仅来自预约登记）。`,
    refresh: "刷新",
    keyLabel: "管理密钥",
    open: "打开",
    badKey: "密钥不正确。",
    tooMany: "尝试次数过多，请约一小时后再试。",
    ev: {
      lp_view: "落地页浏览",
      device_new: "首次打开应用的新设备",
      first_photo: "拍了第一张照片的设备",
      photo_free: "照片数（免费试用）",
      photo_pass: "照片数（年度方案）",
      trial_out: "用完试用的设备",
      unlock_order: "开通年度方案（订单号）",
      unlock_code: "开通年度方案（兑换码）",
      waitlist: "预约登记邮箱",
    },
    today: "今天",
    photosTotal: "照片数（合计）",
    unlocks: "开通年度方案",
    funnel: "客户转化漏斗",
    cols: ["今天", "7天", "30天", "累计", "上一步转化率"],
    fromPrev: "上一步转化率",
    steps: ["① 浏览落地页", "② 打开应用（新设备）", "③ 拍了第一张", "④ 用完免费试用", "⑤ 开通年度方案（设备数）"],
    unlockNote: "⑤ 为通过订单号或兑换码开通的设备数（同一方案的第2、第3台设备也计入）。",
    users: "用户（按设备）",
    usersNote: "无需注册或邮箱，因此每位用户以设备的随机ID（前6位）显示。一部手机或平板 = 一位用户。",
    usersCards: ["使用过试用的用户", "近7天拍过照片的用户", "用完试用的用户", "年度方案用户"],
    userCols: ["ID", "照片数", "状态", "首次拍照", "最近拍照"],
    status: { trying: "试用中", out: "已用完", pass: "年度方案" },
    usersShown: (s, a) => `显示最近拍照的 ${s} 位用户（共 ${a} 位）。全部请看CSV。`,
    passes: "年度方案",
    passCards: ["有效方案", "其中 商店购买", "其中 兑换码（课程等）", "使用中的设备", "30天内到期", "未使用的兑换码", "已过期"],
    daily: "每日（近30天，有数据的日期）",
    date: "日期",
    none: "暂无",
    waitlist: (n) => `预约登记邮箱（${n}条）`,
    csv: "下载CSV",
    excel: "（可用Excel打开）",
    waitCols: ["时间（日本时间）", "邮箱", "年级", "困扰", "来源"],
    newest50: "显示最新的50条，全部请看CSV。",
    csvWaitHead: "时间(JST),邮箱,年级,困扰,来源,标题",
    csvUserHead: "ID,照片数,状态,首次拍照(JST),最近拍照(JST)",
    mailTitle: "商店订单确认邮件（一键开通年度方案）",
    mailSteps: [
      "在 Shopify 后台打开「设置」→「通知」→「订单确认」→「编辑代码」。",
      "把下面的代码原样粘贴到正文靠前的位置（如感谢语下方）并保存。",
      "只有包含年度方案（LENS-SNAP-1Y）或课程（LENS-COURSE）的订单邮件才会出现欢迎语和按钮，其他商品的邮件不变。",
      "发送测试邮件，但不要点击按钮：长按复制链接，粘贴到下方「检查链接」（测试订单号可能与真实订单重复）。",
    ],
    copy: "复制代码",
    copied: "已复制",
    checkTitle: "检查链接（粘贴邮件按钮的链接）",
    checkBtn: "检查",
    checkOk: (o) => `设置正确（订单号 ${o} 的有效链接）。`,
    checkBad: "链接无效。请重新粘贴代码（确认密钥部分没有被改动）。",
  },
};

// ---------------------------------------------------------------- data

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
  /** The free trial's size (FREE_TRIAL). */
  freeTrial?: number;
  /** Key of the signed link in the store's order confirmation email (shown inside the snippet). */
  linkKey?: string;
  now?: Now;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
const jst = (iso: string | undefined) => (iso ? new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") : "");
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
/** The ID shown for a device: the first 6 characters of its random id (never the signed token). */
const shortId = (dev: string) => dev.slice(0, 6);

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
  const s = { active: 0, order: 0, code: 0, unusedCodes: 0, expired: 0, devices: 0, endingSoon: 0, onPass: new Set<string>() };
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
    for (const d of lic.devices) s.onPass.add(d);
    if (end - now < 30 * 24 * 3600 * 1000) s.endingSoon++;
  }
  return s;
}

type UserRow = { id: string; n: number; status: "trying" | "out" | "pass"; first?: string; last?: string };

/** Every device that read at least one free photo (newest activity first). */
async function trialUsers(store: Store, freeTrial: number, onPass: Set<string>): Promise<UserRow[]> {
  const rows: UserRow[] = [];
  for (const dev of (await store.list("usage/trial")).slice(0, 20000)) {
    const u = await store.get<Usage>(`usage/trial/${dev}`);
    if (!u?.n) continue;
    rows.push({ id: shortId(dev), n: u.n, status: onPass.has(dev) ? "pass" : u.n >= freeTrial ? "out" : "trying", first: u.first, last: u.last });
  }
  return rows.sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
}

const n = (c: Counts, ev: StatEvent) => c[ev] ?? 0;

/** The block for Shopify's order confirmation email (Liquid): a welcome and the one-tap unlock button. */
export function orderEmailSnippet(linkKey: string, site = "https://tsumazuki.domo-ai.com"): string {
  return `{% comment %} つまずきマップ：年間プラン・講座のご購入者だけに表示 {% endcomment %}
{% assign tz_pass = false %}
{% for line in subtotal_line_items %}
  {% if line.sku == 'LENS-SNAP-1Y' or line.sku == 'LENS-COURSE' or line.variant.sku == 'LENS-SNAP-1Y' or line.variant.sku == 'LENS-COURSE' %}{% assign tz_pass = true %}{% endif %}
{% endfor %}
{% if tz_pass %}
{% assign tz_sig = order_number | append: '' | hmac_sha256: '${linkKey}' %}
<table role="presentation" width="100%" style="margin:16px 0;border-collapse:separate"><tr><td style="padding:20px;border:1px solid #e4ded3;border-radius:12px;background:#f7f4ee">
<p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#1e2d4a">つまずきマップ 年間プランへようこそ</p>
<p style="margin:0 0 14px;line-height:1.7;color:#1d2433">ご購入ありがとうございます。下のボタンを押すと、つまずきマップが開いて年間プランがすぐに有効になります（注文番号やメールアドレスの入力は不要です）。ご家族の端末（3台まで）でも、このボタンから有効にできます。</p>
<a href="${site}/app/claim?o={{ order_number }}&s={{ tz_sig }}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1e2d4a;color:#ffffff;font-weight:bold;text-decoration:none">つまずきマップを開いて有効にする</a>
<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#5d6779">ボタンが使えないときは、アプリの「プラン」→「購入済みの方」に、注文番号 {{ order_name }} とこのメールのアドレスを入力してください。</p>
</td></tr></table>
{% endif %}`;
}

// ---------------------------------------------------------------- page

function page(d: Dict, lang: Lang, body: string) {
  const switcher = LANGS.map((l) => (l === lang ? `<b>${LANG_NAMES[l]}</b>` : `<a href="?lang=${l}">${LANG_NAMES[l]}</a>`)).join(" ｜ ");
  return `<!doctype html><html lang="${d.htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(d.title)}</title><style>
:root{--ink:rgb(29,36,51);--muted:rgb(93,103,121);--line:rgb(228,222,211);--bg:rgb(247,244,238);--card:white;--accent:rgb(201,100,59);--navy:rgb(30,45,74);--ok:rgb(47,138,99);--gold:rgb(138,101,16)}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP","PingFang SC","Noto Sans SC",sans-serif;background:var(--bg);color:var(--ink);font-size:15px}
main{max-width:1100px;margin:0 auto;padding:16px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}
.lang{display:flex;justify-content:flex-end;gap:6px;font-size:14px;margin-bottom:8px}.lang b{color:var(--navy)}
.muted{color:var(--muted);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.card b{display:block;font-size:26px;color:var(--navy)}
.card span{font-size:12px;color:var(--muted)}.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}thead th{background:var(--bg);font-weight:600}.left td,.left th{text-align:left}
.funnel td:last-child{color:var(--accent);font-weight:700}a{color:var(--navy)}input,button{font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line)}
button{background:var(--navy);color:white;border:0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
code{font-family:ui-monospace,Menlo,monospace}.st-trying{color:var(--navy)}.st-out{color:var(--accent);font-weight:700}.st-pass{color:var(--gold);font-weight:700}
</style></head><body><main><nav class="lang" aria-label="language">${switcher}</nav>${body}</main></body></html>`;
}

function loginPage(d: Dict, lang: Lang, error?: string) {
  return page(
    d,
    lang,
    `<h1>${esc(d.title)}</h1><form method="post" action="/admin/login" style="display:grid;gap:10px;max-width:360px;margin-top:16px">
<label>${esc(d.keyLabel)}<br><input name="key" type="password" autocomplete="current-password" required style="width:100%"></label>
${error ? `<p style="color:var(--accent)">${esc(error)}</p>` : ""}<button type="submit">${esc(d.open)}</button></form>`,
  );
}

export function createAdmin(o: AdminOptions) {
  const now = o.now ?? Date.now;
  const freeTrial = o.freeTrial ?? 30;
  const admin = new Hono();
  const loginIp = new RateLimiter(10, 60 * 60 * 1000, now);
  const token = createHmac("sha256", o.secret).update(`admin:${o.key}`).digest("base64url");
  const authed = (c: Context) => safeEqual(getCookie(c, "adm") ?? "", token);

  /** ?lang=en switches and is remembered (cookie); else the cookie; else 日本語. */
  const langOf = (c: Context): Lang => {
    const q = c.req.query("lang");
    if (q && (LANGS as readonly string[]).includes(q)) {
      setCookie(c, "adm_lang", q, { path: "/admin", sameSite: "Lax", maxAge: 60 * 60 * 24 * 365 });
      return q as Lang;
    }
    const k = getCookie(c, "adm_lang");
    return k && (LANGS as readonly string[]).includes(k) ? (k as Lang) : "ja";
  };

  admin.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Robots-Tag", "noindex, nofollow");
  });

  admin.post("/login", async (c) => {
    const lang = langOf(c);
    const d = T[lang];
    const ip = clientKey(c.req.header("x-forwarded-for"), undefined);
    if (!loginIp.hit(ip)) return c.html(page(d, lang, `<p>${esc(d.tooMany)}</p>`), 429);
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const key = typeof form.key === "string" ? form.key.trim() : "";
    if (!safeEqual(key, o.key)) return c.html(loginPage(d, lang, d.badKey), 401);
    setCookie(c, "adm", token, { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", path: "/admin", maxAge: 60 * 60 * 24 * 30 });
    return c.redirect("/admin");
  });

  const bom = (csv: string) => `﻿${csv}`; // Excel opens Japanese / Chinese correctly
  admin.get("/waitlist.csv", async (c) => {
    if (!authed(c)) return c.redirect("/admin");
    const d = T[langOf(c)];
    const rows = await readSignups(o.waitlist);
    const csv = [d.csvWaitHead, ...rows.map((r) => [jst(r.at), r.email, r.grade, r.worry, r.src, r.variant].map(csvCell).join(","))].join("\r\n");
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="waitlist-${statDay(now())}.csv"`);
    return c.body(bom(csv));
  });

  admin.get("/users.csv", async (c) => {
    if (!authed(c)) return c.redirect("/admin");
    const d = T[langOf(c)];
    const passes = await passSummary(o.store, now());
    const rows = await trialUsers(o.store, freeTrial, passes.onPass);
    const csv = [d.csvUserHead, ...rows.map((r) => [r.id, r.n, d.status[r.status], jst(r.first), jst(r.last)].map(csvCell).join(","))].join("\r\n");
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="users-${statDay(now())}.csv"`);
    return c.body(bom(csv));
  });

  admin.get("/", async (c) => {
    const lang = langOf(c);
    const d = T[lang];
    if (!authed(c)) return c.html(loginPage(d, lang));
    const t = now();
    const [week, month, total, passes, signups] = await Promise.all([o.stats.recent(7), o.stats.recent(30), o.stats.total(), passSummary(o.store, t), readSignups(o.waitlist)]);
    const users = await trialUsers(o.store, freeTrial, passes.onPass);
    const weekAgo = new Date(t - 7 * 24 * 3600 * 1000).toISOString();
    const today = week.days[0].c;
    const num = (v: number) => v.toLocaleString(d.locale);
    const card = (v: number, label: string) => `<div class="card"><b>${num(v)}</b><span>${esc(label)}</span></div>`;
    const funnelRow = (label: string, ev: StatEvent, base?: StatEvent) =>
      `<tr><td>${esc(label)}</td><td>${n(today, ev)}</td><td>${n(week.sum, ev)}</td><td>${n(month.sum, ev)}</td><td>${n(total, ev)}</td><td>${base ? pct(n(total, ev), n(total, base)) : ""}</td></tr>`;
    const unlocks = (c: Counts) => n(c, "unlock_order") + n(c, "unlock_code");
    const daily = month.days
      .filter(({ c }) => STAT_EVENTS.some((ev) => n(c, ev) > 0))
      .map(({ day, c }) => `<tr><td>${day}</td>${STAT_EVENTS.map((ev) => `<td>${n(c, ev) || ""}</td>`).join("")}</tr>`)
      .join("");
    const userRows = users
      .slice(0, 100)
      .map(
        (u) =>
          `<tr><td><code>${esc(u.id)}</code></td><td>${u.n}／${freeTrial}</td><td class="st-${u.status}">${esc(d.status[u.status])}</td><td>${esc(jst(u.first))}</td><td>${esc(jst(u.last))}</td></tr>`,
      )
      .join("");
    const recent = signups
      .slice(0, 50)
      .map((r) => `<tr><td>${esc(jst(r.at))}</td><td>${esc(r.email)}</td><td>${esc(r.grade)}</td><td>${esc(r.worry)}</td><td>${esc(r.src)}</td></tr>`)
      .join("");
    const none = (cols: number) => `<tr><td colspan="${cols}">${esc(d.none)}</td></tr>`;
    // 「リンクの確認」: is a pasted email link signed with our key? (nothing is unlocked)
    const checked = c.req.query("check")?.trim().slice(0, 500);
    let checkedOrder: string | null = null;
    if (checked && o.linkKey) {
      try {
        const u = new URL(checked);
        const ord = (u.searchParams.get("o") ?? "").replace(/\D/g, "");
        if (ord && linkSignatureOk(o.linkKey, ord, u.searchParams.get("s") ?? "")) checkedOrder = ord;
      } catch {
        /* not a URL */
      }
    }
    return c.html(
      page(
        d,
        lang,
        `<div class="top"><div><h1>${esc(d.title)}</h1><p class="muted">${esc(d.asOf(jst(new Date(t).toISOString())))}</p></div><a href="/admin">${esc(d.refresh)}</a></div>
<h2>${esc(d.today)}</h2><div class="cards">${card(n(today, "lp_view"), d.ev.lp_view)}${card(n(today, "device_new"), d.ev.device_new)}${card(n(today, "first_photo"), d.ev.first_photo)}${card(n(today, "photo_free") + n(today, "photo_pass"), d.photosTotal)}${card(n(today, "trial_out"), d.ev.trial_out)}${card(unlocks(today), d.unlocks)}${card(n(today, "waitlist"), d.ev.waitlist)}</div>
<h2>${esc(d.funnel)}</h2><div class="wrap"><table class="funnel"><thead><tr><th></th>${d.cols.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
${funnelRow(d.steps[0], "lp_view")}
${funnelRow(d.steps[1], "device_new", "lp_view")}
${funnelRow(d.steps[2], "first_photo", "device_new")}
${funnelRow(d.steps[3], "trial_out", "first_photo")}
<tr><td>${esc(d.steps[4])}</td><td>${unlocks(today)}</td><td>${unlocks(week.sum)}</td><td>${unlocks(month.sum)}</td><td>${unlocks(total)}</td><td>${pct(unlocks(total), n(total, "trial_out"))}</td></tr>
${funnelRow(d.ev.waitlist, "waitlist")}
</tbody></table></div>
<p class="muted">${esc(d.unlockNote)}</p>
<h2>${esc(d.users)}</h2><p class="muted">${esc(d.usersNote)}</p>
<div class="cards">${card(users.length, d.usersCards[0])}${card(users.filter((u) => (u.last ?? "") >= weekAgo).length, d.usersCards[1])}${card(users.filter((u) => u.status === "out").length, d.usersCards[2])}${card(passes.onPass.size, d.usersCards[3])}</div>
<p><a href="/admin/users.csv">${esc(d.csv)}</a>${esc(d.excel)}</p>
<div class="wrap" data-testid="users"><table class="left"><thead><tr>${d.userCols.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${userRows || none(5)}</tbody></table></div>
${users.length > 100 ? `<p class="muted">${esc(d.usersShown(100, users.length))}</p>` : ""}
<h2>${esc(d.passes)}</h2><div class="cards">${[passes.active, passes.order, passes.code, passes.devices, passes.endingSoon, passes.unusedCodes, passes.expired].map((v, i) => card(v, d.passCards[i])).join("")}</div>
<h2>${esc(d.daily)}</h2><div class="wrap"><table><thead><tr><th>${esc(d.date)}</th>${STAT_EVENTS.map((ev) => `<th>${esc(d.ev[ev])}</th>`).join("")}</tr></thead><tbody>${daily || none(STAT_EVENTS.length + 1)}</tbody></table></div>
<h2>${esc(d.waitlist(num(signups.length)))}</h2><p><a href="/admin/waitlist.csv">${esc(d.csv)}</a>${esc(d.excel)}</p>
<div class="wrap"><table class="left"><thead><tr>${d.waitCols.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${recent || none(5)}</tbody></table></div>
<p class="muted">${esc(d.newest50)}</p>
${
  o.linkKey
    ? `<h2>${esc(d.mailTitle)}</h2><ol class="muted" style="line-height:1.8;padding-left:20px">${d.mailSteps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
<textarea id="mail-snippet" readonly rows="10" style="width:100%;font:12px/1.5 ui-monospace,Menlo,monospace;padding:10px;border:1px solid var(--line);border-radius:10px" data-testid="mail-snippet">${esc(orderEmailSnippet(o.linkKey))}</textarea>
<p><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('mail-snippet').value).then(()=>{this.textContent='${esc(d.copied)}'})">${esc(d.copy)}</button></p>
<h2 id="check">${esc(d.checkTitle)}</h2><form method="get" action="/admin#check" style="display:flex;gap:8px;flex-wrap:wrap"><input name="check" value="${esc(checked ?? "")}" placeholder="https://tsumazuki.domo-ai.com/app/claim?o=…&amp;s=…" style="flex:1;min-width:260px"><button type="submit">${esc(d.checkBtn)}</button></form>
${checked ? `<p data-testid="check-result" style="color:${checkedOrder ? "var(--ok)" : "var(--accent)"};font-weight:700">${esc(checkedOrder ? d.checkOk(checkedOrder) : d.checkBad)}</p>` : ""}`
    : ""
}`,
      ),
    );
  });

  return admin;
}
