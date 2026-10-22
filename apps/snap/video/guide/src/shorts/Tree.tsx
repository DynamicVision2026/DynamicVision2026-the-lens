import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, C, FONT, Hex, Sfx, clamp, ease, usePop } from "../v2/kit";
import { MapEndCard, SAFE_RIGHT, s } from "./common";

/**
 * Short A — 「中2のまちがいは、小5で生まれていた」: a unit's family tree drawn backwards, one hex per unit.
 * `chain[0]` is where the child stopped; each next entry is the root before it (the app's rootsOf()).
 * Series: pass another `chain` + its two narration lines (same component).
 */
export type TreeProps = {
  chain: { grade: string; topic: string }[];
  /** two narration lines: [the reveal, the turn]; `src` is a file in public/, `text` is also the caption */
  lines: [{ src: string; text: string }, { src: string; text: string }];
  credit: string;
};

export const TREE_DEFAULT: TreeProps = {
  chain: [
    { grade: "中2", topic: "連立方程式" },
    { grade: "中1", topic: "一次方程式" },
    { grade: "小6", topic: "文字を用いた式" },
    { grade: "小5", topic: "数量の関係を表す式" },
  ],
  lines: [
    { src: "shorts/a01.wav", text: "中2のまちがいは、\n小5で生まれていました。" },
    { src: "shorts/a02.wav", text: "テスト前に解くのは、\n中2の問題じゃない。" },
  ],
  credit: "VOICEVOX:No.7",
};

/** Timeline (s) from the chain length; 4 units → the brief's 25.0 s. */
export function treeTimes(n: number) {
  const hexAt = (k: number) => (k === 0 ? 0.4 : 4.0 + (k - 1) * 2.4);
  const lineAt = (k: number) => 3.2 + (k - 1) * 2.4; // line into node k (k ≥ 1)
  const reveal = hexAt(n - 1) + 1.8;
  return { hexAt, lineAt, reveal, say1: reveal + 0.4, hold: reveal + 5.4, say2: reveal + 5.6, land: reveal + 8.9, end: reveal + 11.4, total: reveal + 14.4 };
}
export const treeFrames = (p: TreeProps) => s(treeTimes(p.chain.length).total);

const HEX = 150;

function pos(k: number, n: number) {
  const t = n === 1 ? 0 : k / (n - 1);
  return { x: 680 - 380 * t, y: 1020 - 760 * t };
}

function Caption({ text, from, to }: { text: string; from: number; to: number }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 6, to - 4, to], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  const two = text.includes("\n");
  return (
    <div style={{ position: "absolute", left: 60, width: SAFE_RIGHT - 120, top: two ? 1262 : 1300, textAlign: "center", fontFamily: FONT, fontSize: 60, fontWeight: 900, color: C.text, lineHeight: 1.3, whiteSpace: "pre-line", opacity: o, textShadow: "0 4px 18px rgba(0,0,0,0.6)" }}>
      {text}
    </div>
  );
}

function Node({ k, n, at, red, dim }: { k: number; n: number; at: number; red: number; dim: number }) {
  const p = usePop(at, 11);
  const f = useCurrentFrame();
  if (f < at) return null;
  const { x, y } = pos(k, n);
  return (
    <div style={{ position: "absolute", left: x - HEX / 2, top: y - HEX / 2, width: HEX, opacity: 1 - 0.6 * dim, transform: `scale(${Math.min(1.08, p)})`, transformOrigin: "50% 50%" }}>
      <div style={{ position: "relative", width: HEX, height: HEX }}>
        <div style={{ position: "absolute", inset: 0, opacity: 1 - red }}>
          <Hex color={C.grey} size={HEX} />
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: red }}>
          <Hex color={C.red} size={HEX} />
        </div>
      </div>
    </div>
  );
}

function Label({ k, n, at, dim, text }: { k: number; n: number; at: number; dim: number; text: { grade: string; topic: string } }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [at + 4, at + 14], [0, 1], clamp) * (1 - 0.6 * dim);
  const { x, y } = pos(k, n);
  return (
    <div style={{ position: "absolute", left: x - 300, width: 600, top: y + HEX / 2 + 4, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ padding: "6px 22px", borderRadius: 14, background: "rgba(6,12,25,0.86)", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: C.text, whiteSpace: "nowrap" }}>
        <span style={{ color: C.muted }}>{text.grade}｜</span>
        {text.topic}
      </div>
    </div>
  );
}

