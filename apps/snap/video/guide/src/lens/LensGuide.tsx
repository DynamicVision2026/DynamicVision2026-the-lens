import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, Screen, Sfx, clamp, ease, useIn, usePop } from "../v2/kit";
import { AgeBars, Chip, Clock, EndCard, FreezeFig, HAND, LensRing, MirrorFig, P, PaperBg, Scribble, Sheet } from "./kit";
import timeline from "./timeline.json";

/** 視点レンズ guide video (16:9, ~4 min): pain → what the course is → 3 examples → the 4 steps → measure → offer. */
type Line = { id: string; text: string; from: number; dur: number };
type Scene = { id: string; from: number; dur: number; lines: Line[] };
export const LENS_TL = timeline as { fps: number; total: number; scenes: Scene[] };
const L = (sc: Scene, i: number) => sc.lines[i].from - sc.from;
const s = (sec: number) => Math.round(sec * 30);

function Fade({ dur, children }: { dur: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, 10, dur - 10, dur], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
}
const Kick = ({ children, color = P.red }: { children: React.ReactNode; color?: string }) => (
  <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 900, color, letterSpacing: "0.22em" }}>{children}</div>
);
const Big = ({ children, size = 76, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, color: P.ink, lineHeight: 1.25, ...style }}>{children}</div>
);

// ---------------------------------------------------------------- scenes

function Hook({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const shake = f > L(sc, 1) ? Math.sin(f / 2.2) * 1.5 : 0;
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <Sheet head="算数　入試演習　第3問" text="いま、お父さんは38才、子どもは8才です。お父さんの年れいが子どもの年れいの3倍になるのは何年後ですか。" size={44} style={{ left: 300, top: 120, width: 1100, height: 720, transform: `rotate(-1.5deg) translateX(${shake}px)` }}>
        <div style={{ marginTop: 40, height: 260, border: `3px dashed ${P.line}`, borderRadius: 8 }} />
      </Sheet>
      <Clock from={0} startSec={179} rate={6} size={210} style={{ right: 170, top: 90 }} />
      <div style={{ position: "absolute", left: 1040, top: 640, width: 260, height: 28, background: `linear-gradient(90deg, #f2c14e 82%, #e9a5a0 82%)`, borderRadius: 4, transform: `rotate(-32deg) translateY(${Math.sin(f / 7) * 3}px)` }} />
      {Array.from({ length: Math.floor(sc.dur / 30) }).map((_, i) => <Sfx key={i} at={i * 30 + 4} src="tick" volume={0.18} />)}
    </Fade>
  );
}

function Thesis({ sc }: { sc: Scene }) {
  const a = useIn(L(sc, 0), 16);
  const b = useIn(L(sc, 1), 18);
  const f = useCurrentFrame();
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 160, top: 230, opacity: a * (1 - b) }}>
        <Kick>時間を失うのは</Kick>
        <Big size={96} style={{ marginTop: 20 }}>
          計算ではなく、<br />
          <span style={{ color: P.red }}>最初の一歩。</span>
        </Big>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 260, textAlign: "center", opacity: b }}>
        <div style={{ width: 170, height: 170, margin: "0 auto", borderRadius: "50%", border: `14px solid ${P.gold}`, boxShadow: `0 0 ${50 + 15 * Math.sin(f / 8)}px rgba(227,165,28,0.6)`, background: P.goldSoft }} />
        <Big size={130} style={{ marginTop: 30, letterSpacing: "0.06em" }}>視点レンズ</Big>
        <div style={{ marginTop: 14, fontFamily: FONT, fontSize: 46, fontWeight: 800, color: P.muted }}>最初の一歩を、練習するコース。</div>
      </div>
      <Sfx at={L(sc, 1)} src="chime" volume={0.3} />
    </Fade>
  );
}

