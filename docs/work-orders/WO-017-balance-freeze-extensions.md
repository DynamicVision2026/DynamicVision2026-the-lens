# WO-017: てんびん · 止める scene extensions (water/salt lever, chase)

**Owner:** Builder · **Review:** Architect visual check · **Target:** Oct 19 · Builds on WO-015 (render by `figure.diagram.family`) and WO-016 (walkthrough).

## Content now on main
てんびん and 止める each have 6 anchor cards, all verified with 4 variants each. Both lessons are complete in the catalog.

| card | family | mode after this WO |
|---|---|---|
| balance-002 (水を加える, L1) | `lever`, `p2: 0` | scene |
| balance-001 (L2) | `lever` | scene (existing) |
| balance-003 (食塩を加える, L3) | `lever`, `p2: 100` | scene |
| balance-004 (混ぜてから水, L4) | `steps_only` | walkthrough |
| balance-f01 (蒸発, best = 差一定) | `steps_only` | walkthrough |
| balance-no-lens (食塩の量) | `steps_only` | walkthrough |
| freeze-002 (追いかける, L1) | `road`, `mode: chase` | scene |
| freeze-001 (L2) | `road`, `mode: toward` | scene (existing) |
| freeze-003 (列車のすれちがい, L3) | `steps_only` | walkthrough |
| freeze-004 (時計算, L4) | `steps_only` | walkthrough |
| freeze-f01 (速さが変わる, best = 面積図) | `area_two_rect` | walkthrough, with a static area diagram |
| freeze-no-lens (着く時間の差) | `steps_only` | walkthrough |

## Tasks
1. **`PLAYABLE`:**
   - `balance` = family `lever`;
   - `freeze` = family `road`.
2. **Lever (`Balance.tsx`):**
   - Read `diagram.unit_w` / `diagram.unit_p` for labels (all g / % today).
   - Draw the lower percentage on the left, whichever end it is. `p2` (the unknown weight's end) can now be **0** (water) or **100** (salt).
   - Label the end 「水 0%」 or 「食塩 100%」 (`ja.ts`: `balance.water`, `balance.salt`).
   - The arm and ratio numbers still come from `allAfterEquals(steps[1])` and `ratioIn(steps[2])`. The step layout is unchanged: arms in step 1, inverse ratio in step 2, result in step 3.
   - For p2 = 100 the arm is long (90 vs 2). Use a broken-axis zig-zag on the long arm so the short arm stays touchable, at ≥ 44 px.
3. **Road (`Freeze.tsx`), `mode: chase`:**
   - Both walkers start on the same side. The slower one (`b`) starts `diagram.d` m ahead, shown from `steps[1]`.
   - **Tap to freeze `b`.** Then dragging `a` closes the gap at `u − v` per minute, taken from `expressionIn(steps[0])`.
   - Snap when the gap is 0. The steps[2] caption appears, then the aha.
   - `toward` behaviour is unchanged.
   - Guide line `guide.freeze.chase`: 「前を歩く{b}をタップして止めよう。{a}は1分に何mずつ近づく？」
4. **Tests:**
   - snap at the bundle answer for `lever` with p2 = 0 and with p2 = 100, and for `road` chase;
   - the lesson order and modes for balance (6) and freeze (6) match the table.

## Done when
- `/lesson/chugaku_juken/balance?preview=1` and `/lesson/chugaku_juken/freeze?preview=1` play every card end to end (scene or walkthrough) on iPad 1180×820 and phone 390×844, with no console errors.
- CI is green.
- The Architect visual check passes.
