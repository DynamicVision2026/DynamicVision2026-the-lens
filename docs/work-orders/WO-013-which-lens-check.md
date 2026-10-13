# WO-013 · 「どのレンズ？」 check: the free 8-question mode and the week-4 mixed drill

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 27 · **Depends on:** WO-012 core flow (pick → clue). It can start in parallel, since it reuses the picker.

## Goal

One mode, two uses:
- **Free check (landing funnel):** 8 problems, one per lens, mixed order, no login. Shown on the landing page and linked from every Short.
- **Sprint week 4 (paid):** the same mode drawing from all verified problems and variants, plus no-lens items.

## Flow

1. The ナゼホリ guide asks 「どのレンズで見る？」 for each problem; the figure is shown at rest (the `drawPreview` look from the prototype).
2. The child picks a lens (4 options, from `picker.options`), then the clue (same chips as the lens flow). **No solving:** this mode trains the choice.
3. Each pick is timed (first render → pick).
4. **Result screen (the parent's moment):** correct picks out of 8; which lenses were confused with which (for example 「面積図 ↔ てんびん」); average decision time; one suggested lens to start with. The result can be saved as an image (screenshot-friendly layout), and there is a "share with your LINE" link to the landing URL. No child data leaves the device.
5. Then the signup block (email + LINE) and the founder offer.

## Result screen touchpoints (Brian, Oct 13 15:09 CST): no LINE; email + X

- **Remove LINE completely:** the 「LINEで送る」 button, the add-friend placeholder and any LINE copy.
- **Email capture block** (directly under the report):
  - label 「診断結果と『4週間完成スケジュール（PDF）』をメールで受け取る」;
  - one email field and the existing consent line;
  - it posts to the same Shopify customer signup (WO-009), tagged `free-check` plus the check's top confusion pair, e.g. `confused:area-balance`.
- **X share button** 「Xで結果をシェア」: a standard Web Intent, `https://x.com/intent/post?text=…&url=…`, opened as a plain link. Pre-filled text (keys in `i18n/ja.ts`, Architect-owned):
  `どのレンズ？チェック {score}/8問・1問平均{sec}秒でした。#中学受験 #2027年組` and url = `SITE_URL/check?s=x`.
  No child name or other data, only what is on the screen.
- **Founder offer stays prominent:** the Founder Edition checkout block (¥6,800, 先着30家庭, seats left, WO-010 founder copy) sits directly below the email block, above the fold on iPad landscape where possible.
- **Order on the result screen:** report → email capture → X share → founder offer → footer.

## Data

- Problem selection comes from `bundle.passes[chugaku_juken].lessons`: one random card or variant per lens. For the paid drill, also include the `no_lens` and `failure` cards (where `best_move` is the right pick).
- The free check uses the lesson's level-1/2 cards only.
- Results are stored in `safeStorage` under `lens.v1.check`.

## Acceptance

- [ ] `/check` runs 8 mixed problems → result → signup on iPad and phone, with no console errors.
- [ ] Confusion pairs and times on the result screen are correct for a scripted run (test).
- [ ] Guide bubbles, ghost-finger hint on the first pick, and the 5 s idle glow, as in WO-012 §3b.
- [ ] Nothing under the Architect-owned paths changed.
