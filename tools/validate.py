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


def label_check(card):
    """Every picker option and clue chip must have a Japanese label; decoys must be real decoys."""
    errs = []
    lenses, tags = LABELS["lenses"], LABELS["tags"]
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
        out.append({"id": f"{card['id']}-v{len(out) + 1}", "figure": {"bottom_x": bottom, "apex_x": apex, "band_height": h},
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
        out.append({"id": f"{card['id']}-v{len(out) + 1}", "figure": {"ab": ab, "pa": pa, "qb": qb},
                    "answer": str(x), "lens_route": {"steps": steps}})
    return out


def make_variants(card):
    if card["variants"]["generator"] == "slide_band":
        return make_band_variants(card)
    if card["variants"]["generator"] == "mirror_path":
        return make_mirror_variants(card)
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


def _annotate(card, vs):
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


def write_bundle(entries, include_drafts=False) -> Path:
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
    bundle = {"bundle_version": "1.2", "schema_version": "1.1", "tokens": tokens, "labels": LABELS, "cards": cards}
    out = ROOT / "build" / "bundle.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want_bundle = "--bundle" in sys.argv
    entries = [validate(Path(a), "--variants" in sys.argv or want_bundle) for a in args]
    all_ok = bool(entries) and all(ok for ok, _, _ in entries)
    if want_bundle:
        if all_ok:
            out = write_bundle(entries, include_drafts="--include-drafts" in sys.argv)
            n = len(json.loads(out.read_text(encoding="utf-8"))["cards"])
            print(f"\nbundle: {out.relative_to(ROOT)} ({n} cards{', drafts included' if '--include-drafts' in sys.argv else ''})")
        else:
            print("\nbundle: NOT written, fix the failing cards first")
    sys.exit(0 if all_ok else 1)
