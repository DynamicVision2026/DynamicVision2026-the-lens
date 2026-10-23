import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { HAND } from "../story/art";
import { Backdrop, C, FONT, Hex, Sfx, clamp, ease, usePop } from "../v2/kit";
import narrEn from "../../../narration.en.json";
import narrZh from "../../../narration.zh-Hant.json";
import { IS_JA, VLANG, VOICE_CREDIT, grade, lfile, tr } from "../vlang";
import { MapEndCard, SAFE_RIGHT, s } from "./common";

/**
 * Short A — 「中2のまちがいは、小5で生まれていた」: a unit's family tree drawn backwards, one hex per unit,
 * with the years counting back. Opens on the stamped ✕ problem; lands on the real app (unit + root path).
 * `chain[0]` is where the child stopped; each next entry is the root before it (the app's rootsOf()).
 * Series: pass another `chain`, `problem` and its two narration lines (same component).
 */
export type TreeProps = {
  chain: { grade: string; topic: string }[];
  /** the opening sheet: heading, the printed problem lines, the child's (wrong) answer */
  problem: { head: string; q: string; lines: string[]; answer: string };
  /** two narration lines: [the reveal, the turn]; `src` is a file in public/, `text` is also the caption */
  lines: [{ src: string; text: string }, { src: string; text: string }];
  credit: string;
};

/** The narration line's caption in this language (the Japanese captions are in TREE_DEFAULT). */
const NARR = ({ en: narrEn, "zh-Hant": narrZh } as Record<string, { lines: { id: string; text: string }[] }>)[VLANG];
const said = (id: string, ja: string) => (IS_JA ? ja : NARR.lines.find((l) => l.id === id)?.text ?? ja);

export const TREE_DEFAULT: TreeProps = {
  chain: [
    { grade: "中2", topic: "連立方程式" },
    { grade: "中1", topic: "一次方程式" },
    { grade: "小6", topic: "文字を用いた式" },
    { grade: "小5", topic: "数量の関係を表す式" },
  ],
  problem: { head: tr("数学 2年　小テスト"), q: tr("(3) 次の連立方程式を解きなさい。"), lines: ["2x + y = 7", "x − y = 2"], answer: "x = 5,  y = 3" },
  lines: [
    { src: lfile("shorts/a01.wav"), text: said("a01", "中2のまちがいは、\n小5で生まれていました。") },
    { src: lfile("shorts/a02.wav"), text: said("a02", "テスト前に解くのは、\n中2の問題じゃない。") },
  ],
  credit: VOICE_CREDIT,
};

const GRADES = ["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "高1", "高2", "高3"];
const yearsBack = (from: string, to: string) => Math.max(0, GRADES.indexOf(from) - GRADES.indexOf(to));
const yearsLabel = (y: number) => (y === 0 ? tr("いま") : y === 1 ? tr("1年前") : tr("{y}年前").replace("{y}", String(y)));

/** Timeline (s) from the chain length; 4 units → 26.8 s. */
export function treeTimes(n: number) {
  const hexAt = (k: number) => (k === 0 ? 2.0 : 4.2 + (k - 1) * 2.4);
  const lineAt = (k: number) => 3.4 + (k - 1) * 2.4; // line into node k (k ≥ 1)
  const reveal = hexAt(n - 1) + 1.6;
  const land = reveal + 9.2;
  return { stamp: 0.8, hexAt, lineAt, reveal, say1: reveal + 1.7, hold: reveal + 5.5, say2: reveal + 5.7, land, end: land + 4.0, total: land + 7.0 };
}
export const treeFrames = (p: TreeProps) => s(treeTimes(p.chain.length).total);

const HEX = 220;

/** Chain layout: a gentle diagonal from the stopped unit (bottom) to the root (top-left), labels to the right. */
function pos(k: number, n: number) {
  const t = n === 1 ? 0 : k / (n - 1);
  return { x: 360 - 160 * t, y: 1110 - 860 * t };
}

function Caption({ text, from, to, big = false }: { text: string; from: number; to: number; big?: boolean }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 6, to - 4, to], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  const two = text.includes("\n");
  const size = big ? 120 : 60;
  return (
    <div style={{ position: "absolute", left: 60, width: SAFE_RIGHT - 120, top: big ? 1250 : two ? 1262 : 1300, textAlign: "center", fontFamily: FONT, fontSize: size, fontWeight: 900, color: big ? C.red : C.text, lineHeight: 1.3, whiteSpace: "pre-line", opacity: o, transform: big ? `scale(${0.85 + 0.15 * o})` : undefined, textShadow: "0 4px 18px rgba(0,0,0,0.6)" }}>
      {text}
    </div>
  );
}

