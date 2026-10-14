"""Stage 3 (大学受験パス, ADR-004) figure types: text, exact answer, lens steps, checks and variants.

Each type is exact and auto-checkable like the Stage 1/2 types: the problem sentence and the lens steps are
generated from the figure's numbers, the answer is computed with SymPy, and a type check confirms the lens is
valid (and, for failure cards, that it is not). validate.py dispatches here for every `hs_*` check and for the
figure types in HS_TYPES.

  parabola_area   囲む     area between a parabola and a line / parabola (1/6 formula); failure: bounds x = p, q;
                           no-lens: a line (trapezoid)
  parabola_tri    等積変形  △ABP on y = ax²: P where the tangent ∥ AB (px, max_area), △ABP = △ABO (equal_o);
                           failure: P's range excludes the tangent point; no-lens: △OAB directly
  line_mirror     折り返す  AP+PB on a slanted line ℓ: reflect B (p_x, min_len); failure: max |PA−PB|; no-lens: opposite sides
  param_family    止める    fixed point of a family of lines / parabolas; failure: the a for a given point (substitute)
  cone_unfold     展開     cone side opened into a sector: loop / to_point; failure: sector ≥ 180°; no-lens: side area
  dice_grid       面積図    two dice as a 6×6 table (sum_le, sum_eq, diff_ge, prod_le, prod_mult);
                           failure: three dice; no-lens: independent events (multiply)
  const_sum       差一定    fixed sum: centre ± t (max_product, min_squares, shift); failure: x ≥ x_min past the centre;
                           no-lens: sum and difference both given
"""
from __future__ import annotations

import math
import random
from itertools import product as _prod

from sympy import Integer, Rational, S, Tuple, cos, expand, integrate, pi, sin, sqrt, symbols, sympify, nsimplify, Poly, solve, factor

X = symbols("x")
HS_TYPES = ("parabola_area", "parabola_tri", "line_mirror", "param_family", "cone_unfold", "dice_grid", "const_sum")


# --------------------------------------------------------------- formatting ---

def num(v) -> str:
    """Number for Japanese text: real minus sign, fractions as p/q, roots and π as √ and π."""
    v = nsimplify(S(v))
    if v.is_Rational:
        a = abs(v)
        t = str(a.p) if a.q == 1 else f"{a.p}/{a.q}"
        return ("−" if v < 0 else "") + t
    s = str(v).replace("sqrt", "√").replace("*", "").replace("pi", "π").replace("(", "").replace(")", "")
    return s.replace("-", "−")


def par(v) -> str:
    return f"({num(v)})" if S(v) < 0 else num(v)


def poly(c) -> str:
    """a x² + b x + c as 「x² − 2x − 3」."""
    out = []
    for k, (coef, pw) in enumerate(zip(c, ("x²", "x", ""))):
        coef = S(coef)
        if coef == 0:
            continue
        sign = "−" if coef < 0 else "+"
        a = abs(coef)
        body = (num(a) if (a != 1 or not pw) else "") + pw
        out.append((sign, body))
    if not out:
        return "0"
    s = ("−" if out[0][0] == "−" else "") + out[0][1]
    for sign, body in out[1:]:
        s += f" {sign} {body}"
    return s


def pt(name, p) -> str:
    return f"{name}({num(p[0])}, {num(p[1])})"


def tup(p) -> str:
    return f"({num(p[0])}, {num(p[1])})"


def display(fig, ans, unit=""):
    """Answer text for a card or a variant (variants have no hand-written display_ja)."""
    if isinstance(ans, Tuple) or isinstance(ans, tuple):
        return tup(ans)
    return f"{num(ans)}{unit}"


def _f(c, x):
    return S(c[0]) * x ** 2 + S(c[1]) * x + S(c[2])


# ----------------------------------------------------------- parabola_area ---

def pa_roots(fig):
    """Difference f − g and its real roots, by the quadratic formula (fast and exact)."""
    d = [S(a) - S(b) for a, b in zip(fig["f"], fig.get("g", [0, 0, 0]))]
    a, b, c = d
    if a == 0:
        return d, ([-c / b] if b != 0 else [])
    D = b * b - 4 * a * c
    if D < 0:
        return d, []
    r = sorted({(-b - sqrt(D)) / (2 * a), (-b + sqrt(D)) / (2 * a)}, key=lambda v: float(v))
    return d, r


def _int_poly(c, p, q):
    """Exact ∫[p→q] (c0 x² + c1 x + c2) dx."""
    F = lambda x: S(c[0]) * x ** 3 / 3 + S(c[1]) * x ** 2 / 2 + S(c[2]) * x
    return F(S(q)) - F(S(p))


def pa_answer(fig):
    if "bounds" in fig:
        p, q = fig["bounds"]
        return _int_poly(fig["f"], p, q)
    d, r = pa_roots(fig)
    return abs(S(d[0])) * (r[1] - r[0]) ** 3 / 6


def pa_text(fig):
    f, g = fig["f"], fig.get("g", [0, 0, 0])
    if "bounds" in fig:
        p, q = fig["bounds"]
        curve = "直線" if S(f[0]) == 0 else "放物線"
        return (f"{curve} y = {poly(f)} と x軸、および 2直線 x = {num(p)}、x = {num(q)} で囲まれた部分の面積を求めなさい。")
    if all(S(v) == 0 for v in g):
        return f"放物線 y = {poly(f)} と x軸で囲まれた部分の面積を求めなさい。"
    if S(g[0]) == 0:
        return f"放物線 y = {poly(f)} と直線 y = {poly(g)} で囲まれた部分の面積を求めなさい。"
    return f"2つの放物線 y = {poly(f)} と y = {poly(g)} で囲まれた部分の面積を求めなさい。"


