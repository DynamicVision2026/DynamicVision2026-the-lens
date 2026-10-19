"""Drive the built app headlessly and save phone screenshots to docs/screens/.

Usage: pnpm build
       PORT=8093 node dist-server/index.js &                       # open server
       PORT=8094 PILOT_CODE=kumo42 node dist-server/index.js &     # gated server (招待コード)
       PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py [base_url] [gated_url]
Flow: landing → waitlist → /app grade 小5 → seed earlier pages (gold / green / red units)
      → upload p01 (mock reader) → confirm → save → 単元星図 flares 5-C3 → full star chart
      → sheet on 5-C3 with its roots → 一覧 (tile view) → /app opens the map with the report strip
      (bar, 次にやること → star + sheet, 前の学年 → far band opened + stars ringed, fold remembered)
      → 学習レポート (詳しく: every unit opens its star via ?unit=) → its button opens the list with
      exactly those units → テスト前リスト
      with 5-C3 = exactly the 2 ✕ problems → + gold 5-B1: its old ✕ in 念のため → archive → backup download / restore / invalid file → offline reload (service
      worker) → Android install button → retake → iPhone install tip → empty レポート (no pages)
      → gated server: 招待コード prompt, wrong code → 403 → asked again → right code reads.
"""
import json, os, re, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8093"
GATED = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8094"