const LENSES = ["囲む", "等積変形", "展開", "止める", "てんびん", "面積図", "折り返す", "和差一定"];
function Lenses({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const per = Math.round((sc.lines[0].dur * 0.7) / 8);
  const t0 = L(sc, 0) + Math.round(sc.lines[0].dur * 0.28);
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 160, top: 130 }}>
        <Kick color={P.goldInk}>8つのレンズ</Kick>
        <Big style={{ marginTop: 16 }}>問題の「見方」を変える道具。</Big>
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, top: 420, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 34 }}>
        {LENSES.map((n, i) => {
          const p = usePop(t0 + i * per, 12);
          const on = f >= t0 + i * per && f < t0 + (i + 1) * per + 6;
          return (
            <div key={n} style={{ transform: `scale(${Math.min(1, p)})`, opacity: Math.min(1, p), textAlign: "center" }}>
              <Chip on={on} style={{ fontSize: 46, padding: "16px 0", width: "100%" }}>{n}</Chip>
            </div>
          );
        })}
      </div>
      {LENSES.map((_, i) => <Sfx key={i} at={t0 + i * per} src="pop" volume={0.22} />)}
    </Fade>
  );
}

/** Shared layout for an example: problem on the left, trap scribble then the lens on the right. */
function Example({ sc, tag, head, text, trap, trapNote, lens, children }: { sc: Scene; tag: string; head: string; text: string; trap: string[]; trapNote: string; lens: string; children: (t: { lensAt: number }) => ReactElement }) {
  const f = useCurrentFrame();
  const trapAt = L(sc, 1);
  const lensAt = L(sc, 2);
  const trapO = interpolate(f, [trapAt - 4, trapAt + 8, lensAt - 8, lensAt + 4], [0, 1, 1, 0], clamp);
  const lensO = useIn(lensAt - 4, 12);
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 90, top: 70 }}>
        <Chip style={{ fontSize: 32, background: P.ink, color: "#fff", borderColor: P.ink }}>{tag}</Chip>
      </div>
      <Sheet head={head} text={text} size={34} style={{ left: 90, top: 150, width: 700, transform: "rotate(-1deg)" }} />
      <div style={{ position: "absolute", left: 980, top: 330, opacity: interpolate(f, [8, 20, trapAt - 8, trapAt], [0, 1, 1, 0], clamp), fontFamily: FONT, fontWeight: 900, fontSize: 84, color: P.ink }}>
        どこから
        <br />
        解く？
      </div>
      <div style={{ position: "absolute", left: 880, top: 110, width: 960, height: 860, opacity: trapO }}>
        <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 900, color: P.trap }}>くせで やると…</div>
        <Scribble lines={trap} start={trapAt + 6} every={20} size={40} cross={lensAt - 24} style={{ top: 80, left: 0 }} />
        <div style={{ position: "absolute", left: 0, top: 700, fontFamily: FONT, fontSize: 36, fontWeight: 900, color: P.red }}>{trapNote}</div>
        <Clock from={trapAt} startSec={180} rate={8} size={150} style={{ right: 0, top: 0 }} />
      </div>
      {f >= lensAt - 4 && (
        <div style={{ position: "absolute", left: 880, top: 110, width: 960, opacity: lensO }}>
          <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 900, color: P.goldInk }}>{lens}で 見ると</div>
          <div style={{ marginTop: 30 }}>{children({ lensAt })}</div>
        </div>
      )}
      <Sfx at={trapAt} src="tick" volume={0.25} />
      <Sfx at={lensAt} src="chime" volume={0.32} />
    </Fade>
  );
}

function Ex1({ sc }: { sc: Scene }) {
  const lensAt = L(sc, 2);
  return (
    <Example sc={sc} tag="例1 ｜ 中学受験" head="算数" text="いま、お父さんは38才、子どもは8才です。お父さんの年れいが子どもの年れいの3倍になるのは何年後ですか。"
      trap={["1年後 39才・9才 → ×", "2年後 40才・10才 → ×", "3年後 41才・11才 → ×", "4年後 42才・12才 → ×", "5年後 43才・13才 → ×", "6年後 …"]} trapNote="表が、終わらない（目安 約2分半）" lens="和差一定レンズ">
      {() => <AgeBars start={lensAt} grow={lensAt + Math.round(sc.lines[2].dur * 0.35)} done={lensAt + Math.round(sc.lines[2].dur * 0.8)} w={640} />}
    </Example>
  );
}

