"""Real app screenshots for the landing page (public/lp/*.webp), from the seeded demo child (小5).

  PORT=8097 MOCK_FALLBACK=zukei5 WAITLIST_DIR=/tmp/wl5 PLAN_DIR=$(mktemp -d) node dist-server/index.js &
  python3 video/lp_shots.py http://localhost:8097 <sheet-photo.jpg>
"""
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE, PHOTO = sys.argv[1], sys.argv[2]
OUT = ROOT / "public" / "lp"
OUT.mkdir(parents=True, exist_ok=True)
src = (ROOT / "scripts" / "screens.py").read_text().split("OUT = ROOT")[0]
ns = {"__file__": str(ROOT / "scripts" / "screens.py")}
exec(src, ns)
SEEDS = [ns["SEED_JS"], ns["exam_seed_js"]()]


def save(pg, name, width, crop=None):
    png = pg.screenshot()
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if crop:
        im = im.crop(crop)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=84, method=6)
    print(name, im.size)


def page(b, vp, scale):
    ctx = b.new_context(viewport=vp, device_scale_factor=scale, locale="ja-JP", is_mobile=vp["width"] < 900, has_touch=True)
    ctx.add_init_script("navigator.share = (d) => Promise.resolve();")
    pg = ctx.new_page()
    pg.goto(BASE + "/app")
    pg.evaluate("localStorage.setItem('lens-snap:grade', '小5'); localStorage.setItem('lens-snap:install-tip', 'closed');")
    for s in SEEDS:
        pg.evaluate(s)
    return ctx, pg


def to_map(pg):
    pg.goto(BASE + "/app/map")
    expect(pg.locator("button.terr-unit")).to_have_count(110)
    pg.wait_for_timeout(1800)


IPAD = {"width": 1366, "height": 1024}
PHONE = {"width": 390, "height": 844}
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = page(b, IPAD, 2)
    to_map(pg)
    save(pg, "map-ipad", 1600)
    pg.get_by_test_id("zoom-out").tap()
    pg.wait_for_timeout(700)
    pg.get_by_test_id("zoom-out").tap()
    pg.wait_for_timeout(1200)
    save(pg, "map-continent", 1600)
    pg.get_by_test_id("compass").tap()
    pg.wait_for_timeout(1200)
    pg.locator('button.terr-unit[data-unit="5-D2"]').dispatch_event("click")
    pg.wait_for_timeout(2200)
    save(pg, "unit-sheet", 1600)
    pg.locator("button.root-btn").first.tap()
    pg.wait_for_timeout(2600)
    save(pg, "roots", 1600)
    ctx.close()

    ctx, pg = page(b, IPAD, 2)
    to_map(pg)
    pg.locator("nav.tabbar a.tab", has_text="テスト前").tap()
    pg.wait_for_timeout(1200)
    pg.get_by_test_id("exam-tomorrow").tap()
    pg.wait_for_timeout(1500)
    pg.get_by_test_id("exam-decide").tap()
    pg.wait_for_timeout(2400)
    save(pg, "exam-plan", 1600)
    pg.get_by_test_id("plan-share").tap()
    pg.wait_for_timeout(1500)
    save(pg, "exam-summary", 1600)
    ctx.close()

    ctx, pg = page(b, PHONE, 3)
    to_map(pg)
    save(pg, "phone-map", 720)
    pg.locator("nav.tabbar a.tab", has_text="撮る").tap()
    pg.wait_for_timeout(900)
    save(pg, "phone-snap", 720)
    pg.get_by_test_id("file-input").set_input_files(PHOTO)
    expect(pg.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)
    pg.wait_for_timeout(800)
    save(pg, "phone-confirm", 720)
    pg.get_by_role("button", name="保存する").tap()
    pg.wait_for_timeout(1600)
    save(pg, "phone-saved", 720)
    ctx.close()
    b.close()
