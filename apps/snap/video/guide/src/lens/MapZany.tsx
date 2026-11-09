import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, Sfx, clamp, ease } from "../v2/kit";
import { EndCard, P } from "./kit";
import { Backdrop, Caption, type Cue, E, EMOJI, Ribbon, Shake, Stamp, draw, plan, pop } from "./ZanyShort";

/**
 * つまずきマップ absurd-comedy Shorts (1080×1920, ~90 s), one per school level. The night before a test, the
 * family's plan is "redo everything" and it escalates into nonsense; then one photo, the map finds the real root
 * (the root units are the ones the app links: 小5 平均 ← 小4 式の計算 (exam-plan root), 中2 連立方程式 ← 中1 一次方程式,
 * 数学I 二次関数 ← 中3 y=ax²), tonight's plan fits on one sheet; then the real app (cut from the guide video),
 * the honesty line, the free 30 photos, end card. No price, no score promise.
 */
export type MapZanyProps = { level: "e" | "j" | "h" };

const TAIL: [string, number][] = [["mp1", 1.0], ["mp2", 0.4], ["mp3", 0.6], ["mr1", 0.6], ["mp4", 0.6], ["mend", 0.8]];
const SEQ: Record<MapZanyProps["level"], [string, number][]> = {
  e: [["m101", 0.4], ["m102", 0.4], ["m103", 0.3], ["m104", 0.3], ["m105", 0.3], ["m106", 0.3], ["m107", 0.3], ["m108", 0.9], ["m109", 0.6], ["m110", 0.6], ["m111", 0.6], ...TAIL],
  j: [["m201", 0.4], ["m202", 0.4], ["m203", 0.3], ["m204", 0.3], ["m205", 0.3], ["m206", 0.3], ["m207", 0.9], ["m208", 0.6], ["m110", 0.6], ["m210", 0.6], ...TAIL],
  h: [["m301", 0.4], ["m302", 0.4], ["m303", 0.3], ["m304", 0.3], ["m305", 0.3], ["m306", 0.3], ["m307", 0.9], ["m308", 0.6], ["m110", 0.6], ["m310", 0.6], ...TAIL],
};
const s = (sec: number) => Math.round(sec * 30);
const END_CARD = s(3.4);
export const mapZanyFrames = (p: MapZanyProps) => plan(SEQ[p.level]).end + s(1.2) + END_CARD;

const LEVEL = {
  e: { tag: "小学生", subject: "算数", range: "平均", wrong: "小5 平均", root: "小4 式の計算", snap: "m108", rootLine: "m109", ribbon: "テスト前夜 全部やり直し作戦 継続中" },
  j: { tag: "中学生", subject: "数学", range: "連立方程式", wrong: "中2 連立方程式", root: "中1 一次方程式", snap: "m207", rootLine: "m208", ribbon: "問題集10冊 いまだ1冊目" },
  h: { tag: "高校生", subject: "数学I", range: "二次関数", wrong: "数学I 二次関数", root: "中3 y＝ax²", snap: "m307", rootLine: "m308", ribbon: "放物線 増殖中 専門家も困惑" },
};

function TestCard({ at, lv }: { at: number; lv: (typeof LEVEL)["e"] }) {
  const f = useCurrentFrame();
  const p = pop(f, at);
  return (
    <div style={{ position: "absolute", left: 140, top: 300, width: 800, background: "#fff", borderRadius: 18, border: `6px solid ${P.ink}`, padding: "30px 40px", transform: `rotate(-3deg) scale(${p})`, fontFamily: FONT, fontWeight: 900, color: P.ink, boxShadow: "0 14px 30px rgba(0,0,0,0.2)" }}>
      <div style={{ fontSize: 40, color: P.red }}>明日　{lv.subject}のテスト</div>
      <div style={{ fontSize: 72, marginTop: 10 }}>範囲：{lv.range}</div>
    </div>
  );
}