function Ex2({ sc }: { sc: Scene }) {
  const lensAt = L(sc, 2);
  const d = sc.lines[2].dur;
  return (
    <Example sc={sc} tag="例2 ｜ 高校受験" head="数学" text="2点A(−2, 3)、B(6, 5)があります。x軸上に点Pをとり、AP＋PBがもっとも短くなるとき、△ABPの面積を求めなさい。"
      trap={["P(p, 0) とおく", "AP＋PB ＝ √((p+2)²+9) ＋ √((p−6)²+25)", "これを最小に…？", "微分？ 平方完成？"]} trapNote="ルートが2つ。面積まで届かない（目安 約4分）" lens="折り返す → 囲むレンズ">
      {() => (
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
          <MirrorFig start={lensAt} reflect={lensAt + 10} joinAt={lensAt + Math.round(d * 0.3)} enclose={lensAt + Math.round(d * 0.7)} size={560} />
          <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: P.ink, lineHeight: 1.7, marginTop: 40 }}>
            Bを折り返して B′(6, −5)
            <br />
            A と B′ をまっすぐ → P(1, 0)
            <br />
            囲んで引く → <b style={{ color: P.goldInk }}>15cm²</b>
          </div>
        </div>
      )}
    </Example>
  );
}

function Ex3({ sc }: { sc: Scene }) {
  const lensAt = L(sc, 2);
  const d = sc.lines[2].dur;
  const f = useCurrentFrame();
  const eq = interpolate(f, [lensAt + 10, lensAt + 26], [0, 1], clamp);
  return (
    <Example sc={sc} tag="例3 ｜ 大学受験" head="数学II" text="直線 (a＋1)x＋(a−1)y−2a＝0 は、定数aの値にかかわらず定点を通る。その定点の座標を求めよ。"
      trap={["a＝0 のとき x − y ＝ 0", "a＝1 のとき 2x − 2 ＝ 0", "交点 (1, 1) …？", "本当に すべての a で？ もう一度…"]} trapNote="代入しては確かめる（目安 約2分半）" lens="止めるレンズ">
      {() => (
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
          <FreezeFig start={lensAt} spin={lensAt + 4} lock={lensAt + Math.round(d * 0.75)} size={520} />
          <div style={{ fontFamily: FONT, fontSize: 36, fontWeight: 800, color: P.ink, lineHeight: 1.8, marginTop: 30, opacity: eq }}>
            aについて整理
            <br />
            <span style={{ color: P.goldInk }}>a</span>(x＋y−2)＋(x−y)＝0
            <br />
            x＋y−2＝0, x−y＝0
            <br />→ <b style={{ color: P.goldInk }}>(1, 1)</b>
          </div>
        </div>
      )}
    </Example>
  );
}

const STEPS: [string, string, string][] = [
  ["マスタークラス", "約6分・声つき", "使えない場面まで"],
  ["手で動かす", "ずらす・回す・折る", "立体も指で回せる"],
  ["自分で解く", "約5問", "わな・レンズなしも"],
  ["速さを測る", "選ぶまでの時間", "保護者が見られる"],
];
function Steps({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const active = [1, 2, 3, 4].filter((i) => f >= L(sc, i) - 6).length - 1;
  const mid = L(sc, 2) + Math.round(sc.lines[2].dur * 0.55);
  // each recording starts playing when it appears (clip seconds a → b laid on scene frames from → to)
  const CL: [string, number, number, number][] = [
    ["lens_master_constant", L(sc, 1) - 10, L(sc, 2) - 6, 16.5],
    ["lens_discover_mirror", L(sc, 2) - 6, mid, 21.5],
    ["lens_3d_unfold", mid, L(sc, 3) - 6, 17],
    ["lens_practice", L(sc, 3) - 6, L(sc, 4) - 6, 24.5],
    ["lens_timed", L(sc, 4) - 6, sc.dur + 12, 14.5],
  ];
  const cur = CL.find(([, a0, b0]) => f >= a0 && f < b0) ?? CL[CL.length - 1];
  const clip = cur[0];
  const startOf = (k: number) => L(sc, Math.min(4, k + 1));
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 90, top: 70 }}>
        <Kick color={P.goldInk}>1つのレンズ ＝ 4ステップ</Kick>
      </div>
      <div style={{ position: "absolute", left: 90, top: 150, width: 560, display: "grid", gap: 22 }}>
        {STEPS.map(([a, b, c], i) => {
          const on = i === active;
          const p = usePop(i === 0 ? 4 : startOf(i), 12);
          return (
            <div key={a} style={{ display: "flex", gap: 22, alignItems: "center", padding: "20px 26px", borderRadius: 18, background: on ? P.goldSoft : P.sheet, border: `4px solid ${on ? P.gold : P.line}`, opacity: Math.min(1, p), transform: `translateX(${(1 - Math.min(1, p)) * -40}px)`, fontFamily: FONT }}>
              <span style={{ fontSize: 64, fontWeight: 900, color: on ? P.goldInk : P.trap, width: 50 }}>{i + 1}</span>
              <span>
                <div style={{ fontSize: 40, fontWeight: 900, color: P.ink }}>{a}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: P.muted }}>{b}・{c}</div>
              </span>
            </div>
          );
        })}
      </div>
      {f >= L(sc, 1) - 10 && (
        <Screen key={clip} clip={clip} segs={[{ from: cur[1], to: cur[2], a: 0.3, b: cur[3] }]} width={1100} style={{ left: 720, top: 150 }} glow="rgba(227,165,28,0.25)" />
      )}
    </Fade>
  );
}

