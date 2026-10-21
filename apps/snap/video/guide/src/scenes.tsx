import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import clips from "./clips.json";
import { FPS, type Scene } from "./timeline";
import { Backdrop, C, Chip, Device, FONT, Headline, Hex, Kicker, SceneFade, ease, useIn, usePop } from "./ui";

const L = (sc: Scene, i: number) => sc.lines[i].from - sc.from; // a line's start, in scene frames
/** Playback rate so a clip (minus `skip` seconds) fills `frames`. */
const fit = (clip: keyof typeof clips, frames: number, skip = 0) => Math.max(0.45, (clips[clip] - skip) / (frames / FPS));

// ---------------------------------------------------------------- 1. hook: the night before the test

function Paper({ i, start }: { i: number; start: number }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start + i * 5, start + i * 5 + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const rot = [-9, 6, -3, 11, -14, 4, -6][i % 7];
  const x = [0, 60, -40, 90, -80, 20, 120][i % 7];
  return (
    <div
      style={{
        position: "absolute",
        left: 760 + x,
        top: 440 + i * 9,
        width: 400,
        height: 520,
        background: "#f5f1e8",
        borderRadius: 6,
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        transform: `translateY(${(1 - t) * -700}px) rotate(${rot * t}deg)`,
        opacity: t,
        padding: 36,
      }}
    >
      {Array.from({ length: 9 }).map((_, k) => (
        <div key={k} style={{ height: 10, borderRadius: 5, background: k % 3 === 0 ? "#c9c2b3" : "#ddd7ca", margin: "18px 0", width: `${60 + ((k * 37 + i * 13) % 40)}%` }} />
      ))}
      <div style={{ position: "absolute", right: 34, top: 40, fontFamily: FONT, fontSize: 64, fontWeight: 900, color: i % 2 ? C.red : "#2f6fd6", opacity: 0.85 }}>{i % 2 ? "✕" : "○"}</div>
    </div>
  );
}

export function Hook({ sc }: { sc: Scene }) {
  const frame = useCurrentFrame();
  const q = useIn(L(sc, 1) - 6, 22);
  const dim = interpolate(frame, [L(sc, 1) - 10, L(sc, 1) + 10], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <SceneFade dur={sc.dur}>
      <AbsoluteFill style={{ background: "radial-gradient(900px 600px at 50% 40%, #1b2a48, #050a14 75%)" }} />
      <AbsoluteFill style={{ opacity: dim }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Paper key={i} i={i} start={8} />
        ))}
      </AbsoluteFill>
      <Kicker style={{ position: "absolute", left: 140, top: 150, opacity: useIn(10) }} color={C.accent}>
        テスト前の夜
      </Kicker>
      <div style={{ position: "absolute", left: 0, right: 0, top: 200, textAlign: "center", opacity: q, transform: `scale(${0.92 + 0.08 * q})` }}>
        <div style={{ fontFamily: FONT, fontSize: 104, fontWeight: 900, color: C.text, textShadow: "0 10px 60px rgba(0,0,0,0.7)" }}>
          「今夜、何を
          <span style={{ color: C.accent }}>復習</span>
          すればいい？」
        </div>
      </div>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 2. title

