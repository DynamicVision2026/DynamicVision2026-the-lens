"""Screen clips of the 視点レンズ course app (apps/trainer) for the promo video, with a log of every tap.

Same recorder as capture2.py (its Rec/session logic, copied here so that script stays untouched): iPad
landscape 1366×1024, Playwright's screen recording at CSS pixels (smooth 30 fps), every tap / focus /
drag logged with its time and the element's box.

  cd apps/trainer && npx vite build && NO_PROXY=localhost npx vite preview --port 8098 &
  NO_PROXY=localhost python3 apps/snap/video/lens_capture.py http://localhost:8098 <mp4-dir> <json-dir> <stills-dir> [clip ...]

The paid Passes are unlocked in each browser context through /open?p=<pass>&k=<key> (keys read from
apps/trainer/src/launch.config.ts; never printed). Math.random is seeded per clip, so the random problem
order of practice / timed / drill / check is the same on every run. lens_report seeds example attempts
(Day 1 ≈ 25 s, week 4 ≈ 11 s per decision) in localStorage the way course/attempts.ts stores them.

Writes <mp4-dir>/<clip>.mp4 (30 fps H.264), <json-dir>/<clip>.json ({"w","h","scale","dur","events":
[{"t","kind","x","y","w","h"}]}, kind tap | focus | drag; a drag also has "x2","y2", where it ended) and
<stills-dir>/<clip>.png.
"""
import json
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BASE = sys.argv[1]
OUT_MP4, OUT_JSON, STILLS = Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
ONLY = sys.argv[5:]
for d in (OUT_MP4, OUT_JSON, STILLS):
    d.mkdir(parents=True, exist_ok=True)
TMP = STILLS / "_tmp"

IPAD = {"width": 1366, "height": 1024}
CFG = (REPO / "apps/trainer/src/launch.config.ts").read_text()
KEYS = dict(re.findall(r"(\w+_juken): \{[^}]*key: '([^']*)'", CFG))
BUNDLE = json.loads((REPO / "build/bundle.json").read_text())
LABELS = BUNDLE["labels"]
# Every problem sentence (cards and their variants) → its anchor card, to know the right lens and clue on screen.
BY_TEXT = {}
for c in BUNDLE["cards"]:
    BY_TEXT[c["problem"]["text_ja"]] = c
    for v in c.get("variants") or []:
        if isinstance(v, dict) and v.get("text_ja"):
            BY_TEXT[v["text_ja"]] = c

SEED_JS = """(() => { let s = %d >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();"""
# Voice check: which clips the page asked to play (the recording itself has no sound).
VOICE_JS = """(() => { window.__plays = []; const p = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { if (this.src && !this.src.startsWith('data:')) window.__plays.push(this.src.split('/audio/')[1] || this.src); return p.apply(this, arguments); }; })();"""
# A soft touch dot while a finger drags (taps get their ripple from the video), so a viewer can follow the drag.
TOUCH_JS = """(() => { const add = () => { if (document.getElementById('__touch')) return; const d = document.createElement('div'); d.id = '__touch';
  d.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.75);box-shadow:0 0 18px rgba(255,255,255,.35);pointer-events:none;z-index:99999;opacity:0;transition:opacity .15s';
  document.body.appendChild(d);
  addEventListener('pointerdown', (e) => { if (!window.__dragging) return; d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; d.style.opacity = 1; }, true);
  addEventListener('pointermove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('pointerup', () => { d.style.opacity = 0; }, true); };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add); })();"""

STATUS: dict[str, str] = {}


