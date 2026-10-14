# WO-022: Zero-friction masterclass, with a guaranteed ghost finger and mascot voice

**Owner:** Builder · **Review:** Architect visual check · **Decision:** Brian, Oct 14 10:10 ("children (小5–6) never feel lost or stuck")

## 1. Onboarding guarantees (tighten what WO-012 §3b already built)
The ghost finger (`tactile.finger_ms` 1500 × `finger_repeats` 2) and the 5 s idle halo (`tactile.idle_ms`) exist. This WO makes them **guaranteed in every masterclass beat**, with tests:
- **Example 1 (beat 2), every lens:** the ghost finger starts within **3 s** of the beat opening (no wait for idle). It demonstrates the lesson's core gesture on the real target:
  - 囲む: drag the box corner;
  - 等積変形: slide the apex;
  - 止める: tap 弟, then drag the walker;
  - and the matching gesture in every other scene.
- **Idle > 5 s in any beat → pulse the one thing to touch next:**
  - in a drag scene, the knob;
  - in a walkthrough, the stage (tap to reveal);
  - on the principle, boundary and onboarding beats, the primary button (「レンズで見ると？」 / 「やってみる →」 / 「わかった」 / the clue chips, then the lens options).
- **Never more than one pulsing target at a time.** The pulse stops on the first touch.
- **Tests (8 lessons):**
  - fake timers: the finger is visible before 3 s on beat 2;
  - after `idle_ms` with no input, exactly one element has the pulse class, and it is the expected target for that beat.

## 2. Mascot voice (TTS), playback side
- **Voice (Brian, Oct 14 10:17):** VOICEVOX 春日部つむぎ, energetic pace (sample A).
  - Brian generates the clips on his Mac with `pnpm voice` (`tools/make_voice.py`, which runs against the VOICEVOX app's local engine) and commits them.
  - The validator only ships a clip whose recorded text still matches the line, so an edited line stays silent until it is regenerated.
- **Credit (required by VOICEVOX's terms):** show 「音声：VOICEVOX:春日部つむぎ」 in the app footer (landing, legal, and lesson pages), in small quiet text.
- **Audio files:** `apps/trainer/public/audio/mc/<lens>/<key>.m4a`, one per masterclass `say` key (`principle`, `principle_turn`, … `onboarding_done`). The bundle will list them per lesson as `masterclass.audio: { <key>: "/audio/mc/<lens>/<key>.m4a" }`. Until then the field is absent and **nothing plays** (build for the absent case first).
- **Sync:** when the mascot bubble shows a `say` line, play that line's clip.
  - A new bubble stops the previous clip.
  - Leaving the beat stops audio.
  - Never overlap two clips.
- **Mute:** a persistent speaker button in the top-right corner of the masterclass (and lesson) screens, at least a 44 px tap target.
  - The state is saved in localStorage (`lens.mute`, try/catch).
  - The default is **on** (sound plays).
  - Muted means the bubbles still show and nothing plays.
- **iOS Safari:** audio can only start after a user gesture. Unlock the audio element on the first tap of the lesson (the case page's start button). If play() is rejected, fail silently; the bubble is enough.
- **Respect `prefers-reduced-motion`?** No: voice is not motion. But do respect the mute button everywhere, including the Step 3 round if a later WO adds lines there.
- **Tests:** with a fake `masterclass.audio`, the clip for each bubble is requested once; mute prevents play; switching beats pauses the current clip.

## Done when
- On iPad and phone, every lesson's beat 2 shows the finger within 3 s, and idling 5 s on any beat pulses the right target.
- The mute button is visible on every masterclass beat, and nothing breaks when `masterclass.audio` is absent.
- CI is green and the Architect visual check passes.