def pa_steps(fig):
    f = fig["f"]
    if "bounds" in fig and S(f[0]) == 0:
        p, q = fig["bounds"]
        yp, yq = _f(f, S(p)), _f(f, S(q))
        a = (yp + yq) * (S(q) - p) / 2
        return [
            {"ja": "直線なので、囲まれた部分は台形。積分はいらない", "op": "note"},
            {"ja": f"x = {num(p)} のとき y = {num(yp)}、x = {num(q)} のとき y = {num(yq)}", "op": "note"},
            {"ja": f"({num(yp)}＋{num(yq)})×{num(S(q) - p)}÷2 = {num(a)}", "value": str(a), "op": "result"},
        ]
    if "bounds" in fig:
        p, q = fig["bounds"]
        F = S(f[0]) * X ** 3 / 3 + S(f[1]) * X ** 2 / 2 + S(f[2]) * X
        Fq, Fp = F.subs(X, q), F.subs(X, p)
        a = Fq - Fp
        return [
            {"ja": f"放物線はx軸と交わらない。端は直線 x = {num(p)}、x = {num(q)} なので、1/6公式は使えない", "op": "note"},
            {"ja": f"そのまま積分する：∫[{num(p)}→{num(q)}] ({poly(f)}) dx", "op": "note"},
            {"ja": f"原始関数 {poly_cubic(F)} に代入：{num(Fq)} − {par(Fp)} = {num(a)}", "value": str(a), "op": "result"},
        ]
    d, r = pa_roots(fig)
    k = abs(S(d[0]))
    w = r[1] - r[0]
    a = k * w ** 3 / 6
    g = fig.get("g", [0, 0, 0])
    lead = num(d[0]) if abs(S(d[0])) != 1 else ("−" if S(d[0]) < 0 else "")
    fac = lambda r_: f"(x − {num(r_)})" if r_ > 0 else (f"(x ＋ {num(-r_)})" if r_ < 0 else "x")
    head = f"y = {poly(d)}" if all(S(v) == 0 for v in g) else f"差をとると {poly(d)}"
    return [
        {"ja": f"{head} = {lead}{fac(r[0])}{fac(r[1])}。交点のx座標は {num(r[0])} と {num(r[1])}", "op": "note"},
        {"ja": f"放物線と直線（放物線）で囲まれた部分は 1/6公式：|x²の係数|×(β−α)³÷6", "op": "note"},
        {"ja": f"{num(k)}×{num(w)}³÷6 = {num(a)}", "value": str(a), "op": "result"},
    ]


def poly_cubic(F) -> str:
    p = Poly(expand(F), X)
    terms = []
    for (deg,), c in sorted(p.terms(), key=lambda t: -t[0][0]):
        pw = {3: "x³", 2: "x²", 1: "x", 0: ""}[deg]
        sign = "−" if c < 0 else "+"
        a = abs(c)
        body = (num(a) if (a != 1 or not pw) else "") + pw
        terms.append((sign, body))
    s = ("−" if terms[0][0] == "−" else "") + terms[0][1]
    for sign, body in terms[1:]:
        s += f" {sign} {body}"
    return s


def pa_check(fig, ans):
    if "bounds" in fig:
        p, q = fig["bounds"]
        f = fig["f"]
        if S(f[0]) == 0:
            ok = all(_f(f, S(x)) > 0 for x in (p, q)) and p < q and ans == pa_answer(fig)
            return ok, f"a line above the x-axis on [{p}, {q}]: trapezoid area {pa_answer(fig)}"
        roots = [r for r in pa_roots({"f": f})[1] if p <= r <= q]
        ok = p < q and not roots and _f(f, S(p)) > 0 and ans == pa_answer(fig) and ans.is_Rational
        return ok, f"the parabola stays above the x-axis on [{p}, {q}] (no crossing at the ends): ∫ = {pa_answer(fig)}; the 1/6 formula does not apply"
    d, r = pa_roots(fig)
    exact = abs(_int_poly(d, r[0], r[1])) if len(r) == 2 else None
    ok = len(r) == 2 and all(v.is_integer for v in r) and S(d[0]) != 0 and exact == ans
    return ok, f"crossings x = {r}, ∫|f−g| = {exact}, 1/6 formula gives {ans}"


def pa_variant(rng, fig0):
    if "bounds" in fig0 and S(fig0["f"][0]) == 0:
        m, n = rng.choice([1, 2, 3, -1]), rng.randint(1, 6)
        p = rng.randint(0, 2); q = p + rng.randint(2, 4)
        return {**fig0, "f": [0, m, n], "bounds": [p, q]}
    if "bounds" in fig0:
        a = rng.choice([1, 1, 2, 3]); b = rng.randint(-4, 4); c = rng.randint(1, 8)
        if b * b - 4 * a * c >= 0:
            return None
        p = rng.randint(-1, 1); q = p + rng.randint(2, 3)
        return {**fig0, "f": [a, b, c], "bounds": [p, q]}
    al = rng.randint(-4, 2); be = al + rng.randint(2, 5)
    g0 = fig0.get("g", [0, 0, 0])
    k = rng.choice([1, -1, 2, -2, 3])
    if all(S(v) == 0 for v in g0):
        f = [k, -k * (al + be), k * al * be]
        return {**fig0, "f": [int(v) for v in f]}
    gl = [S(0) if S(g0[0]) == 0 else S(rng.choice([1, -1, 2])), rng.randint(-3, 3), rng.randint(-4, 4)]
    if gl[0] + k == 0:
        return None
    if gl[0] == 0 and gl[1] == 0:
        return None
    f = [gl[0] + k, gl[1] - k * (al + be), gl[2] + k * al * be]
    return {**fig0, "f": [int(v) for v in f], "g": [int(v) for v in gl]}


# ------------------------------------------------------------ parabola_tri ---

def _pp(fig, x):
    return (S(x), S(fig["a"]) * S(x) ** 2)


def pt_answer(fig):
    a, al, be = S(fig["a"]), S(fig["alpha"]), S(fig["beta"])
    ask = fig["ask"]
    if ask == "px":
        return (al + be) / 2
    if ask == "max_area":
        return abs(a) * (be - al) ** 3 / 8
    if ask == "equal_o":
        return al + be
    if ask == "range_max":
        lo, hi = S(fig["range"][0]), S(fig["range"][1])
        m = (al + be) / 2
        x = lo if abs(lo - m) < abs(hi - m) else hi
        return abs(a) / 2 * (be - al) * (x - al) * (be - x)
    if ask == "oab":
        return abs(a) * abs(al * be * (be - al)) / 2
    raise ValueError(ask)


def pt_text(fig):
    a = fig["a"]
    A, B = _pp(fig, fig["alpha"]), _pp(fig, fig["beta"])
    head = f"放物線 y = {poly([a, 0, 0])} 上に2点{pt('A', A)}、{pt('B', B)}があります。"
    ask = fig["ask"]
    if ask == "px":
        return head + "点Pがこの放物線上をAからBまで動くとき、△ABPの面積が最大になる点Pのx座標を求めなさい。"
    if ask == "max_area":
        return head + "点Pがこの放物線上をAからBまで動くとき、△ABPの面積の最大値を求めなさい。"
    if ask == "equal_o":
        return head + "原点をOとします。放物線上に、Oと異なる点Pを直線ABについてOと同じ側にとり、△ABPの面積が△ABOの面積と等しくなるようにします。点Pのx座標を求めなさい。"
    if ask == "range_max":
        lo, hi = fig["range"]
        return head + f"点Pがこの放物線上を、x座標が {num(lo)} 以上 {num(hi)} 以下の範囲で動くとき、△ABPの面積の最大値を求めなさい。"
    if ask == "oab":
        return head + "原点をOとするとき、△OABの面積を求めなさい。"
    raise ValueError(ask)


