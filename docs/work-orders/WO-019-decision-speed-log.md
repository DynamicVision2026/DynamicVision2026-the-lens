# WO-019: Decision-speed log and the Day-1 vs Week-4 parent report

**Owner:** Builder · **Review:** Architect visual check · **Target:** Oct 21 (before the Oct 23 core-player freeze) · Approved by Brian, Oct 13 17:57.

## Why
Marketing leads with what we actually measure, never with a promise (景表法). The claim is: **"we measure your child's decision time on day 1 and in week 4, and show you the change."** This WO records that measurement in every mode and turns it into the parent report. Everything stays on the device: no child data leaves it.

## 1. The attempt log (all modes)
On every problem, when the child makes the **first lens pick**, append one record. Store it in `localStorage` under `lens.attempts.v1`, wrapped in try/catch like `progress.ts`, and keep the newest 3,000:

```ts
interface Attempt {
  at: string;          // ISO date-time
  pass: string;        // 'chugaku_juken'
  ctx: 'check' | 'lesson' | 'drill' | 'timer' | 'week4';
  card: string;        // card or variant id
  anchor: string;      // anchor card id (variant → its parent)
  want: string;        // picker.correct (the right move: a lens, or 'direct')
  first: string;       // first lens tapped
  ok: boolean;         // first === want
  ms: number;          // problem shown → first tap, visible time only
  msRight?: number;    // problem shown → the right tap, when the first was wrong
}
```

- **Clock:**
  - The timer starts when the pick buttons are first visible, not on page load.
  - It **pauses while the tab is hidden** (`visibilitychange`), so a child who leaves for 5 minutes doesn't wreck the data.
  - Use `performance.now()`.
- **One record per problem appearance.** "もう一度さわる" replays are logged with the same `ctx`, and the report ignores repeats of the same `card`. Only the first time counts.
- The free check keeps its current result record, and *also* writes its answers here with `ctx: 'check'`.

## 2. Baseline and Week 4
- **Day 1 = the first どのレンズ？ check on this device** (`ctx: 'check'`). If the family skipped it, the course start screen offers it as 「はじめの8問チェック（約3分）」 before lesson 1. It is the same 8-question picker as the free check, so the free check counts.
- **Week 4 = the week-4 mixed check** (`ctx: 'week4'`):
  - 8 problems, one per lens, at the same levels as day 1;
  - it **never reuses a card or variant the child saw on day 1** (pick siblings: another variant of the same anchor, or another anchor at the same level);
  - it unlocks from day 22 after the baseline, or earlier from a parent-only "今すぐ測る" link.

## 3. The parent report (`/report`, parent area)
It is shown only when both the day-1 and week-4 sessions have 8 answers. Before that, show the progress so far and 「4週目のチェックで、はじめとくらべられます」.

| Row | Source | Example |
|---|---|---|
| 1問あたりの判断時間（中央値） | median `ms`, day 1 vs week 4 | 「はじめ 11.4秒 → 4週目 3.2秒」 |
| 1回目で正しい道具を選べた数 | count of `ok` | 「3 / 8問 → 7 / 8問」 |
| まちがえやすかった組み合わせ | confusion pairs (`want ↔ first`), then vs now | 「面積図 ↔ てんびん：2回 → 0回」 |
| レンズ別 | per lens: day-1 ms, week-4 ms, ✓/✗ | small table, 8 rows |
| 練習の記録 | lesson and drill attempts per week (count only) | 「1週目 34問 · 2週目 41問 …」 |

**Rules (compliance and honesty):**
- Show **medians of this child's own measurements**, with the two dates. No percentages of improvement in big type, no projected exam minutes, no comparison with other children, no score wording (点数・合格・偏差値 do not appear).
- Footer line: 「この記録は、この端末の中だけに保存されています。はかったのは『どの道具を使うか決めるまでの時間』です。」
- **Screenshot-friendly layout** (the same approach as the check result). Add a "記録を消す" button behind a confirm.

## 4. Where the numbers show up for the child
After each lesson problem, show a small line for the child: 「えらぶまで 2.8秒」 (their own `ms`, no judgement). The lesson summary shows their median for that lens today, nothing more.

## 5. Tests
- **Log:**
  - one record per first pick, in every mode;
  - the hidden-tab time is excluded (fake `visibilitychange`);
  - the ring cap holds;
  - storage errors never throw.
- **Week-4 picker:** over 40 seeds, it never repeats a day-1 card or variant, and covers 8 lenses at matching levels.
- **Report:**
  - medians and confusion counts are correct for a scripted log;
  - it is hidden until both sessions are complete;
  - none of 点数, 合格, 偏差値 or a % sign appears in the rendered report.

## Done when
On iPad 1180×820 and phone 390×844:
- a scripted run goes day-1 check → some lessons → week-4 check (via the parent link) → a report with the expected numbers;
- there are no console errors;
- the Architect visual check passes, and CI is green.