class Rec:
    """capture2.py's recorder, video mode (iPad size): Playwright's screen recording + the event log."""

    def __init__(self, pg, page_t0):
        self.pg, self.page_t0 = pg, page_t0
        self.events: list[dict] = []
        self.t0 = None

    def hold(self, ms):
        self.pg.wait_for_timeout(ms)

    def until(self, loc, timeout=20000):
        expect(loc).to_be_visible(timeout=timeout)

    def start(self):
        self.t0 = time.time()

    def log(self, kind, loc=None, box=None, **extra):
        b = box or (loc.bounding_box() if loc is not None else None)
        e = {"t": round(time.time() - self.t0, 3), "kind": kind}
        if b:
            e.update({k: round(b[k], 1) for k in ("x", "y", "width", "height")})
            e["w"], e["h"] = e.pop("width"), e.pop("height")
        e.update({k: round(v, 1) for k, v in extra.items()})
        self.events.append(e)

    def tap(self, loc, pause=900):
        loc.scroll_into_view_if_needed()
        self.hold(250)
        self.log("tap", loc)
        loc.tap()
        self.hold(pause)

    def focus(self, loc, hold=1200):
        loc.scroll_into_view_if_needed()
        self.hold(200)
        self.log("focus", loc)
        self.hold(hold)

    def drag(self, frm, to, ms=1100, pause=700, box=None, n=None):
        """A finger drag from `frm` to `to` (page px), eased, ~60 moves per second."""
        pg = self.pg
        pg.evaluate("window.__dragging = true")
        b = box or {"x": frm[0] - 22, "y": frm[1] - 22, "width": 44, "height": 44}
        self.log("drag", box=b, x2=to[0], y2=to[1])
        pg.mouse.move(*frm)
        pg.mouse.down()
        self.hold(140)
        # n given (the WebGL scene, where each move costs a rendered frame): just n moves, no waits
        steps = n or max(8, int(ms / 36))  # a move + 16 ms wait ≈ 36 ms here
        for i in range(1, steps + 1):
            u = i / steps
            e = u * u * (3 - 2 * u)
            pg.mouse.move(frm[0] + (to[0] - frm[0]) * e, frm[1] + (to[1] - frm[1]) * e)
            if not n:
                pg.wait_for_timeout(16)
        self.hold(160)
        pg.mouse.up()
        pg.evaluate("window.__dragging = false")
        self.hold(pause)

    def still(self, name):
        self.pg.screenshot(path=str(STILLS / f"{name}.png"))

    def stop_and_write(self, name, video_path):
        vp = self.pg.viewport_size
        off = self.t0 - self.page_t0
        mp4 = OUT_MP4 / f"{name}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{off:.3f}", "-i", str(video_path), "-vf", "fps=30",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", str(mp4)], check=True)
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)], capture_output=True, text=True).stdout)
        (OUT_JSON / f"{name}.json").write_text(json.dumps({"w": vp["width"], "h": vp["height"], "scale": 1, "dur": round(dur, 2), "events": self.events}, indent=1))
        print("clip", name, f"{dur:.1f}s (video)", len(self.events), "events")


def center(loc):
    b = loc.bounding_box()
    return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)


def new_context(browser, seed, record_dir=None, unlock=True, pre=None):
    extra = {"record_video_dir": str(record_dir), "record_video_size": IPAD} if record_dir else {}
    ctx = browser.new_context(viewport=IPAD, device_scale_factor=1, locale="ja-JP", timezone_id="Asia/Tokyo", has_touch=True, **extra)
    ctx.add_init_script(SEED_JS % seed)
    ctx.add_init_script(VOICE_JS)
    ctx.add_init_script(TOUCH_JS)
    # The course's sounds stay on; analytics hosts are unreachable here, so block them (no console noise).
    ctx.route(re.compile(r"googletagmanager|google-analytics|cloudflareinsights"), lambda r: r.abort())
    pg = ctx.new_page()
    page_t0 = time.time()
    pg.goto(BASE + "/check")
    pg.evaluate("localStorage.setItem('lens:lang', 'ja')")
    if unlock:
        for ps, k in KEYS.items():
            pg.goto(f"{BASE}/open?p={ps}&k={k}")
            pg.wait_for_url(f"**/pass/{ps}")
    if pre:
        pg.evaluate(pre)
    return ctx, pg, page_t0


def session(browser, name, path, fn, seed=1, unlock=True, pre=None):
    tmpv = TMP / f"v_{name}"
    shutil.rmtree(tmpv, ignore_errors=True)
    ctx, pg, page_t0 = new_context(browser, seed, tmpv, unlock, pre)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE + path)
    pg.wait_for_timeout(1500)  # settled before recording starts: no blank first frames
    rec = Rec(pg, page_t0)
    rec.start()
    rec.hold(400)
    fn(pg, rec)
    rec.hold(700)
    plays = pg.evaluate("window.__plays || []")
    video = pg.video.path()
    ctx.close()
    rec.stop_and_write(name, video)
    shutil.rmtree(tmpv, ignore_errors=True)
    if errors:
        print("  page errors:", errors[:3])
    if plays:
        print("  voice clips played:", len(plays), plays[:3])