/** The opening: the child's test sheet, full frame, a big red ✕ stamped on it. */
function Sheet({ p, stamp }: { p: TreeProps["problem"]; stamp: number }) {
  const f = useCurrentFrame();
  const q = interpolate(f, [stamp, stamp + 5], [0, 1], { ...clamp, easing: ease });
  const shake = f >= stamp && f < stamp + 8 ? Math.sin((f - stamp) * 2.6) * (8 - (f - stamp)) * 1.6 : 0;
  return (
    <div style={{ position: "absolute", left: 40, top: 150, width: 1000, height: 1300, transform: `rotate(-2deg) translate(${shake}px, ${shake * 0.6}px)`, background: "#fbfaf6", borderRadius: 10, boxShadow: "0 40px 100px rgba(0,0,0,0.6)", overflow: "hidden" }}>
      {/* grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(120,150,190,0.18) 2px, transparent 2px), linear-gradient(90deg, rgba(120,150,190,0.18) 2px, transparent 2px)", backgroundSize: "56px 56px" }} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 50, paddingBottom: 18, borderBottom: "4px solid #2b3550", fontFamily: FONT, fontSize: 46, fontWeight: 900, color: "#2b3550" }}>{p.head}</div>
      <div style={{ position: "absolute", left: 70, top: 200, fontFamily: FONT, fontSize: 50, fontWeight: 800, color: "#2b3550" }}>{p.q}</div>
      <div style={{ position: "absolute", left: 150, top: 300, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontFamily: FONT, fontSize: 190, fontWeight: 300, color: "#2b3550", lineHeight: 1 }}>{"{"}</div>
        <div style={{ fontFamily: FONT, fontSize: 70, fontWeight: 700, color: "#2b3550", lineHeight: 1.45 }}>
          {p.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      </div>
      {/* the child's work and answer (handwriting) */}
      <div style={{ position: "absolute", left: 120, top: 620, fontFamily: HAND, fontWeight: 600, fontSize: 64, color: "#4d5d8a", lineHeight: 1.5, transform: "rotate(-1deg)" }}>
        <div>2x + y − x − y = 7 − 2</div>
        <div>x = 5</div>
      </div>
      <div style={{ position: "absolute", left: 420, top: 980, display: "flex", alignItems: "center", gap: 24, fontFamily: FONT, fontSize: 52, fontWeight: 800, color: "#2b3550" }}>
        {tr("答え")}
        <div style={{ padding: "14px 34px", border: "4px solid #2b3550", fontFamily: HAND, fontWeight: 600, fontSize: 64, color: "#4d5d8a" }}>{p.answer}</div>
      </div>
      {/* the stamp */}
      <div style={{ position: "absolute", left: 230, top: 260, fontFamily: FONT, fontSize: 720, fontWeight: 900, color: "rgba(224,60,50,0.92)", lineHeight: 1, opacity: q, transform: `scale(${1.8 - 0.8 * q}) rotate(-8deg)`, transformOrigin: "50% 50%", mixBlendMode: "multiply" }}>✕</div>
    </div>
  );
}

