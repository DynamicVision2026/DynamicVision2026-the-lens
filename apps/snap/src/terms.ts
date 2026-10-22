// 利用規約 in the visitor's language (the Japanese version prevails; translations say so in `note`).
import * as ja from "./terms.ja";
import * as en from "./terms.en";
import * as hans from "./terms.zh-Hans";
import * as hant from "./terms.zh-Hant";
import { pick } from "./lib/lang";

type T = typeof ja;
export const TERMS = pick<T>({ ja, en: en as unknown as T, "zh-Hans": hans as unknown as T, "zh-Hant": hant as unknown as T }).TERMS;