def pt_steps(fig):
    a, al, be = S(fig["a"]), S(fig["alpha"]), S(fig["beta"])
    slope = a * (al + be)
    m = (al + be) / 2
    ask = fig["ask"]
    lead = [{"ja": f"ABを底辺と見る。ABに平行な直線を動かして、放物線にふれる点で高さが最大（等積変形の線）", "op": "note"},
            {"ja": f"ABの傾きは {num(a)}×({num(al)}＋{par(be)}) = {num(slope)}。y = {poly([a, 0, 0])} の接線の傾き {num(2 * a)}x がこれと等しいのは x = {num(m)}（AとBのまん中）", "op": "note"}]
    if ask == "px":
        return [lead[0], {**lead[1], "value": str(m), "op": "result"}]
    if ask == "max_area":
        A, B, P = _pp(fig, al), _pp(fig, be), _pp(fig, m)
        area = pt_answer(fig)
        return [*lead,
                {"ja": f"P{tup(P)}。△ABPの面積は 1/2|(B−A)×(P−A)| で計算する", "op": "note"},
                {"ja": f"= |{num(a)}|×({num(be)}−{par(al)})³÷8 = {num(area)}", "value": str(area), "op": "result"}]
    if ask == "equal_o":
        x = al + be
        return [{"ja": "ABを底辺と見る。Oを通りABに平行な直線の上なら、△ABPと△ABOの高さは同じ（等積変形）", "op": "note"},
                {"ja": f"ABの傾きは {num(a)}×({num(al)}＋{par(be)}) = {num(slope)}。Oを通る平行線は y = {poly([0, slope, 0])}", "op": "note"},
                {"ja": f"放物線との交点：{poly([a, 0, 0])} = {poly([0, slope, 0])} → x = 0, {num(x)}。O以外の交点がP", "value": str(x), "op": "result"}]
    if ask == "range_max":
        lo, hi = S(fig["range"][0]), S(fig["range"][1])
        x = lo if abs(lo - m) < abs(hi - m) else hi
        area = pt_answer(fig)
        return [{"ja": f"ABに平行な接線がふれる点は x = {num(m)}。でも、Pが動ける範囲（{num(lo)}〜{num(hi)}）にない", "op": "note"},
                {"ja": f"高さは、Pが x = {num(m)} に近いほど大きい。範囲の中で一番近いのは x = {num(x)}", "op": "note"},
                {"ja": f"P{tup(_pp(fig, x))}。△ABP = |{num(a)}|÷2×({num(be)}−{par(al)})×({num(x)}−{par(al)})×({num(be)}−{par(x)}) = {num(area)}", "value": str(area), "op": "result"}]
    if ask == "oab":
        A, B = _pp(fig, al), _pp(fig, be)
        area = pt_answer(fig)
        return [{"ja": f"Oが頂点なので、△OAB = 1/2|x₁y₂ − x₂y₁| をそのまま使う", "op": "note"},
                {"ja": f"= 1/2|{par(A[0])}×{par(B[1])} − {par(B[0])}×{par(A[1])}| = {num(area)}", "value": str(area), "op": "result"}]
    raise ValueError(ask)


def _tri_area(A, B, P):
    return abs((B[0] - A[0]) * (P[1] - A[1]) - (P[0] - A[0]) * (B[1] - A[1])) / 2


def pt_check(fig, ans):
    a, al, be = S(fig["a"]), S(fig["alpha"]), S(fig["beta"])
    A, B = _pp(fig, al), _pp(fig, be)
    ask = fig["ask"]
    if not (al < be and a != 0 and al + be != 0):
        return False, "need α < β, a ≠ 0 and AB not parallel to the x-axis"
    xs = [al + (be - al) * Rational(i, 80) for i in range(81)]
    if ask in ("px", "max_area"):
        best = max(xs, key=lambda x: _tri_area(A, B, _pp(fig, x)))
        want = best if ask == "px" else _tri_area(A, B, _pp(fig, best))
        ok = want == ans and best == (al + be) / 2
        return ok, f"scanning P on the arc: largest △ABP at x = {best}, area {_tri_area(A, B, _pp(fig, best))}"
    if ask == "equal_o":
        P = _pp(fig, ans)
        O = (S(0), S(0))
        same = ((B[0] - A[0]) * (O[1] - A[1]) - (O[0] - A[0]) * (B[1] - A[1])) * ((B[0] - A[0]) * (P[1] - A[1]) - (P[0] - A[0]) * (B[1] - A[1])) > 0
        ok = _tri_area(A, B, P) == _tri_area(A, B, O) and ans != 0 and same and al * be < 0
        return ok, f"P{P}: △ABP = △ABO = {_tri_area(A, B, O)}, same side of AB as O"
    if ask == "range_max":
        lo, hi = S(fig["range"][0]), S(fig["range"][1])
        m = (al + be) / 2
        rs = [lo + (hi - lo) * Rational(i, 80) for i in range(81)]
        best = max(_tri_area(A, B, _pp(fig, x)) for x in rs)
        ok = al <= lo < hi <= be and not (lo <= m <= hi) and best == ans
        return ok, f"the tangent point x = {m} is outside [{lo}, {hi}]; largest △ABP in range = {best}"
    if ask == "oab":
        ok = _tri_area((S(0), S(0)), A, B) == ans and al * be != 0
        return ok, f"shoelace on O, A, B gives {_tri_area((S(0), S(0)), A, B)}"
    return False, ask


def pt_variant(rng, fig0):
    a = rng.choice([1, 1, 2, Rational(1, 2), -1]) if fig0["ask"] != "oab" else rng.choice([1, 2])
    al = rng.randint(-4, -1); be = rng.randint(1, 5)
    if al + be == 0:
        return None
    fig = {**fig0, "a": a if not isinstance(a, Rational) or a.q == 1 else str(a), "alpha": al, "beta": be}
    if fig0["ask"] == "range_max":
        m = S(al + be) / 2
        side = rng.choice([-1, 1])
        if side < 0:
            hi = math.floor(m - Rational(1, 2)); lo = rng.randint(al, hi - 1) if hi - 1 >= al else None
        else:
            lo = math.ceil(m + Rational(1, 2)); hi = rng.randint(lo + 1, be) if lo + 1 <= be else None
        if lo is None or hi is None or lo >= hi:
            return None
        fig["range"] = [int(lo), int(hi)]
    return fig


# -------------------------------------------------------------- line_mirror ---

def _reflect(line, P):
    m, k = S(line[0]), S(line[1])
    # line: m x − y + k = 0
    d = (m * P[0] - P[1] + k) / (m ** 2 + 1)
    return (P[0] - 2 * m * d, P[1] + 2 * d)


def _side(line, P):
    return S(line[0]) * P[0] - P[1] + S(line[1])


def lm_P(fig):
    A = tuple(S(v) for v in fig["A"]); B = tuple(S(v) for v in fig["B"])
    m, k = S(fig["line"][0]), S(fig["line"][1])
    T = B
    if fig.get("ask") != "max_diff" and _side(fig["line"], A) * _side(fig["line"], B) > 0:
        T = _reflect(fig["line"], B)
    # intersect A–T with y = m x + k:  A + t(T − A) on the line  ⇔  t = (m Ax + k − Ay) / ((Ty − Ay) − m (Tx − Ax))
    tt = (m * A[0] + k - A[1]) / ((T[1] - A[1]) - m * (T[0] - A[0]))
    return (A[0] + tt * (T[0] - A[0]), A[1] + tt * (T[1] - A[1])), T


