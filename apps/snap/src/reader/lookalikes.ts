import { type Unit } from "../curriculum";

/**
 * Look-alike units: groups the reader confuses because the surface words are the same
 * (割合, 面積, 比例, 時間 …). Derived by hand from data/units.json (topic + covers); every id is
 * checked by test/judge-units.test.ts. For a page, a group is shown only when at least two of
 * its units are in the page's unit list, and only those units' parts are printed (an id outside
 * the list is never mentioned, so the model is not tempted to answer with it).
 */
export interface LookAlike {
  /** Optional theme word printed before the parts, e.g. "割合". */
  about?: string;
  /** [unit id, what makes a problem belong to it]. */
  parts: [string, string][];
}

export const LOOKALIKES: LookAlike[] = [
  // 割合の系列
  { about: "割合", parts: [
    ["4-C2", "comparing by how many times (何倍) with whole numbers, no %"],
    ["5-C3", "割合 as a decimal, 百分率 %, 歩合, 比べる量 = もとにする量 × 割合, 〜%引き / 〜%増し"],
    ["6-C2", "比 a:b, 等しい比, 比の値, 比例配分 (分ける) — even when the text says 割合"],
  ] },
  { parts: [
    ["5-C2", "per-unit quantities of two DIFFERENT kinds (速さ, 時速 / 分速, 道のり・時間, 人口密度, こみぐあい, 1Lあたり, 燃費)"],
    ["5-C3", "a ratio of two quantities of the SAME kind (%, 何倍, 定価と代金)"],
  ] },
  { parts: [
    ["5-C2", "速さ・道のり・時間 or 単位量あたり"],
    ["6-C1", "built on y = 決まった数 × x, 比例 / 反比例 tables or graphs"],
  ] },
  // 伴って変わる量・比例・関数
  { parts: [
    ["4-C1", "how two quantities change together, tables and 折れ線グラフ, no proportionality required"],
    ["5-C1", "簡単な比例 (□が2倍・3倍になると○も2倍・3倍)"],
    ["6-C1", "比例の式 y = 決まった数 × x, graphs, 反比例, solving problems with 比例"],
  ] },
  { parts: [
    ["6-C1", "positive numbers only, y = 決まった数 × x"],
    ["j1-C1", "関数, 座標, negative values, y = ax / y = a/x with a sign, 変域"],
  ] },
  { parts: [
    ["j1-C1", "y = ax, y = a/x (through the origin)"],
    ["j2-C1", "一次関数 y = ax + b, 傾き, 切片, 変化の割合, the intersection of two lines"],
    ["j3-C1", "y = ax², parabolas, 変化の割合 of y = ax²"],
  ] },
  { parts: [
    ["j3-C1", "only y = ax²"],
    ["h-I-3", "y = a(x − p)² + q, 頂点, 最大・最小, 二次不等式"],
  ] },
  // 面積・体積・円
  { about: "面積", parts: [
    ["4-B4", "squares and rectangles, area units (cm², m², a, ha, km²) and their conversion"],
    ["5-B3", "triangles, parallelograms, rhombi, trapezoids"],
    ["6-B3", "circles (半径 × 半径 × 3.14) and shapes made of circle parts"],
    ["6-B2", "およその面積 of an irregular shape"],
  ] },
  { about: "円", parts: [
    ["5-B1", "円周 (直径 × 3.14), 円周率"],
    ["6-B3", "the AREA of a circle"],
  ] },
  { about: "体積", parts: [
    ["5-B4", "cubes and cuboids (たて × 横 × 高さ), cm³ / m³ / L"],
    ["6-B4", "prisms and cylinders (底面積 × 高さ)"],
    ["j1-B2", "扇形, 錐体, 球, 表面積"],
  ] },
  { about: "立体", parts: [
    ["4-B2", "立方体・直方体, 見取図, 展開図"],
    ["5-B2", "角柱・円柱: names, faces, edges, 展開図 (not volume)"],
    ["6-B4", "volume of 角柱・円柱"],
  ] },
  // 平面図形
  { parts: [
    ["4-B1", "平行・垂直, 平行四辺形・ひし形・台形 properties"],
    ["5-B1", "合同, 多角形の角の和, 正多角形, 円周"],
  ] },
  { parts: [
    ["5-B1", "合同 and angle sums at 小5 level"],
    ["j2-B1", "平行線と角 (同位角・錯角), 多角形の内角・外角"],
    ["j2-B2", "三角形の合同条件, 証明"],
  ] },
  { parts: [
    ["6-B1", "縮図・拡大図, 線対称・点対称"],
    ["j1-B1", "作図 (垂直二等分線, 角の二等分線), 平行移動・回転移動・対称移動"],
  ] },
  { parts: [
    ["j3-A1", "calculating with √"],
    ["j3-B3", "finding a length in a right triangle (三平方の定理), even when the answer has √"],
  ] },
  // 時刻・量の単位
  { about: "時刻・時間", parts: [
    ["1-C2", "reading a clock"],
    ["2-C2", "日・時・分の関係, simple 何時間 / 何分"],
    ["3-C2", "秒, computing a time or a clock time (何時何分になりますか, across hours)"],
  ] },
  { about: "量の単位", parts: [
    ["2-C1", "mm, cm, m, mL, dL, L"],
    ["3-C1", "km, g, kg, t, choosing scales and instruments"],
  ] },
  // 計算
  { about: "かけ算", parts: [
    ["2-A3", "九九 and simple 2位数 × 1位数"],
    ["3-A3", "筆算 of 2・3位数 × 1・2位数"],
  ] },
  { about: "わり算", parts: [
    ["3-A4", "÷ within 九九, 余り, simple 2-digit quotients (69 ÷ 3)"],
    ["4-A3", "筆算, 2-digit divisors, 被除数 = 除数 × 商 + 余り"],
  ] },
  { about: "小数", parts: [
    ["3-A5", "1/10の位 and simple ±"],
    ["4-A4", "1/100の位, ±, 小数 × 整数, 小数 ÷ 整数"],
    ["5-A3", "× or ÷ BY a decimal (2.4 × 1.5, 6 ÷ 0.4)"],
  ] },
  { about: "分数", parts: [
    ["3-A6", "単位分数, simple same-denominator ± within 1"],
    ["4-A5", "帯分数・仮分数, 大きさの等しい分数, same-denominator ±"],
    ["5-A4", "約分・通分, 分数と小数・わり算の関係"],
    ["5-A5", "DIFFERENT denominators ±"],
    ["6-A1", "分数 × / ÷"],
  ] },
  { about: "式", parts: [
    ["3-A7", "□ in an equation"],
    ["4-A6", "( ) and 四則の順序, □ and △, 公式"],
    ["5-A6", "relations in a table written as a 式"],
    ["6-A2", "letters a, x"],
  ] },
  { parts: [
    ["4-A6", "四則混合の順序, ( )"],
    ["4-A7", "交換・結合・分配法則 used to compute cleverly"],
  ] },
  { about: "文字式", parts: [
    ["6-A2", "x × 6 + 100 style expressions"],
    ["j1-A2", "乗除の表し方, 一次式の加減, 不等式で表す"],
    ["j2-A1", "単項式の乗除, 文字式で説明する, 等式の変形"],
  ] },
  { about: "方程式", parts: [
    ["j1-A3", "one unknown, linear (比例式 included)"],
    ["j2-A2", "two unknowns, 連立"],
    ["j3-A3", "x²"],
  ] },
  { parts: [
    ["j3-A2", "展開・因数分解 of an expression"],
    ["j3-A3", "solving an equation = 0"],
  ] },
  { parts: [
    ["6-A1", "分数の計算 with positive numbers"],
    ["j1-A1", "any calculation with negative numbers"],
  ] },
  // データ・場合の数
  { about: "グラフ", parts: [
    ["2-D1", "simple tables and ○ graphs"],
    ["3-D1", "表に整理, 棒グラフ"],
    ["4-D1", "二つの観点の表, 折れ線グラフ of collected data"],
    ["5-D1", "円グラフ・帯グラフ"],
  ] },
  { parts: [
    ["4-D1", "a 折れ線グラフ of collected data (気温 etc.)"],
    ["4-C1", "a table / graph of two quantities that change together"],
  ] },
  { parts: [
    ["5-D2", "平均 alone"],
    ["6-D1", "代表値 (平均値・中央値・最頻値), ドットプロット, 度数分布表, 柱状グラフ"],
    ["j1-D1", "ヒストグラム, 相対度数, 累積相対度数"],
    ["j2-D1", "四分位数, 箱ひげ図"],
  ] },
  { parts: [
    ["6-D2", "counting 並べ方・組み合わせ with tables or trees"],
    ["j1-D2", "確率 from 相対度数 of many trials"],
    ["j2-D2", "確率 from equally likely cases"],
  ] },
];

export interface LookAlikeLine {
  ids: string[];
  hint: string;
}

/** Groups relevant to a unit list, narrowed to the units in it (at least two). */
export function lookalikesFor(units: Unit[]): LookAlikeLine[] {
  const have = new Set(units.map((u) => u.id));
  const out: LookAlikeLine[] = [];
  for (const g of LOOKALIKES) {
    const parts = g.parts.filter(([id]) => have.has(id));
    if (parts.length < 2) continue;
    const body = parts.map(([id, text]) => `${id} = ${text}`).join("; ");
    out.push({ ids: parts.map(([id]) => id), hint: g.about ? `${g.about}: ${body}` : body });
  }
  return out;
}

/**
 * Units in the list with an identical topic name (e.g. 加法・減法 小1 / 小2) that no look-alike
 * line already separates: the prompt tells the model to decide by the covers.
 */
export function sameNameGroups(units: Unit[]): string[][] {
  const covered = lookalikesFor(units).map((l) => new Set(l.ids));
  const by = new Map<string, string[]>();
  for (const u of units) by.set(u.topic, [...(by.get(u.topic) ?? []), u.id]);
  return [...by.values()].filter((ids) => ids.length >= 2 && !covered.some((c) => ids.every((id) => c.has(id))));
}
