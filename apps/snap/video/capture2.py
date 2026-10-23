"""High-resolution app recordings + a log of every tap, for the guide video v2.

Frames come from Chrome's screencast at device pixels (crisp when the video zooms in); every action is logged
with its time and the element's box, so the video can zoom to it and draw a tap ripple there.

  PORT=8097 MOCK_FALLBACK=zukei5 WAITLIST_DIR=/tmp/wl5 PLAN_DIR=$(mktemp -d) node dist-server/index.js &
  python3 video/capture2.py http://localhost:8097 <sheet-photo.jpg> <out-dir> [clip ...]

Writes <out-dir>/<clip>.mp4 (constant 30 fps) and <clip>.json: {"w","h" (CSS px), "scale", "dur", "events": [
{"t", "kind": "tap"|"focus"|"scroll", "x","y","w","h" (CSS px)}]}.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE, PHOTO, OUT = sys.argv[1], sys.argv[2], Path(sys.argv[3])
ONLY = sys.argv[4:]
OUT.mkdir(parents=True, exist_ok=True)

src = (ROOT / "scripts" / "screens.py").read_text().split("OUT = ROOT")[0]
ns = {"__file__": str(ROOT / "scripts" / "screens.py")}
exec(src, ns)
SEEDS = [ns["SEED_JS"], ns["exam_seed_js"]()]
# Display language of the recording (VLANG=ja|en|zh-Hant): the app's language switch + its labels for the locators.
VLANG = os.environ.get("VLANG", "ja")
LOCALE = {"ja": "ja-JP", "en": "en-US", "zh-Hant": "zh-TW"}[VLANG]
LABEL = {
    "ja": {"snap": "撮る", "list": "テスト前", "camera": "カメラで撮る", "confirm": "読み取り結果の確認", "save": "保存する"},
    "en": {"snap": "Snap", "list": "Pre-Test", "camera": "Take a photo", "confirm": "Check the results", "save": "Save"},
    "zh-Hant": {"snap": "拍照", "list": "考前", "camera": "用相機拍", "confirm": "確認辨識結果", "save": "儲存"},
}[VLANG]
IPAD = {"width": 1366, "height": 1024}
PHONE = {"width": 390, "height": 844}


class Rec:
    """mode "shot": screenshots at `scale` (phone: crisp text, ~15 fps); mode "video": Playwright's screen
    recording (iPad: the map canvas is heavy, so smooth 30 fps at CSS pixels)."""

    def __init__(self, pg, cdp, scale, mode="shot", page_t0=None):
        self.pg, self.cdp, self.scale, self.mode, self.page_t0 = pg, cdp, scale, mode, page_t0
        self.frames: list[tuple[float, bytes]] = []
        self.events: list[dict] = []
        self.t0 = None

    def grab(self):
        if self.mode == "video":
            return
        vp = self.pg.viewport_size
        # the clip is in page coordinates: follow the scroll so the frame is what is on screen
        sx, sy = self.pg.evaluate("[window.scrollX, window.scrollY]")
        r = self.cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 82, "optimizeForSpeed": True,
                                                     "clip": {"x": sx, "y": sy, "width": vp["width"], "height": vp["height"], "scale": self.scale}})
        self.frames.append((time.time(), base64.b64decode(r["data"])))

    def hold(self, ms):
        if self.mode == "video":
            self.pg.wait_for_timeout(ms)
            return
        """Wait while recording frames (Chrome renders at device pixels: crisp when the video zooms in)."""
        end = time.time() + ms / 1000
        while time.time() < end:
            self.grab()

    def until(self, loc, timeout=20000):
        if self.mode == "video":
            expect(loc).to_be_visible(timeout=timeout)
            return
        end = time.time() + timeout / 1000
        while time.time() < end:
            self.grab()
            if loc.is_visible():
                return
        raise TimeoutError("not visible")

    def start(self):
        self.t0 = time.time()
        self.grab()

    def log(self, kind, loc=None, box=None):
        b = box or (loc.bounding_box() if loc is not None else None)
        e = {"t": round(time.time() - self.t0, 3), "kind": kind}
        if b:
            e.update({k: round(b[k], 1) for k in ("x", "y", "width", "height")})
            e["w"], e["h"] = e.pop("width"), e.pop("height")
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

    def stop_and_write(self, name, video_path=None):
        vp = self.pg.viewport_size
        if self.mode == "video":
            off = self.t0 - self.page_t0
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{off:.3f}", "-i", str(video_path), "-vf", "fps=30",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", str(OUT / f"{name}.mp4")], check=True)
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT / f"{name}.mp4")], capture_output=True, text=True).stdout)
            (OUT / f"{name}.json").write_text(json.dumps({"w": vp["width"], "h": vp["height"], "scale": 1, "dur": round(dur, 2), "events": self.events}, indent=1))
            print("clip", name, f"{dur:.1f}s (video)", len(self.events), "events")
            return
        self.grab()
        frames = sorted(self.frames)
        tmp = OUT / f"_{name}"
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir()
        end = time.time()
        lines = []
        for i, (ts, data) in enumerate(frames):
            p = tmp / f"{i:05d}.jpg"
            p.write_bytes(data)
            nxt = frames[i + 1][0] if i + 1 < len(frames) else end
            lines.append(f"file '{p.name}'\nduration {max(0.001, nxt - ts):.4f}")
        lines.append(f"file '{tmp / f'{len(frames) - 1:05d}.jpg'}'".replace(str(tmp) + "/", ""))
        (tmp / "list.txt").write_text("\n".join(lines))
        first = frames[0][0] if frames else self.t0
        # events relative to the first frame (= video time 0)
        for e in self.events:
            e["t"] = round(e["t"] - (first - self.t0), 3)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(tmp / "list.txt"),
                        "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
                        "-pix_fmt", "yuv420p", str(OUT / f"{name}.mp4")], check=True)
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT / f"{name}.mp4")], capture_output=True, text=True).stdout)
        (OUT / f"{name}.json").write_text(json.dumps({"w": vp["width"], "h": vp["height"], "scale": self.scale, "dur": round(dur, 2), "events": self.events}, indent=1))
        shutil.rmtree(tmp, ignore_errors=True)
        print("clip", name, f"{dur:.1f}s", len(frames), "frames", len(self.events), "events")


def session(browser, name, vp, scale, fn, path="/app/map"):
    mode = "shot" if vp["width"] < 600 else "video"
    tmpv = OUT / f"_v_{name}"
    shutil.rmtree(tmpv, ignore_errors=True)
    extra = {"record_video_dir": str(tmpv), "record_video_size": vp} if mode == "video" else {}
    ctx = browser.new_context(viewport=vp, device_scale_factor=2 if mode == "shot" else 1, locale=LOCALE, is_mobile=vp["width"] < 900, has_touch=True, **extra)
    ctx.add_init_script("navigator.share = (d) => Promise.resolve();")
    pg = ctx.new_page()
    page_t0 = time.time()
    pg.goto(BASE + "/app")
    pg.evaluate("localStorage.setItem('lens-snap:grade', '小5'); localStorage.setItem('lens-snap:install-tip', 'closed');" + f"localStorage.setItem('lens-snap:lang', '{VLANG}');")
    for s in SEEDS:
        pg.evaluate(s)
    pg.goto(BASE + path)
    if path == "/app/map":
        expect(pg.locator("button.terr-unit")).to_have_count(110)
    pg.wait_for_timeout(1500)  # settled before recording starts: no blank first frames
    rec = Rec(pg, ctx.new_cdp_session(pg), scale, mode, page_t0)
    rec.start()
    rec.hold(400)
    fn(pg, rec)
    rec.hold(700)
    if mode == "video":
        video = pg.video.path()
        ctx.close()
        rec.stop_and_write(name, video)
        shutil.rmtree(tmpv, ignore_errors=True)
    else:
        rec.stop_and_write(name)
        ctx.close()


def tab(pg, label):
    return pg.locator("nav.tabbar a.tab", has_text=label)


def snap_phone(pg, r):
    r.hold(900)
    r.tap(tab(pg, LABEL["snap"]), 1200)
    r.focus(pg.get_by_role("button", name=LABEL["camera"]), 700)
    pg.get_by_test_id("file-input").set_input_files(PHOTO)
    r.until(pg.get_by_role("heading", name=LABEL["confirm"]))
    r.hold(900)
    cards = pg.get_by_test_id("problem-card")
    r.focus(cards.nth(0).locator("select"), 1600)
    r.focus(cards.nth(0).get_by_test_id("mark-source"), 1400)
    r.focus(cards.nth(1), 1600)
    r.focus(cards.nth(3), 1200)
    pg.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")  # recorded by the hold below
    r.hold(700)
    r.tap(pg.get_by_role("button", name=LABEL["save"]), 600)
    r.hold(900)
    lit = pg.locator("button.terr-unit.is-lit").first
    r.focus(lit, 3200)


def map_ipad(pg, r):
    r.hold(1500)
    for _ in range(3):
        r.tap(pg.get_by_test_id("zoom-out"), 900)
    r.hold(1600)
    for _ in range(3):
        r.tap(pg.get_by_test_id("zoom-in"), 600)
    r.tap(pg.get_by_test_id("compass"), 2000)
    r.focus(pg.get_by_test_id("hud-card"), 1600)


def sheet_ipad(pg, r):
    r.hold(800)
    u = pg.locator('button.terr-unit[data-unit="5-D2"]')
    r.log("tap", u)
    u.dispatch_event("click")
    r.hold(2200)
    sheet = pg.get_by_test_id("star-sheet")
    r.focus(sheet.get_by_test_id("sheet-ladder"), 1500)
    r.focus(sheet.get_by_test_id("sheet-history"), 1500)
    r.focus(sheet.get_by_test_id("unit-problem").first, 1500)
    r.tap(sheet.get_by_test_id("photo-thumb").first, 2400)
    r.tap(pg.get_by_test_id("viewer-close"), 1000)


def roots_ipad(pg, r):
    r.hold(800)
    u = pg.locator('button.terr-unit[data-unit="5-D2"]')
    r.log("tap", u)
    u.dispatch_event("click")
    r.hold(2200)
    btn = pg.locator("button.root-btn").first
    r.tap(btn, 3200)


def exam_ipad(pg, r):
    r.hold(800)
    r.tap(tab(pg, LABEL["list"]), 1600)
    r.tap(pg.get_by_test_id("exam-tomorrow"), 2400)
    r.focus(pg.get_by_test_id("exam-rangebar"), 1200)
    r.tap(pg.get_by_test_id("exam-decide"), 2600)
    r.focus(pg.get_by_test_id("plan-overview"), 2000)
    r.tap(pg.get_by_test_id("plan-check").first, 1600)
    r.tap(pg.get_by_test_id("plan-tick").first, 1800)
    r.tap(pg.get_by_test_id("plan-share"), 2800)
    r.tap(pg.get_by_test_id("summary-close"), 900)


def daily_phone(pg, r):
    r.hold(800)
    r.tap(pg.get_by_test_id("hud-next"), 2200)
    sheet = pg.get_by_test_id("star-sheet")
    prob = sheet.get_by_test_id("unit-problem").first
    r.focus(prob, 1400)
    r.tap(prob.get_by_test_id("up-tick"), 2200)
    r.focus(sheet.get_by_test_id("sheet-ladder"), 1800)


def portrait_ipad(pg, r):
    r.hold(3500)


def plan_phone(pg, r):
    r.hold(1200)
    r.focus(pg.get_by_test_id("plan-free"), 1400)
    r.focus(pg.get_by_test_id("plan-offer"), 2000)


CLIPS = {
    "snap_phone": (PHONE, 2, snap_phone, "/app/map"),
    "map_ipad": (IPAD, 2, map_ipad, "/app/map"),
    "sheet_ipad": (IPAD, 2, sheet_ipad, "/app/map"),
    "roots_ipad": (IPAD, 2, roots_ipad, "/app/map"),
    "exam_ipad": (IPAD, 2, exam_ipad, "/app/map"),
    "daily_phone": (PHONE, 2, daily_phone, "/app/map"),
    "portrait_ipad": ({"width": 820, "height": 1180}, 2, portrait_ipad, "/app/map"),
    "plan_phone": (PHONE, 2, plan_phone, "/app/plan"),
}

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, (vp, scale, fn, path) in CLIPS.items():
        if ONLY and name not in ONLY:
            continue
        session(b, name, vp, scale, fn, path)
    b.close()