def lm_answer(fig):
    P, T = lm_P(fig)
    A = tuple(S(v) for v in fig["A"])
    if fig["ask"] == "min_len":
        return sqrt((T[0] - A[0]) ** 2 + (T[1] - A[1]) ** 2)
    return P[0]


def lm_text(fig):
    line = f"直線 ℓ: y = {poly([0, fig['line'][0], fig['line'][1]])}"
    head = f"{line} と、2点{pt('A', fig['A'])}、{pt('B', fig['B'])}があります。"
    ask = fig["ask"]
    if ask == "max_diff":
        return head + "ℓ上に点Pをとり、|PA − PB| がもっとも大きくなるようにします。このとき、点Pのx座標を求めなさい。"
    if ask == "min_len":
        return head + "ℓ上に点Pをとるとき、AP＋PB の最小値を求めなさい。"
    return head + "ℓ上に点Pをとり、AP＋PB がもっとも小さくなるようにします。このとき、点Pのx座標を求めなさい。"


def lm_steps(fig):
    A, B = fig["A"], fig["B"]
    m, k = S(fig["line"][0]), S(fig["line"][1])
    P, T = lm_P(fig)
    ask = fig["ask"]
    same = _side(fig["line"], A) * _side(fig["line"], B) > 0
    if ask == "max_diff":
        return [{"ja": "和ではなく差の最大。折り返さない。|PA−PB| ≦ AB で、P・A・Bが一直線にならぶとき等号", "op": "note"},
                {"ja": f"直線ABとℓの交点がP。AB：傾き ({par(B[1])}−{par(A[1])})÷({par(B[0])}−{par(A[0])})、ℓと連立して x = {num(P[0])}", "value": str(P[0]), "op": "result"}]
    if not same:
        st = [{"ja": "AとBはℓをはさんで反対側にある。折り返さずに、AとBをまっすぐ結ぶ", "op": "note"}]
    else:
        st = [{"ja": f"Bをℓで折り返した点B'をとる（PB＝PB'）。BB'の中点がℓ上、BB'⊥ℓ から B'{tup(T)}", "op": "note"},
              {"ja": "AとB'をまっすぐ結んだ線分が、AP＋PBの最小", "op": "note"}]
    if ask == "min_len":
        dx, dy = T[0] - A[0], T[1] - A[1]
        L = sqrt(dx ** 2 + dy ** 2)
        st.append({"ja": f"最小値 = AB' = √({par(dx)}²＋{par(dy)}²) = √{num(dx ** 2 + dy ** 2)} = {num(L)}" if same else
                   f"最小値 = AB = √({par(dx)}²＋{par(dy)}²) = √{num(dx ** 2 + dy ** 2)} = {num(L)}", "value": str(L), "op": "result"})
        return st
    st.append({"ja": f"直線{'AB' + chr(39) if same else 'AB'}とℓを連立すると、Pのx座標 = {num(P[0])}", "value": str(P[0]), "op": "result"})
    return st


def lm_check(fig, ans):
    A = tuple(S(v) for v in fig["A"]); B = tuple(S(v) for v in fig["B"])
    m, k = S(fig["line"][0]), S(fig["line"][1])
    sA, sB = _side(fig["line"], A), _side(fig["line"], B)
    if sA == 0 or sB == 0:
        return False, "A or B lies on ℓ"
    f = lambda x: math.hypot(x - float(A[0]), float(m) * x + float(k) - float(A[1])) + math.hypot(x - float(B[0]), float(m) * x + float(k) - float(B[1]))
    g = lambda x: abs(math.hypot(x - float(A[0]), float(m) * x + float(k) - float(A[1])) - math.hypot(x - float(B[0]), float(m) * x + float(k) - float(B[1])))
    P, T = lm_P(fig)
    xs = [float(P[0]) + (i - 400) / 40 for i in range(801)]
    ask = fig["ask"]
    if ask == "max_diff":
        ok = sA * sB > 0 and g(float(P[0])) >= max(g(x) for x in xs) - 1e-9 and ans == P[0] and A[1] != B[1] \
            and abs(float(sA) - float(sB)) > 1e-9
        refl = lm_P({**fig, "ask": "p_x"})[0][0]
        return ok and refl != P[0], f"P on line AB, |PA−PB| = AB is the largest; the reflection point x = {refl} is the trap"
    ok = f(float(P[0])) <= min(f(x) for x in xs) + 1e-9
    if ask == "min_len":
        ok = ok and abs(float(ans) - f(float(P[0]))) < 1e-9
    else:
        ok = ok and ans == P[0]
    want_side = fig.get("side") == "opposite"
    ok = ok and ((sA * sB < 0) == want_side)
    return ok, f"P = {P}: AP+PB = {f(float(P[0])):.6f} is the minimum on ℓ ({'opposite sides' if sA * sB < 0 else 'same side, reflect B'})"


def lm_variant(rng, fig0):
    m = fig0["line"][0] if rng.random() < 0.5 else rng.choice([1, -1, 2, -2])
    k = rng.randint(-3, 3)
    A = [rng.randint(-4, 4), rng.randint(-3, 6)]
    B = [rng.randint(-4, 6), rng.randint(-3, 6)]
    fig = {**fig0, "line": [m, k], "A": A, "B": B}
    sA, sB = _side(fig["line"], A), _side(fig["line"], B)
    if sA == 0 or sB == 0 or A == B:
        return None
    if (fig0.get("side") == "opposite") != (sA * sB < 0):
        return None
    if fig0["ask"] != "min_len":
        P = lm_P(fig)[0]
        if not S(P[0]).is_Rational or S(P[0]).q > 6:
            return None
    else:
        T = lm_P(fig)[1]
        if any(S(v).q != 1 for v in T):
            return None
    return fig


# ------------------------------------------------------------- param_family ---

def pf_point(fig):
    """The fixed point: the a-coefficient and the rest both vanish (Cramer's rule for lines)."""
    if fig["family"] == "line":
        (p1, q1), (p2, q2), (p3, q3) = fig["c"]
        det = S(p1 * q2 - p2 * q1)
        if det == 0:
            return None
        return ((-p3 * q2 + p2 * q3) / det, (-p1 * q3 + p3 * q1) / det)
    (p, q), (r, s_) = fig["c"]
    if p == 0:
        return None
    x = S(-r) / p
    return (x, x ** 2 + q * x + s_)


def _pf_expr(fig):
    a = symbols("a")
    if fig["family"] == "line":
        (p1, q1), (p2, q2), (p3, q3) = fig["c"]
        return p1 * a + q1, p2 * a + q2, p3 * a + q3
    (p, q), (r, s_) = fig["c"]
    return p * a + q, r * a + s_


