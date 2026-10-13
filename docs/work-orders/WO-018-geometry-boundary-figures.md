# WO-018: Geometry boundary + L4 figures (等積変形 · 折り返す · 展開)

**Owner:** Architect (cards, validator) + Builder (drawing) · **Target:** Oct 20 · Not needed for the founder pre-sale: each lens already plays 3 anchors plus variants.

Each geometry lens now has L1, L2 and L3. To finish the catalog (L4, a "lens doesn't work" card and a "no lens needed" card per lens), each figure type needs one small extension. The Architect adds the field, the validator checks and the cards. The Builder draws the field in the static figure and in the scene.

| lens | card | figure extension | best move |
|---|---|---|---|
| 等積変形 | no-lens | `parallel_band.shown.each_base: true`, 1 triangle | 底辺×高さ÷2 directly |
| 等積変形 | failure | `parallel_band.apex_heights: [..]` (ℓ is **not** parallel to m; apexes at different heights) | each triangle on its own: sliding along a tilted line changes the height |
| 等積変形 | L4 | `parallel_band.ask: band_height` (the total shaded area is given, find the gap between the lines) | merge into one triangle, then work back |
| 折り返す | no-lens | `mirror_path.side: opposite` (Q below the river) | join PQ directly; no reflection needed |
| 折り返す | L4 | `mirror_corner` (two perpendicular walls, touch both: reflect twice) | reflect, then reflect again |
| 折り返す | failure | `mirror_path.ask: equal_distance` (the X with PX = QX) | not a shortest-path problem: perpendicular bisector / counting squares on a grid |
| 展開 | no-lens | `box_unfold.path: same_face` (A to C across the bottom face only) | a straight line on one face; nothing to open |
| 展開 | L4 | `box_unfold.compare: [BF, EF]` (two possible nets; pick the shorter) | open both ways and compare |
| 展開 | failure | `box_unfold.ask: volume_after_cut` | a volume question: unfolding doesn't help |

**Builder, for each extension:**
- the static figure (`LensScene` and the walkthrough) draws it correctly;
- the scene either supports it (L4 cards) or the card plays as a walkthrough (failure and no-lens cards; WO-016 already routes them).

Until a field is drawn, cards that use it stay `draft`, so a wrong picture can't reach a child.
