# WO-026: KDP paperback workbooks for all three SKUs, upload-ready

**Owner:** Builder (the `apps/book` owner) · **Review:** Architect visual check · **Why (Brian, Oct 16):** the Amazon books for the three courses, alongside today's web launch.

WO-021 built the pipeline (`@lens/book`) and the 中学受験 book. Since then all three Passes went live with 8 lessons each (WO-020/023/024). This WO makes **three upload-ready books** and the listing text for each. Everything still comes from `build/bundle.json` → `passes[].book`; never type problem content into `apps/book`.

## 0. Already done by the Architect (this PR)
- `catalog/*/book.yaml`: all three books are `status: proof`.
- Today's sizes from the bundle: 中学受験 8 chapters / 59 practice / 16 review (~142 pp) · 高校受験 8 / 25 / 12 (~94 pp) · 大学受験 8 / 24 / 8 (~92 pp).

## 1. Build all three
`pnpm book chugaku_juken`, `pnpm book koukou_juken`, `pnpm book daigaku_juken` → `apps/book/dist/<id>/interior.pdf` + `cover.pdf`, `--date 2026-10-16`.

## 2. Stage 2/3 figures in print (the new work)
- Every figure type added since WO-021 must print correctly in B&W on the B5 page: coordinate planes (`coord_polygon` incl. `axis_diagonal`, `coord_y_split`, `coord_quad_tri`), box/cone unfolds (`box_unfold ask: length`, `cone_unfold`), parabola area/triangle, line mirror, parameter family, dice grid, const_sum, and the 高校/大学 word diagrams.
- B&W rules from WO-021 §2 apply (trap 60% dashed, lens 100% + icon, step patterns + numbered badges, never hue alone). Axis labels and tick numbers must stay ≥ 7 pt at print size.
- If a figure needs a print tweak inside `@lens/scenes`, say so in the PR and the Architect makes it.
- **Answers:** Stage 3 variants carry `display_ja`; the answers section prints it (fractions, √, π as in the trainer).

## 3. Per-book KDP settings
- `apps/book/kdp.json` gets one entry per book id: page count, spine width (KDP cover calculator, white paper, B&W), and whether spine text is allowed. Covers read their own entry.
- Page count even and ≥ 24 for each book. Interior B5 182 × 257 mm, no bleed; cover full-wrap with 3.2 mm bleed, barcode area clear.
- Cover back QR: `https://lens.domo-ai.com/` (from `SITE_URL`). Chapter QRs already point to `https://lens.domo-ai.com/lesson/<pass>/<lens>?src=book`.

## 4. Listing sheet per book: `docs/kdp/<book.id>.md`
For Brian to copy into KDP, all from `book.yaml` / bundle (no new claims):
- タイトル, サブタイトル, シリーズ名 (視点レンズ), 著者 (Brian Fu), 出版社 (Beyond Culture), 言語 日本語.
- 内容紹介 (≤ 4,000 chars): from `hajimeni_ja` + chapter list (8 lens names) + `honesty_ja` + a line that each chapter has a QR to the web app. No score promises (景表法).
- キーワード ×7 and カテゴリー ×2 (suggestions; Brian picks).
- 判型 B5 / 本文 白黒 / 用紙 白 / 表紙 光沢 / ページ数 / ISBN: KDP free.
- 価格: leave blank for Brian.

## 5. Trainer link (WO-021 §5, still open)
Show 「紙の問題集（Amazon）」 only when `book.status === 'live'` and `amazon_url` is set: the Pass card on the landing page, the end of a lesson, and `/report/:passId`. `target="_blank" rel="noopener"`. Test both cases. (Nothing shows today; the Architect sets `live` + `amazon_url` after Brian publishes.)

## 6. Tests and review
- Existing book tests pass for all three (every id appears, page count within ±15% of `page_estimate`, no-math check, answers match).
- In the PR, attach for each book PNGs of: title, contents, one opener, one example spread, one boundary page, one practice page, one answers page, and the cover. Include at least two Stage 3 figure pages (parabola, dice grid or cone).

## Done when
Three `interior.pdf` + `cover.pdf` sets and three listing sheets exist, CI is green, and the Architect visual check passes. Then Brian uploads each book to KDP (kdp.amazon.co.jp) and orders printed proofs; KDP's previewer is the final check.

## 7. Language-audit fixes for the Builder (editor's Phase 1, Oct 16)
The editor's audit of the three books found layout and figure problems. The Architect has already fixed the **content** items in the source (PR "audit phase 1": いま→現在 corruption, reversed 差 explanation, 何つ分, えんぴつ→本, parents' ages, clock answers as 「5時27と3/11分」, true minus in answers, Stage 3 formulas such as 「(13/2)²」「3x + y − 4」「(1/2)x²」, はじめに as whole sentences, how-to-use headings, 小5〜小6). These are yours, in `apps/book` (and `@lens/scenes` where noted):

**MUST (before KDP upload)**
1. **No line breaks inside coordinates, ratios or short equations.** Keep `B(1, −3)`, `BD:DC＝3:4`, `AB＝6cm`, `(x + 2)(y + 3)`, `y = x + 1` and `8−(−4) = 12` on one line (nowrap spans for `(…, …)`, `a:b`, `X＝n単位`, and around `=` / `＝`). Also never start a line with `²` / `³` or a lone `か。`.
2. **はじめに paragraphs:** split `hajimeni_ja` into paragraphs only at line breaks (`\n`), never at spaces. The cover's back excerpt must end at a sentence end (`。`), never mid-sentence.
3. **大学受験 総まとめ ① (p.84):** the parabola graph renders as an empty box. Draw it.
4. **Review pages:** the lens checkbox row must never overlap the page number (keep a bottom margin).
5. **中学受験 展開 ⑨⑩⑬⑭ (`unfold-004`, `unfold-005`, `box_unfold`):** the printed figure shows only face ABFE; the question needs C, G, H, Q and BC＝5cm. Print the full box (and the net), as in the trainer.
6. **Stage 3 figure size:** parabola figures in the 大学受験 book print tiny or squashed (pp.16–19, 21–23, 46–49). Give every figure a minimum print size and a readable aspect ratio; axis numbers ≥ 7 pt. Same for the 高校受験 第2章 lens-side figures (pp.17, 19).

**SHOULD (same PR if quick)**
7. Time strip: 「+4分0秒 目安」 → 「約4分」; seconds only when non-zero; 60 s and more in 分.
8. Colophon date: 「2026年10月16日 初版発行」, not ISO.
9. Example spreads: show the answer on the right page for every example (some don't: 高校 p.59, p.69).
10. Boundary pages: print their answers in the answers section.
11. Ratio labels in balance figures: one style for `:` and `＝` (match the text).

Attach before/after PNGs of each MUST item in the PR.
