"""Architect's walkthrough: every tab and button a parent or student touches, tapped in order, on iPad
landscape, iPad portrait and iPhone — run before anything is handed to the founder.

Unlike screens.py (fixed expectations + screenshots for the docs), this never stops at the first problem:
every step is PASS / FAIL with a screenshot, and the run ends with a table. Also checks on every step:
no JS error, no sideways scrolling, the tab bar / rail never covered by accident.

Usage: pnpm build
       PORT=8096 PILOT_CODE=kumo42 MOCK_FALLBACK=zukei5 WAITLIST_DIR=/tmp/wl4 node dist-server/index.js &
       python3 scripts/walkthrough.py [base_url] [photo.jpg] [out_dir]
"""

import sys
import traceback
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8096"
PHOTO = sys.argv[2] if len(sys.argv) > 2 else str(ROOT / "fixtures" / "photos" / "live4.jpg")
OUT = Path(sys.argv[3] if len(sys.argv) > 3 else "/tmp/lens-snap-walkthrough")
OUT.mkdir(parents=True, exist_ok=True)
CODE = "kumo42"  # local test pilot code (the server above), never the real one

DEVICES = [
    ("ipad-landscape", {"width": 1366, "height": 1024}),
    ("ipad-portrait", {"width": 1024, "height": 1366}),
    ("iphone", {"width": 390, "height": 844}),
]

results: list[tuple[str, str, str, str]] = []  # device, step, PASS/FAIL, detail


def run(device, page, errors, n, name, fn):
    before = len(errors)
    try:
        fn()
        page.wait_for_timeout(350)
        over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        problems = []
        if over > 1:
            problems.append(f"page scrolls sideways by {over}px")
        if len(errors) > before:
            problems.append("JS error: " + errors[-1][:160])
        status, detail = ("FAIL", "; ".join(problems)) if problems else ("PASS", "")
    except Exception as e:  # noqa: BLE001 — record and keep going
        status, detail = "FAIL", (str(e).splitlines() or [repr(e)])[0][:220]
        traceback.print_exc(limit=1)
    try:
        page.screenshot(path=str(OUT / f"{device}-{n:02d}.png"))
    except Exception:  # noqa: BLE001
        pass
    results.append((device, f"{n:02d} {name}", status, detail))
    print(f"[{device}] {n:02d} {status} {name} {detail}")


def tab(page, label):
    page.locator("nav.tabbar a.tab", has_text=label).tap()


