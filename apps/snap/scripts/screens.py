"""Drive the built app headlessly and save phone screenshots to docs/screens/.

Usage: pnpm build
       PORT=8093 node dist-server/index.js &                       # open server
       PORT=8094 PILOT_CODE=kumo42 node dist-server/index.js &     # gated server (招待コード)
       PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py [base_url] [gated_url]
Flow: landing → waitlist → /app grade 小5 → seed earlier pages (gold / green / red units)
      → upload p01 (mock reader) → confirm → save → map lights up 5-C3 → full map
      → テスト前リスト with 5-C3 = exactly the 2 ✕ problems → archive → retake
      → gated server: 招待コード prompt, wrong code → 403 → asked again → right code reads.
"""
import os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8093"
GATED = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8094"

# Earlier saved pages for 小5 (IndexedDB seed), so the map shows every state:
#   5-A1 gold (newest test all ○), 5-B1 gold (old ✕ then a later all-○ test),
#   5-A3 green (✕ reviewed), 5-C1 red (✕ not reviewed), 5-D1 green (drill, no marks),
#   4-A2 red in 小4 (shows in a collapsed section summary).
SEED_JS = """async () => {
  const P = (id, at, type, probs) => ({ id, createdAt: at, grade: "小5", pageType: type, score: null,
    problems: probs.map(([unit, mark, reviewed], i) => ({ n: i + 1, q: "（見本）問題 " + (i + 1), unit, answer: "1",
      mark, confidence: 0.95, reviewed: !!reviewed })) });
  const pages = [
    P("seed1", "2026-10-01T09:00:00.000Z", "test", [["5-A1","○"],["5-A1","○"],["5-A1","○"],["5-A3","✕",true],["5-A3","○"]]),
    P("seed2", "2026-10-03T09:00:00.000Z", "drill", [["5-B1","✕"],["5-B1","✕"],["5-D1",null],["5-D1",null],["5-C1","✕"],["5-C1","○"]]),
    P("seed3", "2026-10-10T09:00:00.000Z", "test", [["5-B1","○"],["5-B1","○"],["5-B1","○"],["4-A2","✕"]]),
  ];
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
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screens"
OUT.mkdir(parents=True, exist_ok=True)


def shot(page, name, full=True):
    # Full-page captures: un-fix the bars so they render once at their natural place.
    style = page.add_style_tag(content=".tabbar,.topbar,.sticky-actions{position:static!important}") if full else None
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    if style:
        style.evaluate("el => el.remove()")
    print("saved", name)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # 0/1. Landing (default variant): full page with FAQ opened, and first screen
    # No ?h= → a random variant (sticky); ?h=default pins the default hero for the screenshot.
    page.goto(BASE + "/")
    first = page.locator("h1").get_attribute("data-variant")
    page.reload()
    assert page.locator("h1").get_attribute("data-variant") == first, "variant must be sticky"
    page.goto(BASE + "/?h=default&src=yt")
    expect(page.get_by_role("heading", level=1)).to_have_text("撮るだけで、やることがわかる。")
    assert "\u3010\u4eee\u3011" not in page.content()  # no placeholder marker left
    page.locator("details.faq-item summary").first.click()
    shot(page, "00-landing-full")
    shot(page, "01-landing", full=False)

    # 2. Waitlist via hero CTA (scrolls to the form): empty submit → errors, then valid submit
    page.get_by_role("link", name="先行登録する（無料）").click()
    page.get_by_role("button", name="先行登録する", exact=True).click()
    expect(page.get_by_text("メールアドレスを入力してください。")).to_be_visible()
    expect(page.get_by_text("お子さまの学年を選んでください。")).to_be_visible()
    page.fill("input[name=email]", "parent@example.com")
    page.select_option("select[name=grade]", "小学5年生")
    page.locator("label.seg-item", has_text="よくある").click()
    page.locator("#waitlist").scroll_into_view_if_needed()
    shot(page, "02-waitlist-filled", full=False)
    page.get_by_role("button", name="先行登録する", exact=True).click()
    expect(page.get_by_text("ご登録ありがとうございます")).to_be_visible()
    page.locator("#waitlist").scroll_into_view_if_needed()
    shot(page, "03-waitlist-done", full=False)

    # A/B variants: ?h=a / ?h=c change the hero; c also changes the subline and is recorded
    page.goto(BASE + "/?h=a")
    expect(page.get_by_role("heading", level=1)).to_have_text("今夜、何を復習すればいい？")
    page.goto(BASE + "/?h=c")
    expect(page.get_by_role("heading", level=1)).to_have_text("間違い直しノート、撮るだけで。")
    expect(page.locator(".hero-sub")).to_contain_text("切って貼って")
    shot(page, "01c-landing-variant-c", full=False)
    page.fill("input[name=email]", "juken@example.com")
    page.select_option("select[name=grade]", "小学6年生")
    page.get_by_role("button", name="先行登録する", exact=True).click()
    expect(page.get_by_text("ご登録ありがとうございます")).to_be_visible()

    # Privacy page from the footer link
    page.goto(BASE + "/?h=default")
    page.get_by_role("link", name="プライバシーポリシー").click()
    expect(page.get_by_role("heading", level=1)).to_have_text("プライバシーポリシー")
    shot(page, "03p-privacy")

    # 3. /app onboarding → 小5
    page.goto(BASE + "/app")
    expect(page.get_by_role("heading", name="学年を選んでください")).to_be_visible()
    page.get_by_role("radio", name="小5").click()
    shot(page, "04-onboarding-grade")
    page.get_by_role("button", name="はじめる").click()
    expect(page.get_by_role("heading", name="ページを撮りましょう")).to_be_visible()
    shot(page, "05-snap")
    page.evaluate(SEED_JS)

    # 4. Upload p01 → confirm
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "p01.jpg"))
    expect(page.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    cards = page.get_by_test_id("problem-card")
    expect(cards).to_have_count(5)
    shot(page, "06-confirm")
    page.get_by_role("button", name="保存する").click()

    # 5a. Light-up: straight to the map, 5-C3 glows, toast says where the problems went
    expect(page).to_have_url(BASE + "/app/map?saved=5&lit=5-C3")
    expect(page.get_by_test_id("lit-toast")).to_have_text("5問を保存しました。光っている単元に入りました。")
    lit = page.locator('a.tile.is-lit[data-unit="5-C3"]')
    expect(lit).to_have_count(1)
    page.wait_for_timeout(450)  # mid-pulse (1.5 s animation)
    shot(page, "07-saved-lit", full=False)

    # 5b. Full map: own grade open and first, with red / green / gold tiles; other grades collapsed
    page.wait_for_timeout(4600)  # toast gone
    page.goto(BASE + "/app/map")
    secs = page.locator("details.grade-sec")
    expect(secs).to_have_count(10)
    expect(secs.first).to_have_attribute("data-grade", "小5")
    expect(secs.first).to_have_attribute("open", "")
    expect(page.locator("details.grade-sec[open]")).to_have_count(1)
    assert page.locator("a.tile").count() == 110
    tile = page.locator('a.tile[data-unit="5-C3"]')
    expect(tile).to_have_attribute("data-status", "review")
    expect(tile).to_contain_text("割合")
    expect(tile).to_contain_text("✕ 2")
    expect(tile).to_contain_text("5問")
    for unit, st in [("5-A1", "gold"), ("5-B1", "gold"), ("5-A3", "ok"), ("5-D1", "ok"), ("5-C1", "review"), ("5-A2", "empty")]:
        expect(page.locator(f'a.tile[data-unit="{unit}"]')).to_have_attribute("data-status", st)
    expect(page.locator('details[data-grade="小4"] .sum-review')).to_have_text("復習 1")
    shot(page, "08-map")
    page.locator('details[data-grade="小4"] > summary').click()
    expect(page.locator('a.tile[data-unit="4-A2"]')).to_be_visible()
    page.locator('details[data-grade="小4"]').scroll_into_view_if_needed()
    shot(page, "08b-map-other-grade", full=False)

    # 6. テスト前リスト with 5-C3 only → exactly the 2 ✕ problems
    page.goto(BASE + "/app/list")
    for chip in page.locator("button.chip.is-on").all():
        chip.click()
    page.locator('button.chip[data-unit="5-C3"]').click()
    items = page.get_by_test_id("review-item")
    expect(items).to_have_count(2)
    expect(items.nth(0)).to_contain_text("水そうに水が120L")
    expect(items.nth(1)).to_contain_text("ある数の40%が56")
    expect(page.get_by_test_id("readiness")).to_have_text("60%")
    shot(page, "09-test-list")
    items.nth(0).get_by_role("checkbox").check()
    expect(page.get_by_test_id("readiness")).to_have_text("80%")
    shot(page, "10-test-list-reviewed")

    # 7. ふりかえり
    page.get_by_role("link", name="ふりかえり").click()
    expect(page.get_by_text("このページを削除").first).to_be_visible()
    shot(page, "11-archive")

    # 8. Retake path (h03, mock reader says retake)
    page.get_by_role("link", name="撮る").click()
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "h03.jpg"))
    expect(page.get_by_text("もう少し明るい所で撮り直してください。")).to_be_visible(timeout=15000)
    shot(page, "12-retake", full=False)

    # 9. Gated server: 招待コード first, then grade; a wrong code is asked again on the snap screen
    ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    g = ctx2.new_page()
    g.on("pageerror", lambda e: errors.append(str(e)))
    g.goto(GATED + "/app")
    expect(g.get_by_role("heading", name="招待コードを入力してください")).to_be_visible()
    g.fill("input[name=pilot-code]", "kumo42")
    shot(g, "13-pilot-code", full=False)
    g.fill("input[name=pilot-code]", "wrong1")  # a mistyped code
    g.get_by_role("button", name="つづける").click()
    g.get_by_role("radio", name="小5").click()
    g.get_by_role("button", name="はじめる").click()
    g.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "p01.jpg"))
    expect(g.get_by_text("招待コードが違うようです。もう一度入力してください。")).to_be_visible(timeout=15000)
    g.fill("input[name=pilot-code]", "kumo42")
    shot(g, "14-pilot-code-again", full=False)
    g.get_by_role("button", name="コードを送って読み取る").click()
    expect(g.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    ctx2.close()

    assert not errors, errors
    browser.close()
    print("UI flow OK")