def _lin(c) -> str:
    """p a + q as 「2a − 1」 / 「a」 / 「3」."""
    p, q = S(c[0]), S(c[1])
    s = ""
    if p != 0:
        s = ("−" if p < 0 else "") + ("" if abs(p) == 1 else num(abs(p))) + "a"
    if q != 0:
        s = (s + (" − " if q < 0 else " + ") + num(abs(q))) if s else num(q)
    return s or "0"


def pf_equation(fig) -> str:
    if fig["family"] == "line":
        (cx, cy, cc) = fig["c"]
        parts = []
        for c, v in ((cx, "x"), (cy, "y")):
            parts.append(f"({_lin(c)}){v}")
        const = _lin(cc)
        return f"{parts[0]} ＋ {parts[1]} ＋ ({const}) = 0"
    (cb, cc) = fig["c"]
    return f"y = x² ＋ ({_lin(cb)})x ＋ ({_lin(cc)})"


def pf_answer(fig):
    if fig.get("ask") == "a_for_point":
        a = symbols("a")
        x0, y0 = fig["point"]
        if fig["family"] == "line":
            ex, ey, ec = _pf_expr(fig)
            return solve(ex * x0 + ey * y0 + ec, a)[0]
        eb, ec = _pf_expr(fig)
        return solve(x0 ** 2 + eb * x0 + ec - y0, a)[0]
    if fig.get("ask") == "slope_at":
        a = symbols("a")
        ex, ey, ec = _pf_expr(fig)
        return -(ex / ey).subs(a, fig["a0"])
    return Tuple(*pf_point(fig))


def pf_text(fig):
    eq = pf_equation(fig)
    name = "直線" if fig["family"] == "line" else "放物線"
    ask = fig.get("ask", "point")
    if ask == "a_for_point":
        return f"{name} {eq} が点{tup(fig['point'])}を通るとき、定数 a の値を求めなさい。"
    if ask == "slope_at":
        return f"直線 {eq} について、a = {num(fig['a0'])} のときの傾きを求めなさい。"
    return f"{name} {eq} は、定数 a の値にかかわらず定点を通ります。その定点の座標を求めなさい。"


def pf_steps(fig):
    ask = fig.get("ask", "point")
    if ask == "a_for_point":
        x0, y0 = fig["point"]
        v = pf_answer(fig)
        return [{"ja": f"通る点が決まっているので、x = {num(x0)}、y = {num(y0)} を代入するだけ（aでまとめなくてよい）", "op": "note"},
                {"ja": f"aの1次方程式を解いて a = {num(v)}", "value": str(v), "op": "result"}]
    if ask == "slope_at":
        a = symbols("a")
        ex, ey, ec = _pf_expr(fig)
        v = pf_answer(fig)
        return [{"ja": f"aの値が決まっているので、a = {num(fig['a0'])} を代入するだけ", "op": "note"},
                {"ja": f"{num(ex.subs(a, fig['a0']))}x ＋ {par(ey.subs(a, fig['a0']))}y ＋ {par(ec.subs(a, fig['a0']))} = 0 → 傾き = {num(v)}", "value": str(v), "op": "result"}]
    P = pf_point(fig)
    if fig["family"] == "line":
        (p1, q1), (p2, q2), (p3, q3) = fig["c"]
        A = poly([0, p1, 0]) + f" {'−' if p2 < 0 else '+'} {'' if abs(p2) == 1 else num(abs(p2))}y" + (f" {'−' if p3 < 0 else '+'} {num(abs(p3))}" if p3 else "")
        Bq = poly([0, q1, 0]) + f" {'−' if q2 < 0 else '+'} {'' if abs(q2) == 1 else num(abs(q2))}y" + (f" {'−' if q3 < 0 else '+'} {num(abs(q3))}" if q3 else "")
        return [{"ja": "aを止めて考える：aについて整理すると a×(…) ＋ (…) = 0。どんなaでも成り立つのは、2つのかっこが両方0のとき", "op": "note"},
                {"ja": f"a({A}) ＋ ({Bq}) = 0", "op": "note"},
                {"ja": f"{A} = 0 と {Bq} = 0 を連立して、定点 {tup(P)}", "value": str(Tuple(*P)), "op": "result"}]
    (p, q), (r, s_) = fig["c"]
    return [{"ja": "aを止めて考える：aについて整理すると a×(…) ＋ (…) = 0。どんなaでも成り立つのは、両方のかっこが0のとき", "op": "note"},
            {"ja": f"a({poly([0, p, r])}) ＋ ({poly([1, q, s_])} − y) = 0", "op": "note"},
            {"ja": f"{poly([0, p, r])} = 0 から x = {num(P[0])}、もう一方に代入して y = {num(P[1])}。定点 {tup(P)}", "value": str(Tuple(*P)), "op": "result"}]


def pf_check(fig, ans):
    a = symbols("a")
    ask = fig.get("ask", "point")
    if ask == "a_for_point":
        v = pf_answer(fig)
        P = pf_point(fig)
        ok = v == ans and (P is None or tuple(P) != tuple(S(t) for t in fig["point"]))
        return ok, f"substituting the point gives a = {v} (the point is not the fixed point, so every a is not a solution)"
    if ask == "slope_at":
        return pf_answer(fig) == ans, f"slope at a = {fig['a0']} is {pf_answer(fig)}"
    P = pf_point(fig)
    if P is None:
        return False, "no single fixed point"
    x, y = P
    if fig["family"] == "line":
        ex, ey, ec = _pf_expr(fig)
        vals = [(ex * x + ey * y + ec).subs(a, t) for t in range(-5, 6)]
    else:
        eb, ec = _pf_expr(fig)
        vals = [(x ** 2 + eb * x + ec - y).subs(a, t) for t in range(-5, 6)]
    ok = all(v == 0 for v in vals) and Tuple(*P) == ans and all(S(t).is_integer for t in P)
    return ok, f"{P} satisfies the equation for every a from −5 to 5"


def pf_variant(rng, fig0):
    if fig0["family"] == "line":
        X0, Y0 = rng.randint(-4, 4), rng.randint(-4, 4)
        while True:
            p1, p2 = rng.randint(-3, 3), rng.randint(-3, 3)
            q1, q2 = rng.randint(-3, 3), rng.randint(-3, 3)
            if p1 * q2 - p2 * q1 != 0 and 0 not in (p1 or q1, p2 or q2):
                break
        p3, q3 = -(p1 * X0 + p2 * Y0), -(q1 * X0 + q2 * Y0)
        fig = {**fig0, "c": [[p1, q1], [p2, q2], [p3, q3]]}
        if fig0.get("ask") == "a_for_point":
            fig["point"] = [rng.randint(-3, 3), rng.randint(-3, 3)]
            ex, ey, ec = _pf_expr(fig)
            aa = symbols("a")
            co = (ex * fig["point"][0] + ey * fig["point"][1] + ec).coeff(aa, 1)
            if co == 0:
                return None
        if fig0.get("ask") == "slope_at":
            fig["a0"] = rng.randint(-3, 3)
            ex, ey, ec = _pf_expr(fig)
            if ey.subs(symbols("a"), fig["a0"]) == 0:
                return None
        return fig
    X0 = rng.choice([-3, -2, -1, 1, 2, 3]); p = rng.choice([-2, -1, 1, 2]); r = -p * X0
    q, s_ = rng.randint(-4, 4), rng.randint(-5, 5)
    return {**fig0, "c": [[p, q], [r, s_]]}


