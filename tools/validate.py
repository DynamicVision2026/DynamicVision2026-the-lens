#!/usr/bin/env python3
"""Lens Card validator for 視点レンズ (The Lens).

Usage:
    python3 tools/validate.py cards/*.yaml            # validate cards
    python3 tools/validate.py cards/*.yaml --variants # also generate + check variants
    python3 tools/validate.py cards/**/*.yaml --bundle  # all of the above + build/bundle.json
    python3 tools/validate.py cards/**/*.yaml --bundle --include-drafts  # local dev only: also bundle draft cards

A card is 'verified' only if:
  1. it matches schema/lens-card.schema.json,
  2. every check in its `checks` list passes (exact arithmetic with SymPy),
  3. every generated variant passes the same structural checks, still needs the same move,
     and carries lens-route steps that sum to its own answer.
Exit code is non-zero on any failure, so this can gate CI and the renderers.
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from sympy import Rational, S, sympify
from sympy.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((ROOT / "schema" / "lens-card.schema.json").read_text(encoding="utf-8"))


def _load_labels():
    out = {}
    for name in ("lenses", "tags"):
        path = ROOT / "labels" / f"{name}.yaml"
        out[name] = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    return out


LABELS = _load_labels()
CATALOG_DIRS = {"elem": 1, "middle": 2, "high": 3}   # catalog/<dir>/pass.yaml, one Pass (SKU) per dir


def _load_catalog():
    """One Pass per catalog/<dir>/pass.yaml (strict isolation per SKU). Ordered elem → middle → high."""
    out = {}
    for d in sorted(CATALOG_DIRS, key=CATALOG_DIRS.get):
        f = ROOT / "catalog" / d / "pass.yaml"
        if not f.exists():
            continue
        data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        if len(data) != 1:
            raise SystemExit(f"catalog/{d}/pass.yaml must define exactly one Pass, found {list(data)}")
        (pid, ps), = data.items()
        if ps.get("stage_no") != CATALOG_DIRS[d]:
            raise SystemExit(f"catalog/{d}/pass.yaml: {pid} has stage_no {ps.get('stage_no')}, expected {CATALOG_DIRS[d]}")
        out[pid] = {**ps, "catalog_dir": d}
    return out


CATALOG = _load_catalog()


def catalog_check(entries, release=None):
    """Check every Pass's lessons against the cards in this run and report progress.

    Errors (always fail): a lesson lists an unknown card, a card of another lens or stage,
    a card without level/archetype, a lens outside the Pass's lessons, or the same
    archetype twice at the same level. Progress (fails only for the --release Pass):
    target problem count, all levels covered, a failure card and a no-lens card per lesson.
    Returns (ok, passes_for_bundle).
    """
    by_id = {c["id"]: (ok, c) for ok, c, _ in entries}
    ok_all, out = True, []
    print("\n== catalog/{elem,middle,high}/pass.yaml")
    owner = {}
    for pid, ps in CATALOG.items():
        for ls in ps.get("lessons", []):
            for cid in ls["cards"]:
                if cid in owner and owner[cid] != pid:
                    print(f"  FAIL    isolation: {cid} is listed in both {owner[cid]} and {pid}"); ok_all = False
                owner[cid] = pid
    for pid, ps in CATALOG.items():
        lessons, target = ps.get("lessons", []), ps.get("lesson_target", 10)
        levels = set(ps.get("levels", {1: 0, 2: 0, 3: 0, 4: 0}))
        complete = bool(lessons)
        out_lessons = []
        for ls in lessons:
            errs, cards = [], []
            if ls["lens"] not in LABELS["lenses"]:
                errs.append(f"lens '{ls['lens']}' has no label")
            seen = set()
            for cid in ls["cards"]:
                if cid not in by_id:
                    errs.append(f"{cid} not found"); continue
                okc, c = by_id[cid]
                if c["lens"] != ls["lens"]:
                    errs.append(f"{cid} is lens {c['lens']}")
                if c["stage"] not in ps["card_stages"]:
                    errs.append(f"{cid} is stage {c['stage']}")
                if "level" not in c or "archetype" not in c:
                    errs.append(f"{cid} needs level and archetype"); continue
                key = (c["archetype"], c["level"])
                if key in seen:
                    errs.append(f"{cid} repeats {c['archetype']} at level {c['level']}")
                seen.add(key)
                if okc:
                    cards.append(c)
            n = len(cards)
            lv = {c["level"] for c in cards}
            has_fail = any(c["kind"] == "failure" for c in cards)
            has_none = any(c["kind"] == "no_lens" for c in cards)
            done = n >= target and levels <= lv and has_fail and has_none
            complete &= done and not errs
            ok_all &= not errs
            missing = [f"{n}/{target} problems"] if n < target else []
            missing += [f"levels {sorted(levels - lv)}"] if not levels <= lv else []
            missing += ["failure card"] if not has_fail else []
            missing += ["no-lens card"] if not has_none else []
            tag = "FAIL" if errs else ("DONE" if done else "TODO")
            print(f"  {tag}    {pid}/{ls['lens']}: " + ("; ".join(errs) if errs else ("complete" if done else "needs " + ", ".join(missing))))
            out_lessons.append({"lens": ls["lens"], "video": ls.get("video"), "cards": [c["id"] for c in cards if c["status"] in PUBLISHABLE]})
        print(f"  {'PASS' if complete else 'INFO'}    {pid}: {'complete' if complete else ps.get('status', 'planned')} ({len(lessons)} lessons)")
        if release == pid and not complete:
            print(f"  FAIL    --release {pid}: not every lesson is complete"); ok_all = False
        meta = {k: v for k, v in ps.items() if k != "lessons"}
        out.append({"id": pid, **meta, "lessons": out_lessons})
    return ok_all, out


def label_check(card):
    """Every picker option and clue chip must have a Japanese label; decoys must be real decoys."""
    errs = []
    lenses, tags = LABELS["lenses"], LABELS["tags"]
    if card["lens"] not in lenses:
        errs.append(f"lens '{card['lens']}' has no label in labels/lenses.yaml")
    for opt in card["picker"]["options"]:
        if opt not in lenses:
            errs.append(f"picker option '{opt}' has no label in labels/lenses.yaml")
    real = card["trigger"]["tags"]
    decoys = card["picker"]["clue_distractors"]
    for tg in real + decoys:
        if tg not in tags:
            errs.append(f"tag '{tg}' has no label in labels/tags.yaml")
    if set(real) & set(decoys):
        errs.append(f"clue_distractors overlap trigger.tags: {sorted(set(real) & set(decoys))}")
    if not [tg for tg in real if not tags.get(tg, {}).get("generic")]:
        errs.append("trigger.tags has no specific (non-generic) clue for the child to find")
    return errs


# ---------------------------------------------------------------- geometry ---

def shoelace(pts) -> Rational:
    """Signed area (positive = counter-clockwise), exact."""
    s = S(0)
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += S(x1) * y2 - S(x2) * y1
    return s / 2


def _orient(a, b, c) -> int:
    v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    return (v > 0) - (v < 0)


def _on_segment(a, b, c) -> bool:
    return min(a[0], b[0]) <= c[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= c[1] <= max(a[1], b[1])


def _segments_cross(p1, p2, p3, p4) -> bool:
    d1, d2 = _orient(p3, p4, p1), _orient(p3, p4, p2)
    d3, d4 = _orient(p1, p2, p3), _orient(p1, p2, p4)
    if d1 * d2 < 0 and d3 * d4 < 0:
        return True
    for d, a, b, c in ((d1, p3, p4, p1), (d2, p3, p4, p2), (d3, p1, p2, p3), (d4, p1, p2, p4)):
        if d == 0 and _on_segment(a, b, c):
            return True
    return False


def is_simple_ccw(pts) -> tuple[bool, str]:
    n = len(pts)
    if len(set(map(tuple, pts))) != n:
        return False, "repeated vertex"
    for i in range(n):
        if _orient(pts[i - 1], pts[i], pts[(i + 1) % n]) == 0:
            return False, f"vertex {i} is collinear with its neighbours"
    edges = [(pts[i], pts[(i + 1) % n]) for i in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue
            if _segments_cross(*edges[i], *edges[j]):
                return False, f"edges {i} and {j} cross"
    if shoelace(pts) <= 0:
        return False, "points are not counter-clockwise"
    return True, ""


def is_convex(pts) -> bool:
    n = len(pts)
    return all(_orient(pts[i - 1], pts[i], pts[(i + 1) % n]) > 0 for i in range(n))


def bbox(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def enclose_breakdown(pts):
    """Return (box_area, [corner triangle areas]) if Enclose collapses cleanly, else None.

    Clean means: polygon is convex, every vertex lies on the bounding box, and every
    gap between polygon and box is a right triangle with legs on grid lines.
    """
    if not is_convex(pts):
        return None
    x0, y0, x1, y1 = bbox(pts)
    on_box = lambda p: p[0] in (x0, x1) or p[1] in (y0, y1)
    if not all(on_box(p) for p in pts):
        return None
    corners = []
    n = len(pts)
    for i in range(n):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        if ax == bx or ay == by:
            continue  # edge lies on a grid line; no gap
        corners.append(S(abs(bx - ax)) * abs(by - ay) / 2)
    box = S(x1 - x0) * (y1 - y0)
    if box - sum(corners, S(0)) != shoelace(pts):
        return None  # a gap is not a single right triangle
    return box, corners


def flat_base_triangle(pts) -> bool:
    """Triangle with one edge on a grid line and the apex's foot strictly inside that edge."""
    if len(pts) != 3:
        return False
    for i in range(3):
        a, b, c = pts[i], pts[(i + 1) % 3], pts[(i + 2) % 3]
        if a[1] == b[1] and min(a[0], b[0]) < c[0] < max(a[0], b[0]):
            return True
        if a[0] == b[0] and min(a[1], b[1]) < c[1] < max(a[1], b[1]):
            return True
    return False


