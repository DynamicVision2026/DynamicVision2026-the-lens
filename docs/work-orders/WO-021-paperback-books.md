# WO-021: Paperback workbooks (one per SKU) on Amazon.co.jp KDP, linked from the app

**Owner:** Builder B (a second Builder session, working in parallel with Builder A's WO-014/018/020)
**Review:** Architect visual check · **Decision:** Brian, Oct 14 08:20 / 08:30 ("same 3 SKUs… assign another builder")

## Ownership (so the two Builders never collide)
- Builder B owns **`apps/book/`** (new workspace package `@lens/book`).
- Builder B uses `@lens/scenes` (`LensScene`) read-only. If a figure needs a print tweak, say so in the PR; Builder A or the Architect makes it.
- The only change outside `apps/book/` is §5 (the trainer link), as its own small PR at the end.

## Approved dependencies
- `@fontsource/noto-serif-jp` and `@fontsource/noto-sans-jp` (SIL OFL).
- `qrcode` (MIT) for the QR SVGs.
- `playwright` (already used by the tools).
- Anything else: ask first in the PR.

## Content: already done, and it comes from the bundle
- `catalog/<pass>/book.yaml` (Architect) holds the book's own copy: title, subtitle, はじめに, 使い方, the QR line, the honesty line and the parent line.
- The validator assembles every chapter from the Pass's lessons and masterclass. It writes the result to **`build/bundle.json` → `passes[].book`**:

```ts
book: { id, status: 'planned'|'building'|'proof'|'live', series_ja, title_ja, subtitle_ja, audience_ja, author_ja, publisher_ja,
        interior: 'bw', amazon_url: string|null, practice_variants: number, page_estimate: number,
        front_matter: { hajimeni_ja, tsukaikata_ja: string[], qr_ja, honesty_ja, parent_ja },
        chapters: { lens, principle_ja, example1, example2: string|null, boundary: string|null, boundary_line: string|null,
                    practice: { card: string, variants: string[] }[], qr: string }[],
        review: { card: string, variant: string }[] }
```

- **Ids are card ids** (`bundle.cards`) and variant ids (`card.variants[].id`). Variant figures merge over the card figure, exactly as the trainer does.
- **Never type problem content, numbers or answers into `apps/book`.** Fixed headings (listed below) live in `apps/book/src/copy.ts`.
- **Today's books:**

| book | status | content now |
|---|---|---|
| chugaku_juken | building | 8 chapters, 36 practice cards, 16 review items, ~110 pages |
| koukou_juken | planned | 3 chapters, ~36 pages |
| daigaku_juken | planned | 1 chapter, ~18 pages (under the KDP minimum of 24) |

- Build all three. Only `building`/`proof`/`live` books go to KDP; `planned` books are for checking the layout.

## 1. Build command
- `pnpm --filter @lens/book build <passId>` → `apps/book/dist/<book.id>/interior.pdf` and `cover.pdf`.
- Pipeline: React SSR (`renderToStaticMarkup`) → one HTML file → PDF with Playwright. Reuse the approach of `tools/print_pdf.mjs`; Chromium is at `CHROMIUM` or the default.
- Add `pnpm book <passId>` at the root.

## 2. Interior (tokens `layout.book`, `color.*.print`, `stroke`, `type`)
- **Page:** B5 portrait 182 × 257 mm, margins from `layout.book.margin_mm`. No bleed in the interior.
- **B&W only:** use each token's `print` value. Trap = 60% black, thin and dashed; lens = 100% black at lens weight plus the lens icon. Steps use the `step.palette[].print` patterns plus numbered badges. Never rely on hue.
- **Fonts:** embed a Japanese font with an open licence (Noto Serif JP for body text, Noto Sans JP for headings), e.g. through `@fontsource`. KDP needs every font embedded.
- **Figures:** vector SVG from `LensScene` (keyframe 0 for the problem; the last lens keyframe for the solution).

**Page order**
1. Title page (series, title, subtitle, audience).
2. はじめに (`hajimeni_ja`).
3. この本の使い方: the numbered `tsukaikata_ja`, then `qr_ja`, `honesty_ja`, `parent_ja`.
4. 目次 (contents).
5. **Each chapter**
   - **Opener page:** the lens name (`labels.lenses[lens].ja`) and its icon, `principle_ja`, the chapter QR (`chapters[].qr`) with the caption 「動かして確かめる」.
   - **Example 1 spread** (`layout.book.spread`). Both pages show the problem text and figure at the top.
     - Left page: 「くせでやると」 with the `trap_route` steps and its time.
     - Right page: 「レンズで見ると」 with the `lens_route` steps and the solved figure.
     - Bottom bar on both pages: the `trigger.ja` line and the QR.
   - **Example 2 spread:** same layout (skip if `example2` is null).
   - **Boundary page:**
     - heading 「レンズが使えないとき」 when the boundary card's lens is this chapter's lens; otherwise 「ここは別のレンズ」 plus that card's lens name;
     - then the problem, its figure and `boundary_line`.
   - **練習 (practice):** 2 problems per page, in order. Each card is followed by its variants, labelled 「類題」.
     - Each problem: number, text, figure, a box 「どのレンズ？ □」 and blank working space.
6. **「どのレンズ？」総まとめ:** the `review` items, 4 per page, with text, figure and a row of tick boxes for the 8 lenses plus そのまま計算 (labels from `labels.lenses`). No hints.
7. **答え (answers):** for every practice, 類題 and review item, give the number, the answer (`answer.display_ja`, or the variant's answer plus the card unit), the lens name, and the lens steps in small type.
8. **奥付 (colophon):** title, author, publisher, the publication date (build argument `--date`), © Beyond Culture.

- **Numbering:** problems are numbered within each chapter (「囲む ⑤」) and the answers use the same numbers. The page count must be even.

## 3. Cover (`cover.pdf`)
- KDP full-wrap cover (back + spine + front) with 3.2 mm bleed (`layout.book.bleed_mm`).
- **Spine width:** take it from KDP's cover calculator for the final page count and paper type. Put it in `apps/book/kdp.json`, not in code. Spine text only if the page count allows it under KDP's rule.
- **Front:** series, title, subtitle, audience, and one large solved figure (chapter 1 `example1`, last lens keyframe).
- **Back:** a short excerpt from `hajimeni_ja`, `honesty_ja`, and a QR to `https://domo-ai.com/lens/`. Leave KDP's barcode area clear (bottom right).

## 4. Tests (`pnpm -r test` picks them up)
- Each of the three books renders to HTML without throwing. Every `chapters[].example1/example2/boundary/practice` id and every review id appears.
- The rendered page count is within ±15% of `page_estimate`.
- **No-math check:** every number printed in a problem is in that card's or variant's text or figure fields.
- The answer for each numbered problem equals its card's or variant's answer.

## 5. Trainer link (small final PR, `apps/trainer`)
- When `passes[].book.status === 'live'` and `amazon_url` is set, show 「紙の問題集（Amazon）」 as an outbound link (`target="_blank" rel="noopener"`) in three places:
  - the Pass's landing card;
  - the end of a lesson;
  - the parent report page (`/report/:passId`).
- Otherwise show nothing. Add a test for both cases.

## Done when
- `interior.pdf` and `cover.pdf` are built for chugaku_juken, plus layout proofs of the other two.
- The Architect visual check passes on 8 sample pages: title, contents, opener, both spreads, boundary, one practice page, one answers page.
- CI is green.
- Then Brian uploads the chugaku_juken book to KDP and orders a printed proof. KDP's own previewer is the final check for fonts and margins.

## Not in scope
- Colour interior (only if KDP Japan offers it and Brian wants it).
- An ISBN (KDP's free one is fine).
- Affiliate links.
- English or Chinese editions (ADR-002, later).