# -------------------------------------------------------------- cone_unfold ---

def cu_theta(fig):
    return Rational(360 * fig["r"], fig["l"])


def cu_answer(fig):
    r, l = S(fig["r"]), S(fig["l"])
    th = cu_theta(fig)
    ask = fig["ask"]
    if ask == "side_area":
        return pi * r * l
    if th >= 180:
        return 2 * l if ask == "loop" else l + S(fig.get("d", 0))
    if ask == "loop":
        return nsimplify(2 * l * sin(th * pi / 360))
    d = S(fig["d"])
    return nsimplify(sqrt(l ** 2 + d ** 2 - 2 * l * d * cos(th * pi / 180)))


def cu_text(fig):
    r, l = fig["r"], fig["l"]
    head = f"底面の半径が{r}cm、母線の長さが{l}cmの円すいがあります。"
    ask = fig["ask"]
    if ask == "side_area":
        return head + "この円すいの側面積を求めなさい。"
    if ask == "loop":
        return head + "底面の円周上の点Aから、側面を1周してAにもどるように糸をかけます。糸の長さの最小値を求めなさい。"
    return head + f"頂点をOとし、母線OA上にOB＝{fig['d']}cmとなる点Bをとります。点Aから側面を1周して点Bまで糸をかけるとき、糸の長さの最小値を求めなさい。"


def cu_steps(fig):
    r, l = S(fig["r"]), S(fig["l"])
    th = cu_theta(fig)
    ask = fig["ask"]
    if ask == "side_area":
        v = cu_answer(fig)
        return [{"ja": "側面積は公式 π×半径×母線 でそのまま出る（最短の道の問題ではない）", "op": "note"},
                {"ja": f"π×{num(r)}×{num(l)} = {num(v)}", "value": str(v), "op": "result"}]
    open_ = {"ja": f"側面を開くと、半径{num(l)}のおうぎ形。中心角は 360°×{num(r)}/{num(l)} = {num(th)}°", "op": "note"}
    if th >= 180:
        v = cu_answer(fig)
        return [open_,
                {"ja": f"中心角が180°以上なので、開いた図でAとA'を結ぶ直線はおうぎ形の外に出てしまう。展開しても1本の直線にならない", "op": "note"},
                {"ja": f"最短の糸は頂点Oを通る：{num(l)}＋{num(l) if ask == 'loop' else num(fig['d'])} = {num(v)}", "value": str(v), "op": "result"}]
    v = cu_answer(fig)
    if ask == "loop":
        return [open_,
                {"ja": "1周してもどる糸は、開いた図で両はしのAとA'を結ぶ線分（弦）", "op": "note"},
                {"ja": f"中心角{num(th)}°の二等辺三角形の底辺：2×{num(l)}×sin{num(th / 2)}° = {num(v)}", "value": str(v), "op": "result"}]
    d = S(fig["d"])
    c = cos(th * pi / 180)
    return [open_,
            {"ja": f"開いた図で、Aと、反対のはしの半径上のB'（OB'＝{num(d)}）を結ぶ線分が最短", "op": "note"},
            {"ja": f"余弦定理：AB'² = {num(l)}²＋{num(d)}²−2×{num(l)}×{num(d)}×cos{num(th)}° = {num(nsimplify(l ** 2 + d ** 2 - 2 * l * d * c))}", "op": "note"},
            {"ja": f"AB' = {num(v)}", "value": str(v), "op": "result"}]


def cu_check(fig, ans):
    r, l = fig["r"], fig["l"]
    th = cu_theta(fig)
    ask = fig["ask"]
    if not (0 < r < l):
        return False, "need 0 < r < l"
    if ask == "side_area":
        return ans == pi * r * l, f"π r l = {pi * r * l}"
    # numeric: shortest path in the opened sector, via the straight chord when it stays inside, else through O
    if ask == "loop":
        chord = 2 * l * math.sin(math.radians(min(float(th), 180)) / 2) if th < 180 else 2 * l
        want_fail = fig.get("expect") == "through_apex"
        ok = abs(float(ans) - chord) < 1e-9 and ((th >= 180) == want_fail)
        return ok, f"sector {th}°: shortest loop {chord:.6f}" + (" (through the apex)" if th >= 180 else "")
    d = fig["d"]
    if th >= 180:
        val = l + d
    else:
        val = math.sqrt(l * l + d * d - 2 * l * d * math.cos(math.radians(float(th))))
    want_fail = fig.get("expect") == "through_apex"
    ok = abs(float(ans) - val) < 1e-9 and 0 < d < l and ((th >= 180) == want_fail)
    return ok, f"sector {th}°: shortest A→B' {val:.6f}"


def cu_variant(rng, fig0):
    ask = fig0["ask"]
    if ask == "side_area":
        r = rng.randint(2, 8); l = rng.randint(r + 1, 15)
        return {**fig0, "r": r, "l": l}
    if fig0.get("expect") == "through_apex":
        r = rng.randint(3, 9); l = rng.randint(r + 1, 2 * r)
        fig = {**fig0, "r": r, "l": l}
        if ask != "loop":
            fig["d"] = rng.randint(1, l - 1)
        return fig
    th = rng.choice(fig0.get("angles", [60, 90, 120]))
    k = rng.randint(1, 4)
    l = {60: 6, 90: 4, 120: 3}[th] * k
    r = l * th // 360
    fig = {**fig0, "r": r, "l": l}
    if ask != "loop":
        fig["d"] = rng.randint(1, l - 1)
        if fig["d"] * 2 == l and th == 60:
            return None
    return fig


# ---------------------------------------------------------------- dice_grid ---

def _cond(cond, t):
    op, k = cond["op"], cond.get("k")
    if op == "sum_le":
        return sum(t) <= k
    if op == "sum_eq":
        return sum(t) == k
    if op == "diff_ge":
        return abs(t[0] - t[1]) >= k
    if op == "prod_le":
        return t[0] * t[1] <= k
    if op == "prod_mult":
        return (t[0] * t[1]) % k == 0
    if op == "both_even":
        return all(v % 2 == 0 for v in t)
    if op == "both_le":
        return all(v <= k for v in t)
    if op == "even_le":
        return t[0] % 2 == 0 and t[1] <= k
    if op == "both_ge":
        return all(v >= k for v in t)
    raise ValueError(op)


