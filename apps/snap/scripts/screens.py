"""Drive the built app headlessly and save phone screenshots to docs/screens/.

Usage: pnpm build && PORT=8093 node dist-server/index.js &  then
       PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py [base_url]
Flow: landing → waitlist → /app grade 小5 → upload p01 (mock reader) → confirm → save
      → マップ (割合 tile ✕) → テスト前リスト with 5-C3 = exactly the 2 ✕ problems.
"""
import os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8093"
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
    page.goto(BASE + "/")
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
    page.goto(BASE + "/")
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

    # 4. Upload p01 → confirm
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "p01.jpg"))
    expect(page.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    cards = page.get_by_test_id("problem-card")
    expect(cards).to_have_count(5)
    shot(page, "06-confirm")
    page.get_by_role("button", name="保存する").click()
    expect(page.get_by_text("保存しました。")).to_be_visible()
    shot(page, "07-saved", full=False)

    # 5. マップ: 割合 (5-C3) tile needs review with ✕ 2
    page.get_by_role("link", name="マップ").last.click()
    tile = page.locator('a.tile[data-unit="5-C3"]')
    expect(tile).to_have_class("tile tile-review")
    expect(tile).to_contain_text("割合")
    expect(tile).to_contain_text("✕ 2")
    expect(tile).to_contain_text("5問")
    shot(page, "08-map")

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
    expect(page.get_by_text("このページを削除")).to_be_visible()
    shot(page, "11-archive")

    # 8. Retake path (h03, mock reader says retake)
    page.get_by_role("link", name="撮る").click()
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "h03.jpg"))
    expect(page.get_by_text("もう少し明るい所で撮り直してください。")).to_be_visible(timeout=15000)
    shot(page, "12-retake", full=False)

    assert not errors, errors
    browser.close()
    print("UI flow OK")
