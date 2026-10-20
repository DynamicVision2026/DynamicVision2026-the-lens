"""Records the real app for the つまずきマップ guide video (Playwright screen recordings, one WebM per clip).

  PORT=8097 MOCK_FALLBACK=zukei5 WAITLIST_DIR=/tmp/wl5 PLAN_DIR=$(mktemp -d) node dist-server/index.js &
  python3 video/capture.py http://localhost:8097 <sheet-photo.jpg> <out-dir>

Data: the screens.py seeds (earlier pages on every ladder step + the founder's three sheets), so the map
shows gold, green, red flags and roots. Each clip is paced for viewing (pauses after every action).
"""
import shutil
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE = sys.argv[1]
PHOTO = sys.argv[2]
OUT = Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)

src = (ROOT / "scripts" / "screens.py").read_text().split("OUT = ROOT")[0]
ns = {"__file__": str(ROOT / "scripts" / "screens.py")}
exec(src, ns)
SEEDS = [ns["SEED_JS"], ns["exam_seed_js"]()]

IPAD = {"width": 1366, "height": 1024}
PHONE = {"width": 390, "height": 844}


def clip(browser, name, vp, scale, fn, seed=True, grade="小5"):
    size = {"width": vp["width"] * scale, "height": vp["height"] * scale}
    tmp = OUT / f"_{name}"
    shutil.rmtree(tmp, ignore_errors=True)
    # setup without recording (seed data, grade), then a recorded context on the same storage
    setup = browser.new_context(viewport=vp, locale="ja-JP")
    sp = setup.new_page()
    sp.goto(BASE + "/app")
    sp.evaluate(f"localStorage.setItem('lens-snap:grade', '{grade}')")
    sp.evaluate("localStorage.setItem('lens-snap:install-tip', 'closed')")
    if seed:
        for s in SEEDS:
            sp.evaluate(s)
    state = setup.storage_state()
    # IndexedDB is not in storage_state: keep the same context alive by recording in it instead
    setup.close()
    ctx = browser.new_context(viewport=vp, device_scale_factor=scale, locale="ja-JP", is_mobile=vp["width"] < 900,
                              has_touch=True, record_video_dir=str(tmp), record_video_size=size, storage_state=state)
    ctx.add_init_script("navigator.share = (d) => Promise.resolve();")
    pg = ctx.new_page()
    pg.goto(BASE + "/app")
    pg.evaluate(f"localStorage.setItem('lens-snap:grade', '{grade}')")
    if seed:
        for s in SEEDS:
            pg.evaluate(s)
    fn(pg)
    pg.wait_for_timeout(800)
    video = pg.video.path()
    ctx.close()
    Path(video).rename(OUT / f"{name}.webm")
    shutil.rmtree(tmp, ignore_errors=True)
    print("clip", name)


def wait(pg, ms=900):
    pg.wait_for_timeout(ms)


def tab(pg, label):
    pg.locator("nav.tabbar a.tab", has_text=label).tap()


def map_overview(pg):
    pg.goto(BASE + "/app/map")
    expect(pg.locator("button.terr-unit")).to_have_count(110)
    wait(pg, 2200)
    for _ in range(3):
        pg.get_by_test_id("zoom-out").tap()
        wait(pg, 900)
    wait(pg, 1800)
    for _ in range(3):
        pg.get_by_test_id("zoom-in").tap()
        wait(pg, 700)
    pg.get_by_test_id("compass").tap()
    wait(pg, 2200)


def snap_phone(pg):
    pg.goto(BASE + "/app/map")
    wait(pg, 1500)
    tab(pg, "撮る")
    wait(pg, 1400)
    pg.get_by_test_id("file-input").set_input_files(PHOTO)
    expect(pg.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)
    wait(pg, 1800)
    for _ in range(4):
        pg.mouse.wheel(0, 260)
        wait(pg, 700)
    pg.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
    wait(pg, 900)
    pg.get_by_role("button", name="保存する").tap()
    wait(pg, 5200)


def unit_sheet(pg):
    pg.goto(BASE + "/app/map")
    wait(pg, 1600)
    pg.locator('button.terr-unit[data-unit="5-D2"]').dispatch_event("click")
    wait(pg, 2600)
    body = pg.get_by_test_id("sheet-body")
    for _ in range(3):
        body.evaluate("el => el.scrollBy({top: 220, behavior: 'smooth'})")
        wait(pg, 900)
    thumb = pg.get_by_test_id("star-sheet").get_by_test_id("photo-thumb").first
    thumb.scroll_into_view_if_needed()
    wait(pg, 600)
    thumb.tap()
    wait(pg, 2400)
    pg.get_by_test_id("viewer-close").tap()
    wait(pg, 1200)


def roots(pg):
    pg.goto(BASE + "/app/map")
    wait(pg, 1200)
    pg.locator('button.terr-unit[data-unit="5-D2"]').dispatch_event("click")
    wait(pg, 2600)
    btn = pg.locator("button.root-btn").first
    btn.scroll_into_view_if_needed()
    wait(pg, 1000)
    btn.tap()
    wait(pg, 3200)


def exam(pg):
    pg.goto(BASE + "/app/map")
    wait(pg, 1400)
    tab(pg, "テスト前")
    wait(pg, 1800)
    pg.get_by_test_id("exam-tomorrow").tap()
    wait(pg, 2600)
    pg.get_by_test_id("exam-decide").tap()
    wait(pg, 3000)
    btn = pg.get_by_test_id("plan-check").first
    btn.scroll_into_view_if_needed()
    wait(pg, 800)
    btn.tap()
    wait(pg, 1600)
    tick = pg.get_by_test_id("plan-tick").first
    tick.scroll_into_view_if_needed()
    tick.tap()
    wait(pg, 1800)
    pg.get_by_test_id("plan-share").tap()
    wait(pg, 3000)
    pg.get_by_test_id("summary-close").tap()
    wait(pg, 1000)


def ipad_portrait(pg):
    pg.goto(BASE + "/app/map")
    wait(pg, 3000)


def plan_phone(pg):
    pg.goto(BASE + "/app/plan")
    wait(pg, 2000)
    for _ in range(3):
        pg.mouse.wheel(0, 250)
        wait(pg, 800)


ONLY = sys.argv[4:]  # optional: names of the clips to (re)record
with sync_playwright() as p:
    b = p.chromium.launch()
    if ONLY:
        fns = {"c4_roots_ipad": (IPAD, 1, roots)}
        for n in ONLY:
            vp, sc, fn = fns[n]
            clip(b, n, vp, sc, fn)
        b.close()
        sys.exit(0)
    clip(b, "c1_map_ipad", IPAD, 1, map_overview)
    clip(b, "c2_snap_phone", PHONE, 2, snap_phone)
    clip(b, "c3_sheet_ipad", IPAD, 1, unit_sheet)
    clip(b, "c4_roots_ipad", IPAD, 1, roots)
    clip(b, "c5_exam_ipad", IPAD, 1, exam)
    clip(b, "c6_map_portrait", {"width": 820, "height": 1180}, 1, ipad_portrait)
    clip(b, "c7_plan_phone", PHONE, 2, plan_phone)
    b.close()
