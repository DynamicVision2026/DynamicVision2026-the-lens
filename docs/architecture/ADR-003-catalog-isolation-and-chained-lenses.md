# ADR-003: Catalog isolation per SKU, and chained lenses (Stage 2+)

**Status:** accepted (Brian, Oct 13 2026) · **Owner:** Product Architect · Extends ADR-001

## 1. Catalog: one folder per SKU

```
catalog/chugaku_juken/pass.yaml  · Elementary Sprint (中学受験)       stage_no 1 · LENS-CJ-12M
catalog/koukou_juken/pass.yaml   · Middle School Breakthrough (高校受験) stage_no 2 · LENS-KJ-12M
catalog/daigaku_juken/pass.yaml  · High School Analytical (大学受験)    stage_no 3 · LENS-DJ-12M
```

Each folder holds exactly one Pass. The folder name is the Pass id. The validator loads them in Stage 1 → 2 → 3 order and fails on any of these:
- a folder whose name isn't the Pass id it defines;
- a file that defines anything other than one Pass;
- a `stage_no` that doesn't match its folder;
- a card listed in two Passes (**strict isolation**);
- a card whose `stage` isn't in the Pass's `card_stages` (`shogakko` / `chugaku` / `koko`).

The bundle's `passes[]` entries gain `catalog_dir`. Stage 2's id is now `koukou_juken` (was `koko_juken`; renamed before any order existed, Brian Oct 13). SKUs are unchanged.

Shared, never forked: schema, validator, variant engine, picker, scene renderers, tokens and the lesson player. Owned per Pass: its lens set, lessons, problems, levels and traps.

## 2. Chained lenses (Middle School Breakthrough geometry)

Stage 2 geometry often needs **two moves in sequence on one figure**. For example, step 1 折り返す (or a rotation) snaps a point into place, which reveals the parallel lines that step 2 等積変形 needs. The card format and the runner are left open for this now. No Stage 2 card exists yet.

**Card format: an optional `chain`.**
```yaml
lens: mirror                 # = the first stage's lens
lens_route:
  steps: [s0, s1, s2, s3, s4]          # one route, as today; the last step is the result
chain:
  - {lens: mirror, steps: [0, 1], goal_ja: "Qを折り返すと、平行な2本の線があらわれる", snap: mirror.reflect}
  - {lens: slide,  steps: [2, 4], goal_ja: "頂点を平行線にそって動かして、1つの三角形に"}
```
The validator's `chain_check` requires:
- at least 2 stages, each lens labelled;
- consecutive stages use different lenses;
- the first stage is the card's `lens`;
- the step slices are contiguous, cover every lens step in order, and end on the result.

Every existing check (answer, route sum, variants) still runs on the whole route.

**Runner contract (Builder, when Stage 2 content starts; nothing to build now):**
- A lesson problem with `chain` plays in `mode: 'chain'`.
- One figure stays on screen. The stage-k scene (by `chain[k].lens`) runs on it and gets `stage={index, steps}`. It captions only its slice and calls `onSolved` at its snap.
- On snap, the next stage unlocks with the `goal_ja` line, a short halo on whatever the snap revealed, and the guide bubble.
- The picker asks only for the **first** lens. The second lens is the "aha" the first one unlocks; asking for both up front would give it away. Progress counts the problem as solved when the last stage snaps.
- **Scenes must not assume they own the whole route.** Today's scenes read `lens_route.steps[i]` by absolute index. When chains arrive, they read through a `stageSteps(card, stage)` helper. That is the only code change this ADR asks of the existing scenes, and it can wait until the first chained card lands.

**Lens set for Stage 2:** still to be decided from Stage 1 signup data (ADR-001). 回転 (rotate) would be a new lens with its own label and scene. Chains can combine any labelled lenses.

## 3. Selling Stages 2 and 3 now (confirmed by Brian, Oct 13 17:57: 先行登録 only at launch)

Until a Pass has playable, reviewed lessons, its storefront entry is a **waitlist (先行登録)**, not a paid preorder:
- `status: planned` → shown as 「準備中・先行登録受付中」 with an email capture tagged `waitlist:<pass id>`;
- no price, no checkout, no delivery date.

A paid preorder needs a delivery promise we can keep. Stage 1 has one (founders get early access from mid-November, everything by Jan 31 or a full refund); Stages 2 and 3 don't yet. Changing `status` to `preorder` is a founder decision, recorded in that Pass's `pass.yaml`.
