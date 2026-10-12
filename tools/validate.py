#!/usr/bin/env python3
"""Lens Card validator for 視点レンズ (The Lens).

Usage:
    python3 tools/validate.py cards/*.yaml            # validate cards
    python3 tools/validate.py cards/*.yaml --variants # also generate + check variants

A card is 'verified' only if:
  1. it matches schema/lens-card.schema.json,
  2. every check in its `checks` list passes (exact arithmetic with SymPy),
  3. every generated variant passes the same structural checks and still needs the same move.
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
    g = card["problem"]["figure"]["grid"]
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
    if t == "lens_faster":
        a, b = card["lens_route"]["time_cost_sec"], card["trap_route"]["time_cost_sec"]
        return a < b, f"lens {a}s vs trap {b}s"
    return False, f"unknown check {t}"


# -------------------------------------------------------------- generators ---

def gen_enclose_standard(rng, c):
    w, h = rng.randint(c.get("min", 4), c.get("max", 8)), rng.randint(c.get("min", 4), c.get("max", 8))
    return [(rng.randint(1, w - 1), 0), (w, rng.randint(1, h - 1)),
            (rng.randint(1, w - 1), h), (0, rng.randint(1, h - 1))]


def gen_enclose_failure_notch(rng, c):
    w, h = rng.randint(c.get("min", 5), c.get("max", 8)), rng.randint(c.get("min", 5), c.get("max", 8))
    y1 = rng.randint(2, h - 2)
    y2 = rng.randint(1, y1 - 1) if y1 > 1 else 1
    # notch on the left side: (0,h) -> q1 -> q2 -> (0,0), two interior vertices
    q1 = (rng.randint(1, w - 2), rng.randint(y1, h - 1))
    q2 = (rng.randint(1, w - 2), rng.randint(1, y1))
    return [(0, 0), (w, 0), (w, h), (0, h), q1, q2]


def gen_no_lens_flat_base(rng, c):
    w, h = rng.randint(c.get("min", 5), c.get("max", 9)), rng.randint(c.get("min", 3), c.get("max", 7))
    return [(0, 0), (w, 0), (rng.randint(1, w - 1), h)]


GENERATORS = {
    "enclose_standard": gen_enclose_standard,
    "enclose_failure_notch": gen_enclose_failure_notch,
    "no_lens_flat_base": gen_no_lens_flat_base,
}

# Structural checks a variant must keep, so it still needs the same move.
VARIANT_CHECKS = {"lattice_only", "simple_polygon", "enclose_clean", "enclose_not_clean", "has_horizontal_base"}


def make_variants(card):
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
        if all(ok for ok, _ in results) and shoelace(pts) > 0:
            seen.add(tuple(pts))
            entry = {"points": [list(p) for p in pts], "grid": grid, "answer": str(area)}
            bd = enclose_breakdown(pts)
            if bd and card["kind"] == "standard":
                entry["enclose"] = {"box": str(bd[0]), "corners": [str(x) for x in bd[1]]}
            out.append(entry)
    return out


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
    pts = [tuple(p) for p in card["problem"]["figure"]["points"]]
    for ch in card["checks"]:
        ok, msg = run_check(card, ch, pts)
        ok_all &= ok
        print(f"  {'PASS' if ok else 'FAIL'}    {ch['type']}{'(' + ch['route'] + ')' if 'route' in ch else ''}: {msg}")
    if with_variants:
        vs = make_variants(card)
        enough = len(vs) == card["variants"]["count"]
        ok_all &= enough
        print(f"  {'PASS' if enough else 'FAIL'}    variants: {len(vs)}/{card['variants']['count']} generated and re-checked")
        out = ROOT / "build" / "variants" / f"{card['id']}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(vs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  => {'VERIFIED' if ok_all else 'NOT VERIFIED'}")
    return ok_all


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    results = [validate(Path(a), "--variants" in sys.argv) for a in args]
    sys.exit(0 if results and all(results) else 1)
