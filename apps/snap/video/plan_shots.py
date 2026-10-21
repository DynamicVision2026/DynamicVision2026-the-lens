"""Screenshots of the monthly photo limit (年間プラン 200/month shared by the plan's devices, free plan).

  pnpm build && python3 video/plan_shots.py <out-dir> <sheet-photo.jpg>

Starts the built server several times on a fresh plan folder (MockReader, no pilot gate), with
PLANS_TEST_NOW pinning the clock (honoured only off Cloud Run) so the month reset can be shown.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from tempfile import mkdtemp

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT, PHOTO = Path(sys.argv[1]), sys.argv[2]
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8099
BASE = f"http://localhost:{PORT}"
LIC = "LS-F3BJ-D3FG-N7F7"
LIC_FILE = LIC.replace("-", "")
PLAN_DIR = Path(mkdtemp(prefix="plans-"))
src = (ROOT / "scripts" / "screens.py").read_text().split("OUT = ROOT")[0]
ns = {"__file__": str(ROOT / "scripts" / "screens.py")}
exec(src, ns)
SEEDS = [ns["SEED_JS"], ns["exam_seed_js"]()]


def put(key: str, value) -> None:
    p = PLAN_DIR / f"{key}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value))


def get(key: str):
    p = PLAN_DIR / f"{key}.json"
    return json.loads(p.read_text()) if p.exists() else None


put(f"lic/{LIC_FILE}", {"key": LIC, "kind": "order", "expiresAt": "2027-10-19T03:00:00.000Z", "devices": [], "createdAt": "2026-10-19T03:00:00.000Z"})


class Server:
    def __init__(self, now: str, free: int = 30):
        env = {**os.environ, "PORT": str(PORT), "PLAN_DIR": str(PLAN_DIR), "PLANS_TEST_NOW": now, "FREE_MONTHLY": str(free),
               "MOCK_FALLBACK": "zukei5", "WAITLIST_DIR": mkdtemp(prefix="wl-"), "SIGNING_KEY": "k" * 40}
        for k in ("PILOT_CODE", "ANTHROPIC_API_KEY", "K_SERVICE"):
            env.pop(k, None)
        self.p = subprocess.Popen(["node", "dist-server/index.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen(BASE + "/api/health", timeout=1)
                return
            except Exception:
                time.sleep(0.1)
        raise RuntimeError("server did not start")

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.p.terminate()
        self.p.wait()


MAIN_DEVICE: dict[str, str] = {}  # one phone reused across runs (a pass allows 3 devices)


def ctx_for(b, license_: str | None, phone=True, seed=False, main=False):
    vp = {"width": 390, "height": 844} if phone else {"width": 1180, "height": 820}
    ctx = b.new_context(viewport=vp, device_scale_factor=2, locale="ja-JP", is_mobile=phone, has_touch=True)
    pg = ctx.new_page()
    pg.goto(BASE + "/app")
    js = "localStorage.setItem('lens-snap:grade', '小5'); localStorage.setItem('lens-snap:install-tip', 'closed');"
    if license_:
        js += f"localStorage.setItem('lens-snap:license', '{license_}');"
    if main and MAIN_DEVICE:
        js += f"localStorage.setItem('lens-snap:device', '{MAIN_DEVICE['t']}');"
    pg.evaluate(js)
    if main and not MAIN_DEVICE:
        pg.goto(BASE + "/app/plan")
        pg.wait_for_function("!!localStorage.getItem('lens-snap:device')")
        MAIN_DEVICE["t"] = pg.evaluate("localStorage.getItem('lens-snap:device')")
    if seed:
        for s in SEEDS:
            pg.evaluate(s)
    return ctx, pg


def shot(pg, name):
    pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
    print("shot", name)


def plan_and_snap(b, tag, expect_count, level):
    ctx, pg = ctx_for(b, LIC, main=True)
    pg.goto(BASE + "/app/plan")
    expect(pg.get_by_test_id("plan-month-count")).to_have_text(expect_count)
    assert pg.get_by_test_id("plan-month").get_attribute("data-level") == level
    shot(pg, f"{tag}-plan")
    pg.goto(BASE + "/app/snap")
    expect(pg.get_by_test_id("plan-chip-count")).to_be_visible()
    shot(pg, f"{tag}-snap")
    return ctx, pg


month = "2026-10"
with sync_playwright() as p:
    b = p.chromium.launch()

    # 1) paid plan at 0, 37, 160 (orange), 200 (used up) — 21 Oct 2026, 12:00 JST
    with Server("2026-10-21T03:00:00Z"):
        for n, tag, level in [(0, "pass-000", "ok"), (37, "pass-037", "ok"), (160, "pass-160", "low"), (200, "pass-200", "out")]:
            put(f"usage/pass/{month}/{LIC_FILE}", {"n": n})
            ctx, pg = plan_and_snap(b, tag, f"{n}／200枚（{int(n / 2 + 0.5)}%）", level)
            if n == 200:
                expect(pg.get_by_test_id("pass-out-card")).to_be_visible()
                assert pg.get_by_role("button", name="カメラで撮る").count() == 0
                ctx.close()
                # used up: saved pages, the map and テスト前 keep working
                ctx, pg = ctx_for(b, LIC, seed=True, main=True)
                pg.goto(BASE + "/app/map")
                expect(pg.locator("button.terr-unit")).to_have_count(110)
                pg.wait_for_timeout(1500)
                shot(pg, "pass-200-map-still-works")
                pg.locator("nav.tabbar a.tab", has_text="テスト前").tap()
                pg.wait_for_timeout(1000)
                shot(pg, "pass-200-exam-still-works")
            ctx.close()

        # 2) two devices on the same code: device A reads a photo (36 → 37), device B shows 37 too
        put(f"usage/pass/{month}/{LIC_FILE}", {"n": 36})
        a, pa = ctx_for(b, LIC, main=True)
        bb, pb = ctx_for(b, LIC, phone=False)
        pb.goto(BASE + "/app/plan")
        expect(pb.get_by_test_id("plan-month-count")).to_contain_text("36／200枚")
        pa.goto(BASE + "/app/snap")
        expect(pa.get_by_test_id("plan-chip-count")).to_have_text("今月 36／200枚")
        pa.get_by_test_id("file-input").set_input_files(PHOTO)
        expect(pa.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)
        pa.get_by_role("button", name="保存する").tap()
        pa.wait_for_timeout(1200)
        pa.goto(BASE + "/app/plan")
        expect(pa.get_by_test_id("plan-month-count")).to_contain_text("37／200枚")
        shot(pa, "two-devices-A-phone")
        pb.reload()
        expect(pb.get_by_test_id("plan-month-count")).to_contain_text("37／200枚")
        shot(pb, "two-devices-B-ipad")
        devs = get(f"lic/{LIC_FILE}")["devices"]
        assert len(devs) == 2, devs
        print("license devices:", len(devs), "count file:", get(f"usage/pass/{month}/{LIC_FILE}"))
        a.close()
        bb.close()

    # 3) free plan used up (30/30 now; and 2/2 with FREE_MONTHLY=2)
    for free in (30, 2):
        with Server("2026-10-21T03:00:00Z", free=free):
            ctx, pg = ctx_for(b, None)
            pg.goto(BASE + "/app/plan")
            expect(pg.get_by_test_id("plan-free")).to_be_visible()
            dev = pg.evaluate("localStorage.getItem('lens-snap:device')").split(".")[1]
            put(f"usage/{month}/{dev}", {"n": free})
            pg.reload()
            expect(pg.get_by_test_id("plan-left")).to_contain_text("今月あと 0枚")
            shot(pg, f"free-{free}of{free}-plan")
            pg.goto(BASE + "/app/snap")
            expect(pg.get_by_test_id("quota-card")).to_be_visible()
            shot(pg, f"free-{free}of{free}-snap")
            ctx.close()

    # 4) the reset: 200 used on 31 Oct 23:59 JST → 0 on 1 Nov 00:00 JST
    put(f"usage/pass/{month}/{LIC_FILE}", {"n": 200})
    with Server("2026-10-31T14:59:00Z"):
        ctx, pg = ctx_for(b, LIC, main=True)
        pg.goto(BASE + "/app/plan")
        expect(pg.get_by_test_id("plan-month-count")).to_contain_text("200／200枚")
        shot(pg, "reset-1-oct31-2359")
        ctx.close()
    with Server("2026-10-31T15:00:00Z"):
        ctx, pg = ctx_for(b, LIC, main=True)
        pg.goto(BASE + "/app/plan")
        expect(pg.get_by_test_id("plan-month-count")).to_have_text("0／200枚（0%）")
        expect(pg.get_by_text("12月1日にリセットされます")).to_be_visible()
        shot(pg, "reset-2-nov01-0000")
        pg.goto(BASE + "/app/snap")
        expect(pg.get_by_test_id("plan-chip-count")).to_have_text("今月 0／200枚")
        shot(pg, "reset-3-nov01-snap")
        ctx.close()
    b.close()
print("all checks passed")