# Earlier saved pages for 小5 (IndexedDB seed), so the map shows every state:
#   5-A1 gold (newest test all ○), 5-B1 gold (old ✕ then a later all-○ test),
#   5-A3 green (✕ reviewed), 5-C1 red (✕ not reviewed), 5-D1 green (drill, no marks),
#   4-A2 red, 4-C2 green and 4-B4 gold in 小4 (4-C2 簡単な割合 is the root of 5-C3 割合);
#   far sky: 3-A4 red in 小3, 6-C2 gold in 小6 (visible as coloured stars from afar).
SEED_JS = """async () => {
  const P = (id, at, type, probs) => ({ id, createdAt: at, grade: "小5", pageType: type, score: null,
    problems: probs.map(([unit, mark, reviewed], i) => ({ n: i + 1, q: "（見本）問題 " + (i + 1), unit, answer: "1",
      mark, confidence: 0.95, reviewed: !!reviewed })) });
  const pages = [
    P("seed1", "2026-10-01T09:00:00.000Z", "test", [["5-A1","○"],["5-A1","○"],["5-A1","○"],["5-A3","✕",true],["5-A3","○"]]),
    P("seed2", "2026-10-03T09:00:00.000Z", "drill", [["5-B1","✕"],["5-B1","✕"],["5-D1",null],["5-D1",null],["5-C1","✕"],["5-C1","○"]]),
    P("seed3", "2026-10-10T09:00:00.000Z", "test", [["5-B1","○"],["5-B1","○"],["5-B1","○"],["4-A2","✕"]]),
    P("seed4", "2026-10-12T09:00:00.000Z", "drill", [["4-C2","✕",true],["4-C2","○"],["4-B4","○"],["4-B4","○"],["3-A4","✕"],["6-C2","○"],["6-C2","○"]]),
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
# A 小2 child: red 2-A2 (twice), gold 2-B1, green 2-C1, and red 1-A2 in the grade below.
SEED_YOUNG_JS = SEED_JS.replace('grade: "小5"', 'grade: "小2"').split("const pages = [")[0] + """const pages = [
    P("y1", "2026-10-14T09:00:00.000Z", "drill", [["2-A2","✕"],["2-A2","✕"],["2-A2","○"],["2-C1","✕",true],["1-A2","✕"]]),
    P("y2", "2026-10-16T09:00:00.000Z", "test", [["2-B1","○"],["2-B1","○"]]),
  ];""" + SEED_JS.split("];", 1)[1]
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screens"
OUT.mkdir(parents=True, exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="lens-snap-shots-"))


def shot(page, name, full=True):
    # Full-page captures: un-fix the bars so they render once at their natural place.
    style = page.add_style_tag(content=".tabbar,.topbar,.sticky-actions,.sky-lanes{position:static!important}") if full else None
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    if style:
        style.evaluate("el => el.remove()")
    print("saved", name)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True, accept_downloads=True)
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

    # 5a. Light-up: straight to the 単元星図, 5-C3 flares and its root line draws down; toast stays
    expect(page).to_have_url(BASE + "/app/map?saved=5&lit=5-C3")
    expect(page.get_by_test_id("lit-toast")).to_have_text("5問を保存しました。光っている単元に入りました。")
    expect(page.get_by_test_id("toast-report")).to_have_attribute("href", "/app/report")
    lit = page.locator('button.star-node.is-lit[data-unit="5-C3"]')
    expect(lit).to_have_count(1)
    expect(page.locator('path.sky-edge.is-lit[data-edge="5-C3>4-C2"]')).to_have_count(1)
    page.wait_for_timeout(430)  # mid-flare (1.2 s), line half drawn
    shot(page, "07-saved-lit", full=False)

    # 5b. Full star chart: near sky (小5 + 小4) with labels, far bands compact; coloured far stars
    page.wait_for_timeout(4600)  # toast gone
    page.goto(BASE + "/app/map")
    expect(page.locator(".sky-page")).to_have_count(1)
    expect(page.locator("button.star-node")).to_have_count(31)  # 小5 (15) + 小4 (16)
    # far sky: one merged 「これから学ぶ単元（小6〜高校）」 row on top + 小3, 小2, 小1 as their own bands
    expect(page.locator("button.far-band")).to_have_count(4)
    expect(page.get_by_test_id("upper-band")).to_have_text("これから学ぶ単元（小6〜高校）")
    expect(page.locator(".sky-hint")).to_have_text("下の学年の単元が、上の学年の単元のもとになっています。")
    expect(page.locator("g.far-star")).to_have_count(110 - 31)
    expect(page.locator(".sky-band-label.is-own")).to_contain_text("小5")
    for unit, st in [("5-C3", "review"), ("5-A1", "gold"), ("5-B1", "gold"), ("5-A3", "ok"), ("5-D1", "ok"),
                     ("5-C1", "review"), ("5-A2", "empty"), ("4-A2", "review"), ("4-C2", "ok"), ("4-B4", "gold"),
                     ("3-A4", "review"), ("6-C2", "gold")]:
        expect(page.locator(f'.sky-canvas [data-unit="{unit}"]')).to_have_attribute("data-status", st)
    expect(page.get_by_test_id("strip-counts")).to_contain_text("復習が必要2")
    # plain load: top of the page (strip), the child's grade band starts on the first screen
    assert page.evaluate("window.scrollY") == 0
    box = page.locator('button.star-node[data-unit="5-C3"]').bounding_box()
    assert 0 < box["y"] < 844 - 64, box
    # constellations only where there is data (plus none for empty units)
    expect(page.locator('path.sky-edge[data-edge="5-C3>4-C2"]')).to_have_count(1)
    expect(page.locator('path.sky-edge[data-edge="5-A2>4-A4"]')).to_have_count(0)
    shot(page, "08-starmap")

    # 5c. Sheet on a red unit: counts, roots (tappable), root path highlighted, everything else dimmed
    page.locator('button.star-node[data-unit="5-C3"]').click()
    sheet = page.get_by_test_id("star-sheet")
    expect(sheet).to_be_visible()
    expect(sheet).to_contain_text("割合")
    expect(sheet).to_contain_text("もとになる単元")
    expect(sheet.locator('button.root-btn[data-unit="4-C2"]')).to_be_visible()
    expect(page.locator('path.sky-edge.is-path[data-edge="5-C3>4-C2"]')).to_have_count(1)
    expect(page.locator('button.star-node.is-path[data-unit="4-C2"]')).to_have_count(1)
    expect(page.locator('button.star-node.is-dim[data-unit="5-A1"]')).to_have_count(1)
    expect(sheet.get_by_role("link", name="この単元の問題を見る")).to_have_attribute("href", "/app/list?unit=5-C3")
    expect(sheet.get_by_test_id("sheet-report")).to_have_attribute("href", "/app/report")
    page.wait_for_timeout(1000)  # smooth scroll settles
    shot(page, "08s-starmap-sheet", full=False)
    sheet.locator('button.root-btn[data-unit="4-C2"]').click()  # jump to the root
    expect(sheet).to_contain_text("簡単な割合")
    page.keyboard.press("Escape")
    expect(sheet).to_have_count(0)

    # 5c2. Tap a far band → it opens (labels, tap targets); 「たたむ」 closes it again
    page.locator('button.far-band[data-grade="小3"]').click()
    expect(page.locator('button.star-node[data-unit="3-A4"]')).to_have_attribute("data-status", "review")
    expect(page.locator("button.far-band")).to_have_count(3)
    page.wait_for_timeout(300)
    shot(page, "08e-starmap-expanded", full=False)
    page.get_by_role("button", name="たたむ", exact=True).click()
    expect(page.locator('button.far-band[data-grade="小3"]')).to_have_count(1)

    # 5c3. The merged upper row expands into 小6 … 高校 as individual far bands; 「たたむ」 merges them again
    page.get_by_test_id("upper-band").click()
    expect(page.get_by_test_id("upper-band")).to_have_count(0)
    expect(page.get_by_test_id("upper-head")).to_contain_text("これから学ぶ単元（小6〜高校）")
    expect(page.locator("button.far-band")).to_have_count(8)
    expect(page.locator('.sky-canvas [data-unit="6-C2"]')).to_have_attribute("data-status", "gold")
    page.get_by_role("button", name="これから学ぶ単元をたたむ").click()
    expect(page.get_by_test_id("upper-band")).to_have_count(1)
    expect(page.locator("button.far-band")).to_have_count(4)

    # 5d. 一覧: the tile view (accessible fallback), choice remembered
    page.get_by_role("radio", name="一覧").click()
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
    expect(page.locator('details[data-grade="小4"] .sum-review')).to_have_text("復習 1")
    page.reload()
    expect(page.locator("details.grade-sec")).to_have_count(10)  # remembered
    page.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    shot(page, "08l-map-list")
    page.get_by_role("radio", name="星図").click()
    expect(page.locator("button.star-node")).to_have_count(31)

    # 5e. The map is home: /app opens it once pages exist, the report strip on top (same night sky)
    page.goto(BASE + "/app")
    expect(page).to_have_url(BASE + "/app/map")
    expect(page.locator("nav.tabbar a")).to_have_count(4)
    expect(page.locator("nav.tabbar a")).to_have_text(["撮る", "マップ", "テスト前", "ふりかえり"])
    expect(page.locator("nav.tabbar a.tab-active")).to_have_text("マップ")
    strip = page.get_by_test_id("map-strip")
    expect(strip).to_have_attribute("data-open", "true")
    expect(strip.locator(".strip-title")).to_have_text("小5の15単元")
    expect(page.get_by_test_id("strip-counts")).to_have_text("マスター2復習ずみ2復習が必要2まだ9")
    expect(page.get_by_test_id("strip-bar")).to_have_attribute("aria-label", "小5の15単元 マスター 2・復習ずみ 2・復習が必要 2・まだ 9")
    rows = page.get_by_test_id("strip-next").locator(".strip-row")
    expect(rows).to_have_count(2)
    expect(rows.nth(0)).to_contain_text("割合")
    expect(rows.nth(0)).to_contain_text("✕ 2問")
    expect(page.get_by_test_id("strip-open-list")).to_have_attribute("href", "/app/list?units=5-C3,5-C1")
    expect(page.get_by_test_id("strip-report")).to_have_attribute("href", "/app/report")
    expect(page.get_by_test_id("strip-earlier")).to_have_text("前の学年に✕のある単元があります（2）+")
    assert page.evaluate("window.scrollY") == 0
    # one glance: the strip and the child's grade band (label + first row of stars) on the first screen
    assert page.locator(".sky-band-label.is-own").bounding_box()["y"] < 844 - 64 - 46
    page.wait_for_timeout(300)
    shot(page, "18-map-home", full=False)

    # 次にやること row → that star selected on the chart, its sheet open
    rows.nth(1).click()
    expect(page.get_by_test_id("star-sheet")).to_contain_text("伴って変わる二つの数量")
    expect(page.locator('button.star-node.is-sel[data-unit="5-C1"]')).to_have_count(1)
    page.keyboard.press("Escape")

    # 前の学年に✕: the far 小3 band opens and both earlier red stars are ringed; tap again → back
    page.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    page.get_by_test_id("strip-earlier").click()
    expect(page.locator("button.far-band")).to_have_count(3)
    expect(page.locator("button.star-node.is-marked")).to_have_count(2)
    expect(page.locator('button.star-node.is-marked[data-unit="3-A4"]')).to_have_count(1)
    expect(page.locator('button.star-node.is-marked[data-unit="4-A2"]')).to_have_count(1)
    page.wait_for_timeout(1000)
    shot(page, "18e-map-earlier", full=False)
    page.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    page.get_by_test_id("strip-earlier").click()
    expect(page.locator("button.far-band")).to_have_count(4)
    expect(page.locator(".is-marked")).to_have_count(0)

    # Fold to one line; remembered after a reload; open again
    page.get_by_test_id("strip-toggle").click()
    expect(strip).to_have_attribute("data-open", "false")
    expect(page.get_by_test_id("strip-toggle")).to_have_attribute("aria-label", "小5の15単元　マスター 2・復習ずみ 2・復習が必要 2・まだ 9　次にやること 2。ひらく")
    page.reload()
    expect(page.get_by_test_id("map-strip")).to_have_attribute("data-open", "false")
    page.wait_for_timeout(300)
    shot(page, "18c-map-home-collapsed", full=False)
    page.get_by_test_id("strip-toggle").click()
    expect(page.get_by_test_id("map-strip")).to_have_attribute("data-open", "true")

    # 5f. 学習レポート = the map's 「詳しく」 page; every unit opens its star on the map
    page.get_by_test_id("strip-report").click()
    expect(page).to_have_url(BASE + "/app/report")
    expect(page.locator("nav.tabbar a.tab-active")).to_have_text("マップ")
    expect(page.get_by_test_id("report-back")).to_have_attribute("href", "/app/map")
    expect(page.get_by_role("heading", level=1)).to_have_text("小5の学習レポート")
    expect(page.locator(".report-meta")).to_contain_text("これまでに5ページ")
    expect(page.get_by_test_id("glance-sum")).to_have_text("15単元のうちマスター 2復習ずみ 2復習が必要 2まだ 9")
    expect(page.get_by_test_id("glance-bar")).to_have_attribute("aria-label", "15単元のうち マスター 2 ・ 復習ずみ 2 ・ 復習が必要 2 ・ まだ 9")
    nxt = page.get_by_test_id("report-next")
    expect(nxt.locator(".report-row")).to_have_count(2)
    expect(nxt.locator(".report-row").nth(0)).to_contain_text("割合")
    expect(nxt.locator(".report-row").nth(0)).to_contain_text("✕ 2問")
    expect(nxt.locator(".report-row").nth(0)).to_have_attribute("href", "/app/map?unit=5-C3")
    earlier = page.get_by_test_id("report-earlier")
    expect(earlier.locator('[data-unit="4-A2"]')).to_contain_text("概数")
    expect(earlier.locator('[data-unit="3-A4"]')).to_contain_text("小5「整数の性質」のもと")
    expect(earlier.locator('[data-unit="3-A4"]')).to_have_attribute("href", "/app/map?unit=3-A4")
    # この1週間 depends on today's date: p01 (5 problems, 2 ✕) + the seed pages from the last 7 days
    from datetime import datetime, timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(days=7)
    week = [1, 5, 2]
    for at, n, x in [("2026-10-01", 5, 1), ("2026-10-03", 6, 3), ("2026-10-10", 4, 1), ("2026-10-12", 7, 2)]:
        if datetime.fromisoformat(at + "T09:00:00+00:00") >= since:
            week = [week[0] + 1, week[1] + n, week[2] + x]
    expect(page.get_by_test_id("report-week").locator("dd")).to_have_text([str(v) for v in week])
    chips = page.get_by_test_id("report-chips")
    expect(chips.locator(".mc-gold")).to_have_count(2)
    expect(chips.locator(".mc-review")).to_have_count(0)  # already in 次にやること
    expect(chips.locator(".mc-ok")).to_have_count(2)
    expect(chips.locator('.mc-gold[data-unit="5-B1"]')).to_have_attribute("href", "/app/map?unit=5-B1")
    expect(page.get_by_role("link", name="単元マップで全体を見る")).to_have_attribute("href", "/app/map")
    shot(page, "17-report")
    # a far unit from the report: the map opens its band and its sheet (?unit=3-A4)
    earlier.locator('[data-unit="3-A4"]').click()
    expect(page).to_have_url(BASE + "/app/map?unit=3-A4")
    expect(page.get_by_test_id("star-sheet")).to_contain_text("除法")
    expect(page.locator('button.star-node.is-sel[data-unit="3-A4"]')).to_have_count(1)
    page.wait_for_timeout(800)
    shot(page, "18u-map-unit-from-report", full=False)
    page.goto(BASE + "/app/report")
    page.get_by_test_id("report-open-list").click()
    expect(page).to_have_url(BASE + "/app/list?units=5-C3,5-C1")
    expect(page.locator("button.chip.is-on")).to_have_count(2)
    expect(page.get_by_test_id("test-list").get_by_test_id("review-item")).to_have_count(3)

    # 6. テスト前リスト with 5-C3 only → exactly the 2 ✕ problems
    page.goto(BASE + "/app/list")
    on = page.locator("button.chip.is-on")
    expect(on).to_have_count(2)  # the range is remembered (here: the two units from the レポート)
    for left in (1, 0):
        on.first.click()
        expect(on).to_have_count(left)
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

    # 6b. Add gold 5-B1 (old ✕, then a later all-○ test): its ✕ sit in 念のため, not in the main list
    page.locator('button.chip[data-unit="5-B1"]').click()
    expect(page.get_by_test_id("test-list").get_by_test_id("review-item")).to_have_count(2)
    nen = page.get_by_test_id("nennotame")
    expect(nen.locator("summary")).to_contain_text("念のため（最新のページでは全問○の単元）")
    expect(nen.locator("summary")).to_contain_text("2問")
    expect(page.get_by_test_id("readiness")).to_have_text("90%")  # 5-B1's old ✕ are not pending
    nen.locator("summary").click()
    expect(nen.get_by_test_id("review-item")).to_have_count(2)
    expect(nen.get_by_test_id("review-item").first).to_contain_text("平面図形")
    nen.scroll_into_view_if_needed()
    shot(page, "09n-test-list-nennotame")

    # 7. ふりかえり
    page.get_by_role("link", name="ふりかえり").click()
    expect(page.get_by_text("このページを削除").first).to_be_visible()
    expect(page.get_by_test_id("backup-last")).to_have_text("まだバックアップしていません。")
    expect(page.get_by_text("そろそろバックアップを保存しておくと安心です。")).to_be_visible()
    shot(page, "11-archive")

    # 7b. Backup: download one JSON file, delete a page, restore → 1 page back; invalid file → clear message
    with page.expect_download() as dl:
        page.get_by_role("button", name="バックアップを保存").click()
    d = dl.value
    assert re.fullmatch(r"lens-snap-backup-\d{8}\.json", d.suggested_filename), d.suggested_filename
    backup_path = TMP / d.suggested_filename
    d.save_as(str(backup_path))
    data = json.loads(backup_path.read_text())
    assert data["app"] == "lens-snap" and data["version"] == 1 and data["grade"] == "小5"
    assert len(data["pages"]) == 5 and any("photo" in pg for pg in data["pages"]), len(data["pages"])
    expect(page.get_by_test_id("backup-last")).to_contain_text("最後のバックアップ：")
    expect(page.get_by_text("そろそろバックアップを保存しておくと安心です。")).to_have_count(0)
    page.on("dialog", lambda dlg: dlg.accept())
    n_before = page.locator("li.card").count()
    page.get_by_text("このページを削除").last.click()
    expect(page.locator("li.card")).to_have_count(n_before - 1)
    page.get_by_test_id("backup-input").set_input_files(str(backup_path))
    expect(page.get_by_test_id("backup-msg")).to_have_text("1ページを戻しました。")
    expect(page.locator("li.card")).to_have_count(n_before)
    page.get_by_test_id("backup-input").set_input_files(files=[{"name": "x.json", "mimeType": "application/json", "buffer": b'{"app":"other"}'}])
    expect(page.get_by_test_id("backup-msg")).to_contain_text("読み込めませんでした")
    page.get_by_test_id("backup-input").set_input_files(str(backup_path))
    expect(page.get_by_test_id("backup-msg")).to_have_text("新しいページはありませんでした（すべてこの端末にあります）。")
    page.get_by_text("このページを削除").last.click()  # once more, for the screenshot of a real restore
    page.get_by_test_id("backup-input").set_input_files(str(backup_path))
    expect(page.get_by_test_id("backup-msg")).to_have_text("1ページを戻しました。")
    page.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    shot(page, "16-backup", full=False)

    # 7c. Offline: the service worker serves the app shell (pages come from IndexedDB)
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.goto(BASE + "/app/map")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    ctx.set_offline(True)
    page.goto(BASE + "/app/map")
    expect(page.get_by_role("heading", name="単元マップ")).to_be_visible()
    expect(page.locator("button.star-node")).to_have_count(31)
    ctx.set_offline(False)
    assert page.evaluate("caches.keys()") == ["lens-snap-v1"]
    assert not page.evaluate("""caches.open('lens-snap-v1').then(c => c.keys()).then(ks => ks.some(r => new URL(r.url).pathname.startsWith('/api')))""")

    # 7d. Android / Chrome: beforeinstallprompt → 「ホーム画面に追加」 button on 撮る; dismiss is remembered
    page.get_by_role("link", name="撮る").click()
    expect(page.get_by_test_id("install-tip")).to_have_count(0)  # nothing to offer before the event
    page.evaluate("""() => { const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); }""")
    tip = page.get_by_test_id("install-tip")
    expect(tip.get_by_role("button", name="ホーム画面に追加")).to_be_visible()
    tip.get_by_role("button", name="閉じる").click()
    expect(tip).to_have_count(0)

    # 8. Retake path (h03, mock reader says retake)
    page.get_by_role("link", name="撮る").click()
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "h03.jpg"))
    expect(page.get_by_text("もう少し明るい所で撮り直してください。")).to_be_visible(timeout=15000)
    shot(page, "12-retake", full=False)

    # 8b. iPhone Safari after the first 保存: install tip with the share-button steps (shown once)
    ios = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True,
                              user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
    ip = ios.new_page()
    ip.on("pageerror", lambda e: errors.append(str(e)))
    ip.goto(BASE + "/app")
    ip.evaluate("localStorage.setItem('lens-snap:grade', '小5'); localStorage.setItem('lens-snap:saved-once', new Date().toISOString())")
    ip.evaluate(SEED_JS)
    ip.goto(BASE + "/app/snap")
    itip = ip.get_by_test_id("install-tip")
    expect(itip).to_contain_text("共有ボタン（□↑）→「ホーム画面に追加」")
    shot(ip, "15-install-tip", full=False)
    itip.get_by_role("button", name="閉じる").click()
    ip.reload()
    expect(ip.get_by_role("heading", name="ページを撮りましょう")).to_be_visible()
    expect(ip.get_by_test_id("install-tip")).to_have_count(0)
    ios.close()

    # 8b2. A young child (小2): the merged upper row keeps the child's band on the first screen
    young = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    y = young.new_page()
    y.on("pageerror", lambda err: errors.append(str(err)))
    y.goto(BASE + "/app")
    y.evaluate("localStorage.setItem('lens-snap:grade', '小2')")
    y.evaluate(SEED_YOUNG_JS)
    y.goto(BASE + "/app")
    expect(y).to_have_url(BASE + "/app/map")
    expect(y.get_by_test_id("map-strip").locator(".strip-title")).to_have_text("小2の7単元")
    expect(y.get_by_test_id("upper-band")).to_have_text("これから学ぶ単元（小3〜高校）")
    expect(y.locator("button.far-band")).to_have_count(1)  # only the merged row: 小1 is near (the grade below)
    expect(y.get_by_test_id("strip-earlier")).to_have_text("前の学年に✕のある単元があります（1）+")
    own = y.locator(".sky-band-label.is-own")
    expect(own).to_contain_text("小2")
    assert own.bounding_box()["y"] + 46 < 844 - 64, own.bounding_box()
    for unit, st in [("2-A2", "review"), ("2-B1", "gold"), ("2-C1", "ok"), ("1-A2", "review"), ("2-A1", "empty")]:
        expect(y.locator(f'.sky-canvas [data-unit="{unit}"]')).to_have_attribute("data-status", st)
    y.wait_for_timeout(300)
    shot(y, "18y-map-home-young", full=False)
    young.close()

    # 8c. 学習レポート with no pages yet: a friendly card + 「ページを撮る」; /app starts at 撮る
    ctx3 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    e = ctx3.new_page()
    e.on("pageerror", lambda err: errors.append(str(err)))
    e.goto(BASE + "/app")
    e.evaluate("localStorage.setItem('lens-snap:grade', '小5')")
    e.goto(BASE + "/app")
    expect(e).to_have_url(BASE + "/app/snap")
    e.goto(BASE + "/app/report")
    expect(e.get_by_test_id("report-empty")).to_contain_text("撮ると、ここにレポートができます")
    expect(e.get_by_test_id("report-back")).to_have_attribute("href", "/app/map")
    expect(e.get_by_role("link", name="ページを撮る", exact=True)).to_have_attribute("href", "/app/snap")
    shot(e, "17e-report-empty", full=False)
    ctx3.close()

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