export function Tree(p: TreeProps) {
  const f = useCurrentFrame();
  const n = p.chain.length;
  const T = treeTimes(n);
  const last = s(T.hexAt(n - 1));
  // camera: starts close on the first hex, eases out so the whole chain fits by the last hex
  const cz = interpolate(f, [s(0.4), last], [1.45, 1], { ...clamp, easing: ease });
  const P0 = pos(0, n);
  const PC = { x: (pos(0, n).x + pos(n - 1, n).x) / 2, y: (pos(0, n).y + pos(n - 1, n).y) / 2 };
  const ct = interpolate(f, [s(0.4), last], [0, 1], { ...clamp, easing: ease });
  const F = { x: P0.x + (PC.x - P0.x) * ct, y: P0.y + (PC.y - P0.y) * ct };
  const red = interpolate(f, [s(T.reveal), s(T.reveal) + 12], [0, 1], clamp);
  const land = interpolate(f, [s(T.land), s(T.land) + 30], [0, 1], { ...clamp, easing: ease });
  const shot = interpolate(f, [s(T.land) + 6, s(T.land) + 36], [0, 1], { ...clamp, easing: ease });
  const cross = interpolate(f, [s(0.4), s(0.4) + 10], [0, 1], clamp);
  const stepCaption = (k: number) => (k === n - 1 ? "その前に。" : "その前に、");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: interpolate(f, [s(0.3), s(0.5)], [0, 1], clamp) }}>
        <Backdrop w={1080} h={1920} tint={C.red} glints={false} />
      </AbsoluteFill>
      {/* the tree */}
      <AbsoluteFill style={{ opacity: 1 - land, transform: `scale(${1 - 0.35 * land}) translate(${-60 * land}px, ${-120 * land}px)` }}>
        <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${PC.x}px, ${PC.y}px) scale(${cz}) translate(${-F.x}px, ${-F.y}px)` }}>
          <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {p.chain.slice(1).map((_, i) => {
              const k = i + 1;
              const A = pos(k - 1, n);
              const Bp = pos(k, n);
              const L = Math.hypot(Bp.x - A.x, Bp.y - A.y);
              const ux = (Bp.x - A.x) / L;
              const uy = (Bp.y - A.y) / L;
              const r = HEX * 0.48; // start and stop at the hex edges
              const a = { x: A.x + ux * r, y: A.y + uy * r };
              const b = { x: Bp.x - ux * r, y: Bp.y - uy * r };
              const q = interpolate(f, [s(T.lineAt(k)), s(T.lineAt(k) + 0.4)], [0, 1], { ...clamp, easing: ease });
              const dim = k - 1 < n - 1 ? red : 0;
              return <line key={k} x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * q} y2={a.y + (b.y - a.y) * q} stroke={C.muted} strokeWidth={4} strokeLinecap="round" opacity={q > 0 ? 0.85 - 0.45 * dim : 0} />;
            })}
          </svg>
          {p.chain.map((u, k) => {
            const at = s(T.hexAt(k));
            const isRoot = k === n - 1;
            const nodeRed = k === 0 ? 1 - red : isRoot ? red : 0;
            const dim = isRoot ? 0 : red;
            return (
              <div key={k}>
                <Node k={k} n={n} at={at} red={nodeRed} dim={dim} />
                <Label k={k} n={n} at={at} dim={dim} text={u} />
              </div>
            );
          })}
          {/* the ✕ where the child stopped */}
          {(() => {
            const a = pos(0, n);
            return (
              <div style={{ position: "absolute", left: a.x + 38, top: a.y - 130, fontFamily: FONT, fontSize: 90, fontWeight: 900, color: C.red, opacity: cross * (1 - 0.6 * red), transform: `scale(${0.6 + 0.4 * cross})`, textShadow: "0 4px 18px rgba(0,0,0,0.6)" }}>✕</div>
            );
          })()}
        </AbsoluteFill>
      </AbsoluteFill>
      {/* lands on the real app: the unit and its root path on the map */}
      <div style={{ position: "absolute", left: 90, top: 250, width: 740, opacity: shot, transform: `scale(${0.9 + 0.1 * shot})`, transformOrigin: "50% 40%" }}>
        <div style={{ borderRadius: 40, overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.12)" }}>
          <Img src={staticFile("shorts/roots.png")} style={{ width: 740, height: Math.round((740 * 1560) / 1170), display: "block" }} />
        </div>
      </div>
      {/* captions (end above y 1440, left of x 920) */}
      <Caption text="ここで止まった。" from={s(2.0)} to={s(T.lineAt(1))} />
      {p.chain.slice(1).map((_, i) => {
        const k = i + 1;
        const next = k + 1 < n ? s(T.lineAt(k + 1)) : s(T.reveal);
        return <Caption key={k} text={stepCaption(k)} from={s(T.hexAt(k))} to={next} />;
      })}
      <Caption text={p.lines[0].text} from={s(T.say1)} to={s(T.hold)} />
      <Caption text={p.lines[1].text} from={s(T.hold)} to={s(T.land)} />
      {/* sound */}
      {p.chain.map((_, k) => (
        <Sfx key={`h${k}`} at={s(T.hexAt(k))} src="tap" volume={0.35} />
      ))}
      {p.chain.slice(1).map((_, i) => (
        <Sfx key={`l${i}`} at={s(T.lineAt(i + 1))} src="tick" volume={0.3} />
      ))}
      <Sequence from={s(T.say1)} durationInFrames={s(5)}>
        <Audio src={staticFile(p.lines[0].src)} />
      </Sequence>
      <Sequence from={s(T.say2)} durationInFrames={s(5)}>
        <Audio src={staticFile(p.lines[1].src)} />
      </Sequence>
      <Sfx at={s(T.land) + 30} src="chime" volume={0.28} />
      <Sequence from={s(T.end)} durationInFrames={s(3)}>
        <MapEndCard fadeAt={s(2.7)} credit={p.credit} />
      </Sequence>
    </AbsoluteFill>
  );
}