function Finish({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const second = f >= L(sc, 1) - 6;
  const third = f >= L(sc, 1) + Math.round(sc.lines[1].dur * 0.45);
  const planO = interpolate(f, [L(sc, 1) - 6, L(sc, 1) + 8, L(sc, 1) + Math.round(sc.lines[1].dur * 0.45) - 6, L(sc, 1) + Math.round(sc.lines[1].dur * 0.45) + 4], [0, 1, 1, 0], clamp);
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 90, top: 110, width: 560 }}>
        <Kick color={second ? P.goldInk : P.red}>{second ? "4週間の計画 ・ 保護者レポート" : "仕上げ"}</Kick>
        <Big size={60} style={{ marginTop: 18 }}>
          {second ? (
            <>
              1日15〜20分。
              <br />
              変化は、<span style={{ color: P.goldInk }}>数字</span>で。
            </>
          ) : (
            <>
              単元ばらばら、
              <br />
              ヒントなしの
              <br />
              「どのレンズ？」
            </>
          )}
        </Big>
        {third && <div style={{ marginTop: 30, fontFamily: FONT, fontSize: 24, color: P.muted }}>画面の数字は例です。点数の約束ではありません。</div>}
      </div>
      {!second && <Screen key="drill" clip="lens_drill" segs={[{ from: 0, to: L(sc, 1), a: 0.3, b: 15.5 }]} width={1100} style={{ left: 720, top: 150 }} glow="rgba(227,165,28,0.25)" />}
      {third && <Screen key="report" clip="lens_report" segs={[{ from: L(sc, 1) + Math.round(sc.lines[1].dur * 0.45), to: sc.dur + 12, a: 0.3, b: 10.5 }]} width={1100} style={{ left: 720, top: 150 }} glow="rgba(227,165,28,0.25)" />}
      {planO > 0 && <Img src={staticFile("lens/plan-1.png")} style={{ position: "absolute", left: 700, top: 130, width: 1150, borderRadius: 10, boxShadow: "0 30px 70px rgba(31,42,68,0.25)", opacity: planO, transform: `rotate(1deg) scale(${0.96 + 0.04 * planO})` }} />}
    </Fade>
  );
}

function Benefits({ sc }: { sc: Scene }) {
  const items: [string, string][] = [
    ["最初に止まる時間が減る", "見る場所がわかる"],
    ["使いまちがいを防ぐ", "使えない場面を知っている"],
    ["初めての問題にも使える", "暗記ではなく道具"],
    ["浮いた時間は見直しへ", "次の1問にも手が届く"],
  ];
  const per = Math.round(sc.lines[0].dur / 4.4);
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 160, right: 160, top: 170, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34 }}>
        {items.map(([a, b], i) => {
          const p = usePop(L(sc, 0) + i * per, 12);
          return (
            <div key={a} style={{ padding: "40px 44px", borderRadius: 22, background: P.sheet, border: `4px solid ${P.gold}`, boxShadow: "0 18px 40px rgba(31,42,68,0.1)", opacity: Math.min(1, p), transform: `scale(${0.9 + 0.1 * Math.min(1, p)})`, fontFamily: FONT }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: P.ink }}>{a}</div>
              <div style={{ marginTop: 10, fontSize: 32, fontWeight: 700, color: P.muted }}>{b}</div>
            </div>
          );
        })}
      </div>
    </Fade>
  );
}

