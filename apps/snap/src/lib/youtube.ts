import { YOUTUBE_CHANNEL_URL } from "../copy";

/**
 * One YouTube channel for every unit (ナゼホリ数学), no per-unit mapping: the unit sheet searches the
 * channel for the unit's topic, so a new video is found without any change here.
 */

/** The channel home (map ☰ menu, テスト前モード plan header). */
export function channelUrl(): string {
  return YOUTUBE_CHANNEL_URL;
}

/** The channel's search for a unit's topic (unit sheet). */
export function unitVideoUrl(topic: string): string {
  return `${YOUTUBE_CHANNEL_URL}/search?query=${encodeURIComponent(topic)}`;
}
