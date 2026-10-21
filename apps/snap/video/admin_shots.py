"""The dashboard in 日本語 / English / 中文 with a few simulated trial users (mock reader, local server).

  pnpm build && python3 video/admin_shots.py <out-dir> <sheet-photo.jpg>
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
OUT, PHOTO = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8095
BASE = f"http://localhost:{PORT}"
env = {**os.environ, "PORT": str(PORT), "PLAN_DIR": mkdtemp(prefix="plans-"), "WAITLIST_DIR": mkdtemp(prefix="wl-"), "MOCK_FALLBACK": "zukei5",
       "ADMIN_KEY": "demo-admin-key", "READ_PER_IP_HOUR": "1000"}
for k in ("INVITE_ONLY", "PILOT_CODE", "ANTHROPIC_API_KEY", "K_SERVICE"):
    env.pop(k, None)
srv = subprocess.Popen(["node", "dist-server/index.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(100):
    try:
        urllib.request.urlopen(BASE + "/api/health", timeout=1)
        break
    except Exception:
        time.sleep(0.1)

UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"}


def post(path, body=b"", headers=None):
    req = urllib.request.Request(BASE + path, data=body, method="POST", headers={**UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


def read(dev):
    boundary = "----dash"
    img = PHOTO.read_bytes()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"grade\"\r\n\r\n小5\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"p.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + img + f"\r\n--{boundary}--\r\n".encode()
    return post("/api/read", body, {"x-device": dev, "Content-Type": f"multipart/form-data; boundary={boundary}"})[0]


try:
    for _ in range(9):
        urllib.request.urlopen(urllib.request.Request(BASE + "/", headers=UA))  # landing page views
    photos = [30, 12, 5, 1, 0, 3]  # one user used up the trial; one opened the app but took none
    for n in photos:
        dev = post("/api/device")[1]["device"]
        for _ in range(n):
            assert read(dev) == 200
        if n == 30:
            assert read(dev) == 402  # the 31st is refused
    time.sleep(1)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1180, "height": 900})
        pg.goto(BASE + "/admin")
        pg.fill("input[name=key]", "demo-admin-key")
        pg.get_by_role("button", name="ひらく").click()
        expect(pg.get_by_test_id("users").locator("tbody tr")).to_have_count(5)  # 5 users took photos
        for lang, heading in [("ja", "利用者（端末ごと）"), ("en", "Users (by device)"), ("zh", "用户（按设备）")]:
            pg.goto(f"{BASE}/admin?lang={lang}")
            expect(pg.get_by_role("heading", name=heading)).to_be_visible()
            pg.screenshot(path=str(OUT / f"dashboard-{lang}.png"), full_page=True)
            print("shot", lang)
        b.close()
finally:
    srv.terminate()
print("all checks passed")
