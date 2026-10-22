import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, clamp, ease } from "../v2/kit";

/** Shared rules for the story-format Shorts (1080×1920). */
export const W = 1080;
export const H = 1920;
export const FPS = 30;
/** Captions must end above this line (YouTube's Shorts overlay covers the bottom). */
export const SAFE_BOTTOM = 1440;
/** Keep text left of this x (like/comment buttons sit in the right column). */
export const SAFE_RIGHT = 920;
export const s = (sec: number) => Math.round(sec * FPS);

/**
 * End card (3.0 s): the app's 単元マップ, then 「つまずきマップ」 at the wordmark size, domo-ai.com small under it.
 * Nothing else. `credit` (bottom-right) only when the Short has narration. Fades to black over `fade` s from frame `fadeAt`, then stays black.
 */
export function MapEndCard({ fadeAt, credit, fade = 0.3 }: { fadeAt: number; credit?: string; fade?: number }) {
  const f = useCurrentFrame();
  const mapIn = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: ease });
  const word = interpolate(f, [12, 30], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(f, [fadeAt, fadeAt + s(fade)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: mapIn, transform: `scale(${1.04 - 0.04 * mapIn})` }}>
        <Img src={staticFile("shorts/map.png")} style={{ width: W, height: (W * 2532) / 1170, objectFit: "cover", marginTop: -200 }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(6,12,25,0.15) 0%, rgba(6,12,25,0.78) 38%, rgba(6,12,25,0.78) 62%, rgba(6,12,25,0.2) 100%)" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 30, width: SAFE_RIGHT - 20, top: 790, textAlign: "center", fontFamily: FONT, opacity: word, transform: `translateY(${(1 - word) * 24}px)` }}>
        <div style={{ fontSize: 118, fontWeight: 900, color: C.text, letterSpacing: "0.04em", textShadow: `0 0 60px ${C.cyan}55` }}>つまずきマップ</div>
        <div style={{ marginTop: 22, fontSize: 44, fontWeight: 800, color: C.muted, letterSpacing: "0.06em" }}>domo-ai.com</div>
      </div>
      {credit && <div style={{ position: "absolute", right: 28, bottom: 28, fontFamily: FONT, fontSize: 22, color: "rgba(200,210,230,0.65)" }}>{credit}</div>}
      <AbsoluteFill style={{ background: "#000", opacity: out }} />
    </AbsoluteFill>
  );
}
