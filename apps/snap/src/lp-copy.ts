// Landing-page copy in the visitor's language. lp-copy.ja.ts is the source; lp-copy.<lang>.ts mirror its shape.
import * as ja from "./lp-copy.ja";
import * as en from "./lp-copy.en";
import * as hans from "./lp-copy.zh-Hans";
import * as hant from "./lp-copy.zh-Hant";
import { pick } from "./lib/lang";

export { LEGAL_URL, BUY_URL, SITE_URL, LENS_COURSES_URL } from "./lp-copy.ja";

type T = Pick<typeof ja, "lp">;
export const lp = pick<T>({ ja, en: en as unknown as T, "zh-Hans": hans as unknown as T, "zh-Hant": hant as unknown as T }).lp;
