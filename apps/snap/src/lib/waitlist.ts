import { z } from "zod";
import { HERO_VARIANTS, copy } from "../copy";
import { normalizeSrc } from "./attribution";

/** Options come from the copy file so the form and the server always agree. */
export const WORRY_OPTIONS = copy.waitlist.painOptions;
export const WAITLIST_GRADES = copy.waitlist.gradeOptions;

export const WaitlistSchema = z.object({
  email: z.string().trim().min(1).max(254).email(),
  grade: z.enum(WAITLIST_GRADES),
  worry: z.enum(WORRY_OPTIONS).optional(),
  /** Hero headline variant the visitor saw (?h=a / ?h=b), for the A/B test. */
  variant: z.enum(HERO_VARIANTS).default("default"),
  /** Traffic source from `?src=` (allow-listed; unknown → "other", missing → "direct"). */
  src: z.preprocess(normalizeSrc, z.enum(["yt", "x", "tiktok", "survey", "book", "other", "direct"])),
});
export type WaitlistEntry = z.infer<typeof WaitlistSchema>;
