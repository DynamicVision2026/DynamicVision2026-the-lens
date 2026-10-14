# ADR-004: Stage 2 and 3 curriculum seed (provisional)

**Status:** accepted as a *provisional* map (Architect, Oct 13; Brian's autopilot directive, 19:35). It is to be revised from Stage 1 signup data and the first outside review. Both Passes stay `status: planned` (waitlist only, ADR-003 §3).

## Principle
The same 8 lenses, re-aimed at middle-school and high-school exam math. A lens is a *decision*, not a topic: "what do I do first?". So each stage only adds new **figure types and archetypes**. The picker, lessons, scenes and validator stay the same (ADR-001).

## Stage 2: Middle School Breakthrough (`koukou_juken`, card stage `chugaku`)
Coordinate-plane geometry (中1〜中2, 一次関数・図形) first, because it is exact, auto-checkable and exam-frequent.

| lens | first archetypes (built) | next (planned) |
|---|---|---|
| 囲む | `coord_polygon`: lattice △ / tilted □ / quadrilateral on the coordinate plane. No-lens: `shape: axis_base` (one side on the x-axis → 底辺×高さ÷2, no box) | failure card, 座標と面積の二等分 |
| 等積変形 | `coord_equal_area`: P on the y-axis with △ABP = △ABC (parallel line) | 四角形→三角形, 面積の二等分線 |
| 折り返す | **chained** `coord_mirror_area`: 折り返す (P minimises AP+PB) → 囲む (area of △ABP). Single-lens `ask: p_x`. No-lens: `side: opposite` (B below the axis → join A–B directly) | 2本の直線で2回折り返す, 回転 (new lens) → 等積変形 |
| 展開, 面積図, 差一定, てんびん, 止める | — | 円すい・角すいの表面の最短, 連立方程式の文章題 (面積図/てんびん), 動点 (止める) |

**Chained lenses** (ADR-003 §2) are what make Stage 2 its own product. The first chained archetype is 折り返す → 囲む. 回転 → 等積変形 (Brian's example) needs a new 回転 lens and scene; it comes after the runner exists (WO-020).

## Stage 3: High School Analytical (`daigaku_juken`, card stage `koko`)
"Dimensional reduction and parameter freezing." The seed is plane figures (数A), exact and auto-checkable.

| lens | first archetype (built) | next (planned) |
|---|---|---|
| てんびん | `triangle_cevians`: mass points. Each side is a lever; chain the weights to get AP:PD (L2–3), BP:PE (L3, `ask: bp_pe`) and △PBC/△ABC (L4, `ask: area_pbc`), all checked against exact coordinates. No-lens: △ABD/△ABC (`ask: area_abd`, E is a decoy; same height → base ratio) | L1 single lever, failure card, 内分点ベクトル |
| 止める | — | 文字定数を固定する (parameter freezing) in 2次関数・軌跡 |
| 囲む / 展開 | — | 座標・ベクトルでの面積, 空間図形の切断 |

## What "verified" means here
- Every Stage 2/3 card is generated and checked by the validator: exact answer, generated text and steps, a type-specific validity check, lens faster than the trap, and 4 variants.
- The chain check (ADR-003) runs on chained cards.
- **Not yet:** an outside reviewer (Stage 1 reviewers are for 中学受験 only), playable scenes (WO-020), boundary cards, and levels 1–4 per lesson.
