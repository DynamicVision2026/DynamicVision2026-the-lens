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

## Data

- Problem selection comes from `bundle.passes[chugaku_juken].lessons`: one random card or variant per lens. For the paid drill, also include the `no_lens` and `failure` cards (where `best_move` is the right pick).
- The free check uses the lesson's level-1/2 cards only.
- Results are stored in `safeStorage` under `lens.v1.check`.

## Acceptance

- [ ] `/check` runs 8 mixed problems → result → signup on iPad and phone, with no console errors.
- [ ] Confusion pairs and times on the result screen are correct for a scripted run (test).
- [ ] Guide bubbles, ghost-finger hint on the first pick, and the 5 s idle glow, as in WO-012 §3b.
- [ ] Nothing under the Architect-owned paths changed.