/** the calm part: one photo → the root → tonight's plan (an illustration of the app's output, marked 例) */
function Found({ c, lv, freeze }: { c: Record<string, Cue>; lv: (typeof LEVEL)["e"]; freeze: number }) {
  const f = useCurrentFrame();
  const snapAt = freeze + s(1.0);
  const flash = interpolate(f, [snapAt, snapAt + 2, snapAt + 10], [0, 1, 0], clamp);
  const r = c[lv.rootLine].from;
  const node = (y: number, text: string, color: string, at: number, glow = false) => (
    <div style={{ position: "absolute", left: 140, width: 800, top: y, textAlign: "center", opacity: draw(f, at, 12), transform: `scale(${0.9 + 0.1 * draw(f, at, 12)})` }}>
      <div style={{ display: "inline-block", background: "#fff", border: `8px solid ${color}`, borderRadius: 24, padding: "18px 44px", fontFamily: FONT, fontWeight: 900, fontSize: 64, color: P.ink, boxShadow: glow ? "0 0 50px rgba(227,165,28,0.7)" : "none" }}>{text}</div>
    </div>
  );
  const planAt = c.m110.from;
  const rows: [string, string, string, string][] = [["①", "まず解き直す", lv.wrong, "2問・10分"], ["②", "つまずきのもと", lv.root, "1問・5分"], ["③", "念のため", "確認", "1問・5分"]];
  return (
    <AbsoluteFill>
      {f < planAt && (
        <>
          {f < r && <E c="📱" x={540} y={560} size={360} at={freeze + 8} />}
          {f >= snapAt && f < r && <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 60, color: P.ink }}>パシャ。</div>}
          {f >= r && (
            <>
              {node(380, `${lv.wrong}　✕`, P.red, r)}
              <div style={{ position: "absolute", left: 528, top: 520, width: 24, height: draw(f, r + s(1.2), 16) * 200, background: P.gold, borderRadius: 12 }} />
              {node(740, `${lv.root}（もと）`, P.gold, r + s(2.2), true)}
            </>
          )}
        </>
      )}
      {f >= planAt && (
        <div style={{ position: "absolute", left: 80, top: 260, width: 920, background: "#fff", borderRadius: 24, border: `6px solid ${P.ink}`, padding: "34px 40px", opacity: draw(f, planAt, 12), fontFamily: FONT, color: P.ink }}>
          <div style={{ fontWeight: 900, fontSize: 56 }}>今夜の作戦 <span style={{ fontSize: 34, color: P.muted }}>（例）</span></div>
          {rows.map(([n, h, u, t], i) => (
            <div key={n} style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 20, opacity: draw(f, planAt + s(0.4 + i * 0.5), 10), borderLeft: `12px solid ${i === 1 ? P.gold : i === 0 ? P.red : P.line}`, paddingLeft: 20 }}>
              <span style={{ fontWeight: 900, fontSize: 52 }}>{n}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 40 }}>{h}</div>
                <div style={{ fontWeight: 700, fontSize: 34, color: P.muted }}>{u}</div>
              </div>
              <span style={{ fontWeight: 900, fontSize: 38 }}>{t}</span>
            </div>
          ))}
        </div>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
}

