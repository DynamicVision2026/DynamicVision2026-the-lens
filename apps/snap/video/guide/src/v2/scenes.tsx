import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, C, Callout, FONT, FPS, Fade, Hex, Kicker, Screen, type Seg, Sfx, Slam, clamp, ease, useIn, usePop } from "./kit";

export type Line = { id: string; text: string; from: number; dur: number };
export type Scene = { id: string; from: number; dur: number; lines: Line[] };
const L = (sc: Scene, i: number) => sc.lines[i].from - sc.from;
const E = (sc: Scene, i: number) => L(sc, i) + sc.lines[i].dur;
const s = (sec: number) => Math.round(sec * FPS);

// ================================================================ 1. hook — 毎日の復習 / テスト前 / 何を？

function Paper({ i, start, chaos }: { i: number; start: number; chaos: number }) {
  const f = useCurrentFrame();
  const t = interpolate(f, [start + i * 3, start + i * 3 + 22], [0, 1], { ...clamp, easing: ease });
  const ang = (i / 9) * Math.PI * 2 + f * 0.012 * chaos;
  const rad = 330 * chaos;
  const x = 960 - 170 + Math.cos(ang) * rad + (i - 4) * 18 * (1 - chaos);
  const y = 560 - 220 + Math.sin(ang) * rad * 0.45 + i * 6 * (1 - chaos);
  const rot = (i % 2 ? 1 : -1) * (6 + i * 3) * t + chaos * Math.sin(f / 20 + i) * 12;
  return (
    <div style={{ position: "absolute", left: x, top: y + (1 - t) * -700, width: 340, height: 440, background: "#f4efe4", borderRadius: 6, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", transform: `rotate(${rot}deg)`, opacity: t * (1 - chaos * 0.35), padding: 30 }}>
      {Array.from({ length: 8 }).map((_, k) => (
        <div key={k} style={{ height: 9, borderRadius: 5, background: k % 3 === 0 ? "#c4bdae" : "#dcd5c7", margin: "17px 0", width: `${55 + ((k * 37 + i * 13) % 42)}%` }} />
      ))}
      <div style={{ position: "absolute", right: 26, top: 30, fontFamily: FONT, fontSize: 60, fontWeight: 900, color: i % 3 === 0 ? C.red : "#2f6fd6" }}>{i % 3 === 0 ? "✕" : "○"}</div>
    </div>
  );
}

export function Hook({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const s2 = L(sc, 1);
  const s3 = L(sc, 2);
  const chaos = interpolate(f, [s3 - 6, s3 + 30], [0, 1], { ...clamp, easing: ease });
  const a = interpolate(f, [s2 - 8, s2 + 2], [1, 0], clamp);
  const b = interpolate(f, [s2 - 2, s2 + 10, s3 - 8, s3 + 2], [0, 1, 1, 0], clamp);
  const q = useIn(s3, 16);
  const qPulse = 1 + 0.04 * Math.sin((f - s3) / 6);
  return (
    <Fade dur={sc.dur + 12}>
      <AbsoluteFill style={{ background: "radial-gradient(1100px 700px at 50% 45%, #18294a, #040812 75%)" }} />
      <AbsoluteFill style={{ opacity: 0.55 + 0.45 * (1 - chaos * 0.4) }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Paper key={i} i={i} start={4} chaos={chaos} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(4,8,18,${0.35 + chaos * 0.35})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", opacity: a }}>
        <Slam parts={["毎日の、", "算数・数学の", "復習。"]} start={6} size={110} colors={[undefined, C.cyan, undefined]} style={{ textShadow: "0 10px 50px rgba(0,0,0,0.8)" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", opacity: b }}>
        <Slam parts={["そして、", "テスト前の", "総復習。"]} start={s2} size={110} colors={[undefined, C.accent, undefined]} style={{ textShadow: "0 10px 50px rgba(0,0,0,0.8)" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", opacity: q, transform: `scale(${(0.8 + 0.2 * q) * qPulse})` }}>
        <div style={{ fontFamily: FONT, fontSize: 52, fontWeight: 800, color: C.muted, marginBottom: 18 }}>どちらも、悩みはこれ。</div>
        <div style={{ fontFamily: FONT, fontSize: 132, fontWeight: 900, color: C.text, textShadow: `0 0 60px ${C.accent}66, 0 10px 50px rgba(0,0,0,0.8)` }}>
          何を<span style={{ color: C.accent }}>復習</span>すればいい？
        </div>
      </div>
      <Sfx at={6} src="whoosh" volume={0.35} />
      <Sfx at={s2} src="whoosh" volume={0.35} />
      <Sfx at={s3} src="hit" volume={0.35} />
    </Fade>
  );
}

// ================================================================ 2. title (riser → hit → logo)

export function Title({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const burst = interpolate(f, [0, 26], [0, 1], { ...clamp, easing: ease });
  const colors = [C.grey, C.red, C.green, C.gold, C.purple, C.cyan, C.gold, C.green, C.red, C.purple, C.gold, C.green];
  const shine = interpolate(f, [24, 70], [-30, 130], clamp);
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop />
      {colors.map((c, i) => {
        const ang = (i / colors.length) * Math.PI * 2;
        const r = 120 + 420 * burst;
        const p = usePop(2 + i, 14);
        return (
          <div key={i} style={{ position: "absolute", left: 960 + Math.cos(ang) * r * 1.5 - 32, top: 470 + Math.sin(ang) * r * 0.62 - 37, opacity: (1 - burst * 0.55) * p, transform: `scale(${p}) rotate(${f * (i % 2 ? 0.6 : -0.6)}deg)` }}>
            <Hex color={c} size={64} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 340, textAlign: "center" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <Slam parts={["つ", "ま", "ず", "き", "マ", "ッ", "プ"]} start={6} size={168} style={{ letterSpacing: "0.06em", textShadow: `0 0 70px ${C.cyan}55` }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(105deg, transparent ${shine - 12}%, rgba(255,255,255,0.55) ${shine}%, transparent ${shine + 12}%)`, mixBlendMode: "overlay" }} />
        </div>
        <div style={{ marginTop: 26, opacity: useIn(30, 20), fontFamily: FONT, fontSize: 50, fontWeight: 800, color: C.muted }}>
          撮るだけで、<span style={{ color: C.text }}>復習すること</span>がわかる。
        </div>
      </div>
      <Sfx at={0} src="hit" volume={0.55} />
      <Sfx at={30} src="chime" volume={0.3} />
    </Fade>
  );
}

// ================================================================ 3. two moments: 毎日 / テスト前

function DailyIcon({ start }: { start: number }) {
  const f = useCurrentFrame();
  const days = ["月", "火", "水", "木", "金"];
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {days.map((d, i) => {
        const on = f > start + 14 + i * 9;
        const p = usePop(start + 14 + i * 9, 12);
        return (
          <div key={d} style={{ width: 70, height: 86, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: `2px solid ${on ? C.cyan : C.line}`, display: "grid", placeItems: "center", fontFamily: FONT }}>
            <div style={{ fontSize: 24, color: C.muted, fontWeight: 800 }}>{d}</div>
            <div style={{ fontSize: 34, color: C.green, transform: `scale(${on ? p : 0})`, fontWeight: 900 }}>✓</div>
          </div>
        );
      })}
    </div>
  );
}

function ExamIcon({ start }: { start: number }) {
  const f = useCurrentFrame();
  const ring = useIn(start + 20, 20);
  const n = Math.max(1, 5 - Math.floor(Math.max(0, f - start - 20) / 8));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, fontFamily: FONT }}>
      <div style={{ position: "relative", width: 120, height: 120, borderRadius: 18, background: "rgba(255,255,255,0.06)", border: `2px solid ${C.line}`, display: "grid", placeItems: "center" }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: C.text }}>21</div>
        <svg width="150" height="150" style={{ position: "absolute", left: -15, top: -15 }}>
          <circle cx="75" cy="75" r="64" fill="none" stroke={C.accent} strokeWidth="6" strokeDasharray={`${402 * ring} 402`} strokeLinecap="round" transform="rotate(-90 75 75)" />
        </svg>
      </div>
      <div style={{ fontSize: 46, fontWeight: 900, color: C.accent }}>あと{n}日</div>
    </div>
  );
}

export function UseCases({ sc }: { sc: Scene }) {
  const a = useIn(4, 22);
  const b = useIn(L(sc, 0) + Math.round(sc.lines[0].dur * 0.45), 22);
  const card = (p: number, dir: number) => ({ opacity: p, transform: `translateX(${(1 - p) * 120 * dir}px)` });
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={C.accent} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 110, textAlign: "center" }}>
        <Kicker color={C.gold} style={{ justifyContent: "center" }}>
          ふたつの場面で
        </Kicker>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", gap: 70 }}>
        {[
          { k: "毎日", t: "返ってきたプリントを撮るだけ", c: C.cyan, icon: <DailyIcon start={4} />, p: a, dir: -1 },
          { k: "テスト前", t: "今夜やることがひと目でわかる", c: C.accent, icon: <ExamIcon start={L(sc, 0) + Math.round(sc.lines[0].dur * 0.45)} />, p: b, dir: 1 },
        ].map((x) => (
          <div key={x.k} style={{ width: 720, height: 520, borderRadius: 34, padding: "50px 54px", background: "rgba(12,24,48,0.88)", border: `3px solid ${x.c}`, boxShadow: `0 0 70px ${x.c}33`, ...card(x.p, x.dir), fontFamily: FONT }}>
            <div style={{ fontSize: 72, fontWeight: 900, color: x.c }}>{x.k}</div>
            <div style={{ marginTop: 14, fontSize: 40, fontWeight: 800, color: C.text }}>{x.t}</div>
            <div style={{ marginTop: 70 }}>{x.icon}</div>
          </div>
        ))}
      </div>
      <Sfx at={4} src="whoosh" volume={0.3} />
      <Sfx at={L(sc, 0) + Math.round(sc.lines[0].dur * 0.45)} src="whoosh" volume={0.3} />
    </Fade>
  );
}

// ================================================================ 4. 撮る → AI → 確認 → 地図

const PROBLEMS = [
  { q: "平行四辺形の面積", unit: "B(3) 平面図形の面積", mark: "○" },
  { q: "平均点を求める（表なし）", unit: "D(2) 平均", mark: "✕" },
  { q: "平均点を求める（表）", unit: "D(2) 平均", mark: "✕" },
  { q: "15%引きの値引き額", unit: "C(3) 割合", mark: "○" },
];

function Pipeline({ start }: { start: number }) {
  const f = useCurrentFrame();
  const photo = useIn(start, 18);
  const split = interpolate(f, [start + 26, start + 50], [0, 1], { ...clamp, easing: ease });
  const scan = interpolate(f, [start + 8, start + 30], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 230, width: 560, opacity: photo * (1 - split * 0.6), transform: `scale(${1 - split * 0.15}) rotate(${-2 + split * 2}deg)`, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <Img src={staticFile("sheet.jpg")} style={{ width: "100%", display: "block" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 6, background: C.cyan, boxShadow: `0 0 30px ${C.cyan}`, opacity: scan < 1 ? 1 : 0 }} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {PROBLEMS.map((_, i) => {
          const p = interpolate(f, [start + 34 + i * 6, start + 54 + i * 6], [0, 1], { ...clamp, easing: ease });
          const y = 300 + i * 150 + 40;
          return <path key={i} d={`M 700 ${430} C 780 ${430}, 760 ${y}, ${700 + 120 * p} ${y}`} fill="none" stroke={C.cyan} strokeOpacity={0.5 * p} strokeWidth="3" strokeDasharray="8 8" />;
        })}
      </svg>
      {PROBLEMS.map((pr, i) => {
        const p = usePop(start + 40 + i * 8, 14);
        const tag = usePop(start + 70 + i * 8, 12);
        const stamp = usePop(start + 100 + i * 8, 9);
        return (
          <div key={i} style={{ position: "absolute", left: 830, top: 300 + i * 150, width: 960, height: 120, borderRadius: 20, background: "rgba(12,24,48,0.92)", border: `2px solid ${C.line}`, display: "flex", alignItems: "center", gap: 26, padding: "0 30px", opacity: Math.min(1, p), transform: `translateX(${(1 - p) * 80}px)`, fontFamily: FONT }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: C.muted, width: 70 }}>問{i + 1}</span>
            <span style={{ fontSize: 34, fontWeight: 800, color: C.text, flex: 1 }}>{pr.q}</span>
            <span style={{ padding: "8px 18px", borderRadius: 12, background: C.gold, color: "#10182a", fontSize: 26, fontWeight: 900, transform: `scale(${tag})`, opacity: Math.min(1, tag) }}>{pr.unit}</span>
            <span style={{ width: 74, height: 74, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 50, fontWeight: 900, color: "#fff", background: pr.mark === "○" ? C.green : C.red, transform: `scale(${stamp * (1.6 - 0.6 * Math.min(1, stamp))})`, opacity: Math.min(1, stamp) }}>{pr.mark}</span>
          </div>
        );
      })}
      {PROBLEMS.map((_, i) => (
        <Sfx key={i} at={start + 100 + i * 8} src="pop" volume={0.3} />
      ))}
    </AbsoluteFill>
  );
}

export function SnapScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const s7 = L(sc, 1);
  const s8 = L(sc, 2);
  const s9 = L(sc, 3);
  const pipe = interpolate(f, [s7 - 8, s7 + 6, s8 - 10, s8 + 2], [0, 1, 1, 0], clamp);
  const phoneOn = 1 - pipe;
  const segs: Seg[] = [
    { from: 0, to: s7, a: 0.4, b: 4.4 },
    { from: s7, to: s8, a: 4.4, b: 4.6 },
    { from: s8, to: s9, a: 4.8, b: 12.8 },
    { from: s9, to: sc.dur + 12, a: 12.8, b: 19.2 },
  ];
  const flash = interpolate(f, [s7 - 14, s7 - 10, s7 - 2], [0, 0.85, 0], clamp);
  const steps = [
    { n: "1", t: "1枚まるごと撮る", at: 0 },
    { n: "2", t: "単元を見分ける", at: s7 },
    { n: "3", t: "○✕を記録・確認", at: s8 },
    { n: "4", t: "地図に反映", at: s9 },
  ];
  const active = steps.filter((x) => f >= x.at - 4).length - 1;
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop />
      <div style={{ position: "absolute", left: 110, top: 90 }}>
        <Kicker color={C.accent}>使い方</Kicker>
        <div style={{ marginTop: 22, display: "flex", gap: 14 }}>
          {steps.map((x, i) => (
            <div key={x.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: i === active ? C.accent : "rgba(20,34,62,0.8)", color: i === active ? "#1b0f08" : i < active ? C.text : C.muted, fontFamily: FONT, fontSize: 24, fontWeight: 900 }}>
              <span>{x.n}</span>
              <span>{x.t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ opacity: phoneOn }}>
        <Screen clip="snap_phone" segs={segs} width={430} style={{ left: 1260, top: 110, transform: `translateY(${(1 - useIn(0, 22)) * 120}px)` }} glow="rgba(255,138,92,0.25)" />
        <div style={{ position: "absolute", left: 110, top: 300, width: 900, opacity: interpolate(f, [0, 14, s7 - 14, s7 - 4], [0, 1, 1, 0], clamp) }}>
          <Slam parts={["宿題・ドリル・テストを、", "1枚まるごと。"]} start={6} size={74} />
          <div style={{ marginTop: 40, width: 560, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.55)", transform: `rotate(-3deg) scale(${0.9 + 0.1 * useIn(16, 20)})`, opacity: useIn(16, 20) }}>
            <Img src={staticFile("sheet.jpg")} style={{ width: "100%", display: "block" }} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 110, top: 300, width: 900, opacity: interpolate(f, [s8, s8 + 14, s9 - 10, s9], [0, 1, 1, 0], clamp) }}>
          <Slam parts={["先生の丸つけを優先。", "印がなければAIが判定。"]} start={s8 + 4} size={60} />
          <div style={{ marginTop: 30, fontFamily: FONT, fontSize: 38, fontWeight: 800, color: C.muted }}>保存の前に、内容を確かめられます。</div>
        </div>
        <div style={{ position: "absolute", left: 110, top: 300, width: 900, opacity: interpolate(f, [s9, s9 + 14], [0, 1], clamp) }}>
          <Slam parts={["保存すると、", "地図の上に", "立ち上がる。"]} start={s9 + 4} size={78} colors={[undefined, C.gold, undefined]} />
        </div>
      </div>
      {f >= s8 && f < s9 && (
        <>
          <Callout at={s8 + s(0.9)} color={C.gold} style={{ left: 640, top: 620 }}>
            単元を自動で判定
          </Callout>
          <Callout at={s8 + s(3.0)} color={C.green} style={{ left: 640, top: 720 }}>
            AI判定 ○
          </Callout>
          <Callout at={s8 + s(5.0)} color={C.red} style={{ left: 640, top: 820 }}>
            空欄 → ✕
          </Callout>
        </>
      )}
      <AbsoluteFill style={{ opacity: pipe }}>
        <Backdrop tint={C.gold} />
        <div style={{ position: "absolute", left: 120, top: 90 }}>
          <Kicker color={C.gold}>AI</Kicker>
          <Slam parts={["1問ずつ読み取り、", "単元と○✕を記録。"]} start={s7} size={62} style={{ marginTop: 18 }} />
        </div>
        {f >= s7 - 8 && <Pipeline start={s7} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <Sfx at={s7 - 14} src="shutter" volume={0.6} />
      <Sfx at={s9 + s(1.2)} src="chime" volume={0.35} />
      <Sfx at={s7 - 8} src="whoosh" volume={0.25} />
      <Sfx at={s8 - 10} src="whoosh" volume={0.25} />
    </Fade>
  );
}

// ================================================================ 5. the continent

const ZONES: [string, string, number][] = [
  ["小1", "海岸線", 10],
  ["小3", "平原", 120],
  ["小5", "深い森林帯", 500],
  ["中1", "丘陵帯", 1000],
  ["中3", "高原帯", 2000],
  ["高1", "雪線", 2500],
  ["高3", "山頂", 3776],
];

export function MapScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [10, 70], [0, 110], { ...clamp, easing: ease }));
  const tilt = interpolate(f, [0, sc.dur], [10, -4]);
  const tab = useIn(0, 26);
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={C.green} />
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, perspective: 2200 }}>
        <Screen clip="map_ipad" segs={[{ from: 0, to: sc.dur + 12, a: 1.2, b: 16.5 }]} width={1080} camera={false} sfx={false} style={{ left: 760, top: 150, transform: `rotateY(${-tilt}deg) rotateX(${tilt * 0.3}deg) translateY(${(1 - tab) * 140}px)` }} glow="rgba(71,199,139,0.25)" />
      </div>
      <div style={{ position: "absolute", left: 110, top: 100, width: 620 }}>
        <Kicker color={C.green}>MAP</Kicker>
        <div style={{ marginTop: 20, fontFamily: FONT, fontWeight: 900, color: C.text, fontSize: 70, lineHeight: 1.2 }}>
          算数・数学の
          <br />
          <span style={{ color: C.gold, fontSize: 120 }}>{n}</span>単元が、
          <br />
          ひとつの大陸に。
        </div>
        <div style={{ marginTop: 34, position: "relative", height: 420 }}>
          <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 4, background: `linear-gradient(${C.gold}, ${C.green}, ${C.cyan})`, borderRadius: 2 }} />
          {ZONES.slice()
            .reverse()
            .map(([g, z, h], i) => {
              const p = useIn(30 + (ZONES.length - 1 - i) * 8, 14);
              return (
                <div key={g} style={{ position: "absolute", left: 0, top: i * 60, display: "flex", alignItems: "center", gap: 16, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, fontFamily: FONT }}>
                  <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.bg0, border: `3px solid ${C.gold}`, display: "grid", placeItems: "center" }} />
                  <span style={{ width: 70, textAlign: "center", padding: "4px 0", borderRadius: 8, background: C.gold, color: "#10182a", fontWeight: 900, fontSize: 24 }}>{g}</span>
                  <span style={{ fontSize: 30, fontWeight: 800, color: C.text }}>{z}</span>
                  <span style={{ fontSize: 24, color: C.muted }}>標高 {h.toLocaleString()}m</span>
                </div>
              );
            })}
        </div>
      </div>
      <Sfx at={2} src="whoosh" volume={0.3} />
    </Fade>
  );
}

// ================================================================ 6. the 5-step ladder

const LADDER: [string, string, string][] = [
  ["まだ", C.grey, ""],
  ["挑戦中", C.red, ""],
  ["復習ずみ", C.green, ""],
  ["マスター", C.gold, "★"],
  ["定着", C.purple, ""],
];

export function LadderScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const s12 = L(sc, 1);
  const stepLen = Math.round((E(sc, 0) - 20) / 5);
  const step = Math.min(4, Math.max(0, Math.floor((f - 16) / stepLen)));
  const morph = interpolate(f, [16 + step * stepLen, 16 + step * stepLen + 10], [0.75, 1], clamp);
  const split = interpolate(f, [s12 - 14, s12 + 10], [0, 1], { ...clamp, easing: ease });
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={LADDER[step][1]} />
      <div style={{ position: "absolute", left: 110, top: 100 }}>
        <Kicker color={C.gold}>5 STEPS</Kicker>
        <Slam parts={["色は、", "理解の段階。"]} start={4} size={74} style={{ marginTop: 18 }} />
      </div>
      <div style={{ position: "absolute", left: 960 - 160 - split * 300, top: 270, transform: `scale(${1 - split * 0.3})`, transformOrigin: "left top", opacity: 1 - split }}>
        <div style={{ transform: `scale(${morph})` }}>
          <Hex color={LADDER[step][1]} size={320} label={LADDER[step][2]} />
        </div>
        <div style={{ marginTop: 20, textAlign: "center", width: 320, fontFamily: FONT, fontSize: 64, fontWeight: 900, color: C.text }}>{LADDER[step][0]}</div>
        {step === 4 && <div style={{ textAlign: "center", width: 320, fontFamily: FONT, fontSize: 30, color: C.muted }}>2週間後も ○</div>}
      </div>
      <div style={{ position: "absolute", left: 360 - split * 250, top: 880 - split * 600, display: "flex", flexWrap: "wrap", width: 1200 - split * 560, gap: 14 }}>
        {LADDER.map(([name, c], i) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 999, background: i <= step ? `${c}33` : "rgba(20,34,62,0.6)", border: `2px solid ${i <= step ? c : C.line}`, fontFamily: FONT, fontSize: 26, fontWeight: 800, color: i <= step ? C.text : C.muted }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: c }} />
            {name}
          </div>
        ))}
      </div>
      <div style={{ opacity: split }}>
        <Screen clip="sheet_ipad" segs={[{ from: s12 - 14, to: sc.dur + 12, a: 0.6, b: 11.2 }]} width={1000} style={{ left: 820, top: 200, transform: `translateX(${(1 - split) * 200}px)` }} />
        <Callout at={s12 + 10} color={C.red} style={{ left: 110, top: 470 }}>
          🚩 赤い旗 ＝ まだ解き直していない✕
        </Callout>
        <Callout at={s12 + s(3.2)} color={C.cyan} style={{ left: 110, top: 570 }}>
          間違えた問題と写真に、すぐ戻れる
        </Callout>
      </div>
      {LADDER.map((_, i) => (
        <Sfx key={i} at={16 + i * stepLen} src="pop" volume={0.28} />
      ))}
    </Fade>
  );
}

// ================================================================ 7. roots

export function RootsScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const path = interpolate(f, [s(2.2), s(4.4)], [0, 1], { ...clamp, easing: ease });
  const tab = useIn(0, 22);
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={C.purple} />
      <Screen clip="roots_ipad" segs={[{ from: 0, to: sc.dur + 12, a: 0.5, b: 10.8 }]} width={1040} style={{ left: 790, top: 160, opacity: tab, transform: `translateY(${(1 - tab) * 100}px)` }} glow="rgba(169,141,255,0.28)" />
      <div style={{ position: "absolute", left: 110, top: 110, width: 640 }}>
        <Kicker color={C.purple}>ROOTS</Kicker>
        <Slam parts={["つまずきの", "もとは、", "前の学年に。"]} start={4} size={70} style={{ marginTop: 18 }} />
      </div>
      <svg width={700} height={460} style={{ position: "absolute", left: 90, top: 520 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.red} />
            <stop offset="1" stopColor={C.purple} />
          </linearGradient>
        </defs>
        <path d="M 120 70 C 340 70, 120 330, 360 340" fill="none" stroke="url(#g)" strokeWidth="7" strokeLinecap="round" strokeDasharray="1000" strokeDashoffset={1000 * (1 - path)} />
      </svg>
      <div style={{ position: "absolute", left: 120, top: 540, display: "flex", alignItems: "center", gap: 18, fontFamily: FONT, opacity: useIn(s(1.2), 14) }}>
        <Hex color={C.red} size={80} />
        <div>
          <div style={{ fontSize: 26, color: C.muted, fontWeight: 800 }}>5年</div>
          <div style={{ fontSize: 42, color: C.text, fontWeight: 900 }}>平均</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 360, top: 800, display: "flex", alignItems: "center", gap: 18, fontFamily: FONT, opacity: path, transform: `scale(${0.8 + 0.2 * path})` }}>
        <Hex color={C.purple} size={80} />
        <div>
          <div style={{ fontSize: 26, color: C.muted, fontWeight: 800 }}>4年</div>
          <div style={{ fontSize: 38, color: C.text, fontWeight: 900 }}>データの収集と分析</div>
        </div>
      </div>
      <Sfx at={s(4.4)} src="chime" volume={0.25} />
    </Fade>
  );
}

// ================================================================ 8. daily loop

export function DailyScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const words = ["撮る", "解き直す", "チェック"];
  const colors = [C.cyan, C.accent, C.green];
  const per = Math.round(sc.lines[0].dur * 0.22);
  const startW = Math.round(sc.lines[0].dur * 0.22);
  const active = Math.min(2, Math.max(-1, Math.floor((f - startW) / per)));
  const spin = f * 0.6;
  const fill = interpolate(f, [startW + per * 3, startW + per * 3 + 40], [0, 1], clamp);
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={C.cyan} />
      <div style={{ position: "absolute", left: 110, top: 100 }}>
        <Kicker color={C.cyan}>毎日</Kicker>
        <Slam parts={["毎日の復習は、", "このくり返し。"]} start={4} size={66} style={{ marginTop: 18 }} />
      </div>
      <div style={{ position: "absolute", left: 160, top: 360, width: 560, height: 560 }}>
        <svg width={560} height={560} style={{ position: "absolute", transform: `rotate(${spin}deg)` }}>
          <circle cx="280" cy="280" r="220" fill="none" stroke={C.line} strokeWidth="4" strokeDasharray="10 14" />
        </svg>
        <div style={{ position: "absolute", left: 200, top: 190 }}>
          <Hex color={fill > 0 ? C.green : C.red} size={160} label={fill > 0.5 ? "✓" : ""} style={{ transform: `scale(${1 + 0.12 * Math.sin(fill * Math.PI)})` }} />
        </div>
        {words.map((w, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
          const on = i === active;
          const p = usePop(startW + i * per, 12);
          return (
            <div key={w} style={{ position: "absolute", left: 280 + Math.cos(ang) * 220 - 110, top: 280 + Math.sin(ang) * 220 - 42, width: 220, height: 84, borderRadius: 999, display: "grid", placeItems: "center", fontFamily: FONT, fontSize: 36, fontWeight: 900, background: on ? colors[i] : "rgba(14,28,54,0.95)", color: on ? "#0b1426" : C.text, border: `3px solid ${colors[i]}`, boxShadow: on ? `0 0 40px ${colors[i]}88` : "none", transform: `scale(${0.85 + 0.15 * Math.min(1, p) + (on ? 0.08 : 0)})` }}>
              {w}
            </div>
          );
        })}
      </div>
      <Screen clip="daily_phone" segs={[{ from: 0, to: sc.dur + 12, a: 1.0, b: 11.3 }]} width={400} style={{ left: 1260, top: 90 }} glow="rgba(95,216,255,0.25)" />
      {words.map((_, i) => (
        <Sfx key={i} at={startW + i * per} src="pop" volume={0.3} />
      ))}
      <Sfx at={startW + per * 3} src="chime" volume={0.3} />
    </Fade>
  );
}

// ================================================================ 9. テスト前

export function ExamScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const s16 = L(sc, 1);
  const s17 = L(sc, 2);
  const segs: Seg[] = [
    { from: 0, to: s16, a: 0.9, b: 9.4 },
    { from: s16, to: s17, a: 9.4, b: 13.2 },
    { from: s17, to: sc.dur + 12, a: 13.2, b: 23.6 },
  ];
  const rows: [string, string, string][] = [
    ["①", "まず解き直す", C.red],
    ["②", "つまずきのもと", C.accent],
    ["③", "念のため", C.gold],
  ];
  const mins = Math.round(interpolate(f, [s16 + s(3.2), s16 + s(4.6)], [0, 20], clamp));
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={C.accent} />
      <Screen clip="exam_ipad" segs={segs} width={1060} style={{ left: 760, top: 150 }} glow="rgba(255,138,92,0.26)" />
      <div style={{ position: "absolute", left: 100, top: 100, width: 620 }}>
        <Kicker color={C.accent}>テスト前</Kicker>
        <Slam parts={["日付と範囲で、", "今夜の作戦。"]} start={4} size={70} style={{ marginTop: 18 }} />
        <div style={{ marginTop: 50, display: "grid", gap: 16, opacity: interpolate(f, [s17 - 6, s17 + 8], [1, 0], clamp) }}>
          {rows.map(([n, t, c], i) => {
            const p = usePop(s16 + i * s(0.9), 13);
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 24px", borderRadius: 18, background: "rgba(14,28,54,0.92)", borderLeft: `8px solid ${c}`, opacity: Math.min(1, p), transform: `translateX(${(1 - p) * -60}px)`, fontFamily: FONT }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: c }}>{n}</span>
                <span style={{ fontSize: 40, fontWeight: 900, color: C.text }}>{t}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10, opacity: useIn(s16 + s(3.2), 12), fontFamily: FONT }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: C.muted }}>めやす 約</span>
            <span style={{ fontSize: 76, fontWeight: 900, color: C.gold }}>{mins}</span>
            <span style={{ fontSize: 34, fontWeight: 800, color: C.muted }}>分</span>
          </div>
        </div>
      </div>
      {f >= s17 && (
        <>
          <Callout at={s17 + s(0.6)} color={C.cyan} style={{ left: 100, top: 400 }}>
            答えをその場で確かめる
          </Callout>
          <Callout at={s17 + s(2.6)} color={C.green} style={{ left: 100, top: 500 }}>
            ✓ 解き直したらチェック
          </Callout>
          <Callout at={s17 + s(4.8)} color={C.gold} style={{ left: 100, top: 600 }}>
            保護者に1枚で共有
          </Callout>
        </>
      )}
      {rows.map((_, i) => (
        <Sfx key={i} at={s16 + i * s(0.9)} src="pop" volume={0.3} />
      ))}
      <Sfx at={s17 + s(2.6)} src="chime" volume={0.3} />
    </Fade>
  );
}

// ================================================================ 10. trust

export function TrustScene({ sc }: { sc: Scene }) {
  const a = useIn(0, 22);
  const b = useIn(8, 22);
  const c = useIn(16, 22);
  const lock = usePop(10, 10);
  return (
    <Fade dur={sc.dur + 12}>
      <Backdrop tint={C.green} />
      <Screen clip="map_ipad" segs={[{ from: 0, to: sc.dur + 12, a: 14, b: 21 }]} width={760} camera={false} sfx={false} style={{ left: 110, top: 360, opacity: a, transform: `translateY(${(1 - a) * 100}px) rotate(-2deg)` }} />
      <Screen clip="portrait_ipad" segs={[{ from: 0, to: sc.dur + 12, a: 0, b: 5.4 }]} width={400} camera={false} sfx={false} style={{ left: 960, top: 250, opacity: b, transform: `translateY(${(1 - b) * 100}px)` }} />
      <Screen clip="plan_phone" segs={[{ from: 0, to: sc.dur + 12, a: 0, b: 1.2 }]} width={300} camera={false} sfx={false} style={{ left: 1470, top: 330, opacity: c, transform: `translateY(${(1 - c) * 100}px) rotate(3deg)` }} />
      <div style={{ position: "absolute", left: 110, top: 100, display: "flex", alignItems: "center", gap: 26, fontFamily: FONT }}>
        <svg width="84" height="96" viewBox="0 0 84 96" style={{ transform: `scale(${lock})` }}>
          <path d="M42 4 L78 18 V48 C78 72 60 86 42 92 C24 86 6 72 6 48 V18 Z" fill={`${C.green}33`} stroke={C.green} strokeWidth="5" />
          <path d="M26 50 L38 62 L60 36" fill="none" stroke={C.green} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={60 * (1 - Math.min(1, lock))} />
        </svg>
        <Slam parts={["写真は、", "端末の中だけ", "に保存。"]} start={6} size={64} colors={[undefined, C.green, undefined]} />
      </div>
      <div style={{ position: "absolute", left: 220, top: 210, fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.muted, opacity: useIn(24, 16) }}>スマートフォン ・ iPad（縦・横）</div>
      <Sfx at={10} src="chime" volume={0.25} />
    </Fade>
  );
}

// ================================================================ 11. plans + end card

export function PlansScene({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const end = L(sc, 1) - 6;
  const cards = interpolate(f, [end, end + 16], [1, 0], clamp);
  const logo = useIn(end + 6, 24);
  const price = Math.round(interpolate(f, [s(1.6), s(2.6)], [0, 5800], { ...clamp, easing: ease }));
  const pa = useIn(4, 18);
  const pb = useIn(s(1.4), 18);
  return (
    <Fade dur={sc.dur + 12} edge={20}>
      <Backdrop tint={C.gold} />
      <AbsoluteFill style={{ opacity: cards }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 110, display: "flex", justifyContent: "center" }}>
          <Kicker color={C.gold}>PLAN</Kicker>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 220, display: "flex", justifyContent: "center", gap: 60, fontFamily: FONT }}>
          {[
            { k: "無料のお試し", p: "¥0", u: "", d: "30枚まで（1回かぎり）", c: C.cyan, t: pa },
            { k: "年間プラン", p: `¥${price.toLocaleString()}`, u: " ／年（税込）", d: "毎月200枚まで", c: C.gold, t: pb },
          ].map((x) => (
            <div key={x.k} style={{ width: 640, padding: "52px 50px", borderRadius: 34, background: "rgba(12,24,48,0.92)", border: `3px solid ${x.c}`, boxShadow: `0 0 70px ${x.c}33`, opacity: x.t, transform: `translateY(${(1 - x.t) * 70}px)` }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: x.c, letterSpacing: "0.1em" }}>{x.k}</div>
              <div style={{ marginTop: 18, whiteSpace: "nowrap", fontSize: 108, fontWeight: 900, color: C.text, lineHeight: 1 }}>
                {x.p}
                <span style={{ fontSize: 34, color: C.muted }}>{x.u}</span>
              </div>
              <div style={{ marginTop: 24, fontSize: 40, fontWeight: 800, color: C.text }}>{x.d}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: FONT, fontSize: 30, color: C.muted, opacity: useIn(s(2.6), 16) }}>
          年間プランは1年分の一括払い・自動更新なし ・ 家族の端末3台まで
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: logo }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", gap: 18 }}>
          {[C.grey, C.red, C.green, C.gold, C.purple].map((c, i) => (
            <div key={i} style={{ transform: `translateY(${Math.sin((f + i * 10) / 16) * 9}px)` }}>
              <Hex color={c} size={72} />
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: FONT }}>
          <div style={{ fontSize: 50, fontWeight: 800, color: C.muted }}>毎日の復習も、テスト前も。</div>
          <div style={{ marginTop: 18, fontSize: 160, fontWeight: 900, color: C.text, letterSpacing: "0.06em", textShadow: `0 0 70px ${C.cyan}55`, transform: `scale(${0.94 + 0.06 * logo})` }}>つまずきマップ</div>
          <div style={{ marginTop: 18, fontSize: 52, fontWeight: 800, color: C.text }}>
            撮るだけで、<span style={{ color: C.gold }}>何を復習すればいいか</span>がわかる。
          </div>
          <div style={{ marginTop: 60, fontSize: 28, fontWeight: 700, color: C.muted, letterSpacing: "0.14em" }}>ナゼホリ数学 ・ Beyond Culture</div>
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 26, fontFamily: FONT, fontSize: 20, color: "rgba(200,210,230,0.6)" }}>VOICEVOX:No.7</div>
      </AbsoluteFill>
      <Sfx at={4} src="pop" volume={0.3} />
      <Sfx at={s(1.4)} src="pop" volume={0.3} />
      <Sfx at={end + 2} src="hit" volume={0.5} />
      <Sfx at={end + 20} src="chime" volume={0.3} />
    </Fade>
  );
}
