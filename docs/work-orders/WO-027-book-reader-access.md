# WO-027: Book readers get each chapter's masterclass (QR `?src=book`), and book visits are measured

**Owner:** Builder · **Review:** Architect · **Decision (Brian, Oct 16):** the books promise 「各章のQRコードから、同じ考え方を指で動かして確かめられます」. Today chapters 2–8 open a sales page. Fix before the books go on sale. Book price: ¥2,100 (all three).

## 1. Access rule (`apps/trainer/src/course/access.ts`)
- A visit to `/lesson/<pass>/<lens>` with `src=book` in the query opens **Step 1 (the masterclass) of that lens**, for that pass, without purchase or trial. Remember it on the device: `lens.v1.book.<passId>` = list of lenses opened this way (try/catch; on storage failure, the session only).
- Later visits to that lens's masterclass on the same device work without the parameter.
- **Still paid** (or trial, for the trial lens): Step 2–4 (guided discovery, practice, timed check), the report, the mixed review. When a book reader reaches them, show the existing locked panel with one extra line: 「この本の続きの練習・時間チェック・保護者レポートは、コースで使えます。」 and the buy button + 「無料ではじめる（3日間）」.
- A paid Pass ignores all of this. The 3-day trial rule (WO-024 §3a) is unchanged.
- `accessMode` gains `'book'` for a lens opened this way.

## 2. Measuring (GA4, WO-025; still off until `ga4Id` is set)
- New event `book_open {pass, lens}` on the first `src=book` visit per lens per device.
- Remember `lens.v1.src = book` on the device (first touch wins) and send it as a GA user property `src` on every event, so course opens and trials from book readers can be counted.
- `page_view` keeps stripping the query string (keys never sent), but `src` is now kept as an event param.

## 3. Copy (`i18n/ja.ts`, `launch/copy.ts`)
- The masterclass end card for a book reader: 「本の練習問題で、このレンズを使ってみよう。」 plus the course buttons.
- No change to the books themselves: the QR URLs already carry `?src=book`.

## 4. Tests
- `src=book` opens that lens's masterclass for every pass and lens; other lenses stay locked; Steps 2–4 stay locked; remembered on reload without the parameter; storage failure → session only; paid Pass unaffected; trial unaffected.
- `book_open` fires once per lens per device; `src` user property set; no key or query string in any event.
- Headless iPad + phone: scan-like visit to `/lesson/koukou_juken/area?src=book` plays the masterclass; Step 2 shows the locked panel.

## Done when
Each chapter's QR opens its masterclass for anyone, the rest of the course stays paid, and (once GA4 is on) book visits and book-reader course opens can be counted.

## 5. Book price in the listing sheets (small)
`catalog/*/book.yaml` now has `price_jpy: 2100` (Architect). Pass it through to `passes[].book.price_jpy` if the bundle drops it, and print the listing sheet's 価格 row as 「¥2,100（税込）」. Regenerate `docs/kdp/*.md`.
