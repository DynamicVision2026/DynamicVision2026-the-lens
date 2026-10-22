// Launch copy in the visitor's language. copy.ja.ts is the source (as written by the Architect);
// copy.<lang>.ts mirror its shape (Widen<…>).
import * as ja from './copy.ja';
import * as en from './copy.en';
import * as hans from './copy.zh-Hans';
import * as hant from './copy.zh-Hant';
import { pick } from '../i18n/lang';

type T = typeof ja;
const L = pick<T>({ ja, en: en as unknown as T, 'zh-Hans': hans as unknown as T, 'zh-Hant': hant as unknown as T });
export const LANDING = L.LANDING;
export const OPEN = L.OPEN;
export const SIGNUP = L.SIGNUP;
export const FOOTER = L.FOOTER;
export const EXTERNAL = L.EXTERNAL;
export const PRIVACY = L.PRIVACY;
export const PROPOSED = L.PROPOSED;
