// WO-022: the guaranteed ghost finger, one idle target per beat, and the mascot's voice.
import { loadBundle, tokens } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../i18n/ja';
import { FINGER_DELAY_MS, onTarget, showsFinger } from './guide';
import { findPass, isPlayable } from './lessons';
import { masterCards, masterToken } from './masterclass';
import { MasterBeat } from './MasterView';
import { FREEZE_PREVIEW_MS } from './scenes/Freeze';
import { clipFor, Voice, type AudioLike } from './voice';

const pass = findPass(loadBundle(), 'chugaku_juken')!;
const m = masterToken();
const nudged = (html: string) => [...html.matchAll(/<[^>]*class="[^"]*\bnudge\b[^"]*"[^>]*>/g)].map((x) => /data-target="([^"]+)"/.exec(x[0])?.[1] ?? '?');

describe('the ghost finger on masterclass example 1', () => {
  it('is guaranteed there, not only on first use', () => {
    expect(showsFinger(false, true)).toBe(true);
    expect(showsFinger(true, false)).toBe(true);
    expect(showsFinger(false, false)).toBe(false);
  });

  it.each(pass.lessons.map((l) => [l.lens, l] as const))('%s: example 1 is a drag scene and the finger starts within 3 s', (lens, lesson) => {
    const cards = masterCards(lesson)!;
    expect(isPlayable(cards.example1, lens)).toBe(true);
    // Every scene coaches as it mounts; 止める first previews the walk (FREEZE_PREVIEW_MS), then coaches.
    const before = lens === 'freeze' ? FREEZE_PREVIEW_MS : 0;
    expect(before + FINGER_DELAY_MS).toBeLessThan(3000);
  });
});

describe('one target pulses after idle', () => {
  it('a knob pulses only when it is the coached target', () => {
    expect(onTarget(null, 10, 10)).toBe(false);
    expect(onTarget([100, 100], 104, 98, 20)).toBe(true);
    expect(onTarget([100, 100], 160, 100, 20)).toBe(false);
  });

  it.each(pass.lessons.map((l) => [l.lens, l] as const))('%s: every beat pulses at most one element, and the boundary and onboarding beats the expected one', (lens, lesson) => {
    const cards = masterCards(lesson)!;
    const beat = (id: string) => nudged(renderToStaticMarkup(<MasterBeat beat={id} cards={cards} lens={lens} passId={pass.id} m={m} onNext={() => {}} scope={null} idle />));
    for (const id of ['principle', 'example1', 'example2', 'boundary', 'onboarding']) expect(beat(id).length, `${lens} ${id}`).toBeLessThanOrEqual(1);
    expect(beat('boundary')).toEqual(['got']);
    expect(beat('onboarding')).toEqual([`clue:${cards.mc.clues[0]}`]);
    // Nothing pulses unless idle.
    expect(nudged(renderToStaticMarkup(<MasterBeat beat="boundary" cards={cards} lens={lens} passId={pass.id} m={m} onNext={() => {}} scope={null} />))).toEqual([]);
  });

  it('uses the idle time from tokens', () => {
    expect(tokens.motion.tactile?.idle_ms).toBe(5000);
  });
});

function fakeAudio() {
  const a: AudioLike & { plays: string[]; pauses: number } = {
    src: '',
    currentTime: 0,
    paused: true,
    plays: [],
    pauses: 0,
    play() {
      a.paused = false;
      a.plays.push(a.src);
      return Promise.resolve();
    },
    pause() {
      a.paused = true;
      a.pauses++;
    },
  };
  return a;
}

describe('the mascot voice', () => {
  const lesson = pass.lessons[0]!;
  const mc = lesson.masterclass!;
  const audio = Object.fromEntries(Object.keys(mc.say).map((k) => [k, `/audio/mc/${lesson.lens}/${k}.m4a`]));

  it('finds the clip of each bubble line, and none when masterclass.audio is absent', () => {
    for (const [k, line] of Object.entries(mc.say)) expect(clipFor(line, mc.say, audio)).toBe(audio[k]);
    expect(clipFor(mc.say.principle, mc.say, undefined)).toBeNull();
    expect(clipFor(t('guide.aha'), mc.say, audio)).toBeNull();
  });

  it('plays each bubble once, never two at a time, and stops when the beat changes', () => {
    const a = fakeAudio();
    const v = new Voice(() => a, false);
    v.say(clipFor(mc.say.principle, mc.say, audio));
    expect(a.plays).toEqual([audio.principle]);
    v.say(clipFor(mc.say.principle_turn, mc.say, audio));
    expect(a.plays).toEqual([audio.principle, audio.principle_turn]);
    expect(a.pauses).toBe(1); // the first clip stopped before the second
    v.stop(); // leaving the beat
    expect(a.paused).toBe(true);
    v.say(clipFor(t('guide.aha'), mc.say, audio)); // a line without a clip plays nothing
    expect(a.plays).toHaveLength(2);
  });

  it('mute stops the clip and prevents play; the choice is remembered', () => {
    const setItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem } });
    const a = fakeAudio();
    const v = new Voice(() => a, false);
    v.say(audio.principle!);
    v.setMuted(true);
    expect(a.paused).toBe(true);
    expect(setItem).toHaveBeenCalledWith('lens.mute', '1');
    v.say(audio.principle_turn!);
    expect(a.plays).toEqual([audio.principle]);
    vi.unstubAllGlobals();
  });

  it('a rejected play() (iOS before the first tap) fails silently', async () => {
    const a = fakeAudio();
    a.play = () => Promise.reject(new Error('NotAllowedError'));
    const v = new Voice(() => a, false);
    expect(() => v.say(audio.principle!)).not.toThrow();
    await Promise.resolve();
  });
});