def is_tilted_square(pts) -> bool:
    """Four equal sides, equal diagonals, and no side on a grid line."""
    if len(pts) != 4:
        return False
    d2 = lambda a, b: (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    sides = {d2(pts[i], pts[(i + 1) % 4]) for i in range(4)}
    tilted = all(pts[i][0] != pts[(i + 1) % 4][0] and pts[i][1] != pts[(i + 1) % 4][1] for i in range(4))
    return len(sides) == 1 and d2(pts[0], pts[2]) == d2(pts[1], pts[3]) and tilted


def band_triangles(fig):
    """Triangles of a parallel_band figure: base on y=0, apex on y=band_height."""
    b, a, h = fig["bottom_x"], fig["apex_x"], fig["band_height"]
    return [[(S(b[i]), S(0)), (S(b[i + 1]), S(0)), (S(a[i]), S(h))] for i in range(len(a))]


def mirror_touch(fig):
    """Reflect Q across the line; the straight line P->Q' meets the line at AX = ab*pa/(pa+qb)."""
    return S(fig["ab"]) * fig["pa"] / (fig["pa"] + fig["qb"])


def mirror_length(fig, x):
    from sympy import sqrt
    return sqrt(S(x) ** 2 + fig["pa"] ** 2) + sqrt((fig["ab"] - S(x)) ** 2 + fig["qb"] ** 2)


def fig_text(fig):
    """Problem sentence for a figure card, generated from its numbers (used for variants, and checked
    against the card's own text_ja by `text_matches`), so text and figure can never disagree."""
    t = fig["type"]
    if t == "mirror_path":
        u = fig["unit"]
        return (f"点Pと点Qは、まっすぐな川（直線ℓ）の同じ側にあります。PとQから川に垂直に下ろした点をA、Bとすると、"
                f"PA＝{fig['pa']}{u}、QB＝{fig['qb']}{u}、AB＝{fig['ab']}{u}です。PからQまで、とちゅうで川の点Xに1回よって水をくんでいきます。"
                f"道のりがいちばん短くなるとき、AXは何{u}ですか。")
    if t == "parallel_band":
        lb = fig.get("point_labels", {})
        bot = lb.get("bottom") or list("ABCDEF")[:len(fig["bottom_x"])]
        top = lb.get("apex") or list("PQRSTU")[:len(fig["apex_x"])]
        L = S(fig["bottom_x"][-1]) - fig["bottom_x"][0]
        tris = "、".join(bot[i] + bot[i + 1] + top[i] for i in range(len(top)))
        return (f"直線ℓと直線mは平行で、その間は{fig['band_height']}cmです。直線m上の{bot[0]}{bot[-1]}の長さは{_fmt(L)}cmで、"
                f"{'、'.join(bot[1:-1])}は{bot[0]}と{bot[-1]}の間の点です。{'、'.join(top)}は直線ℓ上の点です。"
                f"かげをつけた三角形{tris}の面積の合計は何cm²ですか。")
    if t == "box_unfold":
        u = fig["unit"]
        return (f"直方体ABCD-EFGHがあり、AB＝{fig['a']}{u}、BC＝{fig['b']}{u}、AE＝{fig['h']}{u}です。"
                f"頂点Aから辺BF上の点Pを通って頂点Gまで、直方体の表面に糸をぴんとかけます。"
                f"糸の長さがいちばん短くなるとき、BPは何{u}ですか。")
    return None


def unfold_cross(fig):
    """Open faces ABFE and BCGF flat along BF; the straight line A->G crosses BF at BP = h*a/(a+b)."""
    return S(fig["h"]) * fig["a"] / (fig["a"] + fig["b"])


def unfold_length(fig, p):
    from sympy import sqrt
    return sqrt(S(fig["a"]) ** 2 + S(p) ** 2) + sqrt(S(fig["b"]) ** 2 + (fig["h"] - S(p)) ** 2)


def unfold_steps(fig):
    """Lens steps for box_unfold, generated from the numbers so card, variants and scenes agree."""
    from math import gcd
    a, b, h = fig["a"], fig["b"], fig["h"]
    g = gcd(a, a + b)
    bp = unfold_cross(fig)
    ratio = f"{a}:{a + b}" + (f" = {a // g}:{(a + b) // g}" if g > 1 else "")
    return [
        {"ja": f"辺BFでつながった面ABFEと面BCGFを開いて、1つの長方形にする（横 {a}+{b} = {a + b}、たて {h}）", "op": "note"},
        {"ja": "開いた図でAとGをまっすぐ結ぶ。辺BFと交わる点がP", "op": "note"},
        {"ja": f"三角形ABPとACGは同じ形なので BP:CG = AB:AC = {ratio}", "op": "note"},
        {"ja": f"BP = {h}×{a // g}/{(a + b) // g} = {_fmt(bp)}", "value": str(bp), "op": "result"},
    ]


def wp_solve(fig):
    """Closed-form answer for a word problem (the lens route's result)."""
    k, q = fig["kind"], fig["params"]
    if k == "two_kinds_total":       # n items worth a or b each, total t: how many worth a?
        return S(q["t"] - q["b"] * q["n"]) / (q["a"] - q["b"])
    if k == "age_ratio":             # older p, younger c now: years until older = r x younger
        return S(q["p"] - q["r"] * q["c"]) / (q["r"] - 1)
    if k == "mixture":               # w1 g at p1 %, add ? g at p2 %, get pt %: lever arms (pt-p1):(p2-pt)
        return S(q["w1"]) * (q["pt"] - q["p1"]) / (q["p2"] - q["pt"])
    if k == "meeting":               # d apart, speeds u and v toward each other: freeze one, closing speed u+v
        return S(q["d"]) / (q["u"] + q["v"])
    if k == "average_groups":        # m at average p, ? at average q, all together r: excess over r = dent under r
        return S(q["m"]) * (q["p"] - q["r"]) / (q["r"] - q["q"])
    if k == "shortfall":             # a each leaves s over, b each is d short: how many people?
        return S(q["s"] + q["d"]) / (q["b"] - q["a"])
    if k == "age_ratio_past":        # older p, younger c now: years ago when older = r x younger
        return S(q["r"] * q["c"] - q["p"]) / (q["r"] - 1)
    if k == "same_spend":            # x and y yen, both spend the same: then x' = r y'. How much each?
        return S(q["r"] * q["y"] - q["x"]) / (q["r"] - 1)
    if k == "three_kinds_equal":     # a, b, c each, b and c in equal numbers: pair b+c into their average
        return (q["t"] - S(q["b"] + q["c"]) / 2 * q["n"]) / (q["a"] - S(q["b"] + q["c"]) / 2)
    if k == "pair_offset":           # a and b each, k more of A than B, total t: how many B? (remove k, then pairs)
        return S(q["t"] - q["a"] * q["k"]) / (q["a"] + q["b"])
    if k == "two_kinds_known":       # no lens: both counts known, total value directly
        return S(q["a"] * q["x"] + q["b"] * (q["n"] - q["x"]))
    if k == "age_sum_later":         # no lens: sum of two ages y years from now
        return S(q["p"] + q["c"] + 2 * q["y"])
    if k == "sum_catchup":           # father vs sum of 3 children: gap shrinks by 3-1 = 2 a year
        return S(q["p"] - q["c1"] - q["c2"] - q["c3"]) / 2
    if k == "ratio_shift":           # older:younger now a1:b1, y years later a2:b2: older now?
        P1, P2 = _ratio_parts(q)
        return S(q["y"]) / (P2 - P1) * P1
    if k == "mixture_water":         # w1 g at p1 %, add water (0 %) to get pt %
        return S(q["w1"]) * (q["p1"] - q["pt"]) / q["pt"]
    if k == "mixture_salt":          # w1 g at p1 %, add salt (100 %) to get pt %
        return S(q["w1"]) * (q["pt"] - q["p1"]) / (100 - q["pt"])
    if k == "mix_then_water":        # mix w1 @ p1 with w2 @ p2, then water to pt
        W = q["w1"] + q["w2"]
        m = S(q["w1"] * q["p1"] + q["w2"] * q["p2"]) / W
        return W * (m - q["pt"]) / q["pt"]
    if k == "evaporate":             # w1 g at p1 %, evaporate water to reach pt %
        return q["w1"] - S(q["w1"]) * q["p1"] / q["pt"]
    if k == "salt_total":            # no lens: salt in two solutions
        return S(q["w1"] * q["p1"] + q["w2"] * q["p2"]) / 100
    if k == "chase":                 # slower leaves h min earlier; faster chases: minutes after faster leaves
        return S(q["v"] * q["h"]) / (q["u"] - q["v"])
    if k == "trains_pass":           # two trains toward each other: from meeting to fully apart
        return S(q["l1"] + q["l2"]) / (q["s1"] + q["s2"])
    if k == "clock_overlap":         # minutes after h o'clock when the hands overlap
        return S(30 * q["h"]) / Rational(11, 2)
    if k == "speed_change":          # d m in T min, first at u then at v: minutes at u
        return S(q["d"] - q["v"] * q["T"]) / (q["u"] - q["v"])
    if k == "arrival_gap":           # no lens: same start, same goal, how many minutes earlier
        return S(q["d"]) / q["v"] - S(q["d"]) / q["u"]
    raise ValueError(k)


def _mixed(v) -> str:
    """Japanese mixed number for kids: 180/11 → 16と4/11."""
    v = S(v)
    if v.is_integer:
        return str(v)
    w, r = divmod(v.p, v.q)
    return f"{w}と{r}/{v.q}" if w else f"{r}/{v.q}"


def _ratio_parts(q):
    """Scale both ratios so the (unchanging) difference has the same number of parts: older's parts now and later."""
    from math import lcm
    d1, d2 = q["a1"] - q["b1"], q["a2"] - q["b2"]
    L = lcm(d1, d2)
    return q["a1"] * L // d1, q["a2"] * L // d2


def wp_text(fig, names):
    """The problem sentence for a word problem, generated from its numbers, so text and numbers can never disagree."""
    q = fig["params"]
    if fig["kind"] == "two_kinds_total" and names.get("template") == "count":
        A, B = names["a"], names["b"]
        return f"{A}と{B}が合わせて{q['n']}{names['counter']}あり、{names['part']}の数は合わせて{q['t']}{names['unit']}です。{A}は何{names['counter']}ありますか。"
    if fig["kind"] == "two_kinds_total":
        A, B = names["a"], names["b"]
        return f"{A}と{B}が合わせて{q['n']}{names['counter']}あり、合計{names['measure']}は{q['t']}円です。{A}は何{names['counter']}ありますか。"
    if fig["kind"] == "average_groups":
        return f"1組{q['m']}人のテストの平均点は{q['p']}点、2組の平均点は{q['q']}点で、2つの組を合わせた平均点は{q['r']}点でした。2組は何人ですか。"
    if fig["kind"] == "shortfall":
        it = names["item"]
        return f"何人かの子どもに{it}を配ります。1人に{q['a']}個ずつ配ると{q['s']}個あまり、1人に{q['b']}個ずつ配ると{q['d']}個たりません。子どもは何人ですか。"
    if fig["kind"] == "same_spend":
        o, y = names["older"], names["younger"]
        return f"{o}は{q['x']}円、{y}は{q['y']}円持っています。2人が同じ金額ずつ使ったところ、{o}の残りは{y}の残りの{q['r']}倍になりました。1人何円使いましたか。"
    if fig["kind"] == "age_ratio_past":
        o, y = names["older"], names["younger"]
        return f"いま、{o}は{q['p']}才、{y}は{q['c']}才です。{o}の年れいが{y}の年れいの{q['r']}倍だったのは何年前ですか。"
    if fig["kind"] == "three_kinds_equal":
        it = names["item"]
        return (f"1個{q['a']}円、{q['b']}円、{q['c']}円の3種類の{it}を合わせて{q['n']}個買い、代金は{q['t']}円でした。"
                f"{q['b']}円と{q['c']}円の{it}は同じ数です。{q['a']}円の{it}は何個買いましたか。")
    if fig["kind"] == "pair_offset":
        A, B = names["a"], names["b"]
        return f"1個{q['a']}円の{A}と1個{q['b']}円の{B}を買いました。{A}は{B}より{q['k']}個多く、代金は合わせて{q['t']}円でした。{B}は何個買いましたか。"
    if fig["kind"] == "two_kinds_known":
        A, B = names["a"], names["b"]
        return f"{A}と{B}が合わせて{q['n']}枚あり、そのうち{A}は{q['x']}枚です。合計金額は何円ですか。"
    if fig["kind"] == "age_sum_later":
        o, y = names["older"], names["younger"]
        return f"いま、{o}は{q['p']}才、{y}は{q['c']}才です。{q['y']}年後、2人の年れいの和は何才ですか。"
    if fig["kind"] == "sum_catchup":
        return (f"いま、お父さんは{q['p']}才で、3人の子どもは{q['c1']}才、{q['c2']}才、{q['c3']}才です。"
                f"お父さんの年れいが、子ども3人の年れいの和と等しくなるのは何年後ですか。")
    if fig["kind"] == "mixture_water":
        return f"{q['p1']}%の食塩水{q['w1']}gに水を何g加えると、{q['pt']}%の食塩水になりますか。"
    if fig["kind"] == "mixture_salt":
        return f"{q['p1']}%の食塩水{q['w1']}gに食塩を何g加えると、{q['pt']}%の食塩水になりますか。"
    if fig["kind"] == "mix_then_water":
        return (f"{q['p1']}%の食塩水{q['w1']}gと{q['p2']}%の食塩水{q['w2']}gを混ぜ、さらに水を加えて{q['pt']}%の食塩水にします。"
                f"水を何g加えればよいですか。")
    if fig["kind"] == "evaporate":
        return f"{q['p1']}%の食塩水{q['w1']}gから水を何g蒸発させると、{q['pt']}%の食塩水になりますか。"
    if fig["kind"] == "salt_total":
        return f"{q['p1']}%の食塩水{q['w1']}gと、{q['p2']}%の食塩水{q['w2']}gにふくまれる食塩は、合わせて何gですか。"
    if fig["kind"] == "chase":
        A, B = names["a"], names["b"]
        return (f"{B}が家を出て、分速{q['v']}mで歩き始めました。その{q['h']}分後に、{A}が家を出て、分速{q['u']}mで同じ道を追いかけます。"
                f"{A}が{B}に追いつくのは、{A}が家を出てから何分後ですか。")
    if fig["kind"] == "trains_pass":
        return (f"長さ{q['l1']}mで秒速{q['s1']}mの列車Aと、長さ{q['l2']}mで秒速{q['s2']}mの列車Bが、向かい合って走っています。"
                f"2つの列車が出会ってから完全にはなれるまで、何秒かかりますか。")
    if fig["kind"] == "clock_overlap":
        return f"{q['h']}時と{q['h'] + 1}時の間で、時計の長針と短針が重なるのは、{q['h']}時何分ですか。"
    if fig["kind"] == "speed_change":
        return (f"家から{q['d']}mはなれた公園まで行きます。はじめは分速{q['u']}mで走り、とちゅうから分速{q['v']}mで歩いたところ、"
                f"全部で{q['T']}分かかりました。分速{q['u']}mで走ったのは何分間ですか。")
    if fig["kind"] == "arrival_gap":
        A, B = names["a"], names["b"]
        return f"{A}は分速{q['u']}m、{B}は分速{q['v']}mで、家から{q['d']}mはなれた駅に向かって、同時に家を出ました。{A}は{B}より何分早く駅に着きますか。"
    if fig["kind"] == "ratio_shift":
        o, y = names["older"], names["younger"]
        return (f"いま、{o}と{y}の年れいの比は{q['a1']}:{q['b1']}です。{q['y']}年後には、{o}と{y}の年れいの比は{q['a2']}:{q['b2']}になります。"
                f"いま、{o}は何才ですか。")
    if fig["kind"] == "mixture":
        return f"{q['p1']}%の食塩水{q['w1']}gに、{q['p2']}%の食塩水を何g混ぜると、{q['pt']}%の食塩水になりますか。"
    if fig["kind"] == "meeting":
        A, B = names["a"], names["b"]
        return f"{q['d']}mはなれた道の両はしから、{A}は分速{q['u']}m、{B}は分速{q['v']}mで、向かい合って同時に歩き始めます。2人が出会うのは何分後ですか。"
    o, y = names["older"], names["younger"]
    return f"いま、{o}は{q['p']}才、{y}は{q['c']}才です。{o}の年れいが{y}の年れいの{q['r']}倍になるのは何年後ですか。"


def wp_brute(fig):
    """Every whole-number answer found by trying all cases (the trap route, done by machine)."""
    k, q = fig["kind"], fig["params"]
    if k == "two_kinds_total":
        return [x for x in range(q["n"] + 1) if q["a"] * x + q["b"] * (q["n"] - x) == q["t"]]
    if k == "age_ratio":
        return [y for y in range(0, 120) if q["p"] + y == q["r"] * (q["c"] + y)]
    if k == "mixture":   # salt balance, exact: (w1*p1 + x*p2) / (w1 + x) == pt
        return [x for x in range(1, 5000) if S(q["w1"] * q["p1"] + x * q["p2"]) / (q["w1"] + x) == q["pt"]]
    if k == "meeting":   # minute by minute: distance walked by both == d
        return [t for t in range(0, 600) if (q["u"] + q["v"]) * t == q["d"]]
    if k == "average_groups":   # class size by class size: total points / total people == r
        return [n for n in range(1, 500) if S(q["m"] * q["p"] + n * q["q"]) / (q["m"] + n) == q["r"]]
    if k == "shortfall":        # head count by head count: the two ways need the same number of items
        return [n for n in range(1, 500) if q["a"] * n + q["s"] == q["b"] * n - q["d"]]
    if k == "age_ratio_past":   # year by year back to the younger one's birth
        return [y for y in range(0, q["c"] + 1) if q["p"] - y == q["r"] * (q["c"] - y)]
    if k == "same_spend":       # yen by yen, never more than the smaller amount
        return [z for z in range(0, q["y"] + 1) if q["x"] - z == q["r"] * (q["y"] - z)]
    if k == "three_kinds_equal":   # count of A, the rest split evenly between B and C
        return [x for x in range(q["n"] + 1) if (q["n"] - x) % 2 == 0
                and q["a"] * x + (q["b"] + q["c"]) * (q["n"] - x) // 2 == q["t"]]
    if k == "pair_offset":
        return [m for m in range(0, 500) if q["a"] * (m + q["k"]) + q["b"] * m == q["t"]]
    if k == "two_kinds_known":     # coin by coin
        return [sum([q["a"]] * q["x"] + [q["b"]] * (q["n"] - q["x"]))]
    if k == "age_sum_later":       # year by year
        a, b = q["p"], q["c"]
        for _ in range(q["y"]):
            a, b = a + 1, b + 1
        return [a + b]
    if k == "sum_catchup":
        s0 = q["c1"] + q["c2"] + q["c3"]
        return [y for y in range(0, 200) if q["p"] + y == s0 + 3 * y]
    if k == "mixture_water":       # gram by gram of water: salt stays w1*p1
        return [x for x in range(1, 5000) if S(q["w1"] * q["p1"]) / (q["w1"] + x) == q["pt"]]
    if k == "mixture_salt":        # gram by gram of salt
        return [x for x in range(1, 2000) if S(q["w1"] * q["p1"] + 100 * x) / (q["w1"] + x) == q["pt"]]
    if k == "mix_then_water":
        W, salt = q["w1"] + q["w2"], q["w1"] * q["p1"] + q["w2"] * q["p2"]
        return [x for x in range(1, 5000) if S(salt) / (W + x) == q["pt"]]
    if k == "evaporate":
        return [x for x in range(1, q["w1"]) if S(q["w1"] * q["p1"]) / (q["w1"] - x) == q["pt"]]
    if k == "salt_total":          # gram by gram is pointless; add the two products the long way
        return [sum(Rational(q["p1"], 100) for _ in range(q["w1"])) + sum(Rational(q["p2"], 100) for _ in range(q["w2"]))]
    if k == "chase":               # minute by minute after the faster one leaves
        return [t for t in range(1, 600) if q["u"] * t == q["v"] * (q["h"] + t)]
    if k == "trains_pass":         # second by second: combined travel covers both lengths
        return [t for t in range(1, 600) if (q["s1"] + q["s2"]) * t == q["l1"] + q["l2"]]
    if k == "clock_overlap":       # every 1/11 minute between h:00 and h+1:00
        return [Rational(k11, 11) for k11 in range(0, 660) if 6 * Rational(k11, 11) == 30 * q["h"] + Rational(1, 2) * Rational(k11, 11)]
    if k == "speed_change":        # minute by minute of running
        return [x for x in range(0, q["T"] + 1) if q["u"] * x + q["v"] * (q["T"] - x) == q["d"]]
    if k == "arrival_gap":
        return [S(q["d"]) / q["v"] - S(q["d"]) / q["u"]]
    if k == "ratio_shift":         # every older/younger pair now
        return [o for o in range(1, 120) for u in range(1, o)
                if o * q["b1"] == u * q["a1"] and (o + q["y"]) * q["b2"] == (u + q["y"]) * q["a2"]]
    raise ValueError(k)


def stray_name_numbers(names, text, steps):
    """Numbers printed in diagram labels (figure.names) that appear nowhere in the problem text or lens steps (#63)."""
    import re
    seen = set(re.findall(r"\d+", text + " ".join(st["ja"] for st in steps)))
    return sorted({n for v in names.values() for n in re.findall(r"\d+", str(v))} - seen)


def wp_diagram(fig):
    """Diagram family and its numbers for the apps (WO-015). Sizes only: printed numbers come from the steps."""
    k, q = fig["kind"], fig["params"]
    x = wp_solve(fig)
    xs = str(x)
    if k == "two_kinds_total":
        names = fig.get("names", {})
        return {"family": "area_two_rect", "unit": names.get("unit", "円" if names.get("measure") == "金額" else ""),
                "n": q["n"], "a": q["a"], "b": q["b"], "t": q["t"], "x": xs}
    if k == "average_groups":
        return {"family": "area_average", "w1": q["m"], "h1": q["p"], "h2": q["q"], "level": q["r"], "w2": xs}
    if k == "shortfall":
        return {"family": "area_shortfall", "a": q["a"], "b": q["b"], "s": q["s"], "d": q["d"], "n": xs}
    if k == "age_ratio":
        return {"family": "diff_bars", "measure": "age", "step": 1, "big": q["p"], "small": q["c"], "r": q["r"], "dir": 1, "shift": xs}
    if k == "age_ratio_past":
        return {"family": "diff_bars", "measure": "age", "step": 1, "big": q["p"], "small": q["c"], "r": q["r"], "dir": -1, "shift": xs}
    if k == "same_spend":
        return {"family": "diff_bars", "measure": "yen", "step": 100, "big": q["x"], "small": q["y"], "r": q["r"], "dir": -1, "shift": xs}
    if k == "three_kinds_equal":
        avg = S(q["b"] + q["c"]) / 2
        return {"family": "area_two_rect", "unit": "円", "n": q["n"], "a": q["a"], "b": int(avg), "t": q["t"], "x": xs}
    if k in ("pair_offset", "two_kinds_known", "age_sum_later", "sum_catchup", "ratio_shift",
             "mix_then_water", "evaporate", "salt_total", "trains_pass", "clock_overlap", "arrival_gap"):
        return {"family": "steps_only"}
    if k == "mixture_water":
        return {"family": "lever", "unit_w": "g", "unit_p": "%", "w1": q["w1"], "p1": q["p1"], "p2": 0, "pt": q["pt"], "w2": xs}
    if k == "mixture_salt":
        return {"family": "lever", "unit_w": "g", "unit_p": "%", "w1": q["w1"], "p1": q["p1"], "p2": 100, "pt": q["pt"], "w2": xs}
    if k == "chase":
        return {"family": "road", "mode": "chase", "d": q["v"] * q["h"], "u": q["u"], "v": q["v"], "t": xs}
    if k == "speed_change":
        return {"family": "area_two_rect", "unit": "m", "n": q["T"], "a": q["u"], "b": q["v"], "t": q["d"], "x": xs}
    if k == "mixture":
        return {"family": "lever", "unit_w": "g", "unit_p": "%", "w1": q["w1"], "p1": q["p1"], "p2": q["p2"], "pt": q["pt"], "w2": xs}
    if k == "meeting":
        return {"family": "road", "mode": "toward", "d": q["d"], "u": q["u"], "v": q["v"], "t": xs}
    raise ValueError(k)


# ------------------------------------------------------------------ checks ---

def route_total(route) -> Rational | None:
    total, result = None, None
    for step in route["steps"]:
        op = step.get("op")
        if op in (None, "note"):
            continue
        v = sympify(step["value"])
        if op == "start":
            total = v
        elif op == "add":
            total = (total or 0) + v
        elif op == "sub":
            total = (total or 0) - v
        elif op == "result":
            result = v
    if result is not None and total is not None and result != total:
        return None  # result line contradicts its own arithmetic
    return result if result is not None else total


def run_check(card, check, pts) -> tuple[bool, str]:
    t = check["type"]
    ans = sympify(card["answer"]["value"])
    fig = card["problem"]["figure"]
    g = fig.get("grid")
    if t == "wp_formula":
        x = wp_solve(fig)
        return x == ans, f"lens formula gives {x}, answer = {ans}"
    if t == "wp_unique":
        sols = wp_brute(fig)
        return sols == [ans], f"trying every case finds exactly {sols}"
    if t == "wp_names_match":
        stray = stray_name_numbers(fig.get("names", {}), card["problem"]["text_ja"], card["lens_route"]["steps"])
        return not stray, "every number in the diagram labels appears in the text or steps" if not stray else f"labels print numbers not in the problem: {stray}"
    if t == "wp_text_matches":
        want = wp_text(fig, fig.get("names", {}))
        return card["problem"]["text_ja"] == want, "problem text matches its numbers" if card["problem"]["text_ja"] == want else f"text should be: {want}"
    if t == "wp_nontrivial":
        q = fig["params"]
        if fig["kind"] == "two_kinds_total":
            ok = 0 < ans < q["n"] and q["a"] != q["b"] and 2 * ans != q["n"]
            return ok, "both kinds appear and the answer is not simply half"
        if fig["kind"] == "mixture":
            ok = q["p1"] < q["pt"] < q["p2"] and ans > 0 and (q["pt"] - q["p1"]) != (q["p2"] - q["pt"])
            return ok, "target strength lies between the two, and the arms are unequal (not simply equal amounts)"
        if fig["kind"] == "meeting":
            ok = ans > 1 and q["u"] != q["v"]
            return ok, "different speeds, so meeting at the halfway point is a wrong guess"
        if fig["kind"] == "average_groups":
            ok = q["q"] < q["r"] < q["p"] and ans > 0 and ans != q["m"] and 2 * q["r"] != q["p"] + q["q"]
            return ok, "overall average lies between the two and is not their midpoint (classes differ in size)"
        if fig["kind"] == "shortfall":
            ok = q["b"] - q["a"] >= 2 and q["s"] > 0 and q["d"] > 0 and ans >= 3
            return ok, "one way leaves some over, the other is short, and the gap per person is more than 1"
        if fig["kind"] == "three_kinds_equal":
            ok = (q["b"] + q["c"]) % 2 == 0 and 0 < ans < q["n"] and (q["n"] - ans) % 2 == 0 and q["b"] != q["c"]
            return ok, "B and C pair into a whole-yen average, and every kind appears"
        if fig["kind"] == "pair_offset":
            ok = ans >= 2 and q["k"] >= 1 and q["a"] != q["b"]
            return ok, "both kinds appear and the count difference matters"
        if fig["kind"] == "two_kinds_known":
            ok = 0 < q["x"] < q["n"] and q["a"] != q["b"]
            return ok, "both counts are known (the area diagram is not needed)"
        if fig["kind"] == "age_sum_later":
            ok = q["y"] >= 2 and q["p"] > q["c"]
            return ok, "a sum later, not a ratio: the difference is not needed"
        if fig["kind"] == "sum_catchup":
            s0 = q["c1"] + q["c2"] + q["c3"]
            ok = ans > 0 and q["p"] > s0 and len({q["c1"], q["c2"], q["c3"]}) == 3
            return ok, "the gap is not constant: it shrinks by 2 a year (差一定 does not apply)"
        if fig["kind"] == "mixture_water":
            ok = 0 < q["pt"] < q["p1"] and ans > 0
            return ok, "water (0 %) weakens the solution: the target lies between 0 and the start"
        if fig["kind"] == "mixture_salt":
            ok = q["p1"] < q["pt"] < 100 and ans > 0
            return ok, "salt counts as 100 %: the target lies between the start and 100"
        if fig["kind"] == "mix_then_water":
            m = S(q["w1"] * q["p1"] + q["w2"] * q["p2"]) / (q["w1"] + q["w2"])
            ok = q["p1"] < q["p2"] and m.is_integer and 0 < q["pt"] < m and q["w1"] != q["w2"] and ans > 0
            return ok, "two levers in a row: the first mix is a whole percent and stronger than the target"
        if fig["kind"] == "evaporate":
            ok = q["p1"] < q["pt"] and 0 < ans < q["w1"]
            return ok, "evaporating water strengthens the solution; the salt amount is unchanged"
        if fig["kind"] == "salt_total":
            ok = q["p1"] != q["p2"]
            return ok, "a direct amount of salt: no mixing ratio is asked"
        if fig["kind"] == "chase":
            ok = q["u"] > q["v"] and ans >= 2 and q["u"] != 2 * q["v"]
            return ok, "the faster one starts later and catches up (not exactly twice as fast, where the answer just repeats the head start)"
        if fig["kind"] == "trains_pass":
            ok = q["l1"] != q["l2"] and q["s1"] != q["s2"] and ans >= 2
            return ok, "both trains move and both lengths count"
        if fig["kind"] == "clock_overlap":
            ok = 1 <= q["h"] <= 10
            return ok, "the overlap falls strictly between h:00 and h+1:00"
        if fig["kind"] == "speed_change":
            ok = 0 < ans < q["T"] and q["u"] > q["v"]
            return ok, "both speeds are used for some minutes (a speed story that is really 面積図)"
        if fig["kind"] == "arrival_gap":
            ok = ans > 0 and (S(q["d"]) / q["u"]).is_integer and (S(q["d"]) / q["v"]).is_integer
            return ok, "both travel times are whole minutes; the two never meet, so no relative speed"
        if fig["kind"] == "ratio_shift":
            d1, d2 = q["a1"] - q["b1"], q["a2"] - q["b2"]
            ok = d1 != d2 and q["a2"] * q["b1"] < q["a1"] * q["b2"] and ans > 0
            return ok, "the two ratios have different differences, so they must be lined up first"
        if fig["kind"] in ("age_ratio_past", "same_spend"):
            big, small = (q["p"], q["c"]) if fig["kind"] == "age_ratio_past" else (q["x"], q["y"])
            then_small = small - ans
            ok = ans > 0 and then_small >= 1 and q["r"] >= 2 and big > small
            return ok, "the moment is in the past / after spending, the smaller amount stays positive, and the ratio is at least 2"
        ok = ans > 0 and q["p"] > q["c"] and q["r"] >= 2
        return ok, "the moment is in the future and the ratio is at least 2"
    if t == "mirror_touch_point":
        x = mirror_touch(fig)
        return x == ans, f"reflection gives AX = {x}, answer = {ans}"
    if t == "mirror_shortest":
        x = mirror_touch(fig)
        best = mirror_length(fig, x)
        probes = [x + d for d in (S(-1), S(-1) / 2, S(1) / 2, S(1))] + [S(0), S(fig["ab"])]
        ok = all((mirror_length(fig, q) - best).evalf(30) > 0 for q in probes if q != x)
        return ok, f"path through AX = {x} is shorter than through nearby points and both ends"
    if t == "mirror_not_midpoint":
        ok = fig["pa"] != fig["qb"]
        return ok, "P and Q are at different distances, so the halfway guess is wrong"
    if t == "text_matches":
        want = fig_text(fig)
        ok = want is not None and card["problem"]["text_ja"] == want
        return ok, "problem text matches its figure numbers" if ok else f"text should be: {want}"
    if t == "unfold_cross_point":
        x = unfold_cross(fig)
        return x == ans, f"straight line on the net gives BP = {x}, answer = {ans}"
    if t == "unfold_shortest":
        x = unfold_cross(fig)
        best = unfold_length(fig, x)
        probes = [x + d for d in (S(-1), S(-1) / 2, S(1) / 2, S(1))] + [S(0), S(fig["h"])]
        ok = 0 < x < fig["h"] and all((unfold_length(fig, q) - best).evalf(30) > 0 for q in probes if q != x)
        return ok, f"path through BP = {x} is shorter than through nearby points and both ends of BF"
    if t == "unfold_not_midpoint":
        ok = fig["a"] != fig["b"]
        return ok, "AB and BC differ, so the halfway guess on BF is wrong"
    if t == "band_triangles_disjoint":
        b, a = fig["bottom_x"], fig["apex_x"]
        ok = len(a) == len(b) - 1 and all(x < y for x, y in zip(b, b[1:])) and all(x < y for x, y in zip(a, a[1:]))
        return ok, "one apex per base, bases and apexes both in increasing order (triangles do not overlap)"
    if t == "band_total_only":
        sh = fig["shown"]
        ok = sh["total_base"] and sh["band_height"] and not sh["each_base"]
        return ok, "only the total base and the band height are given; the individual bases are not"
    if t == "band_area_equals_answer":
        tris = band_triangles(fig)
        total = sum((abs(shoelace(tr)) for tr in tris), S(0))
        merged = S(fig["bottom_x"][-1] - fig["bottom_x"][0]) * fig["band_height"] / 2
        return total == ans == merged, f"sum of triangles={total}, one merged triangle={merged}, answer={ans}"
    if t == "lattice_only":
        ok = all(0 <= x <= g["width"] and 0 <= y <= g["height"] for x, y in pts)
        return ok, "all vertices are grid points inside the drawn grid"
    if t == "simple_polygon":
        ok, why = is_simple_ccw(pts)
        return ok, why or "simple, counter-clockwise polygon"
    if t == "area_equals_answer":
        area = shoelace(pts) * S(g["cell_cm"]) ** 2
        sp = Polygon(*[Point(*p) for p in pts]).area * S(g["cell_cm"]) ** 2
        return area == ans and abs(sp) == ans, f"shoelace={area}, sympy={abs(sp)}, answer={ans}"
    if t == "route_steps_sum":
        tot = route_total(card[check["route"]])
        return tot == ans, f"{check['route']} steps give {tot}, answer={ans}"
    if t == "enclose_clean":
        bd = enclose_breakdown(pts)
        return bd is not None, f"box={bd[0]}, corners={bd[1]}" if bd else "a gap is not a right triangle"
    if t == "enclose_not_clean":
        return enclose_breakdown(pts) is None, "Enclose leaves a gap that is not a right triangle"
    if t == "has_horizontal_base":
        return flat_base_triangle(pts), "triangle with a base on a grid line and apex above it"
    if t == "tilted_square":
        return is_tilted_square(pts), "four equal sides, equal diagonals, no side on a grid line"
    if t == "lens_faster":
        a, b = card["lens_route"]["time_cost_sec"], card["trap_route"]["time_cost_sec"]
        return a < b, f"lens {a}s vs trap {b}s"
    return False, f"unknown check {t}"


# -------------------------------------------------------------- generators ---

def gen_enclose_standard(rng, c):
    w, h = rng.randint(c.get("min", 4), c.get("max", 8)), rng.randint(c.get("min", 4), c.get("max", 8))
    return [(rng.randint(1, w - 1), 0), (w, rng.randint(1, h - 1)),
            (rng.randint(1, w - 1), h), (0, rng.randint(1, h - 1))]


def gen_enclose_tilted_square(rng, c):
    # side vector (b, a): box is (a + b) square, four congruent a×b corner triangles
    while True:
        a, b = rng.randint(1, c.get("max", 8) - 1), rng.randint(1, c.get("max", 8) - 1)
        if a != b and c.get("min", 4) <= a + b <= c.get("max", 8):
            return [(a, 0), (a + b, a), (b, a + b), (0, b)]


def gen_enclose_triangle(rng, c):
    # one vertex on a box corner, one on the left side, one on the top side
    w, h = rng.randint(c.get("min", 4), c.get("max", 8)), rng.randint(c.get("min", 4), c.get("max", 8))
    return [(0, rng.randint(1, h - 1)), (w, 0), (rng.randint(1, w - 1), h)]


def gen_enclose_failure_notch(rng, c):
    # Notch on the left side: (0,h) -> q1 -> q2 -> (0,0), two vertices inside the box.
    # q2 is the deepest point (largest x), so a vertical cut at x = q2.x leaves pieces
    # that all have a base on a grid line (see steps_failure_notch).
    w, h = rng.randint(c.get("min", 5), c.get("max", 8)), rng.randint(c.get("min", 5), c.get("max", 8))
    m = rng.randint(2, w - 2)
    q2 = (m, rng.randint(1, h - 3))
    q1 = (rng.randint(1, m - 1), rng.randint(q2[1] + 1, h - 1))
    return [(0, 0), (w, 0), (w, h), (0, h), q1, q2]


def gen_no_lens_flat_base(rng, c):
    w, h = rng.randint(c.get("min", 5), c.get("max", 9)), rng.randint(c.get("min", 3), c.get("max", 7))
    return [(0, 0), (w, 0), (rng.randint(1, w - 1), h)]


GENERATORS = {
    "enclose_standard": gen_enclose_standard,
    "enclose_tilted_square": gen_enclose_tilted_square,
    "enclose_triangle": gen_enclose_triangle,
    "enclose_failure_notch": gen_enclose_failure_notch,
    "no_lens_flat_base": gen_no_lens_flat_base,
}


# ------------------------------------------------------- variant lens steps ---
# Each builder returns lens-route steps in the card step format, or None if the
# variant cannot be explained by that move (the variant is then dropped).

def _fmt(v) -> str:
    v = S(v)
    return str(v) if v.is_integer else f"{float(v):g}"


def steps_enclose(pts):
    bd = enclose_breakdown(pts)
    if not bd:
        return None
    box, corners = bd
    x0, y0, x1, y1 = bbox(pts)
    steps = [{"ja": f"{x1 - x0}×{y1 - y0}の長方形で囲む", "value": str(box), "op": "start"}]
    n = len(pts)
    for i in range(n):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        if ax == bx or ay == by:
            continue
        dx, dy = abs(bx - ax), abs(by - ay)
        steps.append({"ja": f"すみの三角形 {dx}×{dy}÷2", "value": str(S(dx) * dy / 2), "op": "sub"})
    area = box - sum(corners, S(0))
    steps.append({"ja": f"{_fmt(box)} − {_fmt(sum(corners, S(0)))} = {_fmt(area)}", "value": str(area), "op": "result"})
    return steps


def steps_failure_notch(pts):
    (_, _), (w, _), (_, h), _, q1, q2 = pts
    m = q2[0]
    if not (q1[0] < m and q1[1] > q2[1]):
        return None
    rect = S(w - m) * h
    bottom = S(m) * q2[1] / 2
    side = S(h - q2[1]) * (m - q1[0]) / 2
    top = S(m) * (h - q1[1]) / 2
    total = rect + bottom + side + top
    if total != shoelace(pts):
        return None  # the cut does not split the shape into these pieces
    return [
        {"ja": f"縦の線 x={m} で切る。右側は{w - m}×{h}の長方形", "value": str(rect), "op": "start"},
        {"ja": f"左下の三角形 {m}×{q2[1]}÷2", "value": str(bottom), "op": "add"},
        {"ja": f"縦の辺を底辺とする三角形 {h - q2[1]}×{m - q1[0]}÷2", "value": str(side), "op": "add"},
        {"ja": f"上の辺を底辺とする三角形 {m}×{h - q1[1]}÷2", "value": str(top), "op": "add"},
        {"ja": f"合計 {_fmt(total)}", "value": str(total), "op": "result"},
    ]


def steps_no_lens(pts):
    if not flat_base_triangle(pts):
        return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    base, height = max(xs) - min(xs), max(ys) - min(ys)
    area = S(base) * height / 2
    return [
        {"ja": f"底辺は横の線に乗っている：{base}", "op": "note"},
        {"ja": f"高さは方眼で読める：{height}", "op": "note"},
        {"ja": f"{base}×{height}÷2 = {_fmt(area)}", "value": str(area), "op": "result"},
    ]


STEP_BUILDERS = {
    "enclose_standard": steps_enclose,
    "enclose_tilted_square": steps_enclose,
    "enclose_triangle": steps_enclose,
    "enclose_failure_notch": steps_failure_notch,
    "no_lens_flat_base": steps_no_lens,
}

# Structural checks a variant must keep, so it still needs the same move.
VARIANT_CHECKS = {"lattice_only", "simple_polygon", "enclose_clean", "enclose_not_clean", "has_horizontal_base", "tilted_square"}


def make_band_variants(card):
    """slide_band: new total base, band height and splits; apexes stay in order. Answer = total × height ÷ 2."""
    v = card["variants"]
    rng = random.Random(v["seed"])
    c = v.get("constraints", {})
    fig0 = card["problem"]["figure"]
    k = len(fig0["apex_x"])
    seen = {(tuple(fig0["bottom_x"]), tuple(fig0["apex_x"]), fig0["band_height"])}
    used_h, used_L = {fig0["band_height"]}, {fig0["bottom_x"][-1] - fig0["bottom_x"][0]}  # each variant gets a fresh height and base
    out, tries = [], 0
    while len(out) < v["count"] and tries < 2000:
        tries += 1
        L = rng.randint(c.get("min_base", 8), c.get("max_base", 14))
        h = rng.randint(c.get("min_height", 3), c.get("max_height", 8))
        if L < k + 1 or h in used_h or L in used_L:
            continue
        bottom = [0] + sorted(rng.sample(range(1, L), k - 1)) + [L]
        apex = sorted(rng.sample(range(0, L + 1), k))
        key = (tuple(bottom), tuple(apex), h)
        if key in seen:
            continue
        fig = {**fig0, "bottom_x": bottom, "apex_x": apex, "band_height": h}
        area = S(L) * h / 2
        vcard = {**card, "answer": {**card["answer"], "value": str(area)}, "problem": {**card["problem"], "figure": fig}}
        if not all(run_check(vcard, ch, None)[0] for ch in card["checks"] if ch["type"].startswith("band_")):
            continue
        steps = [
            {"ja": "頂点を直線ℓにそって1点に集める（面積は変わらない）", "op": "note"},
            {"ja": f"底辺{L}、高さ{h}の1つの三角形になる", "op": "note"},
            {"ja": f"{L}×{h}÷2 = {_fmt(area)}", "value": str(area), "op": "result"},
        ]
        if route_total({"steps": steps}) != area:
            continue
        seen.add(key); used_h.add(h); used_L.add(L)
        out.append({"id": f"{card['id']}-v{len(out) + 1}", "text_ja": fig_text(fig), "figure": {"bottom_x": bottom, "apex_x": apex, "band_height": h},
                    "answer": str(area), "lens_route": {"steps": steps}})
    return out


def make_mirror_variants(card):
    """mirror_path: new ab, pa, qb with an exact, simple touch point (AX a whole number)."""
    v = card["variants"]
    rng = random.Random(v["seed"])
    c = v.get("constraints", {})
    fig0 = card["problem"]["figure"]
    from math import gcd as _g
    ratio = lambda a, b: (a // _g(a, b), b // _g(a, b))
    used_ratios, used_ab = {ratio(fig0["pa"], fig0["qb"])}, {fig0["ab"]}
    seen = {(fig0["ab"], fig0["pa"], fig0["qb"])}
    out, tries = [], 0
    while len(out) < v["count"] and tries < 20000:
        tries += 1
        pa, qb = rng.randint(c.get("min_side", 2), c.get("max_side", 10)), rng.randint(c.get("min_side", 2), c.get("max_side", 10))
        ab = rng.randint(c.get("min_ab", 6), c.get("max_ab", 20))
        # each variant teaches something new: a fresh ratio and a fresh length
        if pa == qb or (ab * pa) % (pa + qb) or ratio(pa, qb) in used_ratios or ab in used_ab:
            continue
        fig = {**fig0, "ab": ab, "pa": pa, "qb": qb}
        x = mirror_touch(fig)
        vcard = {**card, "answer": {**card["answer"], "value": str(x)}, "problem": {**card["problem"], "figure": fig}}
        if not all(run_check(vcard, ch, None)[0] for ch in card["checks"] if ch["type"].startswith("mirror_")):
            continue
        from math import gcd
        g = gcd(pa, qb)
        steps = [
            {"ja": "Qを川で折り返した点Q'をとる（XQ＝XQ'）", "op": "note"},
            {"ja": "PからQ'へまっすぐ線を引く。川と交わる点がX", "op": "note"},
            {"ja": f"三角形PAXとQ'BXは同じ形なので AX:XB = {pa}:{qb}" + (f" = {pa // g}:{qb // g}" if g > 1 else ""), "op": "note"},
            {"ja": f"AX = {ab}×{pa // g}/{(pa + qb) // g} = {_fmt(x)}", "value": str(x), "op": "result"},
        ]
        seen.add((ab, pa, qb)); used_ratios.add(ratio(pa, qb)); used_ab.add(ab)
        out.append({"id": f"{card['id']}-v{len(out) + 1}", "text_ja": fig_text(fig), "figure": {"ab": ab, "pa": pa, "qb": qb},
                    "answer": str(x), "lens_route": {"steps": steps}})
    return out


def make_unfold_variants(card):
    """box_unfold: new a, b, h with a whole-number BP, a fresh ratio and a fresh height."""
    v = card["variants"]
    rng = random.Random(v["seed"])
    c = v.get("constraints", {})
    fig0 = card["problem"]["figure"]
    from math import gcd as _g
    ratio = lambda a, b: (a // _g(a, b), b // _g(a, b))
    used_ratios, used_h = {ratio(fig0["a"], fig0["b"])}, {fig0["h"]}
    used_ans = {sympify(card["answer"]["value"])}
    out, tries = [], 0
    while len(out) < v["count"] and tries < 20000:
        tries += 1
        a, b = rng.randint(c.get("min_side", 2), c.get("max_side", 12)), rng.randint(c.get("min_side", 2), c.get("max_side", 12))
        h = rng.randint(c.get("min_h", 3), c.get("max_h", 15))
        if a == b or (h * a) % (a + b) or ratio(a, b) in used_ratios or h in used_h or S(h * a) / (a + b) in used_ans:
            continue
        fig = {**fig0, "a": a, "b": b, "h": h}
        x = unfold_cross(fig)
        vcard = {**card, "answer": {**card["answer"], "value": str(x)}, "problem": {**card["problem"], "figure": fig}}
        if not all(run_check(vcard, ch, None)[0] for ch in card["checks"] if ch["type"].startswith("unfold_")):
            continue
        steps = unfold_steps(fig)
        if route_total({"steps": steps}) != x:
            continue
        used_ratios.add(ratio(a, b)); used_h.add(h); used_ans.add(x)
        out.append({"id": f"{card['id']}-v{len(out) + 1}", "text_ja": fig_text(fig), "figure": {"a": a, "b": b, "h": h},
                    "answer": str(x), "lens_route": {"steps": steps}})
    return out


def make_wp_variants(card):
    """Word-problem variants: fresh numbers, same model, same lens steps template."""
    v = card["variants"]
    rng = random.Random(v["seed"])
    fig0 = card["problem"]["figure"]
    names = fig0.get("names", {})
    seen, out, tries = {tuple(sorted(fig0["params"].items()))}, [], 0
    used_answers = {sympify(card["answer"]["value"])}
    while len(out) < v["count"] and tries < 20000:
        tries += 1
        vnames = dict(names)
        if fig0["kind"] == "two_kinds_total" and names.get("template") == "count":
            # the story fixes the per-item numbers (4 wheels, 2 wheels); only the counts change
            a, b = fig0["params"]["a"], fig0["params"]["b"]
            n = rng.randint(12, 36); x = rng.randint(3, n - 3)
            q = {"n": n, "a": a, "b": b, "t": a * x + b * (n - x)}
        elif fig0["kind"] == "two_kinds_total":
            a, b = rng.choice([(50, 10), (100, 10), (100, 50), (10, 5), (50, 5)])
            n = rng.randint(12, 30); x = rng.randint(1, n - 1)
            q = {"n": n, "a": a, "b": b, "t": a * x + b * (n - x)}
            vnames.update({"a": f"{a}円玉", "b": f"{b}円玉"})
        elif fig0["kind"] == "mixture":
            p1 = rng.randint(2, 8); p2 = rng.randint(p1 + 4, 20); pt = rng.randint(p1 + 1, p2 - 1)
            w1 = rng.choice([100, 150, 200, 240, 300, 400])
            q = {"w1": w1, "p1": p1, "p2": p2, "pt": pt}
            # whole grams, and a believable amount: between half and twice the first solution
            if (w1 * (pt - p1)) % (p2 - pt) or not (w1 // 2 <= w1 * (pt - p1) // (p2 - pt) <= 2 * w1):
                continue
        elif fig0["kind"] == "meeting":
            su = rng.randint(5, 10) * 10; sv = rng.randint(4, 9) * 10; tt = rng.randint(6, 20)
            q = {"d": (su + sv) * tt, "u": su, "v": sv}
        elif fig0["kind"] == "average_groups":
            m = rng.randint(20, 36); r = rng.randint(58, 80)
            up = rng.randint(2, 9); dn = rng.randint(2, 12)
            q = {"m": m, "p": r + up, "q": r - dn, "r": r}
            if (m * up) % dn or not (8 <= m * up // dn <= 40):
                continue
        elif fig0["kind"] == "shortfall":
            a = rng.randint(2, 6); b = a + rng.randint(2, 4); n = rng.randint(5, 18)
            gap = (b - a) * n; s = rng.randint(1, gap - 1)
            q = {"a": a, "s": s, "b": b, "d": gap - s}
        elif fig0["kind"] == "age_ratio_past":
            cons = v.get("constraints", {})
            r = rng.randint(*cons.get("r", [2, 5])); then_c = rng.randint(2, 9); y = rng.randint(2, 10)
            q = {"p": r * then_c + y, "c": then_c + y, "r": r}
            lo, hi = cons.get("p", [25, 50])
            if not (lo <= q["p"] <= hi) or q["p"] - q["c"] < cons.get("min_diff", 20):
                continue
        elif fig0["kind"] == "three_kinds_equal":
            b, c = rng.choice([(60, 40), (70, 50), (90, 50), (60, 20), (80, 40)])
            a = rng.choice([x for x in (80, 100, 110, 120, 130, 150) if x > (b + c) // 2 + 10 and x != b])
            pairs = rng.randint(3, 9); x = rng.randint(3, 12); n = x + 2 * pairs
            q = {"n": n, "a": a, "b": b, "c": c, "t": a * x + (b + c) * pairs}
            vnames.update({"a": f"{a}円の{names.get('item', 'お菓子')}", "b": f"平均{(b + c) // 2}円"})
        elif fig0["kind"] == "pair_offset":
            a, b = rng.choice([(120, 70), (150, 90), (130, 80), (110, 60), (140, 50)])
            k = rng.randint(2, 6); m = rng.randint(4, 14)
            q = {"a": a, "b": b, "k": k, "t": a * (m + k) + b * m}
        elif fig0["kind"] == "two_kinds_known":
            a, b = rng.choice([(50, 10), (100, 10), (100, 50), (10, 5), (50, 5)])
            n = rng.randint(12, 30); x = rng.randint(2, n - 2)
            q = {"n": n, "a": a, "b": b, "x": x}
            vnames.update({"a": f"{a}円玉", "b": f"{b}円玉"})
        elif fig0["kind"] == "age_sum_later":
            c = rng.randint(5, 13); p = c + rng.randint(2, 8); y = rng.randint(2, 9)
            q = {"p": p, "c": c, "y": y}
        elif fig0["kind"] == "sum_catchup":
            c3 = rng.randint(2, 6); c2 = c3 + rng.randint(1, 3); c1 = c2 + rng.randint(1, 3); y = rng.randint(4, 15)
            q = {"p": c1 + c2 + c3 + 2 * y, "c1": c1, "c2": c2, "c3": c3}
            if not (30 <= q["p"] <= 50):
                continue
        elif fig0["kind"] == "mixture_water":
            p1 = rng.randint(5, 15); pt = rng.randint(2, p1 - 1); w1 = rng.choice([100, 150, 200, 240, 300, 400, 500])
            q = {"w1": w1, "p1": p1, "pt": pt}
            if (w1 * (p1 - pt)) % pt or not (20 <= w1 * (p1 - pt) // pt <= 2 * w1):
                continue
        elif fig0["kind"] == "mixture_salt":
            p1 = rng.randint(2, 15); pt = rng.randint(p1 + 1, 25); w1 = rng.randint(4, 30) * 10
            q = {"w1": w1, "p1": p1, "pt": pt}
            if (w1 * (pt - p1)) % (100 - pt) or not (5 <= w1 * (pt - p1) // (100 - pt) <= 100):
                continue
        elif fig0["kind"] == "mix_then_water":
            p1 = rng.randint(2, 8); p2 = rng.randint(p1 + 3, 16)
            w1 = rng.choice([100, 200, 300, 400]); w2 = rng.choice([100, 200, 300, 400, 600])
            m = S(w1 * p1 + w2 * p2) / (w1 + w2)
            if not m.is_integer or m - 1 < 2:
                continue
            pt = rng.randint(2, int(m) - 1)
            q = {"w1": w1, "p1": p1, "w2": w2, "p2": p2, "pt": pt}
            W = w1 + w2
            if (W * (int(m) - pt)) % pt:
                continue
        elif fig0["kind"] == "evaporate":
            p1 = rng.randint(2, 10); pt = rng.randint(p1 + 1, 20); w1 = rng.randint(2, 12) * 50
            q = {"w1": w1, "p1": p1, "pt": pt}
            if (w1 * p1) % 100 or ((w1 * p1) * 100 // 100) % pt or (w1 * p1) % pt:
                continue
        elif fig0["kind"] == "salt_total":
            p1 = rng.randint(2, 12); p2 = rng.randint(2, 12); w1 = rng.randint(1, 8) * 50; w2 = rng.randint(1, 8) * 50
            q = {"w1": w1, "p1": p1, "w2": w2, "p2": p2}
            if (w1 * p1) % 100 or (w2 * p2) % 100:
                continue
        elif fig0["kind"] == "chase":
            sv = rng.randint(5, 8) * 10; u = sv + rng.randint(1, 5) * 10; h = rng.randint(3, 15)
            q = {"u": u, "v": sv, "h": h}
            if (sv * h) % (u - sv) or (sv * h) // (u - sv) > 30:
                continue
        elif fig0["kind"] == "trains_pass":
            l1 = rng.randint(8, 30) * 10; l2 = rng.randint(8, 30) * 10; s1 = rng.randint(12, 30); s2 = rng.randint(10, 28)
            q = {"l1": l1, "s1": s1, "l2": l2, "s2": s2}
            if (l1 + l2) % (s1 + s2) or not (4 <= (l1 + l2) // (s1 + s2) <= 30):
                continue
        elif fig0["kind"] == "clock_overlap":
            q = {"h": rng.randint(1, 10)}
        elif fig0["kind"] == "speed_change":
            sv = rng.randint(5, 8) * 10; u = rng.randint(max(10, sv // 10 + 2), 15) * 10; T = rng.randint(12, 30); x = rng.randint(4, T - 4)
            q = {"d": u * x + sv * (T - x), "u": u, "v": sv, "T": T}
        elif fig0["kind"] == "arrival_gap":
            sv = rng.choice([50, 60, 70, 80]); u = sv + rng.choice([10, 20, 30, 40]); k = rng.randint(1, 4)
            from math import lcm
            d = lcm(u, sv) * k
            q = {"d": d, "u": u, "v": sv}
            if not (600 <= d <= 4000):
                continue
        elif fig0["kind"] == "ratio_shift":
            a1, b1 = rng.choice([(5, 3), (7, 4), (3, 1), (5, 2), (7, 3), (4, 1), (9, 5)])
            a2, b2 = rng.choice([(3, 2), (4, 3), (5, 3), (2, 1), (7, 5), (5, 4)])
            P1, P2 = _ratio_parts({"a1": a1, "b1": b1, "a2": a2, "b2": b2})
            if a2 * b1 >= a1 * b2 or P2 <= P1 or (a1 - b1) == (a2 - b2):
                continue
            unit = rng.randint(1, 6); older = unit * P1; younger = older * b1 // a1
            q = {"a1": a1, "b1": b1, "a2": a2, "b2": b2, "y": unit * (P2 - P1)}
            if not (12 <= older <= 50 and younger >= 4 and q["y"] <= 20):
                continue
        elif fig0["kind"] == "same_spend":
            r = rng.randint(2, 4); left = rng.randint(2, 10) * 100; z = rng.randint(2, 12) * 100
            q = {"x": r * left + z, "y": left + z, "r": r}
        else:
            c = rng.randint(3, 12); r = rng.randint(2, 4); y = rng.randint(2, 15)
            q = {"p": r * (c + y) - y, "c": c, "r": r}
            if q["p"] > 50 or q["p"] - c < 20:
                continue
        fig = {**fig0, "params": q, "names": vnames}
        x = wp_solve(fig)
        key = tuple(sorted(q.items()))
        if key in seen or x in used_answers:
            continue
        text = wp_text(fig, vnames)
        vcard = {**card, "answer": {**card["answer"], "value": str(x)}, "problem": {**card["problem"], "figure": fig, "text_ja": text}}
        if not all(run_check(vcard, ch, None)[0] for ch in card["checks"] if ch["type"].startswith("wp_") and ch["type"] != "wp_names_match"):
            continue
        steps = wp_steps(fig, vnames)
        if route_total({"steps": steps}) != x:
            continue
        if stray_name_numbers(vnames, text, steps):
            continue
        seen.add(key); used_answers.add(x)
        out.append({"id": f"{card['id']}-v{len(out) + 1}", "text_ja": text, "figure": {"params": q, "names": vnames},
                    "answer": str(x), "lens_route": {"steps": steps}})
    return out


def wp_steps(fig, names):
    q = fig["params"]
    if fig["kind"] == "two_kinds_total":
        A, B = names.get("a", "A"), names.get("b", "B")
        counter, measure = names.get("counter", "個"), names.get("measure", "金額")
        allb = q["b"] * q["n"]
        x = wp_solve(fig)
        return [
            {"ja": f"たて＝1{counter}あたりの{measure}、横＝{counter}数の長方形2つで表す（面積＝{measure}）", "op": "note"},
            {"ja": f"全部{B}だとすると {q['b']}×{q['n']} = {allb}", "op": "note"},
            {"ja": f"本当の{measure}との差 {q['t']}−{allb} = {q['t'] - allb} が、上にはみ出した長方形の面積", "op": "note"},
            {"ja": f"その長方形のたては {q['a']}−{q['b']} = {q['a'] - q['b']}", "op": "note"},
            {"ja": f"{A}の数 = {q['t'] - allb}÷{q['a'] - q['b']} = {_fmt(x)}", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "mixture":
        a1, a2 = q["pt"] - q["p1"], q["p2"] - q["pt"]
        from math import gcd
        g = gcd(a1, a2)
        w2 = wp_solve(fig)
        return [
            {"ja": f"てんびんの左はしに{q['p1']}%、右はしに{q['p2']}%、支点に{q['pt']}%をおく", "op": "note"},
            {"ja": f"うでの長さは {q['pt']}−{q['p1']} = {a1} と {q['p2']}−{q['pt']} = {a2}", "op": "note"},
            {"ja": f"{q['w1']}g と □g の比は、うでの長さの逆の比 {a2 // g}:{a1 // g}", "op": "note"},
            {"ja": f"{q['w1']}×{a1 // g}" + (f"÷{a2 // g}" if a2 // g > 1 else "") + f" = {_fmt(w2)}（g）", "value": str(w2), "op": "result"},
        ]
    if fig["kind"] == "meeting":
        A, B = names.get("a", "A"), names.get("b", "B")
        t = wp_solve(fig)
        return [
            {"ja": f"{B}を止めて考えると、{A}は1分に {q['u']}+{q['v']} = {q['u'] + q['v']}m ずつ近づく", "op": "note"},
            {"ja": f"はじめのきょりは{q['d']}m", "op": "note"},
            {"ja": f"{q['d']}÷{q['u'] + q['v']} = {_fmt(t)}（分後）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "average_groups":
        up, dn = q["p"] - q["r"], q["r"] - q["q"]
        k = wp_solve(fig)
        return [
            {"ja": "たて＝平均点、横＝人数の長方形2つをならべる（面積＝合計点）", "op": "note"},
            {"ja": f"全体の平均{q['r']}点の線を引く。1組がはみ出す部分のたては {q['p']}−{q['r']} = {up}、面積は {q['m']}×{up} = {q['m'] * up}", "op": "note"},
            {"ja": f"2組の、線より下のへこみも同じ面積。へこみのたては {q['r']}−{q['q']} = {dn}", "op": "note"},
            {"ja": f"2組の人数 = {q['m'] * up}÷{dn} = {_fmt(k)}（人）", "value": str(k), "op": "result"},
        ]
    if fig["kind"] == "shortfall":
        n = wp_solve(fig)
        return [
            {"ja": "たて＝1人あたりの個数、横＝人数の長方形で、2つの配り方をかさねる", "op": "note"},
            {"ja": f"2つの配り方の差は、あまり{q['s']}個とたりない{q['d']}個を合わせた {q['s']}+{q['d']} = {q['s'] + q['d']}", "op": "note"},
            {"ja": f"その差は、たて {q['b']}−{q['a']} = {q['b'] - q['a']}、横＝人数 の長方形の面積", "op": "note"},
            {"ja": f"人数 = {q['s'] + q['d']}÷{q['b'] - q['a']} = {_fmt(n)}（人）", "value": str(n), "op": "result"},
        ]
    if fig["kind"] == "three_kinds_equal":
        avg = (q["b"] + q["c"]) // 2
        alll = avg * q["n"]
        x = wp_solve(fig)
        return [
            {"ja": f"{q['b']}円と{q['c']}円は同じ数なので、1個ずつ組にすると平均 ({q['b']}+{q['c']})÷2 = {avg} 円", "op": "note"},
            {"ja": f"全部{avg}円だとすると {avg}×{q['n']} = {alll}", "op": "note"},
            {"ja": f"本当の代金との差 {q['t']}−{alll} = {q['t'] - alll} が、上にはみ出した長方形の面積", "op": "note"},
            {"ja": f"その長方形のたては {q['a']}−{avg} = {q['a'] - avg}", "op": "note"},
            {"ja": f"{q['a']}円の数 = {q['t'] - alll}÷{q['a'] - avg} = {_fmt(x)}（個）", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "pair_offset":
        A, B = names.get("a", "A"), names.get("b", "B")
        extra = q["a"] * q["k"]
        m = wp_solve(fig)
        return [
            {"ja": f"{A}の多い{q['k']}個分 {q['a']}×{q['k']} = {extra} を先に取りのぞく", "op": "note"},
            {"ja": f"残り {q['t']}−{extra} = {q['t'] - extra} は、{A}と{B}が同じ数", "op": "note"},
            {"ja": f"{A}1個と{B}1個の組は {q['a']}+{q['b']} = {q['a'] + q['b']} 円", "op": "note"},
            {"ja": f"{B}の数 = {q['t'] - extra}÷{q['a'] + q['b']} = {_fmt(m)}（個）", "value": str(m), "op": "result"},
        ]
    if fig["kind"] == "two_kinds_known":
        A, B = names.get("a", "A"), names.get("b", "B")
        nb = q["n"] - q["x"]
        t = wp_solve(fig)
        return [
            {"ja": f"{B}の数は {q['n']}−{q['x']} = {nb}（枚）", "op": "note"},
            {"ja": f"{A}は {q['a']}×{q['x']} = {q['a'] * q['x']}、{B}は {q['b']}×{nb} = {q['b'] * nb}", "op": "note"},
            {"ja": f"{q['a'] * q['x']}+{q['b'] * nb} = {_fmt(t)}（円）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "age_sum_later":
        o, y = names.get("older", "兄"), names.get("younger", "弟")
        t = wp_solve(fig)
        return [
            {"ja": f"{q['y']}年後の{o}は {q['p']}+{q['y']} = {q['p'] + q['y']}", "op": "note"},
            {"ja": f"{q['y']}年後の{y}は {q['c']}+{q['y']} = {q['c'] + q['y']}", "op": "note"},
            {"ja": f"{q['p'] + q['y']}+{q['c'] + q['y']} = {_fmt(t)}（才）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "sum_catchup":
        s0 = q["c1"] + q["c2"] + q["c3"]
        y = wp_solve(fig)
        return [
            {"ja": f"子ども3人の年れいの和は {q['c1']}+{q['c2']}+{q['c3']} = {s0}", "op": "note"},
            {"ja": f"お父さんとの差は {q['p']}−{s0} = {q['p'] - s0}", "op": "note"},
            {"ja": "1年で、子ども3人の和は3才、お父さんは1才ふえる。差は1年に 3−1 = 2 ずつちぢむ", "op": "note"},
            {"ja": f"{q['p'] - s0}÷2 = {_fmt(y)}（年後）", "value": str(y), "op": "result"},
        ]
    if fig["kind"] in ("mixture_water", "mixture_salt"):
        from math import gcd
        water = fig["kind"] == "mixture_water"
        a1, a2 = (q["p1"] - q["pt"], q["pt"]) if water else (q["pt"] - q["p1"], 100 - q["pt"])
        g = gcd(a1, a2)
        x = wp_solve(fig)
        what = "水" if water else "食塩"
        arm1 = f"{q['p1']}−{q['pt']} = {a1}" if water else f"{q['pt']}−{q['p1']} = {a1}"
        arm2 = f"{q['pt']}−0 = {a2}" if water else f"100−{q['pt']} = {a2}"
        first = (f"水は「0%の食塩水」と考える。てんびんの両はしに{q['p1']}%と0%、支点に{q['pt']}%をおく" if water else
                 f"食塩は「100%の食塩水」と考える。てんびんの両はしに{q['p1']}%と100%、支点に{q['pt']}%をおく")
        return [
            {"ja": first, "op": "note"},
            {"ja": f"うでの長さは {arm1} と {arm2}", "op": "note"},
            {"ja": f"{q['w1']}g と {what}□g の比は、うでの長さの逆の比 {a2 // g}:{a1 // g}", "op": "note"},
            {"ja": f"{q['w1']}×{a1 // g}" + (f"÷{a2 // g}" if a2 // g > 1 else "") + f" = {_fmt(x)}（g）", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "mix_then_water":
        from math import gcd
        g = gcd(q["w1"], q["w2"]); r1, r2 = q["w1"] // g, q["w2"] // g
        D = q["p2"] - q["p1"]; arm = S(D) / (r1 + r2) * r2
        m = q["p1"] + arm; W = q["w1"] + q["w2"]
        b1 = m - q["pt"]; h = gcd(int(b1), q["pt"])
        x = wp_solve(fig)
        return [
            {"ja": f"まず{q['p1']}%と{q['p2']}%をてんびんで混ぜる。重さの比 {q['w1']}:{q['w2']} = {r1}:{r2} なので、うでの長さの比は {r2}:{r1}", "op": "note"},
            {"ja": f"うでの長さ {q['p2']}−{q['p1']} = {D} を {r2}:{r1} に分ける。{q['p1']}%からのうでは {D}÷{r1 + r2}×{r2} = {_fmt(arm)}", "op": "note"},
            {"ja": f"混ぜた食塩水は {q['p1']}+{_fmt(arm)} = {_fmt(m)}%、重さは {q['w1']}+{q['w2']} = {W}g", "op": "note"},
            {"ja": f"次に水（0%）を混ぜる。うでの長さは {_fmt(m)}−{q['pt']} = {_fmt(b1)} と {q['pt']}−0 = {q['pt']}", "op": "note"},
            {"ja": f"{W}g と 水□g の比は {q['pt'] // h}:{int(b1) // h}。水 = {W}×{int(b1) // h}" + (f"÷{q['pt'] // h}" if q['pt'] // h > 1 else "") + f" = {_fmt(x)}（g）", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "evaporate":
        salt = S(q["w1"]) * q["p1"] / 100; W2 = salt / q["pt"] * 100
        x = wp_solve(fig)
        return [
            {"ja": "水が蒸発しても、食塩の量は変わらない", "op": "note"},
            {"ja": f"食塩は {q['w1']}×{q['p1']}÷100 = {_fmt(salt)}（g）", "op": "note"},
            {"ja": f"{q['pt']}%で食塩が{_fmt(salt)}gなら、食塩水は {_fmt(salt)}÷{q['pt']}×100 = {_fmt(W2)}（g）", "op": "note"},
            {"ja": f"{q['w1']}−{_fmt(W2)} = {_fmt(x)}（g）", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "salt_total":
        s1 = S(q["w1"] * q["p1"]) / 100; s2 = S(q["w2"] * q["p2"]) / 100
        t = wp_solve(fig)
        return [
            {"ja": f"{q['p1']}%の方の食塩は {q['w1']}×{q['p1']}÷100 = {_fmt(s1)}（g）", "op": "note"},
            {"ja": f"{q['p2']}%の方の食塩は {q['w2']}×{q['p2']}÷100 = {_fmt(s2)}（g）", "op": "note"},
            {"ja": f"{_fmt(s1)}+{_fmt(s2)} = {_fmt(t)}（g）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "chase":
        A, B = names.get("a", "兄"), names.get("b", "弟")
        c = q["u"] - q["v"]; gap = q["v"] * q["h"]
        t = wp_solve(fig)
        return [
            {"ja": f"{B}を止めて考えると、{A}は1分に {q['u']}−{q['v']} = {c}m ずつ近づく", "op": "note"},
            {"ja": f"{A}が家を出るとき、{B}は {q['v']}×{q['h']} = {gap}m 先にいる", "op": "note"},
            {"ja": f"{gap}÷{c} = {_fmt(t)}（分後）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "trains_pass":
        c = q["s1"] + q["s2"]; L = q["l1"] + q["l2"]
        t = wp_solve(fig)
        return [
            {"ja": f"列車Bを止めて考えると、列車Aは秒速 {q['s1']}+{q['s2']} = {c}m で近づく", "op": "note"},
            {"ja": f"出会ってからはなれるまでに進むのは、2つの列車の長さの和 {q['l1']}+{q['l2']} = {L}m", "op": "note"},
            {"ja": f"{L}÷{c} = {_fmt(t)}（秒）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "clock_overlap":
        deg = 30 * q["h"]
        t = wp_solve(fig)
        return [
            {"ja": "長針は1分に6度、短針は1分に0.5度進む", "op": "note"},
            {"ja": "短針を止めて考えると、長針は1分に 6−0.5 = 5.5 度ずつ近づく", "op": "note"},
            {"ja": f"{q['h']}時ちょうどのとき、長針は短針より {q['h']}×30 = {deg} 度うしろにいる", "op": "note"},
            {"ja": f"{deg}÷5.5 = {_mixed(t)}（分）", "value": str(t), "op": "result"},
        ]
    if fig["kind"] == "speed_change":
        vt = q["v"] * q["T"]; gap = q["d"] - vt; hh = q["u"] - q["v"]
        x = wp_solve(fig)
        return [
            {"ja": "たて＝速さ、横＝時間の長方形2つで表す（面積＝道のり）", "op": "note"},
            {"ja": f"全部歩いたとすると {q['v']}×{q['T']} = {vt}", "op": "note"},
            {"ja": f"本当の道のりとの差 {q['d']}−{vt} = {gap} が、上にはみ出した長方形の面積", "op": "note"},
            {"ja": f"その長方形のたては {q['u']}−{q['v']} = {hh}", "op": "note"},
            {"ja": f"走った時間 = {gap}÷{hh} = {_fmt(x)}（分）", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "arrival_gap":
        A, B = names.get("a", "兄"), names.get("b", "弟")
        ta, tb = S(q["d"]) / q["u"], S(q["d"]) / q["v"]
        x = wp_solve(fig)
        return [
            {"ja": f"{A}がかかる時間は {q['d']}÷{q['u']} = {_fmt(ta)}（分）", "op": "note"},
            {"ja": f"{B}がかかる時間は {q['d']}÷{q['v']} = {_fmt(tb)}（分）", "op": "note"},
            {"ja": f"{_fmt(tb)}−{_fmt(ta)} = {_fmt(x)}（分）", "value": str(x), "op": "result"},
        ]
    if fig["kind"] == "ratio_shift":
        o = names.get("older", "兄")
        d1, d2 = q["a1"] - q["b1"], q["a2"] - q["b2"]
        P1, P2 = _ratio_parts(q)
        f1, f2 = P1 // q["a1"], P2 // q["a2"]
        unit = S(q["y"]) / (P2 - P1)
        ans = wp_solve(fig)
        now = f"{q['a1']}:{q['b1']}" + (f" → {q['a1'] * f1}:{q['b1'] * f1}" if f1 > 1 else "")
        later = f"{q['a2']}:{q['b2']}" + (f" → {q['a2'] * f2}:{q['b2'] * f2}" if f2 > 1 else "")
        return [
            {"ja": f"年れいの差は変わらない。差は、いまの比で {q['a1']}−{q['b1']} = {d1}、{q['y']}年後の比で {q['a2']}−{q['b2']} = {d2}", "op": "note"},
            {"ja": f"差が同じ数になるように比をそろえる。いま {now}、{q['y']}年後 {later}", "op": "note"},
            {"ja": f"{o}は {P1} から {P2} へ、{P2}−{P1} = {P2 - P1} つ分ふえた。それが{q['y']}年なので、1つ分は {q['y']}÷{P2 - P1} = {_fmt(unit)}", "op": "note"},
            {"ja": f"いまの{o} = {_fmt(unit)}×{P1} = {_fmt(ans)}（才）", "value": str(ans), "op": "result"},
        ]
    if fig["kind"] in ("age_ratio_past", "same_spend"):
        past = fig["kind"] == "age_ratio_past"
        o, y = names.get("older", "兄"), names.get("younger", "弟")
        big, small = (q["p"], q["c"]) if past else (q["x"], q["y"])
        d = big - small
        then_small = S(d) / (q["r"] - 1)
        z = wp_solve(fig)
        if past:
            first = f"年れいの差は {big}−{small} = {d} で、何年前でも変わらない"
            third = f"そのときの{y}は {d}÷{q['r'] - 1} = {_fmt(then_small)} 才"
            last = f"{small}−{_fmt(then_small)} = {_fmt(z)}（年前）"
        else:
            first = f"2人が同じ金額を使っても、お金の差 {big}−{small} = {d} は変わらない"
            third = f"{y}の残りは {d}÷{q['r'] - 1} = {_fmt(then_small)} 円"
            last = f"{small}−{_fmt(then_small)} = {_fmt(z)}（円）"
        return [
            {"ja": first, "op": "note"},
            {"ja": f"{o}が{y}の{q['r']}倍のとき、差の{d}は{y}の {q['r']}−1 = {q['r'] - 1} つ分", "op": "note"},
            {"ja": third, "op": "note"},
            {"ja": last, "value": str(z), "op": "result"},
        ]
    older, younger = names.get("older", "親"), names.get("younger", "子")
    d = q["p"] - q["c"]
    child_then = S(d) / (q["r"] - 1)
    y = wp_solve(fig)
    return [
        {"ja": f"年れいの差は {q['p']}−{q['c']} = {d} で、何年たっても変わらない", "op": "note"},
        {"ja": f"{older}が{younger}の{q['r']}倍のとき、差の{d}は{younger}の {q['r']}−1 = {q['r'] - 1} つ分", "op": "note"},
        {"ja": f"そのときの{younger}は {d}÷{q['r'] - 1} = {_fmt(child_then)} 才", "op": "note"},
        {"ja": f"{_fmt(child_then)}−{q['c']} = {_fmt(y)}（年後）", "value": str(y), "op": "result"},
    ]


WP_GENERATORS = ("wp_two_kinds", "wp_age_ratio", "wp_mixture", "wp_meeting",
                 "wp_average_groups", "wp_shortfall", "wp_age_ratio_past", "wp_same_spend",
                 "wp_three_kinds_equal", "wp_pair_offset", "wp_two_kinds_known", "wp_age_sum_later",
                 "wp_sum_catchup", "wp_ratio_shift", "wp_mixture_water", "wp_mixture_salt", "wp_mix_then_water",
                 "wp_evaporate", "wp_salt_total", "wp_chase", "wp_trains_pass", "wp_clock_overlap", "wp_speed_change",
                 "wp_arrival_gap")


def make_variants(card):
    if card["variants"]["generator"] in WP_GENERATORS:
        return make_wp_variants(card)
    if card["variants"]["generator"] == "slide_band":
        return make_band_variants(card)
    if card["variants"]["generator"] == "mirror_path":
        return make_mirror_variants(card)
    if card["variants"]["generator"] == "box_unfold":
        return make_unfold_variants(card)
    v = card["variants"]
    rng = random.Random(v["seed"])
    gen = GENERATORS[v["generator"]]
    seen = {tuple(map(tuple, card["problem"]["figure"]["points"]))}
    out, tries = [], 0
    while len(out) < v["count"] and tries < 2000:
        tries += 1
        pts = [tuple(p) for p in gen(rng, v.get("constraints", {}))]
        if tuple(pts) in seen:
            continue
        x0, y0, x1, y1 = bbox(pts)
        grid = {"width": x1, "height": y1, "cell_cm": card["problem"]["figure"]["grid"]["cell_cm"]}
        area = shoelace(pts) * S(grid["cell_cm"]) ** 2
        vcard = {**card, "answer": {**card["answer"], "value": str(area)},
                 "problem": {**card["problem"], "figure": {**card["problem"]["figure"], "grid": grid}}}
        results = [run_check(vcard, ch, pts) for ch in card["checks"] if ch["type"] in VARIANT_CHECKS]
        if not (all(ok for ok, _ in results) and shoelace(pts) > 0):
            continue
        steps = STEP_BUILDERS[v["generator"]](pts)
        if steps is None:
            continue
        # the variant's own lens steps must reach its own answer
        if route_total({"steps": steps}) != shoelace(pts):
            continue
        seen.add(tuple(pts))
        out.append({
            "id": f"{card['id']}-v{len(out) + 1}",
            "points": [list(p) for p in pts],
            "grid": grid,
            "answer": str(area),
            "lens_route": {"steps": steps},
        })
    return out


def chain_check(card):
    """ADR-003: chained lenses. Stages are labelled lenses, consecutive stages differ, the first stage is the
    card's lens, and the step slices are contiguous and cover lens_route.steps exactly; the last stage ends on the result."""
    errs, chain = [], card["chain"]
    steps = card["lens_route"]["steps"]
    if chain[0]["lens"] != card["lens"]:
        errs.append(f"first stage is {chain[0]['lens']}, card lens is {card['lens']}")
    nxt = 0
    for i, st in enumerate(chain):
        if st["lens"] not in LABELS["lenses"]:
            errs.append(f"stage {i + 1} lens '{st['lens']}' has no label")
        if i and st["lens"] == chain[i - 1]["lens"]:
            errs.append(f"stages {i} and {i + 1} use the same lens")
        a, b = st["steps"]
        if a != nxt or b < a:
            errs.append(f"stage {i + 1} covers steps {a}..{b}, expected to start at {nxt}")
        nxt = b + 1
    if nxt != len(steps):
        errs.append(f"stages cover {nxt} of {len(steps)} lens steps")
    elif steps[-1].get("op") != "result":
        errs.append("the last stage must end on the result step")
    return errs


def step_order_check(card, pts):
    """Scenes place each piece's label by step order, so the order is part of the contract.

    Standard Enclose cards: the `sub` steps must list the corner gaps in edge order
    starting at edge AB (A->B, B->C, ...), exactly as enclose_breakdown returns them.
    Failure notch cards: the `start`/`add` steps must follow steps_failure_notch
    (right rectangle, bottom triangle, side triangle, top triangle).
    Returns (applies, ok, message).
    """
    if card["lens"] != "enclose" or pts is None:
        return False, True, ""
    steps = card["lens_route"]["steps"]
    if card["kind"] == "standard":
        bd = enclose_breakdown(pts)
        if not bd:
            return False, True, ""
        got = [sympify(s["value"]) for s in steps if s.get("op") == "sub"]
        want = list(bd[1])
    elif card["kind"] == "failure" and card["variants"]["generator"] == "enclose_failure_notch":
        ref = steps_failure_notch(pts)
        if ref is None:
            return True, False, "figure is not a notch the cut-line route can explain"
        got = [sympify(s["value"]) for s in steps if s.get("op") in ("start", "add")]
        want = [sympify(s["value"]) for s in ref if s.get("op") in ("start", "add")]
    else:
        return False, True, ""
    ok = got == want
    return True, ok, f"pieces in figure order: expected {[str(w) for w in want]}, card has {[str(g) for g in got]}"


# -------------------------------------------------------------------- main ---

def validate(path: Path, with_variants: bool) -> bool:
    card = yaml.safe_load(path.read_text(encoding="utf-8"))
    print(f"\n== {path.name}")
    errors = sorted(Draft202012Validator(SCHEMA).iter_errors(card), key=lambda e: list(e.path))
    for e in errors:
        print(f"  SCHEMA  {'/'.join(map(str, e.path)) or '(root)'}: {e.message}")
    if errors:
        return False
    ok_all = True
    if card["picker"]["correct"] not in card["picker"]["options"]:
        print("  FAIL    picker.correct is not one of the options"); ok_all = False
    if card["kind"] != "standard" and not card.get("best_move"):
        print("  FAIL    failure/no_lens cards need best_move"); ok_all = False
    fig = card["problem"]["figure"]
    pts = [tuple(p) for p in fig["points"]] if fig["type"] == "grid_polygon" else None
    for ch in card["checks"]:
        ok, msg = run_check(card, ch, pts)
        ok_all &= ok
        print(f"  {'PASS' if ok else 'FAIL'}    {ch['type']}{'(' + ch['route'] + ')' if 'route' in ch else ''}: {msg}")
    lerrs = label_check(card)
    for e in lerrs:
        print(f"  FAIL    labels: {e}")
    if not lerrs:
        print("  PASS    labels: every option and clue chip has a label; decoys differ from real clues")
    ok_all &= not lerrs
    if "chain" in card:
        cerrs = chain_check(card)
        for e in cerrs:
            print(f"  FAIL    chain: {e}")
        if not cerrs:
            print(f"  PASS    chain: {' → '.join(st['lens'] for st in card['chain'])}, stages cover every lens step in order")
        ok_all &= not cerrs
    applies, ok, msg = step_order_check(card, pts)
    if applies:
        ok_all &= ok
        print(f"  {'PASS' if ok else 'FAIL'}    step_order (labels land on the right pieces): {msg}")
    vs = []
    if with_variants:
        if fig["type"] == "grid_polygon" and fig["grid"]["cell_cm"] != 1:
            print("  FAIL    variant generators assume cell_cm = 1"); ok_all = False
        vs = make_variants(card)
        enough = len(vs) == card["variants"]["count"]
        ok_all &= enough
        print(f"  {'PASS' if enough else 'FAIL'}    variants: {len(vs)}/{card['variants']['count']} generated, re-checked, lens steps sum to answer")
        out = ROOT / "build" / "variants" / f"{card['id']}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(vs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  => {'VERIFIED' if ok_all else 'NOT VERIFIED'}")
    return ok_all, card, vs


def annotate_enclose_steps(pts, steps):
    """Add a verified `detail` to the box and corner steps of a standard Enclose route.

    Study-pace scenes show each corner's base and height and colour it on its own,
    so those numbers must come from the bundle, never from app code.
      start: {"kind": "box", "width": w, "height": h}
      sub:   {"kind": "corner", "n": 1.., "edge": "AB", "corner": [x, y], "base": dx, "height": dy}
    Returns None (and leaves steps untouched) unless the figure is a clean Enclose
    and the sub steps match the corners in edge order.
    """
    bd = enclose_breakdown(pts)
    if not bd:
        return None
    x0, y0, x1, y1 = bbox(pts)
    n, labels = len(pts), "ABCDEFGHIJ"
    corners = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        if a[0] == b[0] or a[1] == b[1]:
            continue
        # right-angle corner of the gap: the candidate outside the polygon (right of a->b for CCW)
        c1, c2 = (b[0], a[1]), (a[0], b[1])
        c = c1 if _orient(a, b, c1) < 0 else c2
        corners.append({"kind": "corner", "edge": labels[i] + labels[(i + 1) % n], "corner": list(c),
                        "base": abs(b[0] - a[0]), "height": abs(b[1] - a[1]),
                        "value": S(abs(b[0] - a[0])) * abs(b[1] - a[1]) / 2})
    subs = [k for k, st in enumerate(steps) if st.get("op") == "sub"]
    if len(subs) != len(corners) or any(sympify(steps[k]["value"]) != c["value"] for k, c in zip(subs, corners)):
        return None
    out = [dict(st) for st in steps]
    for k, st in enumerate(out):
        if st.get("op") == "start":
            st["detail"] = {"kind": "box", "width": x1 - x0, "height": y1 - y0}
    for num, (k, c) in enumerate(zip(subs, corners), start=1):
        c = {key: val for key, val in c.items() if key != "value"}
        out[k]["detail"] = {**c, "n": num}
    return out


def _annotate_band(fig):
    """Lengths a band scene prints come from the bundle: total_base = last - first bottom point."""
    b = fig["bottom_x"]
    return {**fig, "total_base": str(S(b[-1]) - S(b[0]))}


def _annotate_unfold(fig):
    """Bundle data for the box_unfold scenes: the printed net width, and figure.mesh for the 3D viewport.

    mesh (problem units; x along AB, y up along AE, z away from the viewer along BC, so z = -BC):
      vertices: A..H; faces: name -> 4 vertex names (counter-clockwise seen from outside);
      hinge: the edge the right face folds around (B-F), the folding face (BCGF), and its open angle;
      net: 2D drawing coordinates of the opened faces ABFE + BCGF (A at the origin).
    Drawing data only; nothing here is printed except via net_width.
    """
    a, b, h = fig["a"], fig["b"], fig["h"]
    V = {"A": [0, 0, 0], "B": [a, 0, 0], "C": [a, 0, -b], "D": [0, 0, -b],
         "E": [0, h, 0], "F": [a, h, 0], "G": [a, h, -b], "H": [0, h, -b]}
    mesh = {
        "units": fig.get("unit", ""),
        "vertices": V,
        "faces": {"front": ["A", "B", "F", "E"], "right": ["B", "C", "G", "F"], "back": ["C", "D", "H", "G"],
                  "left": ["D", "A", "E", "H"], "top": ["E", "F", "G", "H"], "bottom": ["A", "D", "C", "B"]},
        "hinge": {"edge": ["B", "F"], "face": "right", "open_deg": 90},
        "net": {"A": [0, 0], "B": [a, 0], "C": [a + b, 0], "G": [a + b, h], "F": [a, h], "E": [0, h]},
        "path": {"from": "A", "via_edge": ["B", "F"], "to": "G"},
    }
    return {**fig, "net_width": str(S(a) + b), "mesh": mesh}


def _annotate(card, vs):
    if card["problem"]["figure"]["type"] == "word_problem":
        fig = card["problem"]["figure"]
        fig = {**fig, "diagram": wp_diagram(fig)}
        card = {**card, "problem": {**card["problem"], "figure": fig}}
        vs = [{**v, "figure": {**v["figure"], "diagram": wp_diagram({**fig, **v["figure"]})}} for v in vs]
        return card, vs
    if card["problem"]["figure"]["type"] == "box_unfold":
        fig = _annotate_unfold(card["problem"]["figure"])
        card = {**card, "problem": {**card["problem"], "figure": fig}}
        vs = [{**v, "figure": _annotate_unfold({**fig, **v["figure"]})} for v in vs]
        return card, vs
    if card["problem"]["figure"]["type"] == "parallel_band":
        fig = _annotate_band(card["problem"]["figure"])
        card = {**card, "problem": {**card["problem"], "figure": fig}}
        vs = [{**v, "figure": _annotate_band({**fig, **v["figure"]})} for v in vs]
        return card, vs
    if card["lens"] != "enclose" or card["kind"] != "standard":
        return card, vs
    pts = [tuple(p) for p in card["problem"]["figure"]["points"]]
    steps = annotate_enclose_steps(pts, card["lens_route"]["steps"])
    if steps is None:
        raise SystemExit(f"bundle: cannot annotate {card['id']} (corners do not match steps)")
    card = {**card, "lens_route": {**card["lens_route"], "steps": steps}}
    new_vs = []
    for v in vs:
        vsteps = annotate_enclose_steps([tuple(p) for p in v["points"]], v["lens_route"]["steps"])
        if vsteps is None:
            raise SystemExit(f"bundle: cannot annotate {v['id']}")
        new_vs.append({**v, "lens_route": {**v["lens_route"], "steps": vsteps}})
    return card, new_vs


PUBLISHABLE = {"verified", "reviewed", "published"}


def write_bundle(entries, include_drafts=False, passes=None) -> Path:
    """build/bundle.json — the only file the trainer and the Shorts renderer import.

    Contains every card that passed this run and whose status is verified or later,
    each with its variants, plus the tokens. Sorted by lens, then id.
    """
    tokens = json.loads((ROOT / "tokens" / "tokens.json").read_text(encoding="utf-8"))
    cards = []
    for ok, card, vs in entries:
        if ok and (card["status"] in PUBLISHABLE or (include_drafts and card["status"] == "draft")):
            card, vs = _annotate(card, vs)
            cards.append({**card, "variants": vs})
    cards.sort(key=lambda c: (c["lens"], c["id"]))
    bundle = {"bundle_version": "1.3", "schema_version": "1.1", "tokens": tokens, "labels": LABELS,
              "passes": passes or [], "cards": cards}
    out = ROOT / "build" / "bundle.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":
    argv = sys.argv[1:]
    release_value = argv[argv.index("--release") + 1] if "--release" in argv else None
    args = [a for a in argv if not a.startswith("--") and a != release_value]
    want_bundle = "--bundle" in sys.argv
    entries = [validate(Path(a), "--variants" in sys.argv or want_bundle) for a in args]
    all_ok = bool(entries) and all(ok for ok, _, _ in entries)
    release = sys.argv[sys.argv.index("--release") + 1] if "--release" in sys.argv else None
    passes = []
    if want_bundle:
        cat_ok, passes = catalog_check(entries, release)
        all_ok &= cat_ok
    if want_bundle:
        if all_ok:
            out = write_bundle(entries, include_drafts="--include-drafts" in sys.argv, passes=passes)
            n = len(json.loads(out.read_text(encoding="utf-8"))["cards"])
            print(f"\nbundle: {out.relative_to(ROOT)} ({n} cards{', drafts included' if '--include-drafts' in sys.argv else ''})")
        else:
            print("\nbundle: NOT written, fix the failing cards first")
    sys.exit(0 if all_ok else 1)
