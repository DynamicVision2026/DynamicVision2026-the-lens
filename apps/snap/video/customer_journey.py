"""A new customer's first visit with the invite gate off, then the founder's dashboard.

  pnpm build && python3 video/customer_journey.py <out-dir> <sheet-photo.jpg>
"""
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
PORT = 8097
BASE = f"http://localhost:{PORT}"
PLAN_DIR = mkdtemp(prefix="plans-")
env = {**os.environ, "PORT": str(PORT), "PLAN_DIR": PLAN_DIR, "WAITLIST_DIR": mkdtemp(prefix="wl-"), "MOCK_FALLBACK": "zukei5",
       "PILOT_CODE": "kumo42", "ADMIN_KEY": "demo-admin-key"}  # PILOT_CODE set but INVITE_ONLY not: the gate must stay off
for k in ("INVITE_ONLY", "ANTHROPIC_API_KEY", "K_SERVICE"):
    env.pop(k, None)
srv = subprocess.Popen(["node", "dist-server/index.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(100):
    try:
        urllib.request.urlopen(BASE + "/api/health", timeout=1)
        break
    except Exception:
        time.sleep(0.1)

n = 0


def shot(pg, name):
    global n
    n += 1
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(OUT / f"{n:02d}-{name}.png"))
    print("shot", f"{n:02d}-{name}")


UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True, user_agent=UA)
        pg = ctx.new_page()
        pg.goto(BASE + "/")
        start = pg.get_by_test_id("lp-start").first
        expect(start).to_contain_text("無料ではじめる")  # not 先行登録: the gate is off
        shot(pg, "lp-top")
        start.tap()
        pg.wait_for_url("**/app**")
        shot(pg, "app-first-screen")
        # a first-time visitor picks the grade
        pg.get_by_text("小5", exact=True).first.tap()
        pg.get_by_role("button", name="はじめる").tap()
        pg.wait_for_timeout(1500)
        shot(pg, "after-grade")
        pg.goto(BASE + "/app/snap")
        expect(pg.get_by_test_id("plan-chip")).to_contain_text("お試し あと30枚")
        shot(pg, "snap-trial-30")
        pg.get_by_test_id("file-input").set_input_files(PHOTO)
        expect(pg.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)  # no invite code asked
        shot(pg, "confirm")
        pg.get_by_role("button", name="保存する").tap()
        pg.wait_for_url("**/app/map**")
        pg.wait_for_timeout(1500)
        shot(pg, "map-after-first-photo")
        pg.goto(BASE + "/app/snap")
        expect(pg.get_by_test_id("plan-chip")).to_contain_text("お試し あと29枚")
        shot(pg, "snap-trial-29")
        ctx.close()

        # the founder's dashboard
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1, locale="ja-JP")
        pg = ctx.new_page()
        pg.goto(BASE + "/admin")
        shot(pg, "admin-login")
        pg.fill("input[name=key]", "demo-admin-key")
        pg.get_by_role("button", name="ひらく").click()
        expect(pg.get_by_role("heading", name="お客さまの流れ")).to_be_visible()
        row = lambda label: pg.locator("table.funnel tr", has_text=label).locator("td").nth(1)  # 今日
        expect(row("① LPを見た")).to_have_text("1")
        expect(row("② アプリを開いた")).to_have_text("1")
        expect(row("③ はじめて撮った")).to_have_text("1")
        pg.screenshot(path=str(OUT / f"{n + 1:02d}-admin-dashboard.png"), full_page=True)
        print("shot admin-dashboard (full page)")
        b.close()
finally:
    srv.terminate()
print("all checks passed")
