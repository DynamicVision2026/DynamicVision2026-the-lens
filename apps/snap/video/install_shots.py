"""The home-screen reminder, tapped through for real (photos saved through the app, mock reader).

  pnpm build && python3 video/install_shots.py <out-dir> <sheet-photo.jpg>

iPhone: 1st photo → window → あとで; 2nd photo → window again → 追加する → steps; 3rd photo → no window.
Android (Chrome install prompt): 1st photo → 追加する → the browser's own install prompt; never again.
Android without a prompt: 追加する → the ︙ menu steps.  Already on the home screen: no window at all.
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
PORT = 8098
BASE = f"http://localhost:{PORT}"
env = {**os.environ, "PORT": str(PORT), "PLAN_DIR": mkdtemp(prefix="plans-"), "WAITLIST_DIR": mkdtemp(prefix="wl-"), "MOCK_FALLBACK": "zukei5"}
for k in ("INVITE_ONLY", "PILOT_CODE", "ANTHROPIC_API_KEY", "K_SERVICE"):
    env.pop(k, None)
srv = subprocess.Popen(["node", "dist-server/index.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(100):
    try:
        urllib.request.urlopen(BASE + "/api/health", timeout=1)
        break
    except Exception:
        time.sleep(0.1)

IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"
PROMPT_JS = """() => { window.__prompted = 0; const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = async () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }"""
STANDALONE_JS = """(() => { const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q); })()"""


def phone(b, ua, standalone=False):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True, user_agent=ua)
    if standalone:
        ctx.add_init_script(STANDALONE_JS)
    pg = ctx.new_page()
    pg.goto(BASE + "/app")
    pg.evaluate("localStorage.setItem('lens-snap:grade', '小5')")
    return ctx, pg


def save_photo(pg):
    pg.goto(BASE + "/app/snap")
    pg.get_by_test_id("file-input").set_input_files(PHOTO)
    expect(pg.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)
    pg.get_by_role("button", name="保存する").tap()
    pg.wait_for_url("**/app/map**")


def shot(pg, name):
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / f"{name}.png"))
    print("shot", name)


def no_window(pg):
    pg.wait_for_timeout(3500)
    expect(pg.get_by_test_id("install-ask")).to_have_count(0)


try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # iPhone Safari
        ctx, pg = phone(b, IPHONE)
        save_photo(pg)
        expect(pg.get_by_test_id("install-ask")).to_have_count(0)  # not over the light-up
        ask = pg.get_by_test_id("install-ask")
        expect(ask).to_contain_text("ホーム画面に追加しませんか？", timeout=6000)
        shot(pg, "1-iphone-after-photo-1")
        ask.get_by_role("button", name="あとで").tap()
        expect(ask).to_have_count(0)
        pg.reload()
        no_window(pg)  # not again until the next photo
        save_photo(pg)
        expect(ask).to_contain_text("ホーム画面に追加しませんか？", timeout=6000)
        shot(pg, "2-iphone-after-photo-2")
        ask.get_by_role("button", name="追加する").tap()
        expect(ask).to_contain_text("共有ボタン（□↑）")
        shot(pg, "3-iphone-steps")
        ask.get_by_role("button", name="わかりました").tap()
        save_photo(pg)
        no_window(pg)
        print("iphone: asked after photo 1 and 2, steps shown, then never again")
        ctx.close()

        # Android Chrome with the install prompt
        ctx, pg = phone(b, ANDROID)
        save_photo(pg)
        pg.evaluate(PROMPT_JS)
        ask = pg.get_by_test_id("install-ask")
        expect(ask).to_be_visible(timeout=6000)
        shot(pg, "4-android-ask")
        ask.get_by_role("button", name="追加する").tap()
        expect(ask).to_have_count(0)
        assert pg.evaluate("window.__prompted") == 1, "the browser's install prompt was not opened"
        save_photo(pg)
        no_window(pg)
        print("android: 追加する opened the browser's install prompt; never again")
        ctx.close()

        # Android without an install prompt (another browser): the ︙ menu steps
        ctx, pg = phone(b, ANDROID)
        save_photo(pg)
        ask = pg.get_by_test_id("install-ask")
        expect(ask).to_be_visible(timeout=6000)
        ask.get_by_role("button", name="追加する").tap()
        expect(ask).to_contain_text("メニュー（︙）")
        shot(pg, "5-android-steps")
        ctx.close()

        # already opened from the home screen: never asked
        ctx, pg = phone(b, IPHONE, standalone=True)
        save_photo(pg)
        no_window(pg)
        save_photo(pg)
        no_window(pg)
        print("home-screen app: no window")
        ctx.close()
        b.close()
finally:
    srv.terminate()
print("all checks passed")
