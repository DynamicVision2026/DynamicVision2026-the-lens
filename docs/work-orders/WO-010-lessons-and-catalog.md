# WO-010 · Lessons and catalog (Stage 1 player) + Masterclass copy

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 20 · **Depends on:** WO-009 merged · **Read first:** [ADR-001](../architecture/ADR-001-multi-pass.md)

## Goal

The trainer becomes a course player: a Pass page with 8 lessons, and a lesson page that plays the lesson's problems in order. Stage 1 data only, but nothing in code may assume Stage 1 or the 8 current lenses. Everything comes from `bundle.passes`.

## Bundle 1.3 (already on `main`)

- `bundle.passes[]`: `{id, stage_no, title_ja, audience_ja, status, sku, price_jpy, early_price_jpy, term_months, devices, lesson_target, levels, review_set, lessons: [{lens, video, cards: [card ids in order]}]}`. Planned Passes have `lessons: []`.
- Cards gain `level` (1–4, labels in `pass.levels`) and `archetype`.
- Update `packages/scenes/src/types.ts` to match.

## Routes

| Route | What |
| --- | --- |
| `/pass/:passId` | Pass page: title, audience, the lessons as 8 tiles (lens icon, `labels.lenses[lens].ja`, `hint_ja`, problem count, progress ring). Planned Passes show 「準備中」 and nothing else |
| `/lesson/:passId/:lens` | Lesson player (below) |
| `/play/:cardId` | Unchanged (Free Lens) |

**Lesson player:**
1. **Video slot** at the top: `lesson.video` id. Until WO-011 lands, show the card's Short scene (`LensScene` study pace, light theme) as a placeholder, with a 「動画は準備中」 caption.
2. **Problem ladder:** the lesson's cards in order, each played with the existing picker flow (problem → pick → clue → reveal), each tagged with its level label (基礎/標準/応用/発展). Failure and no-lens cards play the same way; their `best_move` is the right pick.
3. **Practice:** after the ladder, 「同じ型でもう1問」 serves variants from any card in the lesson, timed.
4. **Mastery:** the lesson is complete after 3 correct picks with a correct clue in a row in practice. Store `{passId, lens, done, bestStreak, attempts}` in `safeStorage` under `lens.v1`, alongside the existing record.

**Access (stub until December):** `launch.config.ts` gets `lessonsPublic: boolean` (default `false`). When false, `/pass/…` shows the tiles with a 🔒 and 「2027年1月公開・先行予約で解放」, and only the Free Lens card plays. A `?preview=1` query (dev and Architect review only) unlocks everything. No token logic yet. That's the access Worker in December, using `token.passes[]` per ADR-001.

## Masterclass copy (replace in `launch/copy.ts`, use as written)

Landing `points` (replace all three):
- 8回のマスタークラス：1回に1つのレンズ（囲む・ずらす・展開・止める・てんびん・面積図・折り返す・差一定）
- 解き方の前に「どのレンズか」を選ぶ練習。まちがえても、なぜちがうかが分かる。
- かかった時間を記録。同じ型の問題で、どれだけ速くなったかが分かる。

`PREORDER` becomes:
- title: 先行予約（30家庭限定）
- stage: 中学受験パス（小4〜小6）
- listPrice / earlyPrice / button: unchanged
- delivery (Oct 13 update): 創設メンバーには、完成したレンズから順に先行公開します（11月中旬開始予定）。全内容は2027年1月31日までにお届けし、間に合わない場合は全額返金します。
- New `includes` list, shown under the price:
  - 8回のマスタークラス（1回に1つのレンズ）
  - 各回4ステップ：さわって学ぶ（約2分）→ いっしょに発見 → ひとりで練習 → 時間をはかって確認
  - 4週間完成スケジュール（PDF）と保護者ガイドつき
  - 各レンズ10問以上、基礎から発展まで（全80問以上・すべてオリジナル問題）
  - 同じ型の練習問題は何度でも（数字が毎回かわります）
  - 「このレンズが使えない問題」と「レンズを使わない方が速い問題」つき
  - 総まとめ：8つのレンズを混ぜた「どのレンズ？」問題
  - 保護者レポート：かかった時間と、得意・苦手なレンズ
  - 1年間・3台まで利用できます
- Prices, item counts and term must come from `bundle.passes` where they exist (`price_jpy`, `early_price_jpy`, `lesson_target`, `term_months`, `devices`), so the copy can't drift from the catalog.

No score promises anywhere (ADR-001, last section).

## i18n-ready from the start ([ADR-002](../architecture/ADR-002-i18n.md))

- Every new UI string goes into `apps/trainer/src/i18n/ja.ts` under a key, and components call `t('key')`. No language toggle yet and no other locales; this only keeps new code from hard-coding Japanese.
- Card text keeps coming from the bundle as today.
- The site URL in the Short end card and on the landing page becomes one setting, `SITE_URL = 'domo-ai.com'`, in `launch.config.ts`.

## Acceptance

- [ ] `/pass/chugaku_juken` shows 8 tiles from the bundle; `/pass/koko_juken` shows 準備中. No lens ids or counts hard-coded.
- [ ] `/lesson/chugaku_juken/enclose?preview=1` plays all 5 Enclose cards in catalog order with level tags, then practice, then marks the lesson done after 3 clean picks in a row.
- [ ] Locked state without `?preview=1`; the Free Lens still works from the landing page.
- [ ] Landing and preorder copy match this WO; numbers come from the bundle.
- [ ] iPad 1180×820 and phone 390×844, private window, no console errors.
- [ ] Nothing under `cards/`, `catalog/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.
