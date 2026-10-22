// UI copy in the visitor's language. copy.ja.ts is the source; copy.<lang>.ts mirror its shape (Widen<…>).
import * as ja from "./copy.ja";
import * as en from "./copy.en";
import * as hans from "./copy.zh-Hans";
import * as hant from "./copy.zh-Hant";
import { LANG, pick } from "./lib/lang";
import { gradeLabel } from "./curriculum";

export { YOUTUBE_CHANNEL_URL, PRIVACY_PATH, HERO_VARIANTS } from "./copy.ja";
export type { HeroVariant } from "./copy.ja";

type T = Pick<typeof ja, "copy" | "landingUi" | "app">;
/**
 * Copy functions are called with saved grade values (「小5」, 「数学I」): in other languages every such argument is
 * shown through gradeLabel (Grade 5 / 五年级 / 五年級), so call sites need no change.
 */
function withGradeLabels<O>(o: O): O {
  if (typeof o === "function") {
    const fn = o as unknown as (...a: unknown[]) => unknown;
    return ((...a: unknown[]) => fn(...a.map((x) => (typeof x === "string" ? gradeLabel(x) : x)))) as unknown as O;
  }
  if (Array.isArray(o) || !o || typeof o !== "object") return o;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, withGradeLabels(v)])) as O;
}
const picked = pick<T>({ ja, en: en as unknown as T, "zh-Hans": hans as unknown as T, "zh-Hant": hant as unknown as T });
const L = LANG === "ja" ? picked : withGradeLabels(picked);
export const copy = L.copy;
export const landingUi = L.landingUi;
export const app = L.app;

/** The product name, the two-line rail brand, and a few labels that used to be written in components. */
export const BRAND = pick({ ja: "つまずきマップ", en: "Stumble Map", "zh-Hans": "卡点地图", "zh-Hant": "卡點地圖" });
export const BRAND_LINES = pick<[string, string]>({ ja: ["つまずき", "マップ"], en: ["Stumble", "Map"], "zh-Hans": ["卡点", "地图"], "zh-Hant": ["卡點", "地圖"] });
export const MISC = pick({
  ja: { colon: "：", points: (s: string) => `・${s}点`, privacyMeta: ["プライバシーポリシー｜つまずきマップ", "つまずきマップでの写真と個人情報の扱いについて。"], pageLinks: "ページ内リンク", siteInfo: "サイト情報", level: { 小: "小", 中: "中", 高: "高" } },
  en: { colon: ": ", points: (s: string) => ` · ${s} pts`, privacyMeta: ["Privacy Policy | Stumble Map", "How Stumble Map handles photos and personal information."], pageLinks: "On this page", siteInfo: "Site information", level: { 小: "Elem.", 中: "Middle", 高: "High" } },
  "zh-Hans": { colon: "：", points: (s: string) => `・${s}分`, privacyMeta: ["隐私政策｜卡点地图", "卡点地图如何处理照片和个人信息。"], pageLinks: "页面内链接", siteInfo: "网站信息", level: { 小: "小学", 中: "初中", 高: "高中" } },
  "zh-Hant": { colon: "：", points: (s: string) => `・${s}分`, privacyMeta: ["隱私權政策｜卡點地圖", "卡點地圖如何處理照片與個人資料。"], pageLinks: "頁面內連結", siteInfo: "網站資訊", level: { 小: "國小", 中: "國中", 高: "高中" } },
});
