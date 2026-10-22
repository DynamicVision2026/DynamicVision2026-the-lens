// WO-022 §2: the mascot's voice (VOICEVOX 春日部つむぎ). When a masterclass bubble shows a `say` line,
// that line's clip plays (from masterclass.audio, when the bundle lists it). One clip at a time: a new
// bubble or leaving the beat stops the last one. A persistent mute button (lens.mute, default sound on).
// iOS only plays after a gesture, so the first tap unlocks the element; a rejected play() is silent.
import { useEffect, useSyncExternalStore } from 'react';
import { t } from '../i18n/ja';
import { LANG } from '../i18n/lang';

export const MUTE_KEY = 'lens.mute';

/** The part of HTMLAudioElement the player uses (a fake in tests). */
export interface AudioLike {
  src: string;
  currentTime: number;
  paused: boolean;
  play: () => Promise<void> | void;
  pause: () => void;
  addEventListener?: (type: 'error', fn: () => void) => void;
}

/** The display language's clip of a Japanese clip URL (/audio/mc/x/y.m4a → /audio/mc/en/x/y.m4a); 日本語: unchanged. */
export function localClip(url: string): string {
  return LANG === 'ja' ? url : url.replace('/audio/mc/', `/audio/mc/${LANG}/`);
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** A short silent WAV (built here, nothing to fetch) to unlock the element inside the first tap. */
function silentWav(): string {
  const n = 64;
  const buf = new Uint8Array(44 + n);
  const v = new DataView(buf.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  buf.fill(128, 44);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...buf))}`;
}

export class Voice {
  private el: AudioLike | null = null;
  private muted: boolean;
  private unlocked = false;
  private listeners = new Set<() => void>();
  /** The clip of the bubble on screen (null for a line without a clip). */
  current: string | null = null;

  constructor(
    private readonly make: () => AudioLike | null = () => (typeof Audio === 'undefined' ? null : new Audio()),
    muted: boolean = readMuted(),
  ) {
    this.muted = muted;
  }

  /** The Japanese clip to try when the display language's clip is missing. */
  private fallback: string | null = null;

  private audio(): AudioLike | null {
    if (!this.el) {
      this.el = this.make();
      // No clip in this language (yet): play the Japanese one instead.
      this.el?.addEventListener?.('error', () => {
        const el = this.el;
        const ja = this.fallback;
        this.fallback = null;
        if (!el || !ja || !this.current || this.muted) return;
        try {
          el.src = ja;
          const p = el.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // The bubble is enough.
        }
      });
    }
    return this.el;
  }

  isMuted() {
    return this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
    if (m) this.stop();
    this.listeners.forEach((f) => f());
  }

  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  };

  /** Inside the first tap (iOS Safari): start and stop a silent clip so later play() calls are allowed. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const el = this.audio();
    if (!el) return;
    try {
      el.src = silentWav();
      const p = el.play();
      if (p && typeof p.then === 'function') p.then(() => el.pause(), () => {});
    } catch {
      // Not allowed: the bubbles still show.
    }
  }

  /** A new bubble: stop the last clip, then play this line's clip (if any, and not muted). */
  say(url: string | null) {
    this.stop();
    this.current = url;
    if (!url || this.muted) return;
    const el = this.audio();
    if (!el) return;
    try {
      const local = localClip(url);
      this.fallback = local === url ? null : url;
      el.src = local;
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Autoplay refused: the bubble is enough.
    }
  }

  stop() {
    this.current = null;
    const el = this.el;
    if (!el) return;
    try {
      if (!el.paused) el.pause();
      el.currentTime = 0;
    } catch {
      // Nothing playing.
    }
  }
}

/** The app's one player. */
export const voice = new Voice();

/** The clip for a bubble's text: the masterclass `say` key whose line it is, looked up in `audio`. */
export function clipFor(text: string, say: Record<string, string> | undefined, audio: Partial<Record<string, string>> | undefined): string | null {
  if (!say || !audio) return null;
  const key = Object.keys(say).find((k) => say[k] === text);
  return key ? (audio[key] ?? null) : null;
}

/** Unlocks the player on the first tap anywhere (iOS), and stops the voice when the screen goes away. */
export function useVoiceSession() {
  useEffect(() => {
    const first = () => voice.unlock();
    document.addEventListener('pointerdown', first, { once: true, capture: true });
    return () => {
      document.removeEventListener('pointerdown', first, { capture: true });
      voice.stop();
    };
  }, []);
}

/** The speaker button (top right of lesson screens): a 44 px tap target, remembered on this device. */
export function MuteButton() {
  const muted = useSyncExternalStore(voice.subscribe, () => voice.isMuted(), () => false);
  return (
    <button
      type="button"
      className={`mute${muted ? ' off' : ''}`}
      aria-pressed={muted}
      aria-label={muted ? t('voice.unmute') : t('voice.mute')}
      onClick={() => voice.setMuted(!muted)}
    >
      <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}

/** Required by VOICEVOX's terms: small, quiet. */
export function VoiceCredit() {
  return <p className="voice-credit">{t('voice.credit')}</p>;
}