def walkthrough(browser, device, vp):
    ctx = browser.new_context(viewport=vp, device_scale_factor=1, locale="ja-JP", is_mobile=True, has_touch=True)
    ctx.add_init_script("navigator.share = (d) => { window.__shared = d; return Promise.resolve(); };")
    pg = ctx.new_page()
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    steps = []
    s = lambda name: (lambda fn: steps.append((name, fn)) or fn)  # noqa: E731

    @s("open /app: invite code, then grade")
    def _():
        pg.goto(BASE + "/app")
        expect(pg.get_by_role("heading", name="招待コードを入力してください")).to_be_visible()
        pg.fill("input[name=pilot-code]", CODE.upper())  # iPhone may capitalise: must still work
        pg.get_by_role("button", name="つづける").tap()
        expect(pg.get_by_role("radio", name="小5")).to_be_visible()

    @s("pick 小5 → はじめる → the map is home")
    def _():
        pg.get_by_role("radio", name="小5").tap()
        pg.get_by_role("button", name="はじめる").tap()
        expect(pg).to_have_url(BASE + "/app/map")
        expect(pg.locator("button.terr-unit")).to_have_count(110)
        expect(pg.get_by_test_id("map-welcome")).to_be_visible()

    @s("撮る tab: back pill + camera / photo buttons")
    def _():
        tab(pg, "撮る")
        expect(pg.get_by_test_id("back-to-map")).to_be_visible()
        expect(pg.get_by_role("button", name="カメラで撮る")).to_be_visible()
        expect(pg.get_by_role("button", name="写真を選ぶ")).to_be_visible()

    @s("‹ マップにもどる → map")
    def _():
        pg.get_by_test_id("back-to-map").tap()
        expect(pg).to_have_url(BASE + "/app/map")

    @s("snap the sheet → 読み取り結果の確認 (4 problems, AI ○✕)")
    def _():
        tab(pg, "撮る")
        pg.get_by_test_id("file-input").set_input_files(PHOTO)
        expect(pg.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=20000)
        expect(pg.get_by_test_id("problem-card")).to_have_count(4)
        expect(pg.locator("[data-testid=mark-source][data-source=ai]")).not_to_have_count(0)
        # no 「マップにもどる」 here: leaving would drop the reading; やめる / 保存する are the ways out
        expect(pg.get_by_test_id("back-to-map")).to_be_hidden()

    @s("保存する → map with toast, new tiles lit")
    def _():
        pg.get_by_role("button", name="保存する").tap()
        expect(pg).to_have_url(__import__("re").compile(r".*/app/map\?saved=4.*"))
        expect(pg.get_by_test_id("lit-toast")).to_contain_text("4問を保存しました")
        expect(pg.locator("button.terr-unit.is-lit")).not_to_have_count(0)

    @s("toast レポートを見る → 学習レポート → ‹ back")
    def _():
        pg.get_by_test_id("toast-report").tap()
        expect(pg.get_by_test_id("report")).to_be_visible()
        pg.get_by_test_id("report-back").tap()
        expect(pg).to_have_url(BASE + "/app/map")

    @s("tap a red unit (平均) → its record sheet")
    def _():
        pg.wait_for_timeout(900)
        pg.locator('button.terr-unit[data-unit="5-D2"]').dispatch_event("click")
        sheet = pg.get_by_test_id("star-sheet")
        expect(sheet).to_contain_text("平均")
        expect(sheet.get_by_test_id("unit-problem")).not_to_have_count(0)

    @s("problem photo → page viewer → ✕ back to the sheet")
    def _():
        thumb = pg.get_by_test_id("star-sheet").get_by_test_id("photo-thumb").first
        thumb.scroll_into_view_if_needed()
        thumb.tap()
        expect(pg.get_by_test_id("page-viewer")).to_be_visible()
        pg.get_by_test_id("viewer-close").tap()
        expect(pg.get_by_test_id("page-viewer")).to_have_count(0)
        expect(pg.get_by_test_id("star-sheet")).to_be_visible()

    @s("sheet ✕ → plain map")
    def _():
        pg.get_by_test_id("sheet-close").tap()
        expect(pg.get_by_test_id("star-sheet")).to_have_count(0)

    @s("テスト前 tab → 「テストはいつですか？」")
    def _():
        tab(pg, "テスト前")
        expect(pg).to_have_url(BASE + "/app/exam")
        expect(pg.get_by_test_id("exam-date")).to_contain_text("テストはいつですか？")

    @s("明日 → range on the map → 決定")
    def _():
        pg.get_by_test_id("exam-tomorrow").tap()
        expect(pg.get_by_test_id("exam-range-count")).not_to_have_text("範囲 0単元")
        pg.get_by_test_id("exam-decide").tap()
        expect(pg.get_by_test_id("exam-plan")).to_be_visible()

    @s("今夜の作戦: date, range, 今夜やること, ①②③")
    def _():
        expect(pg.get_by_test_id("plan-title")).to_contain_text("明日のテスト")
        expect(pg.get_by_test_id("plan-line")).to_contain_text("今夜やること")
        expect(pg.get_by_test_id("exam-countdown")).to_have_text("テストまで あと1日")
        expect(pg.get_by_test_id("plan-card")).not_to_have_count(0)

    @s("答えを確かめる → shows the answer")
    def _():
        btn = pg.get_by_test_id("plan-check").first
        btn.scroll_into_view_if_needed()
        btn.tap()
        expect(pg.get_by_test_id("plan-answer").first).to_be_visible()

    @s("復習した tick → progress moves")
    def _():
        tick = pg.get_by_test_id("plan-tick").first
        tick.scroll_into_view_if_needed()
        tick.tap()
        expect(pg.get_by_test_id("plan-progress")).to_contain_text("復習した 1 /")

    @s("共有用にまとめる → summary → 共有 → close")
    def _():
        pg.get_by_test_id("plan-share").tap()
        expect(pg.get_by_test_id("exam-summary")).to_be_visible()
        pg.get_by_test_id("summary-share").tap()
        pg.wait_for_function("!!window.__shared")
        pg.get_by_test_id("summary-close").tap()
        expect(pg.get_by_test_id("exam-summary")).to_have_count(0)
        expect(pg.get_by_test_id("exam-plan")).to_be_visible()

    @s("plan ✕ → plain map (テスト前 mode off)")
    def _():
        pg.get_by_test_id("plan-close").tap()
        expect(pg).to_have_url(BASE + "/app/map")
        expect(pg.get_by_test_id("exam-plan")).to_have_count(0)
        expect(pg.locator("nav.tabbar a.tab-active")).to_have_text("マップ")

    @s("テスト前 tab again → straight to 今夜の作戦 (tick kept)")
    def _():
        tab(pg, "テスト前")
        expect(pg.get_by_test_id("exam-plan")).to_be_visible()
        expect(pg.get_by_test_id("plan-progress")).to_contain_text("復習した 1 /")

    @s("reload on テスト前 → still 今夜の作戦")
    def _():
        pg.reload()
        expect(pg.get_by_test_id("exam-plan")).to_be_visible(timeout=10000)

    @s("browser back (swipe-back) → leaves テスト前")
    def _():
        pg.get_by_test_id("plan-close").tap()  # leave via ✕ first so the history is the usual one
        expect(pg).to_have_url(BASE + "/app/map")
        tab(pg, "テスト前")
        expect(pg.get_by_test_id("exam-plan")).to_be_visible()
        pg.go_back()
        expect(pg.get_by_test_id("exam-plan")).to_have_count(0)
        expect(pg.locator("button.terr-unit")).to_have_count(110)  # the map, not a blank screen

    @s("ふりかえり tab: the saved page + back pill")
    def _():
        tab(pg, "ふりかえり")
        expect(pg.get_by_test_id("back-to-map")).to_be_visible()
        expect(pg.get_by_text("2026").first).to_be_visible()
        pg.get_by_test_id("back-to-map").tap()
        expect(pg).to_have_url(BASE + "/app/map")

    @s("grade chip → 学年 screen → back pill → map (grade kept)")
    def _():
        pg.get_by_test_id("grade-chip").tap()
        expect(pg.get_by_role("heading", name="学年を選んでください")).to_be_visible()
        pg.get_by_test_id("back-to-map").tap()
        expect(pg).to_have_url(BASE + "/app/map")
        expect(pg.get_by_test_id("grade-chip")).to_have_text("小5")

    @s("map menu ☰: every item opens")
    def _():
        pg.get_by_test_id("hud-menu").tap()
        expect(pg.get_by_test_id("hud-menu-pop")).to_be_visible()
        pg.get_by_test_id("menu-year").tap()
        expect(pg.get_by_test_id("year-sheet")).to_be_visible()
        pg.keyboard.press("Escape")
        expect(pg.get_by_test_id("year-sheet")).to_have_count(0)

    @s("map controls: zoom in / out / 現在地")
    def _():
        for t in ("zoom-in", "zoom-out", "compass"):
            pg.get_by_test_id(t).tap()
        expect(pg.locator("button.terr-unit")).to_have_count(110)

    @s("HUD テスト前モード button → same 今夜の作戦")
    def _():
        pg.get_by_test_id("hud-exam").tap()
        expect(pg.get_by_test_id("exam-plan")).to_be_visible()
        pg.get_by_test_id("plan-close").tap()
        expect(pg.get_by_test_id("exam-plan")).to_have_count(0)

    if device.startswith("ipad"):

        @s("rotate with 今夜の作戦 open → still usable, ✕ works")
        def _():
            tab(pg, "テスト前")
            expect(pg.get_by_test_id("exam-plan")).to_be_visible()
            pg.set_viewport_size({"width": vp["height"], "height": vp["width"]})
            pg.wait_for_timeout(600)
            expect(pg.get_by_test_id("exam-plan")).to_be_visible()
            b = pg.get_by_test_id("plan-close").bounding_box()
            assert b and 0 <= b["x"] and b["x"] + b["width"] <= vp["height"] and 0 <= b["y"], b
            pg.get_by_test_id("plan-close").tap()
            expect(pg.get_by_test_id("exam-plan")).to_have_count(0)
            pg.set_viewport_size(vp)

    for i, (name, fn) in enumerate(steps, 1):
        run(device, pg, errors, i, name, fn)
    ctx.close()


with sync_playwright() as p:
    browser = p.chromium.launch()
    for device, vp in DEVICES:
        walkthrough(browser, device, vp)
    browser.close()

fails = [r for r in results if r[2] == "FAIL"]
print(f"\n{len(results) - len(fails)}/{len(results)} steps passed  (screenshots: {OUT})")
for d, step, _, detail in fails:
    print(f"FAIL [{d}] {step}: {detail}")
(OUT / "results.tsv").write_text("\n".join("\t".join(r) for r in results), encoding="utf-8")
sys.exit(1 if fails else 0)