function ChaosE({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const stack = f >= c.m105.from ? Math.min(1200, (f - c.m105.from) * 40) : 0;
  return (
    <>
      <TestCard at={c.m101.from} lv={LEVEL.e} />
      <E c="👩" x={250} y={900} size={220} at={c.m102.from} anim={f >= c.m105.from ? "shake" : "bounce"} />
      <E c="📚" x={720} y={900} size={300} at={c.m102.from + 6} anim="shake" />
      {f >= c.m103.from && f < c.m104.from && <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 200, color: P.ink }}>1＋1＝2</div>}
      <E c="👴" x={850} y={650} size={240} at={c.m104.from} anim="bounce" />
      <E c="📣" x={700} y={560} size={150} at={c.m104.from + 8} anim="shake" />
      {stack > 0 && <div style={{ position: "absolute", left: 420, width: 240, bottom: 640, height: stack, background: "repeating-linear-gradient(0deg, #fff 0 18px, #dfe3ec 18px 22px)", border: `4px solid ${P.ink}`, transform: `rotate(${Math.sin(f / 4) * 2}deg)` }} />}
      <E c="🐕" x={300} y={1150} size={230} at={c.m106.from} anim="bounce" />
      {f >= c.m106.from && <div style={{ position: "absolute", left: 420, top: 1000, background: "#fff", border: `6px solid ${P.ink}`, borderRadius: 40, padding: "10px 30px", fontFamily: FONT, fontWeight: 900, fontSize: 64, transform: `scale(${pop(f, c.m106.from + 8)})` }}>9×9＝81</div>}
      <E c="☀️" x={800} y={300} size={260} at={c.m107.from} anim="shake" />
      <E c="🙅" x={560} y={420} size={220} at={c.m107.from + 8} anim="shake" />
      <Stamp text="全部やり直す" at={c.m102.from + 10} x={120} y={200} rot={-6} size={84} />
      <Stamp text="午後8時" at={c.m103.from} x={80} y={1050} rot={5} size={90} color="#1971c2" />
      <Stamp text="午後10時" at={c.m104.from} x={90} y={300} rot={-5} size={90} color="#1971c2" />
      <Stamp text="午前0時" at={c.m105.from} x={600} y={240} rot={6} size={90} color="#1971c2" />
      <Stamp text="午前2時" at={c.m106.from} x={80} y={760} rot={-7} size={90} color="#1971c2" />
      <Stamp text="朝、来ない" at={c.m107.from + 6} x={140} y={620} rot={4} size={110} />
    </>
  );
}

function ChaosJ({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const books = f >= c.m202.from ? Math.min(10, Math.floor((f - c.m202.from) / 4) + 1) : 0;
  return (
    <>
      <TestCard at={c.m201.from} lv={LEVEL.j} />
      <E c="🧑‍🎓" x={220} y={1000} size={230} at={c.m202.from} anim={f >= c.m203.from ? "shake" : "bounce"} />
      {Array.from({ length: books }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: 470 + Math.sin(i * 1.7) * 20, top: 1080 - i * 62 - (f >= c.m203.from ? (f - c.m203.from) * 0.8 * i : 0), width: 360, height: 56, background: ["#e03131", "#1971c2", "#2f9e44", "#f08c00", "#7048e8"][i % 5], border: `4px solid ${P.ink}`, borderRadius: 6, transform: `rotate(${Math.sin(i + f / 9) * 4}deg)`, color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 30, textAlign: "center", lineHeight: "48px" }}>問題集 {i + 1}</div>
      ))}
      {f >= c.m204.from && <E c="🔍" x={800} y={700} size={220} at={c.m204.from} anim="shake" />}
      {f >= c.m205.from && <E c="🏠" x={300 + (f - c.m205.from) * 10} y={560} size={300} at={c.m205.from} anim="bounce" />}
      {f >= c.m205.from && <E c="🏛️" x={900} y={500} size={260} at={c.m205.from + 6} />}
      {f >= c.m206.from && Array.from({ length: 12 }, (_, i) => <E key={i} c="📕" x={100 + ((i * 260) % 900)} y={200 + Math.floor(i / 4) * 300} size={150} at={c.m206.from + i * 3} anim="spin" />)}
      <Stamp text="10冊" at={c.m202.from + 20} x={640} y={260} rot={8} size={120} />
      <Stamp text="午後9時" at={c.m203.from} x={80} y={300} rot={-5} size={90} color="#1971c2" />
      <Stamp text="消しゴム全滅" at={c.m204.from} x={100} y={640} rot={6} size={90} />
      <Stamp text="可決" at={c.m205.from + 30} x={560} y={760} rot={-10} size={140} />
      <Stamp text="自己出版" at={c.m206.from + 10} x={160} y={900} rot={5} size={110} color="#7048e8" />
    </>
  );
}

