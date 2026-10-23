import { getInputProps } from "remotion";
import { STRINGS } from "./i18n/strings";

/**
 * Language of the marketing videos: `npx remotion render <id> out.mp4 --props='{"lang":"en"}'` (ja | en | zh-Hant).
 * Japanese is the source: every on-screen string is written in Japanese and looked up here, so the Japanese
 * render is unchanged. English and 繁體中文 use their own narration (audio2/<lang>/), timeline and app recordings.
 */
export type VLang = "ja" | "en" | "zh-Hant";
const raw = (getInputProps() as { lang?: string }).lang;
export const VLANG: VLang = raw === "en" || raw === "zh-Hant" ? raw : "ja";
export const IS_JA = VLANG === "ja";

/** The current language's version of a Japanese on-screen string (Japanese when there is none). */
export function tr(ja: string): string {
  if (IS_JA) return ja;
  const v = STRINGS[VLANG][ja];
  return typeof v === "string" ? v : ja;
}

/** A label whose translation differs from another use of the same Japanese word: `key` names it in strings.ts. */
export function trk(ja: string, key: string): string {
  if (IS_JA) return ja;
  const v = STRINGS[VLANG][key];
  return typeof v === "string" ? v : ja;
}

/** Word-by-word parts (Slam): looked up by the Japanese parts joined with "|". Same count, so colors line up. */
export function trParts(ja: string[]): string[] {
  if (IS_JA) return ja;
  const v = STRINGS[VLANG][ja.join("|")];
  return Array.isArray(v) ? v : ja;
}

/** A file in public/ for this language: audio2/s01.wav → audio2/en/s01.wav (Japanese: unchanged). */
export function lfile(path: string): string {
  if (IS_JA) return path;
  const i = path.lastIndexOf("/");
  return i < 0 ? `${VLANG}/${path}` : `${path.slice(0, i)}/${VLANG}/${path.slice(i + 1)}`;
}

const GRADE_NUM: Record<string, number> = { 小1: 1, 小2: 2, 小3: 3, 小4: 4, 小5: 5, 小6: 6, 中1: 7, 中2: 8, 中3: 9, 高1: 10, 高2: 11, 高3: 12 };
const ZH_NUM = ["", "一", "二", "三", "四", "五", "六"];
/** 小5 → Grade 5 / 五年級; 中2 → Grade 8 / 國二 (the app's gradeLabel). */
export function grade(ja: string): string {
  const n = GRADE_NUM[ja];
  if (IS_JA || !n) return ja;
  if (VLANG === "en") return `Grade ${n}`;
  if (n <= 6) return `${ZH_NUM[n]}年級`;
  return n <= 9 ? `國${ZH_NUM[n - 6]}` : `高${ZH_NUM[n - 9]}`;
}

/** Credit line for the narration voice: VOICEVOX's is required for the Japanese voice; Google's needs none. */
export const VOICE_CREDIT = IS_JA ? "VOICEVOX:No.7" : "";