function Offer({ sc }: { sc: Scene }) {
  const f = useCurrentFrame();
  const free = f >= L(sc, 1) - 6;
  const pa = useIn(L(sc, 0), 16);
  const fo = useIn(L(sc, 1) - 6, 14);
  return (
    <Fade dur={sc.dur + 12}>
      <PaperBg />
      <div style={{ position: "absolute", left: 120, right: 120, top: 110, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30, opacity: pa * (free ? 0.35 : 1) }}>
        {["中学受験", "高校受験", "大学受験"].map((n) => (
          <div key={n} style={{ padding: "36px 30px", borderRadius: 22, background: P.sheet, border: `4px solid ${P.ink}`, textAlign: "center", fontFamily: FONT }}>
            <div style={{ fontSize: 50, fontWeight: 900, color: P.ink }}>{n}</div>
            <div style={{ marginTop: 14, fontSize: 70, fontWeight: 900, color: P.ink }}>¥6,800</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: P.muted }}>税込・買い切り</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 120, right: 120, top: 470, display: "flex", gap: 24, justifyContent: "center", opacity: pa * (free ? 0.35 : 1) }}>
        <Chip on style={{ fontSize: 32 }}>つまずきマップ 1年分つき</Chip>
        <Chip style={{ fontSize: 32 }}>Amazonの問題集 → QRでマスタークラス</Chip>
      </div>
      {free && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 600, display: "flex", gap: 40, justifyContent: "center", opacity: fo }}>
          {["8問の無料チェック", "3日間の無料体験"].map((t) => (
            <div key={t} style={{ padding: "30px 54px", borderRadius: 999, background: P.gold, fontFamily: FONT, fontSize: 52, fontWeight: 900, color: P.navy, boxShadow: "0 16px 40px rgba(227,165,28,0.4)" }}>{t}</div>
          ))}
        </div>
      )}
    </Fade>
  );
}

function End({ sc }: { sc: Scene }) {
  return (
    <Fade dur={sc.dur + 12}>
      <EndCard line="点数は約束しません。時間は、測ってお見せします。" />
    </Fade>
  );
}

const VIEW: Record<string, (p: { sc: Scene }) => ReactElement> = { hook: Hook, thesis: Thesis, lenses: Lenses, ex1: Ex1, ex2: Ex2, ex3: Ex3, steps: Steps, finish: Finish, benefits: Benefits, offer: Offer, end: End };

function Subtitle({ line, dark }: { line: Line; dark: boolean }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 5, line.dur + 3, line.dur + 10], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 36, opacity: o }}>
      <div style={{ maxWidth: 1640, padding: "12px 30px", borderRadius: 14, background: dark ? "rgba(255,255,255,0.12)" : "rgba(31,42,68,0.88)", fontFamily: FONT, fontSize: 36, fontWeight: 700, color: "#fff", textAlign: "center", lineHeight: 1.45 }}>{line.text}</div>
    </AbsoluteFill>
  );
}

export function LensGuide() {
  const lines = LENS_TL.scenes.flatMap((sc) => sc.lines.map((l) => ({ ...l, dark: sc.id === "end" })));
  const duck = (fr: number) => (lines.some((l) => fr >= l.from - 8 && fr <= l.from + l.dur + 6) ? 0.22 : 0.5);
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      {LENS_TL.scenes.map((sc) => {
        const V = VIEW[sc.id];
        return (
          <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur + 12} name={sc.id}>
            <V sc={sc} />
          </Sequence>
        );
      })}
      {LENS_TL.scenes.slice(1).map((sc) => <Sfx key={`w${sc.id}`} at={sc.from - 4} src="whoosh" volume={0.18} />)}
      {lines.map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 12} name={`voice ${l.id}`}>
          <Audio src={staticFile(`lens/${l.id}.wav`)} />
          <Subtitle line={l} dark={l.dark} />
        </Sequence>
      ))}
      <Audio src={staticFile("lens/music.wav")} volume={(fr) => duck(fr)} />
    </AbsoluteFill>
  );
}
export const LENS_GUIDE_TOTAL = LENS_TL.total;
// keep HAND referenced for the handwriting font load
export const _hand = HAND;
export const _ease = ease;