# ---------- the problem on screen ----------

def card_on_screen(pg):
    text = pg.locator("p.qtext").first.inner_text().strip()
    c = BY_TEXT.get(text)
    if not c:
        raise RuntimeError(f"card not found for: {text[:40]}")
    return c


def real_clue(card):
    tags = [t for t in card["trigger"]["tags"] if not LABELS["tags"].get(t, {}).get("generic")]
    return LABELS["tags"][tags[0]]["ja"]


def pick_and_clue(pg, r, wrong_first=False, clue=True, pause=1200, try_on=1900):
    card = card_on_screen(pg)
    right = card["picker"]["correct"]
    side = pg.locator("aside.side")
    if wrong_first:
        wrong = next(o for o in card["picker"]["options"] if o != right)
        r.tap(side.locator("button.opt", has_text=LABELS["lenses"][wrong]["ja"]), try_on)
    r.tap(side.locator("button.opt", has_text=LABELS["lenses"][right]["ja"]), pause)
    if clue:
        r.tap(side.locator("button.cl", has_text=real_clue(card)), 1300)
    return card


def knob(pg, i=0):
    return pg.locator(".stage svg g.knob").nth(i)


def knob_center(pg, i=0):
    return center(knob(pg, i).locator("circle").nth(3))


def solved(pg):
    return pg.locator("aside.side .answer").count() > 0


def solve_mirror_coord(pg, r, quick=False):
    """折り返す on the plane: drag B down across the x-axis (snaps at B′), tap to draw A–B′."""
    k = knob(pg)
    r.until(k)
    r.hold(500)
    x, y = knob_center(pg)
    svg = pg.locator(".stage svg.fig").first.bounding_box()
    r.drag((x, y), (x, min(svg["y"] + svg["height"] - 20, y + 420)), ms=1100 if quick else 1300, pause=800 if quick else 1200)
    line = pg.locator(".stage svg line.nudge-line")
    r.until(line)
    r.hold(250 if quick else 500)
    # the whole figure takes the tap (the dashed line itself sits under the plane's grid)
    b = line.bounding_box()
    r.log("tap", box=b)
    pg.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
    r.hold(1000 if quick else 1500)


def solve_enclose_stage(pg, r):
    """囲む (chain stage 2): drag the box's two corners onto the triangle's corners."""
    r.until(knob(pg))
    r.hold(600)
    poly = pg.locator('.stage svg polygon[stroke-width="2.5"]').first
    b = poly.bounding_box()
    r.drag(knob_center(pg, 0), (b["x"], b["y"]), ms=1000, pause=500)
    r.drag(knob_center(pg, 1), (b["x"] + b["width"], b["y"] + b["height"]), ms=1000, pause=900)


def offcam(pg):
    r = Rec(pg, time.time())
    r.start()
    return r


def probe_1d(browser, path, seed, before):
    """Find, off camera, where to release a one-knob scene that keeps its value (差一定 etc.): step the knob
    a few px at a time until it snaps. Returns (start, target) in page px, the same on a fresh page."""
    ctx, pg, _ = new_context(browser, seed)
    try:
        pg.goto(BASE + path)
        pg.wait_for_timeout(1200)
        before(pg, offcam(pg))
        pg.wait_for_timeout(1200)
        start = knob_center(pg)
        for axis in (0, 1):
            for sign in (1, -1):
                for i in range(1, 70):
                    if solved(pg):
                        break
                    tgt = list(start)
                    tgt[axis] += sign * i * 6
                    cur = knob_center(pg)
                    pg.mouse.move(*cur)
                    pg.mouse.down()
                    pg.mouse.move(*tgt, steps=6)
                    pg.mouse.up()
                    pg.wait_for_timeout(700)
                    if solved(pg):
                        return start, tuple(tgt)
                # back to a fresh page for the next direction
                pg.goto(BASE + path)
                pg.wait_for_timeout(1200)
                before(pg, offcam(pg))
                pg.wait_for_timeout(1200)
        raise RuntimeError("probe: no snap found")
    finally:
        ctx.close()


# ---------- clips ----------

