# WO-028: 「どのレンズ？」 Shorts for YouTube (any card → vertical MP4), first 3 for review, then a batch of 24 + a trailer

**Owner:** Video Builder · **Review:** Architect (math, code), Brian (look) · **Decision (Brian, Oct 16):** marketing video on YouTube Shorts. Same files also go to TikTok / Instagram Reels later; YouTube first.

## 0. Starting point
- `apps/shorts` already renders one Short: `EncloseShort` (card `enclose-001`, theme `short_dark`, study-pace timeline from `shortTimeline(card, tokens)`), via `pnpm render:short <cardId>` → `out/<cardId>.mp4`.
- All drawing is `LensScene` from `@lens/scenes`, the same scenes as the trainer's masterclass. Every word and number comes from the bundle. Do not draw math by hand in the Short.
- Brian approved (Oct 13): dark navy Shorts theme (trainer and book stay light); slow, study-pace walkthrough; one colour per calculation step.

## 1. One template for any card: `LensShort`
Rename/generalise `EncloseShort` → `LensShort({ cardId })`, working for every lens (囲む・等積変形・面積図・和差一定・てんびん・止める・折り返す・展開) and all three stages (中学受験 / 高校受験 / 大学受験). Where `shortTimeline` returns null for a card, fix it in `@lens/scenes` (not in the Short) or report the card to the Architect.

Structure (1080×1920, `tokens.layout.short`), total 30–45 s:

| Time | Beat | Content |
|---|---|---|
| 0–3 s | Hook | The problem, large; series line 「3秒で選べ。どこから解く？」 |
| 3–8 s | Choice | The card's `picker.options` as 3 lens chips + a 3-second countdown |
| 8–15 s | Trap | 「くせでやると…」: the trap route, greyed and tangled (`trap_route`) |
| 15–40 s | Lens | 「レンズで見ると」: the lens route step by step, one colour per step (existing study-pace beats) |
| last 5 s | CTA | Lens name + answer + 「無料でためす lens.domo-ai.com」 (text only; Shorts links aren't clickable) |

- **Captions:** large burned-in Japanese captions for every spoken line (most viewers are muted). Inside the platform safe zones (`tokens.layout.short` safe area; keep the bottom ~20% and right edge clear of text for YouTube's UI).
- **Voice:** VOICEVOX 春日部つむぎ, same settings as the masterclass (`tools/make_voice.py`, sample A). Add the Short lines (hook, choice, trap, lens, CTA) to the voice script so `.github/workflows/voice.yml` generates them; clips go through the normal `voice/clips` PR. The Short must still render (silent) if a clip is missing.
- **Fixed copy** in one place (`SHORT_COPY`), no score claims (景品表示法): time and "first step" wording only.
- **Variety:** a 3-second hook must differ between Shorts; use the card's own problem text, never a generic line.

## 2. Batch render
- `pnpm render:shorts --list shorts.yaml` (or similar): one MP4 per card id into `out/shorts/<stage>-<lens>-<cardId>.mp4`, plus a `out/shorts/captions.md` with, per video, a title (≤ 40 chars, e.g. 「【中学受験算数】3秒で選べ：和差一定」), a description (2–3 lines + 「音声 VOICEVOX:春日部つむぎ」 + `https://lens.domo-ai.com/?src=yt` + hashtags #中学受験 #中受 #算数 / #高校受験 / #大学受験 as fits) and the card id.
- The list file is Architect-owned: `apps/shorts/shorts.yaml`.

## 3. Deliveries
1. **Review set (first):** 3 Shorts: one 中学受験 (`constant`), one 高校受験 (`mirror`), one 大学受験 (`freeze`), card ids chosen by the Architect from cards with `status` ≥ verified. Send MP4s + captions.md for Brian's look review and the Architect's math check. Stop here until approved.
2. **Batch:** after approval, 24 Shorts = 8 lenses × 3 stages (one card each, Architect's list).
3. **Trailer (once, 60 s):** 8 lenses flash past (2–3 s each: one problem, one lens move), ending on 「迷う時間を削る。」 + lens.domo-ai.com. Pinned on the channel.
4. **Book QR demo (once, 20–30 s):** a page of the paperback, a phone scans the chapter QR, the masterclass opens (screen capture of the real app on a phone is fine). For the Amazon buyers and the pinned X post.

## 4. Rules
- Original problems only (our cards). No real 入試問題, no third-party music (silence + voice, or a royalty-free track documented in captions.md).
- Remotion licence: free for companies with ≤ 3 employees (Beyond Culture qualifies; re-check if headcount grows).
- Don't touch the trainer or the books. Keep `pnpm -r test`, `typecheck`, `check:literals` green; tokens only, no hex literals.

## 5. Tests / checks
- Every card in `shorts.yaml` renders; duration 30–45 s; no text outside the safe area (a test over the layout boxes).
- A snapshot frame per beat for one card per stage.
- captions.md: every title ≤ 40 chars; every description contains the VOICEVOX credit and `?src=yt`.