def dg_count(fig):
    n = fig.get("dice", 2)
    return sum(1 for t in _prod(range(1, 7), repeat=n) if _cond(fig["cond"], t))


def dg_answer(fig):
    return Rational(dg_count(fig), 6 ** fig.get("dice", 2))


INDEP = ("both_even", "both_le", "both_ge", "even_le")
COND_JA = {"sum_le": "出た目の和が{k}以下", "sum_eq": "出た目の和が{k}", "diff_ge": "出た目の差が{k}以上",
           "prod_le": "出た目の積が{k}以下", "prod_mult": "出た目の積が{k}の倍数", "both_even": "2個とも偶数の目",
           "both_le": "2個とも{k}以下の目", "both_ge": "2個とも{k}以上の目", "even_le": "大が偶数の目、小が{k}以下の目"}


def dg_text(fig):
    n = fig.get("dice", 2)
    who = "大小2個" if n == 2 else "大中小3個"
    c = COND_JA[fig["cond"]["op"]].format(k=fig["cond"].get("k"))
    return f"{who}のさいころを同時に投げるとき、{c}になる確率を求めなさい。"


def dg_steps(fig):
    n = fig.get("dice", 2)
    cnt, tot = dg_count(fig), 6 ** n
    p = dg_answer(fig)
    op, k = fig["cond"]["op"], fig["cond"].get("k")
    if op in INDEP:
        nb = {"both_even": 3, "both_le": k, "both_ge": 7 - (k or 0), "even_le": 3}[op]
        ns = {"both_even": 3, "both_le": k, "both_ge": 7 - (k or 0), "even_le": k}[op]
        return [{"ja": "大と小は別々に決まる（独立）。表をかかなくても、確率をかければよい", "op": "note"},
                {"ja": f"{nb}/6 × {ns}/6 = {num(p)}", "value": str(p), "op": "result"}]
    if n == 3:
        return [{"ja": "3個なので、6×6の表（平面）にはならない。大の目を決めて、残り2個の和で場合分けする", "op": "note"},
                {"ja": f"大が1〜6のとき、中＋小が {k}−1〜{k}−6 になる数を順に数えて、合計 {cnt} 通り", "op": "note"},
                {"ja": f"{cnt}/{tot} = {num(p)}", "value": str(p), "op": "result"}]
    rows = []
    if op == "sum_le":
        rows = [f"和が{s}：{s - 1}" for s in range(2, k + 1)]
        mid = f"和が一定の目は、表のななめ1列。{'、'.join(rows)}（マス）"
    elif op == "sum_eq":
        mid = f"和が{k}のマスは、表のななめ1列だけ：{cnt}マス"
    elif op == "diff_ge":
        mid = f"差が{k}以上のマスは、対角線から{k}本以上はなれた左下と右上の三角形：{cnt // 2}＋{cnt // 2}"
    elif op == "prod_le":
        per = [min(6, k // a) for a in range(1, 7)]
        mid = f"大の目ごとに、小の目が何マス入るか：{'＋'.join(str(v) for v in per if v)}"
    elif op == "prod_mult":
        n0 = 6 - 6 // k
        mid = f"余事象：どちらも{k}の倍数でない目は{n0}通りずつ。{n0}×{n0} = {n0 * n0}マスを36マスから引く：36−{n0 * n0}"
    return [{"ja": "大を横、小を縦にした6×6の表（36マス）で考える。条件をみたすマスの面積を数える", "op": "note"},
            {"ja": mid + f" = {cnt}マス", "op": "note"},
            {"ja": f"{cnt}/36 = {num(p)}", "value": str(p), "op": "result"}]


def dg_check(fig, ans):
    n = fig.get("dice", 2)
    cnt = dg_count(fig)
    ok = ans == dg_answer(fig) and 0 < cnt < 6 ** n
    if fig.get("expect") == "three_dice":
        ok = ok and n == 3
    elif fig["cond"]["op"] not in INDEP:
        ok = ok and n == 2 and cnt >= 3
    return ok, f"enumerating all {6 ** n} outcomes: {cnt} satisfy it → {dg_answer(fig)}"


def dg_variant(rng, fig0):
    op = fig0["cond"]["op"]
    if fig0.get("dice", 2) == 3:
        return {**fig0, "cond": {"op": "sum_eq", "k": rng.randint(5, 14)}}
    if op in INDEP:
        op = rng.choice(["both_le", "both_ge", "even_le"])
        return {**fig0, "cond": {"op": op, "k": rng.randint(2, 5)}}
    op = rng.choice([op, op, "sum_le", "sum_eq", "diff_ge", "prod_le", "prod_mult"])   # a fresh table condition
    k = {"sum_le": lambda: rng.randint(3, 7), "sum_eq": lambda: rng.randint(3, 11), "diff_ge": lambda: rng.randint(1, 4),
         "prod_le": lambda: rng.randint(4, 12), "prod_mult": lambda: rng.choice([2, 3, 5])}[op]()
    return {**fig0, "cond": {"op": op, "k": k}}


# ---------------------------------------------------------------- const_sum ---

def cs_answer(fig):
    p, q, s_ = S(fig.get("p", 1)), S(fig.get("q", 1)), S(fig["s"])
    ask = fig["ask"]
    if ask == "given_diff":
        d = S(fig["d"])
        return (s_ ** 2 - d ** 2) / 4
    if ask == "min_squares":
        return s_ ** 2 / 2
    u, v = S(fig.get("shift", [0, 0])[0]), S(fig.get("shift", [0, 0])[1])
    if "x_min" in fig:
        x = S(fig["x_min"])
        return x * (s_ - x)
    return (s_ + u + v) ** 2 / (4 * p * q) if (u, v) != (0, 0) else s_ ** 2 / (4 * p * q)


def _sum_eq(fig) -> str:
    p, q = fig.get("p", 1), fig.get("q", 1)
    return f"{'' if p == 1 else num(p)}x ＋ {'' if q == 1 else num(q)}y = {num(fig['s'])}"


def cs_text(fig):
    ask = fig["ask"]
    if ask == "given_diff":
        return f"x ＋ y = {num(fig['s'])}、x − y = {num(fig['d'])} のとき、xy の値を求めなさい。"
    cond = f"{_sum_eq(fig)}、x＞0、y＞0"
    if "x_min" in fig:
        cond = f"{_sum_eq(fig)}、x ≧ {num(fig['x_min'])}、y＞0"
    if ask == "min_squares":
        return f"{cond} のとき、x² ＋ y² の最小値を求めなさい。"
    u, v = fig.get("shift", [0, 0])
    if (u, v) != (0, 0):
        return f"{cond} のとき、(x ＋ {num(u)})(y ＋ {num(v)}) の最大値を求めなさい。"
    return f"{cond} のとき、xy の最大値を求めなさい。"


def cs_steps(fig):
    p, q, s_ = S(fig.get("p", 1)), S(fig.get("q", 1)), S(fig["s"])
    ask = fig["ask"]
    v = cs_answer(fig)
    if ask == "given_diff":
        d = S(fig["d"])
        return [{"ja": "和と差が両方分かっているので、xとyが決まる。動かす必要はない", "op": "note"},
                {"ja": f"x = ({num(s_)}＋{num(d)})÷2 = {num((s_ + d) / 2)}、y = ({num(s_)}−{num(d)})÷2 = {num((s_ - d) / 2)}", "op": "note"},
                {"ja": f"xy = {num((s_ + d) / 2)}×{num((s_ - d) / 2)} = {num(v)}", "value": str(v), "op": "result"}]
    if "x_min" in fig:
        x = S(fig["x_min"])
        return [{"ja": f"和が一定なら、まん中 x = {num(s_ / 2)} で積が最大。でも x ≧ {num(x)} なので、まん中は使えない", "op": "note"},
                {"ja": f"まん中から遠ざかるほど積は小さくなる。いちばん近いのは x = {num(x)}", "op": "note"},
                {"ja": f"xy = {num(x)}×{num(s_ - x)} = {num(v)}", "value": str(v), "op": "result"}]
    if ask == "min_squares":
        m = s_ / 2
        return [{"ja": f"和 x＋y = {num(s_)} は一定。まん中 {num(m)} からのずれを t として x = {num(m)}＋t、y = {num(m)}−t", "op": "note"},
                {"ja": f"x²＋y² = 2×{num(m)}²＋2t²。t = 0 のとき最小", "op": "note"},
                {"ja": f"2×{num(m)}² = {num(v)}", "value": str(v), "op": "result"}]
    u, w = S(fig.get("shift", [0, 0])[0]), S(fig.get("shift", [0, 0])[1])
    if (u, w) != (0, 0):
        T = s_ + u + w
        return [{"ja": f"X = x＋{num(u)}、Y = y＋{num(w)} とおくと、X＋Y = {num(s_)}＋{num(u)}＋{num(w)} = {num(T)} で一定", "op": "note"},
                {"ja": f"和が一定なら、まん中 X = Y = {num(T / 2)} で積が最大（x = {num(T / 2 - u)}、y = {num(T / 2 - w)} はどちらも正）", "op": "note"},
                {"ja": f"{num(T / 2)}×{num(T / 2)} = {num(v)}", "value": str(v), "op": "result"}]
    if p != 1 or q != 1:
        m = s_ / 2
        return [{"ja": f"{num(p) if p != 1 else ''}x と {num(q) if q != 1 else ''}y の和が {num(s_)} で一定。まん中 {num(m)} ずつで、2つの積が最大", "op": "note"},
                {"ja": f"{num(p) if p != 1 else ''}x = {num(m)}、{num(q) if q != 1 else ''}y = {num(m)} のとき、{num(p) if p != 1 else ''}x×{num(q) if q != 1 else ''}y = {num(m * m)} が最大", "op": "note"},
                {"ja": f"xy の最大値 = {num(m * m)}÷{num(p * q)} = {num(v)}", "value": str(v), "op": "result"}]
    m = s_ / 2
    return [{"ja": f"和 x＋y = {num(s_)} は一定。まん中 {num(m)} からのずれを t として x = {num(m)}＋t、y = {num(m)}−t", "op": "note"},
            {"ja": f"xy = {num(m)}² − t²。t = 0 のとき最大", "op": "note"},
            {"ja": f"{num(m)}² = {num(v)}", "value": str(v), "op": "result"}]


def cs_check(fig, ans):
    p, q, s_ = S(fig.get("p", 1)), S(fig.get("q", 1)), S(fig["s"])
    ask = fig["ask"]
    if ask == "given_diff":
        d = S(fig["d"])
        x, y = (s_ + d) / 2, (s_ - d) / 2
        return ans == x * y and d != 0 and x > 0 and y > 0, f"x = {x}, y = {y}, xy = {x * y}"
    u, w = S(fig.get("shift", [0, 0])[0]), S(fig.get("shift", [0, 0])[1])
    lo = S(fig.get("x_min", 0))
    xs = [lo + (s_ / p - lo) * Rational(i, 240) for i in range(1, 240)]
    def val(x):
        y = (s_ - p * x) / q
        return x * x + y * y if ask == "min_squares" else (x + u) * (y + w)
    vals = [val(x) for x in xs] + ([val(lo)] if "x_min" in fig else [])
    best = min(vals) if ask == "min_squares" else max(vals)
    ok = best == ans
    if "x_min" in fig:
        ok = ok and lo > s_ / (2 * p) and lo < s_ / p
    return ok, f"scanning x: {'min' if ask == 'min_squares' else 'max'} = {best}"


def cs_variant(rng, fig0):
    ask = fig0["ask"]
    s_ = rng.randint(4, 16)
    fig = {**fig0, "s": s_}
    if ask == "given_diff":
        d = rng.randint(1, s_ - 1)
        if (s_ + d) % 2:
            return None
        fig["d"] = d
        return fig
    if "x_min" in fig0:
        fig["x_min"] = rng.randint(s_ // 2 + 1, s_ - 1)
        return fig
    if fig0.get("shift"):
        fig["shift"] = [rng.randint(1, 4), rng.randint(1, 4)]
        T = s_ + sum(fig["shift"])
        if T % 2 or T // 2 - fig["shift"][0] <= 0 or T // 2 - fig["shift"][1] <= 0 or T // 2 - fig["shift"][0] >= s_:
            return None
        return fig
    if fig0.get("p", 1) != 1 or fig0.get("q", 1) != 1:
        fig["p"], fig["q"] = rng.choice([(2, 1), (1, 2), (3, 1), (2, 3)])
        return fig
    return fig


# ---------------------------------------------------------------- dispatch ---

FUN = {
    "parabola_area": (pa_text, pa_answer, pa_steps, pa_check, pa_variant),
    "parabola_tri": (pt_text, pt_answer, pt_steps, pt_check, pt_variant),
    "line_mirror": (lm_text, lm_answer, lm_steps, lm_check, lm_variant),
    "param_family": (pf_text, pf_answer, pf_steps, pf_check, pf_variant),
    "cone_unfold": (cu_text, cu_answer, cu_steps, cu_check, cu_variant),
    "dice_grid": (dg_text, dg_answer, dg_steps, dg_check, dg_variant),
    "const_sum": (cs_text, cs_answer, cs_steps, cs_check, cs_variant),
}


def hs_text(fig):
    return FUN[fig["type"]][0](fig) if fig["type"] in FUN else None


def hs_answer(fig):
    return sympify(FUN[fig["type"]][1](fig)) if fig["type"] in FUN else None


def hs_steps(fig):
    return FUN[fig["type"]][2](fig) if fig["type"] in FUN else None


def hs_check(fig, ans):
    return FUN[fig["type"]][3](fig, ans)


def hs_variant(rng, fig0):
    return FUN[fig0["type"]][4](rng, fig0)
