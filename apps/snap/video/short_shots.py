"""Real app screens for the story Shorts A (family tree) and B (chat), phone 390×844 @3x.

  PORT=8097 MOCK_FALLBACK=zukei5 WAITLIST_DIR=$(mktemp -d) PLAN_DIR=$(mktemp -d) node dist-server/index.js &
  python3 video/short_shots.py http://localhost:8097 <out-dir>

Writes map.png (小5 map, end-card background), plan.png (B: tonight's plan for 平均 ✕1 + 割合 ✕2),
roots.png (A: 中2 連立二元一次方程式 with its root path drawn on the map).
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
PHONE = {"width": 390, "height": 844}
VLANG = os.environ.get("VLANG", "ja")  # the app's display language (ja | en | zh-Hant)
LOCALE = {"ja": "ja-JP", "en": "en-US", "zh-Hant": "zh-TW"}[VLANG]
LIST_TAB = {"ja": "テスト前", "en": "Pre-Test", "zh-Hant": "考前"}[VLANG]

SEED = """async (pages) => {
  await new Promise((res, rej) => {
    const req = indexedDB.open("lens-snap", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("pages", { keyPath: "id" });
    req.onerror = () => rej(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("pages", "readwrite");
      for (const p of pages) tx.objectStore("pages").put(p);
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
  });
}"""


def page(pid, at, grade, probs):
    return {"id": pid, "createdAt": at, "grade": grade, "pageType": "drill", "score": None,
            "problems": [{"n": i + 1, "q": q, "unit": u, "answer": "1", "mark": m, "markSource": "teacher" if m else None,
                          "confidence": 0.95, "reviewed": bool(r)} for i, (u, m, r, q) in enumerate(probs)]}


Q = "（見本）問題"
KID5 = [
    page("s0", "2026-09-20T09:00:00.000Z", "小5", [("5-A1", "○", 0, Q), ("5-A1", "○", 0, Q), ("5-A3", "○", 0, Q), ("5-B1", "○", 0, Q)]),
    page("s1", "2026-10-05T09:00:00.000Z", "小5", [("5-B1", "○", 0, Q), ("5-B2", "○", 0, Q), ("5-A3", "✕", 1, Q), ("5-A3", "○", 0, Q)]),
    page("s2", "2026-10-20T09:00:00.000Z", "小5", [
        ("5-D2", "✕", 0, "次の表は、あるクラスのテストの点数です。平均点を求めなさい。"),
        ("5-D2", "○", 0, Q),
        ("5-C3", "✕", 0, "定価4000円の品物を15%引きで買いました。代金はいくらですか。"),
        ("5-C3", "✕", 0, "30人のうち12人が自転車通学です。自転車通学の人の割合を百分率で答えなさい。"),
        ("5-C3", "○", 0, Q)]),
]
KID8 = [page("m0", "2026-10-20T09:00:00.000Z", "中2", [("j2-A2", "✕", 0, "連立方程式 2x+y=7, x−y=2 を解きなさい。"), ("j2-A1", "○", 0, Q)])]


def ctx_for(b, grade, pages):
    ctx = b.new_context(viewport=PHONE, device_scale_factor=3, locale=LOCALE, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto(BASE + "/app")
    pg.evaluate(f"localStorage.setItem('lens-snap:grade', '{grade}'); localStorage.setItem('lens-snap:install-tip', 'closed'); localStorage.setItem('lens-snap:lang', '{VLANG}');")
    pg.evaluate(SEED, pages)
    pg.goto(BASE + "/app/map")
    expect(pg.locator("button.terr-unit")).to_have_count(110)
    pg.wait_for_timeout(2000)
    return ctx, pg


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = ctx_for(b, "小5", KID5)
    pg.screenshot(path=str(OUT / "map.png"))
    pg.locator("nav.tabbar a.tab", has_text=LIST_TAB).tap()
    pg.wait_for_timeout(1200)
    pg.get_by_test_id("exam-tomorrow").tap()
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / "range.png"))
    pg.get_by_test_id("exam-decide").tap()
    pg.wait_for_timeout(2400)
    pg.screenshot(path=str(OUT / "plan.png"))
    ctx.close()

    ctx, pg = ctx_for(b, "中2", KID8)
    pg.locator('button.terr-unit[data-unit="j2-A2"]').dispatch_event("click")
    pg.wait_for_timeout(2200)
    pg.screenshot(path=str(OUT / "unit.png"))
    pg.locator("button.root-btn").first.tap()
    pg.wait_for_timeout(2800)
    pg.screenshot(path=str(OUT / "roots.png"))
    ctx.close()
    b.close()
print("ok")