function ChaosH({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const n = f < c.m303.from ? 0 : f < c.m304.from ? Math.min(100, Math.floor((f - c.m303.from) * 1.2)) : 100;
  const spill = f >= c.m304.from ? Math.min(3, 1 + (f - c.m304.from) / 40) : 1;
  return (
    <>
      <TestCard at={c.m301.from} lv={LEVEL.h} />
      <E c="👩‍🎓" x={220} y={1050} size={230} at={c.m302.from} anim={f >= c.m304.from ? "shake" : "bounce"} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, transform: `scale(${spill})`, transformOrigin: "50% 45%" }}>
        {Array.from({ length: n }, (_, i) => {
          const a = 0.002 + (i % 17) * 0.0011, cx = 540 + ((i * 37) % 300) - 150, cy = 300 + ((i * 53) % 500);
          const d = Array.from({ length: 21 }, (_, k) => { const x = -300 + k * 30; return `${k ? "L" : "M"}${cx + x},${cy + a * x * x}`; }).join(" ");
          return <path key={i} d={d} fill="none" stroke={["#e03131", "#1971c2", "#2f9e44", "#f08c00", "#7048e8"][i % 5]} strokeWidth={5} opacity={0.8} />;
        })}
      </svg>
      {f >= c.m305.from && (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <path d="M -40 1000 Q 540 380 1120 1000" fill="none" stroke={P.ink} strokeWidth={22} />
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={100 + i * 110} y1={1000} x2={100 + i * 110} y2={1000 - (1 - Math.pow((100 + i * 110 - 540) / 580, 2)) * 310} stroke={P.ink} strokeWidth={8} />)}
        </svg>
      )}
      {f >= c.m306.from && <div style={{ position: "absolute", left: Math.min(460, -200 + (f - c.m306.from) * 14), top: 470 + Math.abs(Math.sin((f - c.m306.from) / 4)) * -30, fontSize: 220, fontFamily: EMOJI }}>🦙</div>}
      <Stamp text="手描き" at={c.m302.from + 12} x={600} y={220} rot={7} size={100} />
      <Stamp text="午後10時　100本" at={c.m303.from} x={60} y={260} rot={-5} size={84} color="#1971c2" />
      <Stamp text="午前0時" at={c.m304.from} x={600} y={720} rot={6} size={90} color="#1971c2" />
      <Stamp text="放物線の橋" at={c.m305.from} x={100} y={1120} rot={-6} size={96} />
      <Stamp text="来客" at={c.m306.from + 20} x={640} y={300} rot={8} size={130} color="#7048e8" />
    </>
  );
}

function Product({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const a = c.mp1.from, x3 = c.mp3.from, r1 = c.mr1.from, d4 = c.mp4.from;
  const box = (at: number) => interpolate(f, [at, at + 10], [0, 1], { ...clamp, easing: ease });
  const vid = (src: string, from: number, to: number, w: number, h: number, left: number) =>
    f >= from && f < to ? (
      <Sequence from={from} durationInFrames={to - from} layout="none">
        <div style={{ position: "absolute", left, top: 290, width: w, height: h, borderRadius: 26, overflow: "hidden", boxShadow: "0 20px 50px rgba(31,42,68,0.3)", border: `4px solid ${P.ink}` }}>
          <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </Sequence>
    ) : null;
  return (
    <AbsoluteFill style={{ background: P.paper, opacity: box(a) }}>
      <div style={{ position: "absolute", left: 50, top: 150, fontFamily: FONT, fontWeight: 900, fontSize: 64, color: P.ink }}>
        <span style={{ fontFamily: EMOJI, marginRight: 12 }}>🗺️</span>つまずきマップ
      </div>
      {vid("map/snap.mp4", a, x3, 580, 740, 250)}
      {vid("map/exam.mp4", x3, r1, 980, 740, 50)}
      {vid("map/roots.mp4", r1, c.mend.from + 6, 980, 740, 50)}
      {f < x3 && <div style={{ position: "absolute", left: 50, width: 980, top: 1060, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 54, color: P.ink, opacity: box(c.mp2.from) }}>撮るだけ → <span style={{ color: P.goldInk }}>単元と○✕を記録</span></div>}
      {f >= x3 && f < r1 && <div style={{ position: "absolute", left: 50, width: 980, top: 1070, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 50, color: P.ink, opacity: box(x3) }}>今夜の作戦：<span style={{ color: P.red }}>①</span>解き直す <span style={{ color: P.goldInk }}>②</span>もと ③確認</div>}
      {f >= r1 && f < d4 && <div style={{ position: "absolute", left: 50, width: 980, top: 1060, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 50, lineHeight: 1.3, color: P.ink, opacity: box(r1) }}>点数は約束しません。<br /><span style={{ color: P.goldInk }}>今夜何をやるかで、迷わなくなる。</span></div>}
      {f >= d4 && (
        <div style={{ position: "absolute", left: 50, width: 980, top: 1070, textAlign: "center", opacity: box(d4) }}>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 56, color: P.ink }}>登録なし・<span style={{ color: P.red }}>30枚まで無料</span></span>
        </div>
      )}
    </AbsoluteFill>
  );
}