export function Title({ sc }: { sc: Scene }) {
  const frame = useCurrentFrame();
  const colors = [C.grey, C.red, C.green, C.gold, C.purple, C.gold, C.green];
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop />
      <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", justifyContent: "center", gap: 18 }}>
        {colors.map((c, i) => {
          const p = interpolate(frame, [4 + i * 4, 24 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          return (
            <div key={i} style={{ transform: `translateY(${(1 - p) * 60}px) scale(${p})`, opacity: p }}>
              <Hex color={c} size={78} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 400, textAlign: "center" }}>
        <Headline parts={["つまずき", "マップ"]} start={18} size={150} style={{ letterSpacing: "0.06em" }} />
        <div style={{ marginTop: 30, opacity: useIn(40, 24), fontFamily: FONT, fontSize: 50, fontWeight: 700, color: C.muted }}>
          撮るだけで、<span style={{ color: C.text }}>今夜の復習</span>がわかる。
        </div>
      </div>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 3. the map

const ZONES: [string, string, string][] = [
  ["小1", "海岸線", "10m"],
  ["小3", "平原", "120m"],
  ["小5", "深い森林帯", "500m"],
  ["中1", "丘陵帯", "1,000m"],
  ["中3", "高原帯", "2,000m"],
  ["高3", "山頂", "3,776m"],
];

export function MapScene({ sc }: { sc: Scene }) {
  const frame = useCurrentFrame();
  const s06 = L(sc, 2);
  const tablet = useIn(0, 26);
  const tilt = interpolate(frame, [0, sc.dur], [8, -2]);
  const toPhone = useIn(s06 - 10, 24);
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop />
      <div style={{ position: "absolute", left: 120, top: 120, width: 640 }}>
        <Kicker>MAP</Kicker>
        <Headline parts={["算数・数学の", "110単元が、", "ひとつの大陸に。"]} start={6} size={66} style={{ marginTop: 18 }} />
        <div style={{ marginTop: 36, display: "grid", gap: 14, opacity: 1 - toPhone }}>
          {ZONES.map(([g, z, h], i) => {
            const p = useIn(L(sc, 1) + i * 9, 16);
            return (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 18, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, fontFamily: FONT, color: C.text }}>
                <span style={{ width: 86, padding: "6px 0", textAlign: "center", borderRadius: 8, background: C.gold, color: "#10182a", fontWeight: 900, fontSize: 28 }}>{g}</span>
                <span style={{ fontSize: 34, fontWeight: 800 }}>{z}</span>
                <span style={{ fontSize: 26, color: C.muted }}>標高 {h}</span>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 330, opacity: toPhone, fontFamily: FONT, color: C.text }}>
          <div style={{ display: "flex", gap: 16 }}>
            {["宿題", "ドリル", "テスト"].map((w, i) => (
              <Chip key={w} color={[C.cyan, C.gold, C.accent][i]} start={s06 + i * 8}>
                {w}
              </Chip>
            ))}
          </div>
          <div style={{ marginTop: 34, fontSize: 44, fontWeight: 900, lineHeight: 1.4 }}>
            撮った問題が、
            <br />
            地図を<span style={{ color: C.gold }}>塗り変えていく</span>。
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, perspective: 2400 }}>
        <Device
          kind="tablet"
          clip="c1_map_ipad"
          width={940}
          startFrom={30}
          rate={fit("c1_map_ipad", s06, 1)}
          style={{ left: 860, top: 150, transform: `rotateY(${-tilt}deg) translateY(${(1 - tablet) * 120}px) scale(${1 - toPhone * 0.12})`, opacity: tablet * (1 - toPhone) }}
        />
      </div>
      <Sequence from={s06 - 10} layout="none">
        <Device kind="phone" clip="c2_snap_phone" width={360} startFrom={Math.round(11.6 * FPS)} rate={0.9} style={{ left: 1180, top: 120, opacity: toPhone, transform: `translateY(${(1 - toPhone) * 80}px)` }} glow="rgba(242,193,78,0.25)" />
      </Sequence>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 4. how to snap

const STEPS = [
  { n: "1", t: "1枚まるごと撮る", d: "宿題・ドリル・テスト" },
  { n: "2", t: "単元を見分ける", d: "1問ずつ、AIが読み取り" },
  { n: "3", t: "○✕を記録", d: "先生の丸つけ優先・印なしはAI判定" },
  { n: "4", t: "保存すると地図に", d: "その単元が立ち上がる" },
];

export function SnapScene({ sc }: { sc: Scene }) {
  const at = [0, L(sc, 1), L(sc, 2), L(sc, 3)];
  const frame = useCurrentFrame();
  const active = at.filter((a) => frame >= a - 6).length - 1;
  const phone = useIn(0, 24);
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop hue={-12} />
      <Device kind="phone" clip="c2_snap_phone" width={400} rate={fit("c2_snap_phone", sc.dur)} style={{ left: 250, top: 70, transform: `translateY(${(1 - phone) * 100}px)`, opacity: phone }} />
      <div style={{ position: "absolute", left: 860, top: 130 }}>
        <Kicker color={C.accent}>HOW TO USE</Kicker>
        <Headline parts={["使い方は、", "撮るだけ。"]} start={6} size={74} style={{ marginTop: 16 }} />
        <div style={{ marginTop: 34, display: "grid", gap: 16 }}>
          {STEPS.map((s, i) => {
            const p = useIn(at[i] - 4, 16);
            const on = i === active;
            return (
              <div
                key={s.n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  padding: "20px 28px",
                  width: 820,
                  borderRadius: 22,
                  background: on ? "rgba(255,138,92,0.14)" : "rgba(20,34,62,0.7)",
                  border: `2px solid ${on ? C.accent : C.line}`,
                  opacity: 0.35 + 0.65 * p,
                  transform: `translateX(${(1 - p) * 40}px)`,
                  fontFamily: FONT,
                }}
              >
                <span style={{ width: 64, height: 64, borderRadius: 18, display: "grid", placeItems: "center", background: on ? C.accent : C.navy, color: on ? "#1a0f08" : C.text, fontSize: 34, fontWeight: 900 }}>{s.n}</span>
                <div>
                  <div style={{ fontSize: 40, fontWeight: 900, color: C.text }}>{s.t}</div>
                  <div style={{ fontSize: 26, fontWeight: 600, color: C.muted, marginTop: 4 }}>{s.d}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 5. the 5-step ladder

const LADDER: [string, string, string][] = [
  ["まだ", C.grey, ""],
  ["挑戦中", C.red, ""],
  ["復習ずみ", C.green, ""],
  ["マスター", C.gold, "★"],
  ["定着", C.purple, ""],
];

export function LadderScene({ sc }: { sc: Scene }) {
  const frame = useCurrentFrame();
  const s12 = L(sc, 1);
  const s13 = L(sc, 2);
  const tab = useIn(s13 - 12, 26);
  const shrink = interpolate(frame, [s13 - 12, s13 + 14], [1, 0.62], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const flag = usePop(s12);
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop hue={10} />
      <div style={{ position: "absolute", left: 120, top: 110 }}>
        <Kicker color={C.gold}>5 STEPS</Kicker>
        <Headline parts={["色は、", "理解の段階。"]} start={6} size={74} style={{ marginTop: 16 }} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 380, transformOrigin: "left top", transform: `scale(${shrink})`, display: "flex", gap: 34, alignItems: "flex-end" }}>
        {LADDER.map(([name, color, mark], i) => {
          const at = 10 + i * Math.round((s12 - 30) / 5);
          const p = usePop(at);
          return (
            <div key={name} style={{ textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
              <div style={{ transform: `translateY(${-i * 18}px)` }}>
                <Hex color={color} size={150} label={mark} />
              </div>
              <div style={{ marginTop: 18 - i * 18, fontFamily: FONT, fontSize: 38, fontWeight: 900, color: C.text }}>{name}</div>
              {i === 4 && <div style={{ fontFamily: FONT, fontSize: 24, color: C.muted, marginTop: 6 }}>2週間後も○</div>}
            </div>
          );
        })}
        {LADDER.slice(0, 4).map((_, i) => (
          <div key={i} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 140, top: 770, display: "flex", alignItems: "center", gap: 22, opacity: flag * (1 - tab * 0.0), transform: `scale(${0.7 + 0.3 * flag})`, transformOrigin: "left center", fontFamily: FONT }}>
        <svg width="70" height="90" viewBox="0 0 70 90">
          <rect x="8" y="4" width="6" height="84" rx="3" fill="#dfe6f5" />
          <path d="M14 6 L62 18 L14 34 Z" fill={C.red} />
        </svg>
        <div style={{ fontSize: 44, fontWeight: 900, color: C.text }}>
          赤い旗 = <span style={{ color: C.red }}>まだ解き直していない✕</span>
        </div>
      </div>
      <Sequence from={s13 - 12} layout="none">
        <Device kind="tablet" clip="c3_sheet_ipad" width={880} startFrom={30} rate={fit("c3_sheet_ipad", sc.dur - s13 + 12, 1)} style={{ left: 940, top: 260, opacity: tab, transform: `translateX(${(1 - tab) * 160}px)` }} />
      </Sequence>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 6. roots in earlier grades

export function RootsScene({ sc }: { sc: Scene }) {
  const s15 = L(sc, 1);
  const tab = useIn(0, 24);
  const a = useIn(s15, 30);
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop hue={-25} />
      <Device kind="tablet" clip="c4_roots_ipad" width={1000} startFrom={30} rate={fit("c4_roots_ipad", sc.dur, 1)} style={{ left: 820, top: 150, opacity: tab, transform: `translateY(${(1 - tab) * 80}px)` }} glow="rgba(165,140,255,0.22)" />
      <div style={{ position: "absolute", left: 120, top: 140, width: 640 }}>
        <Kicker color={C.purple}>ROOTS</Kicker>
        <Headline parts={["つまずきの", "もとは、", "前の学年に。"]} start={6} size={70} style={{ marginTop: 16 }} />
        <div style={{ marginTop: 70, fontFamily: FONT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: useIn(s15 - 8, 16) }}>
            <span style={{ padding: "8px 18px", borderRadius: 10, background: C.gold, color: "#10182a", fontWeight: 900, fontSize: 32 }}>5年</span>
            <span style={{ fontSize: 44, fontWeight: 900, color: C.text }}>平均</span>
            <Hex color={C.red} size={54} glow={false} />
          </div>
          <svg width="80" height="150" viewBox="0 0 80 150" style={{ marginLeft: 26 }}>
            <path d={`M40 4 L40 ${4 + 120 * a}`} stroke={C.purple} strokeWidth="6" strokeDasharray="12 10" strokeLinecap="round" />
            {a > 0.95 && <path d="M22 110 L40 134 L58 110" fill="none" stroke={C.purple} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: a }}>
            <span style={{ padding: "8px 18px", borderRadius: 10, background: "#7fd1a8", color: "#10182a", fontWeight: 900, fontSize: 32 }}>4年</span>
            <span style={{ fontSize: 40, fontWeight: 900, color: C.text }}>データの収集と分析</span>
          </div>
        </div>
      </div>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 7. テスト前: tonight's plan

export function ExamScene({ sc }: { sc: Scene }) {
  const s17 = L(sc, 1);
  const s19 = L(sc, 3);
  const tab = useIn(0, 24);
  const rows: [string, string, string][] = [
    ["①", "まず解き直す", C.red],
    ["②", "つまずきのもと", C.accent],
    ["③", "念のため", C.gold],
  ];
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop hue={-8} />
      <Device kind="tablet" clip="c5_exam_ipad" width={1040} startFrom={30} rate={fit("c5_exam_ipad", sc.dur, 1)} style={{ left: 760, top: 140, opacity: tab, transform: `translateY(${(1 - tab) * 80}px)` }} glow="rgba(255,138,92,0.22)" />
      <div style={{ position: "absolute", left: 110, top: 120, width: 600 }}>
        <Kicker color={C.accent}>テスト前</Kicker>
        <Headline parts={["日付と範囲で、", "今夜の作戦。"]} start={6} size={68} style={{ marginTop: 16 }} />
        <div style={{ marginTop: 56, display: "grid", gap: 18 }}>
          {rows.map(([n, t, c], i) => {
            const p = useIn(s17 + i * 30, 16);
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 22px", borderRadius: 18, background: "rgba(20,34,62,0.8)", borderLeft: `8px solid ${c}`, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, fontFamily: FONT }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: c }}>{n}</span>
                <span style={{ fontSize: 40, fontWeight: 900, color: C.text }}>{t}</span>
              </div>
            );
          })}
          <div style={{ opacity: useIn(s17 + 100, 16), fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.muted, marginTop: 6 }}>
            めやすの時間つき ・ 答えもその場で
          </div>
          <div style={{ opacity: useIn(s19 - 4, 16), marginTop: 10 }}>
            <Chip color={C.cyan} start={s19 - 4}>
              保護者に1枚で共有
            </Chip>
          </div>
        </div>
      </div>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 8. devices + privacy

export function DevicesScene({ sc }: { sc: Scene }) {
  const a = useIn(0, 24);
  const b = useIn(10, 24);
  const c = useIn(20, 24);
  const lock = usePop(16);
  return (
    <SceneFade dur={sc.dur}>
      <Backdrop />
      <Device kind="tablet" clip="c1_map_ipad" width={800} startFrom={60} rate={0.8} style={{ left: 120, top: 300, opacity: a, transform: `translateY(${(1 - a) * 80}px)` }} />
      <Device kind="tablet-portrait" clip="c6_map_portrait" width={420} startFrom={24} style={{ left: 1000, top: 200, opacity: b, transform: `translateY(${(1 - b) * 80}px)` }} />
      <Device kind="phone" clip="c2_snap_phone" width={300} startFrom={Math.round(13 * FPS)} rate={0.6} style={{ left: 1500, top: 330, opacity: c, transform: `translateY(${(1 - c) * 80}px)` }} />
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", alignItems: "center", gap: 22, opacity: lock, fontFamily: FONT }}>
        <svg width="60" height="70" viewBox="0 0 60 70">
          <rect x="6" y="30" width="48" height="36" rx="8" fill={C.green} />
          <path d="M16 30 V20 a14 14 0 0 1 28 0 V30" fill="none" stroke={C.green} strokeWidth="7" />
        </svg>
        <div style={{ fontSize: 50, fontWeight: 900, color: C.text }}>
          写真は、<span style={{ color: C.green }}>端末の中だけ</span>に保存。
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, top: 200, fontFamily: FONT, fontSize: 34, fontWeight: 700, color: C.muted, opacity: useIn(30, 20) }}>
        スマートフォン ・ iPad（縦・横）
      </div>
    </SceneFade>
  );
}

// ---------------------------------------------------------------- 9. plans + end card

export function PlansScene({ sc }: { sc: Scene }) {
  const frame = useCurrentFrame();
  const end = L(sc, 1) - 10;
  const cards = interpolate(frame, [end, end + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logo = useIn(end + 6, 26);
  const card = (start: number) => useIn(start, 18);
  return (
    <SceneFade dur={sc.dur + 14}>
      <Backdrop />
      <AbsoluteFill style={{ opacity: cards }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center" }}>
          <Kicker color={C.gold}>PLAN</Kicker>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", gap: 60, fontFamily: FONT }}>
          {[
            { k: "無料のお試し", p: "¥0", d: "30枚まで（1回かぎり）", c: C.cyan, at: 6 },
            { k: "年間プラン", p: "¥5,800", d: "毎月200枚まで", c: C.gold, at: 40 },
          ].map((x) => {
            const t = card(x.at);
            return (
              <div key={x.k} style={{ width: 620, padding: "48px 44px", borderRadius: 32, background: "rgba(16,30,56,0.9)", border: `3px solid ${x.c}`, boxShadow: `0 0 60px ${x.c}33`, opacity: t, transform: `translateY(${(1 - t) * 60}px)` }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: x.c, letterSpacing: "0.1em" }}>{x.k}</div>
                <div style={{ marginTop: 18, fontSize: 100, fontWeight: 900, color: C.text, lineHeight: 1, whiteSpace: "nowrap" }}>
                  {x.p}
                  <span style={{ fontSize: 34, color: C.muted }}>{x.p !== "¥0" ? " ／年（税込）" : " ／月"}</span>
                </div>
                <div style={{ marginTop: 22, fontSize: 38, fontWeight: 800, color: C.text }}>{x.d}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: FONT, fontSize: 30, color: C.muted, opacity: card(60) }}>
          年間プランは1年分の一括払い・自動更新なし ・ 家族の端末3台まで
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: logo }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", gap: 16 }}>
          {[C.grey, C.red, C.green, C.gold, C.purple].map((c, i) => (
            <div key={i} style={{ transform: `translateY(${Math.sin((frame + i * 12) / 18) * 8}px)` }}>
              <Hex color={c} size={70} />
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 440, textAlign: "center", fontFamily: FONT }}>
          <div style={{ fontSize: 150, fontWeight: 900, color: C.text, letterSpacing: "0.06em", transform: `scale(${0.94 + 0.06 * logo})` }}>つまずきマップ</div>
          <div style={{ marginTop: 26, fontSize: 52, fontWeight: 700, color: C.muted }}>
            撮るだけで、<span style={{ color: C.text }}>今夜の復習</span>がわかる。
          </div>
          <div style={{ marginTop: 70, fontSize: 30, fontWeight: 700, color: C.muted, letterSpacing: "0.12em" }}>ナゼホリ数学 ・ Beyond Culture</div>
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 26, fontFamily: FONT, fontSize: 20, color: "rgba(200,210,230,0.6)" }}>VOICEVOX:冥鳴ひまり</div>
      </AbsoluteFill>
    </SceneFade>
  );
}
