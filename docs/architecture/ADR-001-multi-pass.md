# ADR-001 · Three Passes on one engine

**Status:** accepted (Brian, Oct 13 2026) · **Owner:** Product Architect

## Decision

視点レンズ is sold as three independent products (Shopify SKUs), built one after another on one shared engine:

| Pass | id | Audience | Status |
| --- | --- | --- | --- |
| Stage 1 | `chugaku_juken` | 小4〜小6・中学受験 | **building: flagship MVP, delivery Jan 2027** |
| Stage 2 | `koko_juken` | 中1〜中3・高校受験 | planned |
| Stage 3 | `daigaku_juken` | 高1〜高3・共通テスト／個別試験 | planned |

**Shared across Passes (never forked):** the card schema and validator, the variant engine, `LensScene` and the figure renderers, tokens, the Perspective Picker, the lesson player, the Shorts and lesson-video templates, the access Worker.

**Owned by each Pass:** its lens set, its lessons, its problems, its difficulty ladder and its exam traps. A later Pass may reuse a lens (Mirror and Unfold carry into 中学 geometry) or add new ones (for example 座標で見る, 置き換え). That is why `lens` is no longer a fixed enum: any lens with a label in `labels/lenses.yaml` is valid, and each Pass lists its own.

## Data model

```
catalog/passes.yaml      one entry per Pass: sku, price, term, devices, lesson_target,
                         levels, review_set, lessons[{lens, video, cards[]}]
cards/<lens>/*.yaml      problems; new fields: level (1 基礎 … 4 発展), archetype (lens.type)
labels/lenses.yaml       every lens of every Pass
build/bundle.json        bundle 1.3 = tokens + labels + passes + cards (+ variants)
```

- A card joins a Pass through `stage` (`shogakko` → `chugaku_juken`, `chugaku` → `koko_juken`, `koko` → `daigaku_juken`) and by being listed in one of its lessons. The card's `stage` describes the math level; the Pass is the product.
- The validator checks every lesson and prints progress: problem count vs `lesson_target`, all four levels, one failure card, one no-lens card, and no repeated archetype at a level. `--release <pass>` turns that progress into a hard gate for shipping.
- One bundle for now (card content is public by design; the lock protects convenience, not secrecy, PRD §3). Split into one bundle per Pass only if size or load time demands it.

## Commerce and access

- **One Shopify product per Pass**, one variant, SKU from the catalog (`LENS-CJ-12M`, `LENS-KJ-12M`, `LENS-DJ-12M`). The early-bird preorder is a second product with the same SKU prefix plus `-EARLY`, mapping to the same Pass.
- **Access Worker (Dec, after Gate 1)** maps the paid order's SKU → pass id and issues a code whose token carries `passes: [{id, expires}]` (not a single stage), so one family can hold several Passes on one code and one set of 3 devices.
- **Trainer:** a lesson unlocks when the token lists its Pass and is not expired. The free trial is `chugaku_juken` / enclose / first card, with no token.
- **Bundles and tests stay per Pass:** CI runs the catalog check on every push; a Pass ships only when `--release <pass>` passes and every listed card is `reviewed`.

## Consequences

- Adding Stage 2 = new labels, new cards, a filled `koko_juken` entry, new renderers only for new figure types. No change to the engine, the player or the access model.
- **Marketing claims:** the commercial goal is score improvement, but public copy must not promise scores (景品表示法) until we have measured results. Copy speaks to speed on 同じ型の問題 and to choosing the right tool, both of which the product measures.