def lens_master_constant(pg, r):
    # わなとレンズ: ナゼホリ asks, the usual way appears line by line, then 「レンズで見る」 animates the figure.
    r.focus(pg.locator(".stage .guide"), 2200)
    look = pg.locator("button[data-target=lensLook]")
    r.until(look, 15000)
    r.hold(500)
    r.tap(look, 600)
    r.hold(2600)
    r.still("lens_master_constant")
    r.hold(1600)
    r.tap(pg.locator("button[data-target=try]"), 800)
    # 例題1: the ghost finger shows the drag, ナゼホリ says what to do.
    r.hold(4200)


def lens_discover_mirror(pg, r):
    pick_and_clue(pg, r, pause=1000)
    solve_mirror_coord(pg, r, quick=True)
    # chain: 折り返す → 囲む on the same plane
    solve_enclose_stage(pg, r)
    r.until(pg.locator("aside.side .answer"), 8000)
    r.hold(500)
    r.still("lens_discover_mirror")
    r.hold(1600)


def lens_3d_unfold(pg, r):
    pick_and_clue(pg, r)
    canvas = pg.locator(".stage3d canvas")
    r.until(canvas, 20000)
    r.hold(1500)
    b = canvas.bounding_box()
    # spin from empty space (the lower left of the canvas, away from the box); 0.008 rad per px of yaw
    sx, sy = b["x"] + b["width"] * 0.10, b["y"] + b["height"] * 0.85
    r.drag((sx, sy), (sx + 110, sy - 30), pause=900, n=14)
    r.still("lens_3d_unfold")
    r.drag((sx + 110, sy - 30), (sx - 40, sy + 10), pause=900, n=18)
    r.drag((sx - 40, sy + 10), (sx + 60, sy - 20), pause=1500, n=12)


def lens_practice(pg, r):
    """Step 3 on 高校受験 折り返す (seeded: kj-mirror-002-v1, chained 折り返す → 囲む): a wrong pick tries on its
    feedback, the right one, the clue, the drags, then the aha card."""
    pick_and_clue(pg, r, wrong_first=True, pause=900, try_on=1500)
    solve_mirror_coord(pg, r, quick=True)
    solve_enclose_stage(pg, r)
    r.until(pg.locator("aside.side .answer"), 8000)
    r.hold(1000)
    r.still("lens_practice")
    r.focus(pg.locator("aside.side .card").last, 1700)


def make_timed(target):
    """Step 4 on 中学受験 和差一定 (seeded: constant-003): the stopwatch runs, one answer stops it.
    (Not a chained card: on Step 4 the chained 折り返す → 囲む cards never finish their 囲む stage, see the report.)"""
    def lens_timed(pg, r):
        r.focus(pg.locator(".bar .clock"), 1600)
        pick_and_clue(pg, r)
        r.until(knob(pg))
        r.hold(600)
        start, tgt = target()
        r.drag(start, tgt, ms=1500, pause=600)
        r.until(pg.locator("aside.side .answer"), 8000)
        r.hold(900)
        r.still("lens_timed")
        r.focus(pg.locator(".bar .clock"), 2000)
    return lens_timed


def lens_drill(pg, r):
    r.hold(1200)
    pick_and_clue(pg, r)
    r.hold(1300)
    r.still("lens_drill")
    pick_and_clue(pg, r, wrong_first=True)
    r.hold(1000)


def lens_report(pg, r):
    r.hold(1200)
    r.focus(pg.locator(".report-card dl.rows"), 2600)
    r.still("lens_report")
    r.focus(pg.locator(".report-card table.per-lens"), 2600)
    r.focus(pg.locator(".report-card .weekly"), 2000)


def lens_pass(pg, r):
    r.hold(1200)
    r.focus(pg.locator(".course .measure"), 1800)
    r.still("lens_pass")
    r.focus(pg.locator(".case .tile").nth(3), 1400)
    r.focus(pg.locator(".case"), 1500)
    pg.evaluate("window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})")
    r.hold(1000)
    r.focus(pg.locator("button.drill-link"), 1800)


def lens_check(pg, r):
    r.hold(1200)
    pick_and_clue(pg, r)
    r.hold(1200)
    r.still("lens_check")
    pick_and_clue(pg, r, wrong_first=True)
    r.hold(1200)


def lens_master_freeze(pg, r):
    r.hold(3200)
    look = pg.locator("button[data-target=lensLook]")
    r.until(look, 15000)
    r.hold(400)
    r.tap(look, 600)
    r.hold(1800)
    r.still("lens_master_freeze")
    r.hold(1600)


# ---------- the parent report's example data ----------

