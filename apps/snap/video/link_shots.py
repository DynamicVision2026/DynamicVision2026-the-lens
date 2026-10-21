"""The store email's one-tap unlock link, and backup → reset → restore keeping the photo count.

  pnpm build && python3 video/link_shots.py <out-dir> <sheet-photo.jpg>

Local server (mock reader) + a stand-in Shopify that knows one paid order #1001 (LENS-SNAP-1Y).
"""
import hashlib
import hmac
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import mkdtemp

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT, PHOTO = Path(sys.argv[1]), sys.argv[2]
OUT.mkdir(parents=True, exist_ok=True)
PORT, SHOP = 8094, 8093
BASE = f"http://localhost:{PORT}"
LINK_KEY = "test-link-key-0123456789abcdef"
PLAN_DIR = Path(mkdtemp(prefix="plans-"))


class FakeShopify(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        self.rfile.read(int(self.headers.get("content-length", 0)))
        if self.path == "/admin/oauth/access_token":
            return self._json({"access_token": "fake", "expires_in": 86399})
        order = {"id": "gid://shopify/Order/1", "name": "#1001", "email": "mama@example.jp", "cancelledAt": None,
                 "processedAt": "2026-10-21T00:00:00Z", "displayFinancialStatus": "PAID",
                 "lineItems": {"nodes": [{"sku": "LENS-SNAP-1Y", "quantity": 1}]}}
        self._json({"data": {"orders": {"nodes": [order]}}})

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


threading.Thread(target=HTTPServer(("127.0.0.1", SHOP), FakeShopify).serve_forever, daemon=True).start()
env = {**os.environ, "PORT": str(PORT), "PLAN_DIR": str(PLAN_DIR), "WAITLIST_DIR": mkdtemp(prefix="wl-"), "MOCK_FALLBACK": "zukei5",
       "SHOPIFY_TOKEN": "cid:csecret", "SHOPIFY_BASE": f"http://localhost:{SHOP}", "SHOPIFY_LINK_KEY": LINK_KEY, "ADMIN_KEY": "demo-admin-key"}
for k in ("INVITE_ONLY", "PILOT_CODE", "ANTHROPIC_API_KEY", "K_SERVICE"):
    env.pop(k, None)
srv = subprocess.Popen(["node", "dist-server/index.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(100):
    try:
        urllib.request.urlopen(BASE + "/api/health", timeout=1)
        break
    except Exception:
        time.sleep(0.1)

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
sig = hmac.new(LINK_KEY.encode(), b"1001", hashlib.sha256).hexdigest()  # what Shopify's `1001 | hmac_sha256: key` prints


def phone(b):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True, user_agent=UA, accept_downloads=True)
    pg = ctx.new_page()
    pg.goto(BASE + "/app")
    pg.evaluate("localStorage.setItem('lens-snap:grade', '小5'); localStorage.setItem('lens-snap:install-tip', 'closed')")
    return ctx, pg


def shot(pg, name):
    pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / f"{name}.png"))
    print("shot", name)


try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # 1) the button in the order email → the plan is on, nothing typed
        ctx, pg = phone(b)
        pg.goto(f"{BASE}/app/claim?o=1001&s={sig}")
        expect(pg.get_by_test_id("plan-done")).to_have_text("年間プランが有効になりました", timeout=10000)
        expect(pg.get_by_test_id("plan-month-count")).to_have_text("0／200枚（0%）")
        expect(pg.get_by_text("ホーム画面に追加したアプリでも使うときは")).to_be_visible()
        shot(pg, "1-email-link-unlocked")
        pg.goto(BASE + "/app/snap")
        expect(pg.get_by_test_id("plan-chip-count")).to_contain_text("今月 0／200枚")
        ctx.close()

        # 2) a damaged link → プラン with the order number filled in; only the email to type
        ctx, pg = phone(b)
        pg.goto(f"{BASE}/app/claim?o=1001&s=1001")
        claim = pg.get_by_test_id("plan-claim")
        expect(claim.get_by_test_id("plan-claim-error")).to_contain_text("リンクを確認できませんでした", timeout=10000)
        expect(claim.locator("input[name=order]")).to_have_value("1001")
        claim.scroll_into_view_if_needed()
        shot(pg, "2-bad-link-fallback")
        claim.locator("input[name=email]").fill("mama@example.jp")
        claim.get_by_role("button", name="有効にする").tap()
        expect(pg.get_by_test_id("plan-done")).to_be_visible(timeout=10000)
        ctx.close()

        # 3) the snippet for Shopify on the dashboard
        dash = b.new_page(viewport={"width": 1180, "height": 900})
        dash.goto(BASE + "/admin")
        dash.fill("input[name=key]", "demo-admin-key")
        dash.get_by_role("button", name="ひらく").click()
        snippet = dash.get_by_test_id("mail-snippet")
        expect(snippet).to_contain_text(f"hmac_sha256: '{LINK_KEY}'")
        dash.fill("input[name=check]", "https://tsumazuki.domo-ai.com/app/claim?o=1001&s=1001")
        dash.get_by_role("button", name="確認する").click()
        expect(dash.get_by_test_id("check-result")).to_contain_text("リンクを確認できません")
        dash.fill("input[name=check]", f"https://tsumazuki.domo-ai.com/app/claim?o=1001&s={sig}")
        dash.get_by_role("button", name="確認する").click()
        expect(dash.get_by_test_id("check-result")).to_contain_text("正しく設定されています（注文番号 1001")
        dash.get_by_test_id("mail-snippet").scroll_into_view_if_needed()
        dash.screenshot(path=str(OUT / "3-dashboard-snippet.png"))
        print("shot 3-dashboard-snippet (link check ok)")

        # 4) backup keeps the photo count: photo → backup → (trial used up) → wipe → restore → still used up
        ctx, pg = phone(b)
        pg.goto(BASE + "/app/snap")
        pg.get_by_test_id("file-input").set_input_files(PHOTO)
        expect(pg.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)
        pg.get_by_role("button", name="保存する").tap()
        pg.wait_for_url("**/app/map**")
        dev_a = pg.evaluate("localStorage.getItem('lens-snap:device')")
        pg.goto(BASE + "/app/archive")
        with pg.expect_download() as dl:
            pg.get_by_role("button", name="バックアップを保存").tap()
        backup = OUT / "backup.json"
        dl.value.save_as(backup)
        data = json.loads(backup.read_text())
        assert data["device"] == dev_a, "the backup must carry the device id"
        (PLAN_DIR / "usage" / "trial" / f"{dev_a.split('.')[1]}.json").write_text(json.dumps({"n": 30}))  # trial used up
        ctx.close()

        ctx, pg = phone(b)  # "cleared browser": a new device with a fresh 30
        pg.goto(BASE + "/app/plan")
        expect(pg.get_by_test_id("plan-left")).to_have_text("お試し：あと30枚（30枚まで無料）")
        assert pg.evaluate("localStorage.getItem('lens-snap:device')") != dev_a
        pg.goto(BASE + "/app/archive")
        pg.get_by_test_id("backup-input").set_input_files(str(backup))
        expect(pg.get_by_test_id("backup-msg")).to_contain_text("1", timeout=10000)
        assert pg.evaluate("localStorage.getItem('lens-snap:device')") == dev_a
        pg.goto(BASE + "/app/plan")
        expect(pg.get_by_test_id("plan-left")).to_have_text("お試し：あと0枚（30枚まで無料）")
        shot(pg, "4-restored-count-back")
        print("backup: map restored and the used-up trial came back with it")
        ctx.close()
        b.close()
finally:
    srv.terminate()
print("all checks passed")