export function MapZany({ level }: MapZanyProps) {
  const f = useCurrentFrame();
  const lv = LEVEL[level];
  const { cues, end } = plan(SEQ[level]);
  const list = Object.values(cues);
  const freeze = cues[lv.snap].from;
  const tag = cues.mend;
  const music = (fr: number) => (fr >= freeze && fr < freeze + s(1.2) ? 0 : fr >= freeze ? 0.14 : 0.2) * interpolate(fr, [end + s(1.2) + END_CARD - 30, end + s(1.2) + END_CARD], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: P.paper, overflow: "hidden" }}>
      <Backdrop cues={list} freeze={freeze} />
      {f < freeze && (
        <Shake on={f >= list[3].from}>
          {level === "e" && <ChaosE c={cues} />}
          {level === "j" && <ChaosJ c={cues} />}
          {level === "h" && <ChaosH c={cues} />}
        </Shake>
      )}
      {f >= freeze && f < cues.mp1.from + 12 && <Found c={cues} lv={lv} freeze={freeze} />}
      {f >= cues.mp1.from && <Product c={cues} />}
      <Ribbon text={lv.ribbon} until={freeze - 1} />
      {f >= tag.from && (
        <AbsoluteFill style={{ background: P.navy, opacity: interpolate(f, [tag.from, tag.from + 10], [0, 1], clamp), display: "grid", placeItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, color: "#fff", fontSize: 100, lineHeight: 1.35, marginTop: -200 }}>
            全部より、<br />
            <span style={{ color: P.gold }}>もとを。</span>
          </div>
        </AbsoluteFill>
      )}
      {list.filter((x) => x.id !== "mend").map((cue) => <Caption key={cue.id} cue={cue} />)}
      {list.map((cue) => (
        <Sequence key={cue.id} from={cue.from} durationInFrames={cue.dur + 10}>
          <Audio src={staticFile(`lens/${cue.id}.wav`)} />
        </Sequence>
      ))}
      {list.filter((x) => x.from < freeze && x.id !== list[0].id).map((x) => <Sfx key={`p${x.id}`} at={x.from} src="pop" volume={0.35} />)}
      <Sfx at={freeze} src="hit" volume={0.5} />
      <Sfx at={freeze + s(1.0)} src="chime" volume={0.45} />
      <Sfx at={tag.from} src="whoosh" volume={0.3} />
      <Audio src={staticFile("lens/music_zany.wav")} volume={music} />
      <Sequence from={end + s(1.2)} durationInFrames={END_CARD}>
        <EndCard brand="つまずきマップ" url="tsumazuki.domo-ai.com" line="撮るだけで、何を復習すればいいかわかる。" w={1080} scale={0.72} />
      </Sequence>
    </AbsoluteFill>
  );
}