def report_seed_js(pass_id="chugaku_juken"):
    """Example attempts for the report (course/attempts.ts format): a complete Day-1 check 28 days ago
    (median 25.0 s, 5/8 right), a complete week-4 check today (median 11.0 s, 7/8 right) and the lesson,
    timer and drill problems in between. Example numbers, not a real child's."""
    now = datetime.now(timezone.utc).replace(microsecond=0)
    d1 = now - timedelta(days=28, hours=2)
    w4 = now - timedelta(hours=1)
    iso = lambda t: t.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    base = [("enclose-001", "enclose", "enclose", 23700), ("slide-001", "slide", "enclose", 27900), ("area-001", "area", "area", 24300),
            ("constant-001", "constant", "area", 31200), ("balance-001", "balance", "balance", 25700), ("freeze-001", "freeze", "freeze", 21800),
            ("mirror-001", "mirror", "mirror", 19600), ("unfold-001", "unfold", "direct", 26400)]
    wk = [("enclose-002", "enclose", "enclose", 9800), ("slide-002", "slide", "slide", 11800), ("area-002", "area", "area", 10800),
          ("constant-002", "constant", "constant", 12600), ("balance-002", "balance", "balance", 11200), ("freeze-002", "freeze", "freeze", 10400),
          ("mirror-002", "mirror", "mirror", 8700), ("unfold-002", "unfold", "direct", 13900)]
    out = []
    for ctx, sid, at, rows in (("check", "seed-day1", d1, base), ("week4", "seed-week4", w4, wk)):
        for i, (card, want, first, ms) in enumerate(rows):
            out.append({"at": iso(at + timedelta(seconds=20 * i)), "pass": pass_id, "ctx": ctx, "sid": sid, "card": card, "anchor": card,
                        "want": want, "first": first, "ok": want == first, "ms": ms})
    lenses = ["enclose", "slide", "area", "constant", "balance", "freeze", "mirror", "unfold"]
    for w, n in enumerate([18, 24, 21, 27]):
        for j in range(n):
            lens = lenses[j % 8]
            t = d1 + timedelta(days=7 * w + 1 + (j % 6), minutes=10 * j)
            ms = int((22000 - 3200 * w) * (0.85 + 0.3 * ((j * 37) % 10) / 10))
            out.append({"at": iso(t), "pass": pass_id, "ctx": ["lesson", "lesson", "timer", "drill"][j % 4], "sid": f"seed-w{w}-{j // 5}",
                        "card": f"{lens}-00{1 + j % 5}", "anchor": f"{lens}-00{1 + j % 5}", "want": lens, "first": lens, "ok": True, "ms": ms})
    out.sort(key=lambda a: a["at"])
    return f"localStorage.setItem('lens.attempts.v1', {json.dumps(json.dumps(out))});"


# ---------- run ----------

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        want = lambda n: not ONLY or n in ONLY

        if want("lens_master_constant"):
            session(b, "lens_master_constant", "/lesson/chugaku_juken/constant/master", lens_master_constant)
        if want("lens_discover_mirror"):
            session(b, "lens_discover_mirror", "/lesson/koukou_juken/mirror?card=kj-mirror-001", lens_discover_mirror)
        if want("lens_3d_unfold"):
            session(b, "lens_3d_unfold", "/lesson/chugaku_juken/unfold", lens_3d_unfold)
        if want("lens_practice"):
            session(b, "lens_practice", "/lesson/koukou_juken/mirror/practice", lens_practice, seed=3)
        if want("lens_timed"):
            path, seed = "/lesson/chugaku_juken/constant/timed", 1
            found = probe_1d(b, path, seed, lambda pg, r: pick_and_clue(pg, r))
            session(b, "lens_timed", path, make_timed(lambda: found), seed=seed)
        if want("lens_drill"):
            session(b, "lens_drill", "/drill/chugaku_juken", lens_drill, seed=3)
        if want("lens_report"):
            session(b, "lens_report", "/report/chugaku_juken", lens_report, pre=report_seed_js())
        if want("lens_pass"):
            session(b, "lens_pass", "/pass/chugaku_juken", lens_pass)
        if want("lens_check"):
            session(b, "lens_check", "/check", lens_check, seed=5, unlock=False)
        if want("lens_master_freeze"):
            session(b, "lens_master_freeze", "/lesson/daigaku_juken/freeze/master", lens_master_freeze)
        b.close()
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    main()