function Node({ k, n, at, red, dim, pulse }: { k: number; n: number; at: number; red: number; dim: number; pulse: number }) {
  const p = usePop(at, 11);
  const f = useCurrentFrame();
  if (f < at) return null;
  const { x, y } = pos(k, n);
  return (
    <div style={{ position: "absolute", left: x - HEX / 2, top: y - HEX / 2, width: HEX, opacity: 1 - 0.6 * dim, transform: `scale(${Math.min(1.08, p) * (1 + 0.07 * pulse)})`, transformOrigin: "50% 50%" }}>
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

/** 56 px, smaller when a translated unit name would run off the frame (Latin ≈ 0.56 em, CJK 1 em). */
function topicSize(t: string, room: number) {
  const em = [...t].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x2000 ? 0.56 : 1), 0);
  return Math.min(56, Math.floor(room / Math.max(1, em)));
}

function Label({ k, n, at, dim, text, years }: { k: number; n: number; at: number; dim: number; text: { grade: string; topic: string }; years: number }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [at + 4, at + 14], [0, 1], clamp) * (1 - 0.6 * dim);
  const { x, y } = pos(k, n);
  return (
    <div style={{ position: "absolute", left: x + HEX / 2 + 40, top: y - 74, opacity: o, transform: `translateX(${(1 - Math.min(1, o / Math.max(0.01, 1 - 0.6 * dim))) * -20}px)` }}>
      <div style={{ fontFamily: FONT, lineHeight: 1.2, textShadow: "0 3px 14px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: C.muted }}>
          {grade(text.grade)}
          <span style={{ marginLeft: 18, padding: "2px 16px", borderRadius: 999, background: years === 0 ? "rgba(239,97,82,0.25)" : "rgba(246,196,83,0.18)", color: years === 0 ? C.red : C.gold, fontSize: 36 }}>{yearsLabel(years)}</span>
        </div>
        <div style={{ fontSize: topicSize(tr(text.topic), 1080 - (x + HEX / 2 + 40) - 30), fontWeight: 900, color: C.text, whiteSpace: "nowrap" }}>{tr(text.topic)}</div>
      </div>
    </div>
  );
}

export function Tree(p: TreeProps) {
  const f = useCurrentFrame();
  const n = p.chain.length;
  const T = treeTimes(n);
  const first = s(T.hexAt(0));
  const last = s(T.hexAt(n - 1));
  const P0 = pos(0, n);
  const PC = { x: (pos(0, n).x + pos(n - 1, n).x) / 2 + 120, y: (pos(0, n).y + pos(n - 1, n).y) / 2 };
  // camera: close on the first hex, eases out so the chain fills the frame; slow push-in under the narration
  const cz0 = interpolate(f, [first, last], [1.3, 1], { ...clamp, easing: ease });
  const push = interpolate(f, [s(T.reveal), s(T.land)], [1, 1.12], clamp);
  const cz = cz0 * push;
  const ct = interpolate(f, [first, last], [0, 1], { ...clamp, easing: ease });
  const F = { x: P0.x + (PC.x - P0.x) * ct, y: P0.y + (PC.y - P0.y) * ct };
  const red = interpolate(f, [s(T.reveal), s(T.reveal) + 12], [0, 1], clamp);
  const pulse = f >= s(T.reveal) + 12 && f < s(T.land) ? Math.max(0, Math.sin(((f - s(T.reveal) - 12) / 30) * Math.PI * 2)) ** 3 : 0;
  // opening sheet → shrinks into the red hex
  const shrink = interpolate(f, [s(1.45), first + 2], [0, 1], { ...clamp, easing: ease });
  const sheetGone = f > first + 4;
  const hexScreen = { x: PC.x + (P0.x - F.x) * cz, y: PC.y + (P0.y - F.y) * cz };
  const land = interpolate(f, [s(T.land), s(T.land) + 15], [0, 1], { ...clamp, easing: ease });
  const shot = interpolate(f, [s(T.land) + 4, s(T.land) + 20], [0, 1], { ...clamp, easing: ease });
  const shotPush = interpolate(f, [s(T.land), s(T.end)], [1, 1.05], clamp);
  const badge = interpolate(f, [first, first + 10], [0, 1], clamp);
  const root = p.chain[n - 1];
  const back = yearsBack(p.chain[0].grade, root.grade);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Backdrop w={1080} h={1920} tint={C.red} glints={false} />
      {/* the tree */}
      <AbsoluteFill style={{ opacity: (1 - land) * (f >= first - 2 ? 1 : 0), transform: `scale(${1 - 0.3 * land})`, transformOrigin: "50% 40%" }}>
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
              return <line key={k} x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * q} y2={a.y + (b.y - a.y) * q} stroke={C.muted} strokeWidth={6} strokeLinecap="round" opacity={q > 0 ? 0.85 - 0.45 * red : 0} />;
            })}
          </svg>
          {p.chain.map((u, k) => {
            const at = s(T.hexAt(k));
            const isRoot = k === n - 1;
            const nodeRed = k === 0 ? 1 - red : isRoot ? red : 0;
            const dim = isRoot ? 0 : red;
            return (
              <div key={k}>
                <Node k={k} n={n} at={at} red={nodeRed} dim={dim} pulse={isRoot ? pulse : 0} />
                <Label k={k} n={n} at={at} dim={dim} text={u} years={yearsBack(p.chain[0].grade, u.grade)} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: P0.x + 50, top: P0.y - 170, fontFamily: FONT, fontSize: 120, fontWeight: 900, color: C.red, opacity: badge * (1 - 0.6 * red), transform: `scale(${0.6 + 0.4 * badge})`, textShadow: "0 4px 18px rgba(0,0,0,0.6)" }}>✕</div>
        </AbsoluteFill>
      </AbsoluteFill>
      {/* opening: the stamped sheet shrinks into the red hex */}
      {!sheetGone && (
        <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${540 + (hexScreen.x - 540) * shrink}px, ${800 + (hexScreen.y - 800) * shrink}px) scale(${1 - 0.86 * shrink}) translate(-540px, -800px)`, opacity: 1 - interpolate(shrink, [0.75, 1], [0, 1], clamp) }}>
          <Sheet p={p.problem} stamp={s(T.stamp)} />
        </AbsoluteFill>
      )}
      {/* lands on the real app: the unit card and its root path, 85% of the frame width */}
      <div style={{ position: "absolute", left: 81, top: 190, width: 918, opacity: shot, transform: `scale(${(0.9 + 0.1 * shot) * shotPush})`, transformOrigin: "50% 45%" }}>
        <div style={{ borderRadius: 36, overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.12)" }}>
          <Img src={staticFile(lfile("shorts/roots-card.png"))} style={{ width: 918, height: Math.round((918 * 1300) / 1170), display: "block" }} />
        </div>
      </div>
      {/* captions (end above y 1440, left of x 920) */}
      <Caption text={tr("ここで止まった。")} from={first + 9} to={s(T.lineAt(1))} />
      {p.chain.slice(1).map((_, i) => {
        const k = i + 1;
        const next = k + 1 < n ? s(T.lineAt(k + 1)) : s(T.reveal);
        return <Caption key={k} text={k === n - 1 ? tr("その前に。") : tr("その前に、")} from={s(T.hexAt(k))} to={next} />;
      })}
      <Caption text={yearsLabel(back)} from={s(T.reveal) + 6} to={s(T.say1) - 1} big />
      <Caption text={p.lines[0].text} from={s(T.say1)} to={s(T.hold)} />
      <Caption text={p.lines[1].text} from={s(T.hold)} to={s(T.land)} />
      {/* sound */}
      <Sfx at={s(T.stamp)} src="hit" volume={0.7} />
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
      <Sfx at={s(T.land) + 20} src="chime" volume={0.28} />
      <Sequence from={s(T.end)} durationInFrames={s(3)}>
        <MapEndCard fadeAt={s(2.7)} credit={p.credit} />
      </Sequence>
    </AbsoluteFill>
  );
}
