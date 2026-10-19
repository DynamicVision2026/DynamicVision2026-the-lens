"""Drive the built app headlessly and save phone screenshots to docs/screens/.

Usage: pnpm build
       PORT=8093 node dist-server/index.js &                       # open server
       PORT=8094 PILOT_CODE=kumo42 node dist-server/index.js &     # gated server (招待コード)
       PORT=8095 MOCK_FALLBACK=live4 node dist-server/index.js &  # journey server (the founder's live 4年 sheet)
       PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py [base_url] [gated_url] [journey_url]
Flow: landing → waitlist → /app grade 小5 → the map is home (empty territory + card → 撮る)
      → seed earlier pages (gold / green / red units)
      → upload p06 (AI判定 + 単元を確認, then やめる) → upload p01 (teacher marks + 正答（AI）, one
      先生の印とAIの判定がちがいます note) → confirm → save → 領土マップ: fly to 小5, 5-C3 rises → HUD
      (制覇 6/15, 小中高 bars, counts by ladder step, 次にやること 3) → tap 5-C3 → sheet (history, roots, routes) → root
      flies to 小4 → 次にやること tour (one by one, 次へ) → pan / zoom out / 現在地 → 一覧 (tile view)
      → /app = map → half the continent (19) + zoom (19z) → the whole continent coast → summit (20) + the
      小5 zone (20z); 年度の記録 with two school years (20y) → its 2025年度 row flies to the 小4 zone
      → 学習レポート (every unit opens its tile via ?unit=) → its button opens the list with
      exactly those units → テスト前リスト
      with 5-C3 = exactly the 2 ✕ problems → + gold 5-B1: its old ✕ in 念のため → archive → backup download / restore / invalid file → offline reload (service
      worker) → Android install button → retake → iPhone install tip → 小2 and 高2 homes (20k: 高2 on the glacier)
      → legacy 「高校」 → 高1
      → empty レポート (no pages)
      → gated server: 招待コード prompt, wrong code → 403 → asked again → right code reads.
Journey (J*, for the founder): fresh 小5 profile on the journey server → J1 empty territory (home) → 撮る →
      the live 4年 sheet → J2 confirm (AI判定) → 保存 → J3 fly + tiles rising + toast → J4 HUD with
      red flags, 次にやること 2 → J5 次にやること → 平均 sheet at half height (history, routes, its ✕ problem)
      → J6 テスト前リスト from the sheet.
テスト前モード (22*, the founder's real example): a 小5 child with his three sheets (the live 4年 sheet with
      the AI's marks, 5年 図形と割合, 5年 多角形と面積; fixtures/exam-demo.json) → HUD 「テスト前モード」 →
      「テストはいつですか？」 (22a) → 明日 → range on the dimmed map (default = 小5 units with data; tap, 「この地帯を全部」,
      22b) → 決定 → 今夜の作戦 at half height over the map (22c: ①②③, 4問・約20分, range outlined, tonight's
      units pulsing) → full → ② → 「答えを確かめる」 (22d) → photo → viewer → back → tick → 1 / 4 and the 小4 tile
      loses its flag (22e) → 共有用にまとめる (22f) → Web Share text → back, back (mode off) → reopen (ticks kept)
      → all ① ② ticked → 「今夜の作戦は完了です」.
Unit sheet (21*): 5-C3 sheet half height → ticks → 「この単元の問題を見る」 (full height, 問題 at the top, 21) →
      thumbnail → page viewer (21v: photo, double-tap zoom, the page's problems with 割合 highlighted) → close
      keeps the sheet and its scroll → back closes the viewer, then the sheet; the map camera returns.
"""
import base64, json, os, re, sys, tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8093"
GATED = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8094"
JOURNEY = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:8095"

# Earlier saved pages for 小5 (IndexedDB seed), so the map shows every step of the 5-step ladder:
#   5-A1 定着 (all ○ on 9/15 and again on 10/1, 16 days later), 5-B1 マスター (old ✕ then a later all-○ test),
#   5-A3 復習ずみ (✕ reviewed), 5-C1 挑戦中 (✕ not reviewed), 5-D1 復習ずみ (drill, no marks),
#   4-A2 挑戦中, 4-C2 復習ずみ and 4-B4 マスター in 小4 (4-C2 簡単な割合 is the root of 5-C3 割合);
#   other islands: 3-A4 挑戦中 in 小3, 6-C2 マスター in 小6.
SEED_JS = """async () => {
  const P = (id, at, type, probs) => ({ id, createdAt: at, grade: "小5", pageType: type, score: null,
    problems: probs.map(([unit, mark, reviewed], i) => ({ n: i + 1, q: "（見本）問題 " + (i + 1), unit, answer: "1",
      mark, confidence: 0.95, reviewed: !!reviewed })) });
  const pages = [
    P("seed0", "2026-09-15T09:00:00.000Z", "test", [["5-A1","○"],["5-A1","○"]]),
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
# A 高2 child (高校 = three grades since 19 Oct): red 数学II 三角関数, gold 数学B 数列, green いろいろな式,
# red 数学I 二次関数 in the year below.
SEED_KOKO2_JS = SEED_JS.replace('grade: "小5"', 'grade: "高2"').split("const pages = [")[0] + """const pages = [
    P("k1", "2026-10-14T09:00:00.000Z", "test", [["h-II-4","✕"],["h-II-4","✕"],["h-II-4","○"],["h-II-1","✕",true],["h-I-3","✕"]]),
    P("k2", "2026-10-16T09:00:00.000Z", "test", [["h-B-1","○"],["h-B-1","○"]]),
  ];""" + SEED_JS.split("];", 1)[1]
# Two school years for a 小5 child (年度の記録): the four seed pages (2026年度) + two pages from 2025年度 (小4 units).
SEED_YEARS_JS = SEED_JS.replace('    P("seed4",', """    P("old1", "2025-06-12T09:00:00.000Z", "test", [["4-A2","✕"],["4-A2","✕"],["4-B1","○"]]),
    P("old2", "2026-02-10T09:00:00.000Z", "drill", [["4-C2","○"],["4-C2","✕"]]),
    P("seed4",""")
ROOT = Path(__file__).resolve().parent.parent


def exam_seed_js():
    """The founder's three sheets for a 小5 child (テスト前モード demo, 22*), newest last:
    (a) the live 4年 sheet (fixture live4) with the AI's marks as in J2 and its photo;
    (c) 5年 多角形と面積: answered → ○ (AI); Q3's table and work disagree (reader notes) → no mark, reading
        confidence 0.55 (要確認 → ③ 念のため);
    (b) 5年 図形と割合: answered → ○, blank → ✕ (AI).
    The 5年 pages have no photo (the reader outputs only)."""
    fx = json.loads((ROOT / "fixtures" / "reader-outputs.json").read_text())["live4"]["problems"]
    demo = json.loads((ROOT / "fixtures" / "exam-demo.json").read_text())
    photo = base64.b64encode((ROOT / "fixtures" / "photos" / "live4.jpg").read_bytes()).decode()
    now = datetime.now(timezone.utc)
    at = lambda days: (now - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    def prob(i, p, mark, correct, conf=None):
        return {"n": i + 1, "q": p["q"], "unit": p["unit"], "answer": p.get("answer"), "mark": mark, "markSource": "ai" if mark else None,
                "correctAnswer": correct, "aiJudge": mark, "confidence": p["confidence"] if conf is None else conf, "reviewed": False}

    live = [prob(i, p, p["judge"], p.get("correct_answer")) for i, p in enumerate(fx)]
    pp, zp = demo["poly5"]["problems"], demo["zukei5"]["problems"]
    poly = [prob(0, pp[0], "○", "100 cm²"), prob(1, pp[1], "○", None), prob(2, pp[2], None, None, 0.55), prob(3, pp[3], "○", "2400円")]
    zukei = [prob(0, zp[0], "○", "120 cm²"), prob(1, zp[1], "✕", None), prob(2, zp[2], "✕", None), prob(3, zp[3], "○", "600円")]
    page = lambda pid, days, probs: {"id": pid, "createdAt": at(days), "grade": "小5", "pageType": "drill", "score": None, "problems": probs}
    pages = [dict(page("f-live4", 5, live), photoB64=photo), page("f-poly", 3, poly), page("f-zukei", 1, zukei)]
    return """async () => {
  const pages = %s;
  for (const p of pages) {
    if (!p.photoB64) continue;
    const bin = atob(p.photoB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    p.photo = { bytes: bytes.buffer, mime: "image/jpeg" };
    delete p.photoB64;
  }
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
}""" % json.dumps(pages, ensure_ascii=False)


OUT = ROOT / "docs" / "screens"
OUT.mkdir(parents=True, exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="lens-snap-shots-"))


def shot(page, name, full=True):
    # Full-page captures: un-fix the bars so they render once at their natural place.
    style = page.add_style_tag(content=".tabbar,.topbar,.sticky-actions{position:static!important}") if full else None
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
    # 12 grades in a 3-column grid: 小1–3 / 小4–6 / 中1–3 / 高1–3 (never one combined 高校)
    expect(page.locator(".grade-grid [role=radio]")).to_have_text(["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "高1", "高2", "高3"])
    rows = {round(b["y"]) for b in (page.locator(".grade-grid [role=radio]").nth(i).bounding_box() for i in range(12))}
    assert len(rows) == 4, rows
    page.get_by_role("radio", name="小5").click()
    shot(page, "04-onboarding-grade")
    page.get_by_role("button", name="はじめる").click()
    # The map is home, also before any page: unexplored territory + the card, tabs マップ first
    expect(page).to_have_url(BASE + "/app/map")
    expect(page.get_by_test_id("map-welcome")).to_contain_text("プリントを撮ると、その単元が自分の領土になります")
    expect(page.locator("nav.tabbar a")).to_have_text(["マップ", "撮る", "テスト前", "ふりかえり"])
    page.get_by_test_id("welcome-snap").click()
    expect(page.get_by_role("heading", name="ページを撮りましょう")).to_be_visible()
    shot(page, "05-snap")
    page.evaluate(SEED_JS)

    # 4a. Upload p06 (drill, no teacher marks) → confirm: ○✕ prefilled by the AI (AI判定 + 正答（AI）),
    #     one 「単元を確認してください」 pill (unit_confidence 0.62) with 5-C3 offered first as 候補.
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "p06.jpg"))
    expect(page.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    cards = page.get_by_test_id("problem-card")
    expect(cards).to_have_count(5)
    expect(page.get_by_test_id("unit-check")).to_have_count(1)
    expect(cards.nth(2).get_by_test_id("unit-check")).to_have_text("単元を確認してください")
    expect(cards.nth(2).locator("select optgroup").first).to_have_attribute("label", "候補")
    expect(cards.nth(2).locator("select option").nth(1)).to_have_attribute("value", "5-C3")
    expect(page.get_by_test_id("mark-source")).to_have_count(5)
    expect(page.locator('[data-testid=mark-source][data-source=ai]')).to_have_count(5)
    expect(cards.nth(4).get_by_test_id("ai-answer")).to_have_text("正答（AI）：3000人")
    expect(cards.nth(4).get_by_role("radio", name="✕")).to_have_attribute("aria-checked", "true")
    expect(cards.nth(0).locator(".field > span").nth(2)).to_have_text("○✕")
    assert "%" not in (cards.nth(2).inner_text()), "no numbers for confidence"
    shot(page, "06-confirm")
    # Parent taps ✕ on card 1 → the AI label goes (source parent), the AI's answer stays as a hint
    cards.nth(0).get_by_role("radio", name="✕").click()
    expect(cards.nth(0).get_by_test_id("mark-source")).to_have_count(0)
    expect(cards.nth(0).get_by_test_id("ai-answer")).to_have_text("正答（AI）：84点")
    # Picking the suggested unit hides the pill
    cards.nth(2).locator("select").select_option("5-C3")
    expect(page.get_by_test_id("unit-check")).to_have_count(0)
    page.get_by_role("button", name="やめる").click()

    # 4b. Upload p01 (graded test) → confirm: every mark is the teacher's (先生の印); the AI still solves
    #     each problem (正答（AI） under every toggle) and Q5, where its judgment differs, gets a neutral note.
    page.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "p01.jpg"))
    expect(page.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    cards = page.get_by_test_id("problem-card")
    expect(cards).to_have_count(5)
    expect(page.locator('[data-testid=mark-source][data-source=teacher]')).to_have_count(5)
    expect(page.get_by_test_id("mark-source").first).to_have_text("先生の印")
    expect(page.get_by_test_id("ai-answer")).to_have_count(5)
    expect(cards.nth(2).get_by_test_id("ai-answer")).to_have_text("正答（AI）：42L")
    expect(page.get_by_test_id("unit-check")).to_have_count(0)
    expect(page.get_by_test_id("mark-disagree")).to_have_count(1)
    expect(cards.nth(4).get_by_test_id("mark-disagree")).to_have_text("先生の印とAIの判定がちがいます。印を確認してください。")
    expect(cards.nth(4).get_by_role("radio", name="○")).to_have_attribute("aria-checked", "true")  # the teacher's mark wins
    shot(page, "06b-confirm-teacher")
    # A parent tap on that card clears the note (the mark is now the parent's; ○ keeps the saved result unchanged)
    cards.nth(4).get_by_role("radio", name="○").click()
    expect(page.get_by_test_id("mark-disagree")).to_have_count(0)
    expect(cards.nth(4).get_by_test_id("mark-source")).to_have_count(0)
    page.get_by_role("button", name="保存する").click()

    # 5a. After 保存: the camera flies to the island, the new tiles rise; toast stays (top, compact)
    expect(page).to_have_url(re.compile(re.escape(BASE + "/app/map?saved=5&lit=5-C3&page=") + r"[\w-]+$"))
    expect(page.get_by_test_id("lit-toast")).to_have_text("5問を保存しました：✕ 2問（割合）・○ 3問")
    expect(page.get_by_test_id("toast-report")).to_have_attribute("href", "/app/report")
    expect(page.locator('button.terr-unit.is-lit[data-unit="5-C3"]')).to_have_count(1)
    page.wait_for_timeout(820)  # fly (0.65 s) done, tiles rising (0.8 s)
    shot(page, "07-saved-lit", full=False)

    # 5b. Territory map: 110 tiles (units) in 12 zones on one continent, HUD = the report's numbers
    page.wait_for_timeout(4600)  # toast gone
    page.goto(BASE + "/app/map")
    expect(page.locator(".terr-page")).to_have_count(1)
    expect(page.locator("button.terr-unit")).to_have_count(110)
    expect(page.locator(".terr-reg")).to_have_count(12)
    expect(page.locator('.terr-reg.is-own')).to_have_text("深い森林帯小5標高 500")
    expect(page.locator(".terr-wp")).to_have_count(12)
    expect(page.locator('.terr-wp[data-waypoint="小5"]')).to_have_attribute("aria-label", "小5 深い森林帯：制覇 6／15（定着 1 ・ マスター 1 ・ 復習ずみ 2 ・ 挑戦中 2）")
    expect(page.locator('.terr-wp[data-waypoint="小5"] .wp-badge')).to_have_text("制覇 6/15定着 1 ・ マスター 1 ・ 復習ずみ 2 ・ 挑戦中 2")
    expect(page.get_by_test_id("terr-here")).to_have_count(1)
    expect(page.locator('.terr-wp[data-waypoint="小5"]').get_by_test_id("terr-here")).to_have_text("あなたはここ")
    for unit, st in [("5-C3", "trying"), ("5-A1", "settled"), ("5-B1", "master"), ("5-A3", "reviewed"), ("5-D1", "reviewed"),
                     ("5-C1", "trying"), ("5-A2", "mada"), ("4-A2", "trying"), ("4-C2", "reviewed"), ("4-B4", "master"),
                     ("3-A4", "trying"), ("6-C2", "master")]:
        expect(page.locator(f'.terr-layer [data-unit="{unit}"]')).to_have_attribute("data-status", st)
    expect(page.locator('button.terr-unit[data-unit="5-C3"]')).to_have_attribute("aria-label", "小5 割合：挑戦中（✕2）")
    expect(page.locator('button.terr-unit[data-unit="5-A1"]')).to_have_attribute("aria-label", "小5 整数の性質：定着")
    expect(page.locator('button.terr-unit[data-unit="5-B1"] .terr-star')).to_have_count(1)
    expect(page.locator('button.terr-unit[data-unit="5-B1"] .terr-crown')).to_have_count(0)
    expect(page.locator('button.terr-unit[data-unit="5-C3"] .terr-flag')).to_have_count(1)
    expect(page.locator('button.terr-unit[data-unit="5-A1"] .terr-crown')).to_have_count(1)
    expect(page.locator("button.terr-unit .terr-flag")).to_have_count(4)  # 5-C3, 5-C1, 4-A2, 3-A4
    hud = page.get_by_test_id("hud-card")
    expect(hud.locator(".hud-t")).to_have_text("制覇（小5）")
    expect(page.get_by_test_id("hud-taken")).to_have_text("6 / 15")
    expect(hud.locator(".hud-bar em")).to_have_text(["11/66", "0/23", "0/21"])
    expect(page.get_by_test_id("hud-levels")).to_have_text("定着 1・マスター 1・復習ずみ 2・挑戦中 2")
    expect(page.get_by_test_id("hud-next")).to_have_text("次にやること 3")
    # the legend starts folded to a small 「凡例」 button; open → strands + the five ladder steps
    expect(page.get_by_test_id("map-legend")).to_have_count(0)
    expect(page.get_by_test_id("legend-toggle")).to_have_text("凡例")
    page.get_by_test_id("legend-toggle").click()
    expect(page.get_by_test_id("map-legend")).to_contain_text("数と計算 / 数と式")
    expect(page.get_by_test_id("legend-states")).to_have_text("まだ挑戦中復習ずみマスター定着")
    page.wait_for_timeout(200)
    shot(page, "18g-map-legend", full=False)
    # 23: the 小5 zone close up, all five steps visible (まだ flat … 定着 tallest with a crown), legend open
    for lvl in range(5):
        expect(page.locator(f'.terr-layer button.terr-unit.is-own[data-level="{lvl}"]').first).to_be_attached()
    page.get_by_test_id("zoom-in").click()
    page.wait_for_timeout(900)
    for unit in ["5-A1", "5-B1", "5-A3", "5-C1", "5-A2"]:  # 定着, マスター, 復習ずみ, 挑戦中, まだ on screen
        b = page.locator(f'button.terr-unit[data-unit="{unit}"]').bounding_box()
        assert b and 0 <= b["x"] <= 390 and 60 < b["y"] < 844, (unit, b)
    shot(page, "23-ladder-map", full=False)
    page.get_by_test_id("compass").click()
    page.wait_for_timeout(900)
    page.get_by_test_id("legend-toggle").click()
    expect(page.get_by_test_id("map-legend")).to_have_count(0)
    expect(page.get_by_test_id("snap-fab")).to_be_visible()
    # on load: the child's zone fills ~70 % of the width
    lab = page.locator(".terr-reg.is-own").bounding_box()
    assert 40 < lab["x"] + lab["width"] / 2 < 350 and 150 < lab["y"] < 700, lab
    # controls do not collide: 撮る, the compass and the legend button
    fb, cb, lb = (page.get_by_test_id(t).bounding_box() for t in ("snap-fab", "compass", "legend-toggle"))
    assert fb["x"] + fb["width"] <= cb["x"] and lb["x"] + lb["width"] <= fb["x"], (fb, cb, lb)
    page.wait_for_timeout(300)
    shot(page, "18-map-home", full=False)

    # 5c. Tap a tile → the unit sheet at half height (layer 3: zone, counts, roots, history; layer 4: the
    #     unit's problems); root routes drawn; HUD card steps aside. The view before the tap is remembered.
    cam0 = page.locator(".terr-reg.is-own").bounding_box()
    page.locator('button.terr-unit[data-unit="5-C3"]').click()
    sheet = page.get_by_test_id("star-sheet")
    expect(sheet).to_be_visible()
    expect(sheet).to_contain_text("割合")
    expect(sheet).to_have_attribute("data-size", "half")
    expect(sheet.get_by_test_id("sheet-zone")).to_have_text("深い森林帯")
    sb = sheet.bounding_box()
    assert 844 * 0.4 < sb["height"] <= 844 * 0.57 + 1, sb  # half height, the map above it
    probs = sheet.get_by_test_id("unit-problem")
    expect(probs).to_have_count(5)  # p01: 5 problems in 割合, newest first, page order
    expect(probs.nth(0)).to_contain_text("問1")
    expect(sheet.locator('[data-testid=unit-problem][data-mark=x]')).to_have_count(2)
    expect(sheet.get_by_test_id("up-tick")).to_have_count(2)  # only the ✕ (same ticks as the テスト前リスト)
    expect(sheet.locator('[data-testid=unit-problem][data-source=teacher] [data-testid=up-source]').first).to_have_text("先生の印")
    expect(sheet.locator('[data-testid=unit-problem][data-source=parent] [data-testid=up-source]')).to_have_text("保護者")
    expect(sheet.get_by_test_id("photo-thumb")).to_have_count(5)
    expect(sheet.get_by_test_id("sheet-nennotame")).to_have_count(0)
    expect(sheet.get_by_test_id("sheet-history").locator("li")).to_have_count(1)
    expect(sheet.get_by_test_id("sheet-history")).to_contain_text("テスト")
    expect(sheet.get_by_test_id("sheet-history")).to_contain_text("✕2")
    expect(sheet).to_contain_text("もとになる単元")
    expect(sheet.locator('button.root-btn[data-unit="4-C2"]')).to_be_visible()
    expect(page.locator('button.terr-unit.is-root[data-unit="4-C2"]')).to_have_count(1)
    expect(page.locator('button.terr-unit.is-sel[data-unit="5-C3"] .terr-pin')).to_contain_text("割合")
    expect(page.get_by_test_id("hud-card")).to_be_hidden()
    expect(page.get_by_test_id("snap-fab")).to_have_count(0)  # never covers the open sheet
    expect(sheet.get_by_test_id("sheet-list")).to_have_attribute("href", "/app/list?unit=5-C3")
    expect(sheet.get_by_test_id("sheet-report")).to_have_attribute("href", "/app/report")
    page.wait_for_timeout(900)  # the camera settles above the sheet
    pin = page.locator('button.terr-unit.is-sel .terr-pin').bounding_box()
    assert pin["y"] > 56 and pin["y"] + pin["height"] < sheet.bounding_box()["y"], (pin, sheet.bounding_box())
    shot(page, "08s-map-sheet", full=False)
    # the 「復習した」 tick in the sheet is the テスト前リスト's: tick, untick (persisted), the tile follows
    tick = sheet.get_by_test_id("up-tick").first
    tick.check()
    expect(page.locator('button.terr-unit[data-unit="5-C3"]')).to_have_attribute("data-status", "trying")  # one ✕ left
    tick.uncheck()
    # 「この単元の問題を見る」 = full height + the 問題 section at the top of the sheet
    sheet.get_by_test_id("sheet-to-problems").click()
    expect(sheet).to_have_attribute("data-size", "full")
    page.wait_for_timeout(500)
    pb = sheet.get_by_test_id("sheet-problems").bounding_box()
    hb = sheet.locator(".sheet-head").bounding_box()
    assert abs(pb["y"] - (hb["y"] + hb["height"])) < 24, (pb, hb)
    shot(page, "21-sheet-full", full=False)
    # 21v. A thumbnail → the page viewer over the map: the photo, the page's problems, this unit's highlighted
    body = sheet.get_by_test_id("sheet-body")
    scroll0 = body.evaluate("el => el.scrollTop")
    probs.nth(1).get_by_test_id("photo-thumb").click()
    viewer = page.get_by_test_id("page-viewer")
    expect(viewer).to_be_visible()
    expect(viewer.get_by_test_id("viewer-photo")).to_be_visible()
    expect(viewer.locator(".pv-row")).to_have_count(5)
    expect(viewer.locator(".pv-row.is-unit")).to_have_count(5)
    expect(viewer.locator(".pv-row.is-unit").first).to_contain_text("この単元（割合）")
    stage = viewer.get_by_test_id("viewer-stage")
    stage.dblclick()  # double tap → zoomed in; 元の大きさ resets
    expect(stage).to_have_attribute("data-zoomed", "1")
    expect(viewer.get_by_test_id("viewer-reset")).to_be_visible()
    viewer.get_by_test_id("viewer-reset").click()
    expect(stage).to_have_attribute("data-zoomed", "0")
    page.wait_for_timeout(300)
    shot(page, "21v-page-viewer", full=False)
    # close → the same sheet (full height, same scroll); the map under it never moved
    viewer.get_by_test_id("viewer-close").click()
    expect(viewer).to_have_count(0)
    expect(sheet).to_have_attribute("data-size", "full")
    expect(sheet).to_contain_text("割合")
    assert abs(body.evaluate("el => el.scrollTop") - scroll0) < 2
    # back (iPhone swipe-back) peels the layers: viewer → sheet → (map stays)
    sheet.get_by_test_id("hist-row").first.click()
    expect(viewer).to_be_visible()
    page.go_back()
    expect(viewer).to_have_count(0)
    expect(sheet).to_be_visible()
    expect(page).to_have_url(re.compile(re.escape(BASE + "/app/map") + "$"))
    sheet.get_by_test_id("sheet-grab").click()  # tap the handle: back to half height
    expect(sheet).to_have_attribute("data-size", "half")
    sheet.locator('button.root-btn[data-unit="4-C2"]').click()  # fly to the root on the 小4 island (same entry)
    expect(sheet).to_contain_text("簡単な割合")
    expect(page.locator('button.terr-unit.is-sel[data-unit="4-C2"]')).to_have_count(1)
    page.go_back()
    expect(sheet).to_have_count(0)
    expect(page).to_have_url(re.compile(re.escape(BASE + "/app/map") + "$"))
    expect(page.get_by_test_id("snap-fab")).to_be_visible()
    page.wait_for_timeout(900)  # the camera flies back to where it was before the sheet
    cam1 = page.locator(".terr-reg.is-own").bounding_box()
    assert abs(cam1["x"] - cam0["x"]) < 2 and abs(cam1["y"] - cam0["y"]) < 2, (cam0, cam1)
    # drag the handle down closes; Esc closes; a tap on the map closes
    page.locator('button.terr-unit[data-unit="5-C3"]').click()
    expect(sheet).to_be_visible()
    gb = sheet.get_by_test_id("sheet-grab").bounding_box()
    page.mouse.move(gb["x"] + gb["width"] / 2, gb["y"] + 10)
    page.mouse.down()
    for i in range(1, 8):
        page.mouse.move(gb["x"] + gb["width"] / 2, gb["y"] + 10 + i * 25)
    page.mouse.up()
    expect(sheet).to_have_count(0)
    page.locator('button.terr-unit[data-unit="5-C3"]').click()
    page.keyboard.press("Escape")
    expect(sheet).to_have_count(0)

    # 23s. The 5-step ladder in the sheet: 5-B1 平面図形 is マスター (all ○ on 10/10) → ●●●●○, the next step with
    #      the day from which 定着 is possible, and 「解説動画（YouTube）」 near its problems (channel search)
    page.locator('button.terr-unit[data-unit="5-B1"]').click()
    expect(sheet).to_contain_text("平面図形")
    lad = sheet.get_by_test_id("sheet-ladder")
    expect(lad).to_have_attribute("data-level", "3")
    expect(lad.locator(".ld.is-on")).to_have_count(4)
    expect(lad.locator(".ladder-name")).to_have_text("マスター")
    settle = date(2026, 10, 24)
    expect(sheet.get_by_test_id("sheet-next-step")).to_have_text(
        "2週間後にもう一度全問○なら『定着』です（10/24以降）。" if date.today() < settle else "次のページでもう一度全問○なら『定着』です。")
    syt = sheet.get_by_test_id("sheet-youtube")
    expect(syt).to_have_attribute("href", "https://www.youtube.com/@Domo-ai/search?query=%E5%B9%B3%E9%9D%A2%E5%9B%B3%E5%BD%A2")
    expect(syt).to_have_attribute("target", "_blank")
    expect(syt).to_have_attribute("rel", "noopener")
    expect(sheet).to_contain_text("動画がまだない単元もあります")
    sheet.get_by_test_id("sheet-to-problems").click()
    expect(sheet).to_have_attribute("data-size", "full")
    page.wait_for_timeout(600)
    yb = syt.bounding_box()
    assert yb and lad.bounding_box()["y"] < yb["y"] < 844 - 120, yb  # ladder and button on one screen
    shot(page, "23s-ladder-sheet", full=False)
    # 定着 (5-A1): the top step, its own line; 挑戦中 (5-C1): how to reach 復習ずみ
    sheet.get_by_test_id("sheet-close").click()
    page.locator('button.terr-unit[data-unit="5-A1"]').dispatch_event("click")  # small neighbouring buttons at this zoom
    expect(sheet.get_by_test_id("sheet-ladder")).to_have_attribute("data-level", "4")
    expect(sheet.get_by_test_id("sheet-ladder").locator(".ld.is-on")).to_have_count(5)
    expect(sheet.get_by_test_id("sheet-next-step")).to_have_text("いちばん上の段です。ときどき解き直して、保ちましょう。")
    page.keyboard.press("Escape")
    page.locator('button.terr-unit[data-unit="5-C1"]').dispatch_event("click")  # small neighbouring buttons at this zoom
    expect(sheet.get_by_test_id("sheet-ladder").locator(".ladder-name")).to_have_text("挑戦中")
    expect(sheet.get_by_test_id("sheet-next-step")).to_have_text("✕の問題を解き直して「復習した」にすると『復習ずみ』です。")
    page.keyboard.press("Escape")
    expect(sheet).to_have_count(0)
    page.get_by_test_id("compass").click()
    page.wait_for_timeout(900)

    # 5c2. 次にやること: the badge pans to the red-flagged tiles one by one, opening each one's detail
    page.get_by_test_id("hud-next").click()
    expect(sheet).to_contain_text("割合")
    expect(page.locator('button.terr-unit.is-pointed[data-unit="5-C3"]')).to_have_count(1)
    expect(page.get_by_test_id("tour-next")).to_have_text("次へ（1/3）")
    page.wait_for_timeout(900)
    shot(page, "18n-map-next", full=False)
    page.get_by_test_id("tour-next").click()
    expect(sheet).to_contain_text("伴って変わる二つの数量")
    expect(page.get_by_test_id("tour-next")).to_have_text("次へ（2/3）")
    page.get_by_test_id("tour-next").click()
    expect(sheet).to_contain_text("概数")
    expect(page.locator('button.terr-unit.is-pointed[data-unit="4-A2"]')).to_have_count(1)
    page.keyboard.press("Escape")

    # 5c3. Pan / zoom: drag far away (clamped to the map), zoom out to all 12 zones, 現在地 brings 小5 back
    page.mouse.move(200, 400)
    page.mouse.down()
    for i in range(1, 11):
        page.mouse.move(200 - i * 150, 400 + i * 60)
    page.mouse.up()
    for _ in range(6):
        page.get_by_test_id("zoom-out").click()
    page.wait_for_timeout(800)
    for g in ["小1", "小6", "中2", "高3"]:
        b = page.locator(f'.terr-reg[data-region="{g}"]').bounding_box()
        assert b and -40 < b["x"] < 430 and 56 < b["y"] < 844, (g, b)
    page.get_by_test_id("compass").click()
    page.wait_for_timeout(800)
    lab2 = page.locator(".terr-reg.is-own").bounding_box()
    assert abs(lab2["x"] - lab["x"]) < 2 and abs(lab2["y"] - lab["y"]) < 2, (lab, lab2)

    # 5d. 一覧: the tile list (accessible fallback) from the HUD menu, choice remembered
    page.get_by_test_id("hud-menu").click()
    expect(page.get_by_test_id("hud-menu-pop").get_by_role("menuitem")).to_have_text(["一覧で見る", "年度の記録", "解説動画（YouTube）"])
    yt = page.get_by_test_id("menu-youtube")
    expect(yt).to_have_attribute("href", "https://www.youtube.com/@Domo-ai")
    expect(yt).to_have_attribute("target", "_blank")
    expect(yt).to_have_attribute("rel", "noopener")
    page.get_by_test_id("map-to-list").click()
    secs = page.locator("details.grade-sec")
    expect(secs).to_have_count(12)
    expect(secs.first).to_have_attribute("data-grade", "小5")
    expect(secs.first).to_have_attribute("open", "")
    expect(page.locator("details.grade-sec[open]")).to_have_count(1)
    assert page.locator("a.tile").count() == 110
    tile = page.locator('a.tile[data-unit="5-C3"]')
    expect(tile).to_have_attribute("data-status", "trying")
    expect(tile).to_contain_text("割合")
    expect(tile).to_contain_text("✕ 2")
    expect(tile).to_contain_text("5問")
    expect(page.locator('details[data-grade="小4"] .sum-trying')).to_have_text("挑戦中 1")
    expect(page.locator('a.tile[data-unit="5-A1"]')).to_have_attribute("data-status", "settled")
    expect(page.locator('a.tile[data-unit="5-A1"] .tile-star')).to_have_text(" 定着")
    expect(page.locator('details[data-grade="小5"] .sum-settled')).to_have_text("定着 1")
    expect(page.get_by_test_id("list-legend").locator("span")).to_have_count(5)
    page.reload()
    expect(page.locator("details.grade-sec")).to_have_count(12)  # remembered
    page.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    shot(page, "08l-map-list")
    page.get_by_role("radio", name="マップ").click()
    expect(page.locator("button.terr-unit")).to_have_count(110)

    # 5e. The map is home: /app opens it, マップ tab first and lit
    page.goto(BASE + "/app")
    expect(page).to_have_url(BASE + "/app/map")
    expect(page.locator("nav.tabbar a")).to_have_count(4)
    expect(page.locator("nav.tabbar a")).to_have_text(["マップ", "撮る", "テスト前", "ふりかえり"])
    expect(page.locator("nav.tabbar a.tab-active")).to_have_text("マップ")
    expect(page.get_by_test_id("map-strip")).to_have_count(0)  # no text-heavy strip on the map any more

    # 5e2. Zoomed out halfway (the 小 zones and the climb into 中), then close up on 小5
    for _ in range(2):
        page.get_by_test_id("zoom-out").click()
    page.wait_for_timeout(900)
    shot(page, "19-territory-full", full=False)
    page.get_by_test_id("compass").click()
    for _ in range(2):
        page.get_by_test_id("zoom-in").click()
    page.wait_for_timeout(900)
    shot(page, "19z-territory-zoom", full=False)
    # 20. The whole continent, coast → summit, below the HUD; then the 小5 zone as on load
    for _ in range(8):
        page.get_by_test_id("zoom-out").click()
    page.wait_for_timeout(900)
    hb = page.get_by_test_id("hud-card").bounding_box()
    for g in ["小1", "高3"]:
        b = page.locator(f'.terr-reg[data-region="{g}"]').bounding_box()
        assert b and 0 <= b["x"] and b["x"] + b["width"] <= 390 and b["y"] > 56 and b["y"] + b["height"] < 844 - 64, (g, b)
    summit = page.locator('.terr-reg[data-region="高3"]').bounding_box()
    assert summit["y"] > hb["y"] + hb["height"] - 8 or summit["x"] + summit["width"] < hb["x"], (summit, hb)
    shot(page, "20-continent", full=False)
    page.get_by_test_id("compass").click()
    page.wait_for_timeout(900)
    shot(page, "20z-region-xiao5", full=False)
    page.goto(BASE + "/app/report")

    # 5f. 学習レポート = the map's 「詳しく」 page; every unit opens its tile on the map
    expect(page).to_have_url(BASE + "/app/report")
    expect(page.locator("nav.tabbar a.tab-active")).to_have_text("マップ")
    expect(page.get_by_test_id("report-back")).to_have_attribute("href", "/app/map")
    expect(page.get_by_role("heading", level=1)).to_have_text("小5の学習レポート")
    expect(page.locator(".report-meta")).to_contain_text("これまでに6ページ")
    expect(page.get_by_test_id("glance-sum")).to_have_text("15単元のうち定着 1マスター 1復習ずみ 2挑戦中 2まだ 9")
    expect(page.get_by_test_id("glance-bar")).to_have_attribute("aria-label", "15単元のうち 定着 1 ・ マスター 1 ・ 復習ずみ 2 ・ 挑戦中 2 ・ まだ 9")
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
    for at, n, x in [("2026-09-15", 2, 0), ("2026-10-01", 5, 1), ("2026-10-03", 6, 3), ("2026-10-10", 4, 1), ("2026-10-12", 7, 2)]:
        if datetime.fromisoformat(at + "T09:00:00+00:00") >= since:
            week = [week[0] + 1, week[1] + n, week[2] + x]
    expect(page.get_by_test_id("report-week").locator("dd")).to_have_text([str(v) for v in week])
    chips = page.get_by_test_id("report-chips")
    expect(chips.locator(".mc-settled")).to_have_count(1)
    expect(chips.locator('.mc-settled[data-unit="5-A1"]')).to_have_attribute("href", "/app/map?unit=5-A1")
    expect(chips.locator(".mc-master")).to_have_count(1)
    expect(chips.locator(".mc-trying")).to_have_count(0)  # already in 次にやること
    expect(chips.locator(".mc-reviewed")).to_have_count(2)
    expect(chips.locator('.mc-master[data-unit="5-B1"]')).to_have_attribute("href", "/app/map?unit=5-B1")
    expect(page.get_by_role("link", name="単元マップで全体を見る")).to_have_attribute("href", "/app/map")
    shot(page, "17-report")
    # a unit on another island from the report: the map flies there and opens its sheet (?unit=3-A4)
    earlier.locator('[data-unit="3-A4"]').click()
    expect(page).to_have_url(BASE + "/app/map?unit=3-A4")
    expect(page.get_by_test_id("star-sheet")).to_contain_text("除法")
    expect(page.locator('button.terr-unit.is-sel[data-unit="3-A4"]')).to_have_count(1)
    page.wait_for_timeout(800)
    shot(page, "18u-map-unit-from-report", full=False)
    # seed pages have no photo: the placeholder still opens the viewer (problems, no photo)
    page.get_by_test_id("star-sheet").get_by_test_id("photo-thumb").first.click()
    expect(page.get_by_test_id("viewer-nophoto")).to_be_visible()
    expect(page.get_by_test_id("page-viewer").locator(".pv-row.is-unit")).to_have_count(1)
    page.keyboard.press("Escape")
    expect(page.get_by_test_id("page-viewer")).to_have_count(0)
    # back closes the sheet first and keeps the map; the next back returns to the report
    page.go_back()
    expect(page.get_by_test_id("star-sheet")).to_have_count(0)
    expect(page).to_have_url(BASE + "/app/map?unit=3-A4")
    page.go_back()
    expect(page).to_have_url(BASE + "/app/report")
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
    assert len(data["pages"]) == 6 and any("photo" in pg for pg in data["pages"]), len(data["pages"])
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
    expect(page.locator("button.terr-unit")).to_have_count(110)
    ctx.set_offline(False)
    assert page.evaluate("caches.keys()") == ["lens-snap-v1"]
    assert not page.evaluate("""caches.open('lens-snap-v1').then(c => c.keys()).then(ks => ks.some(r => new URL(r.url).pathname.startsWith('/api')))""")

    # 7d. Android / Chrome: beforeinstallprompt → 「ホーム画面に追加」 button on 撮る; dismiss is remembered
    page.get_by_role("link", name="撮る", exact=True).click()
    expect(page.get_by_test_id("install-tip")).to_have_count(0)  # nothing to offer before the event
    page.evaluate("""() => { const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); }""")
    tip = page.get_by_test_id("install-tip")
    expect(tip.get_by_role("button", name="ホーム画面に追加")).to_be_visible()
    tip.get_by_role("button", name="閉じる").click()
    expect(tip).to_have_count(0)

    # 8. Retake path (h03, mock reader says retake)
    page.get_by_role("link", name="撮る", exact=True).click()
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

    # 8b2. A young child (小2): the map opens on the 小2 island
    young = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    y = young.new_page()
    y.on("pageerror", lambda err: errors.append(str(err)))
    y.goto(BASE + "/app")
    y.evaluate("localStorage.setItem('lens-snap:grade', '小2')")
    y.evaluate(SEED_YOUNG_JS)
    y.goto(BASE + "/app")
    expect(y).to_have_url(BASE + "/app/map")
    expect(y.get_by_test_id("hud-card").locator(".hud-t")).to_have_text("制覇（小2）")
    expect(y.get_by_test_id("hud-taken")).to_have_text("3 / 7")
    expect(y.get_by_test_id("hud-next")).to_have_text("次にやること 2")  # 2-A2, then 小1 1-A2
    own = y.locator(".terr-reg.is-own")
    expect(own).to_have_text("入り江小2標高 40")
    ob = own.bounding_box()
    assert 0 < ob["x"] < 390 and 56 < ob["y"] < 844 - 64, ob
    for unit, st in [("2-A2", "trying"), ("2-B1", "master"), ("2-C1", "reviewed"), ("1-A2", "trying"), ("2-A1", "mada")]:
        expect(y.locator(f'.terr-layer [data-unit="{unit}"]')).to_have_attribute("data-status", st)
    y.wait_for_timeout(300)
    shot(y, "18y-map-home-young", full=False)
    young.close()

    # 8b3. A 高2 child: the map opens on the 高2 island (数学II + 数学B), 数学I ✕ on the 高1 island
    k2 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    k = k2.new_page()
    k.on("pageerror", lambda err: errors.append(str(err)))
    k.goto(BASE + "/app")
    k.evaluate("localStorage.setItem('lens-snap:grade', '高2')")
    k.evaluate(SEED_KOKO2_JS)
    k.goto(BASE + "/app")
    expect(k).to_have_url(BASE + "/app/map")
    expect(k.get_by_test_id("grade-chip")).to_have_text("高2")
    expect(k.get_by_test_id("grade-check")).to_have_count(0)
    expect(k.get_by_test_id("hud-card").locator(".hud-t")).to_have_text("制覇（高2）")
    expect(k.get_by_test_id("hud-taken")).to_have_text("3 / 8")
    expect(k.get_by_test_id("hud-levels")).to_have_text("マスター 1・復習ずみ 1・挑戦中 1")
    expect(k.get_by_test_id("hud-next")).to_have_text("次にやること 2")
    expect(k.locator(".terr-reg.is-own")).to_have_text("氷河帯高2標高 3,100")
    for unit, st in [("h-II-4", "trying"), ("h-B-1", "master"), ("h-II-1", "reviewed"), ("h-I-3", "trying"), ("h-II-2", "mada")]:
        expect(k.locator(f'.terr-layer [data-unit="{unit}"]')).to_have_attribute("data-status", st)
    kb = k.locator(".terr-reg.is-own").bounding_box()
    assert 0 < kb["x"] < 390 and 56 < kb["y"] < 844 - 64, kb
    k.wait_for_timeout(300)
    shot(k, "18k-map-home-koko2", full=False)
    # double-tap the glacier (just under its label): the camera zooms in there
    gx, gy = kb["x"] + kb["width"] / 2, kb["y"] + kb["height"] + 10
    k.mouse.click(gx, gy)
    k.mouse.click(gx, gy)
    k.wait_for_timeout(900)
    expect(k.get_by_test_id("star-sheet")).to_have_count(0)
    kb2 = k.locator(".terr-reg.is-own").bounding_box()
    assert 0 < kb2["x"] and kb2["x"] + kb2["width"] < 390 and 56 < kb2["y"] < 844 - 64, kb2
    shot(k, "20k-region-koko2", full=False)
    k.goto(BASE + "/app/report")
    expect(k.get_by_role("heading", level=1)).to_have_text("高2の学習レポート")
    expect(k.get_by_test_id("report-earlier").locator('[data-unit="h-I-3"]')).to_contain_text("二次関数")
    k2.close()

    # 8b4. Migration: a device that saved the old combined 「高校」 opens as 高1, the badge asks for a check
    mg = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    m = mg.new_page()
    m.on("pageerror", lambda err: errors.append(str(err)))
    m.goto(BASE + "/app")
    m.evaluate("localStorage.setItem('lens-snap:grade', '高校')")
    m.goto(BASE + "/app/snap")
    expect(m.get_by_test_id("grade-chip")).to_have_text("高1")
    expect(m.get_by_test_id("grade-check")).to_contain_text("学年を「高1」にしました。")
    assert m.evaluate("localStorage.getItem('lens-snap:grade')") == "高1"
    m.reload()
    expect(m.get_by_test_id("grade-check")).to_be_visible()  # until the parent answers
    shot(m, "04m-grade-migrated", full=False)
    m.get_by_test_id("grade-chip").click()
    m.get_by_role("radio", name="高2").click()
    m.get_by_role("button", name="はじめる").click()
    expect(m.get_by_test_id("grade-chip")).to_have_text("高2")
    expect(m.get_by_test_id("grade-check")).to_have_count(0)
    mg.close()

    # 8b5. 年度の記録: a 小5 child with pages from this school year and last (2025年度 = 小4); a row flies to its zone
    yc = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    yp = yc.new_page()
    yp.on("pageerror", lambda err: errors.append(str(err)))
    yp.goto(BASE + "/app")
    yp.evaluate("localStorage.setItem('lens-snap:grade', '小5')")
    yp.evaluate(SEED_YEARS_JS)
    yp.goto(BASE + "/app/map")
    yp.get_by_test_id("hud-menu").click()
    yp.get_by_test_id("menu-year").click()
    ys = yp.get_by_test_id("year-sheet")
    expect(ys).to_be_visible()
    rows = ys.get_by_test_id("year-row")
    expect(rows).to_have_count(2)
    expect(rows.nth(0)).to_contain_text("2026年度")
    expect(rows.nth(0)).to_contain_text("深い森林帯")
    expect(rows.nth(0)).to_contain_text("制覇 5/15")
    expect(rows.nth(0)).to_contain_text("✕ 7")
    expect(rows.nth(1)).to_contain_text("2025年度")
    expect(rows.nth(1)).to_contain_text("森林帯")
    expect(rows.nth(1)).to_contain_text("小4")
    expect(rows.nth(1)).to_contain_text("制覇 3/16")
    expect(rows.nth(1)).to_contain_text("✕ 3")
    expect(yp.get_by_test_id("hud-card")).to_be_hidden()
    yp.wait_for_timeout(500)
    shot(yp, "20y-yearly", full=False)
    rows.nth(1).click()
    expect(ys).to_have_count(0)
    yp.wait_for_timeout(900)
    l4 = yp.locator('.terr-reg[data-region="小4"]').bounding_box()
    assert 40 < l4["x"] + l4["width"] / 2 < 350 and 100 < l4["y"] < 600, l4
    yc.close()

    # 8c. 学習レポート with no pages yet: a friendly card + 「ページを撮る」; /app is the (empty) map
    ctx3 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    e = ctx3.new_page()
    e.on("pageerror", lambda err: errors.append(str(err)))
    e.goto(BASE + "/app")
    e.evaluate("localStorage.setItem('lens-snap:grade', '小5')")
    e.goto(BASE + "/app")
    expect(e).to_have_url(BASE + "/app/map")
    expect(e.get_by_test_id("map-welcome")).to_be_visible()
    expect(e.get_by_test_id("hud-next")).to_have_count(0)
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
    expect(g).to_have_url(GATED + "/app/map")  # after the code and the grade: the map
    g.get_by_test_id("welcome-snap").click()
    g.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "p01.jpg"))
    expect(g.get_by_text("招待コードが違うようです。もう一度入力してください。")).to_be_visible(timeout=15000)
    g.fill("input[name=pilot-code]", "kumo42")
    shot(g, "14-pilot-code-again", full=False)
    g.get_by_role("button", name="コードを送って読み取る").click()
    expect(g.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    ctx2.close()

    # J. Journey for the founder (journey server: MOCK_FALLBACK=live4 = his live test of a 4年 sheet).
    #    Fresh 小5 profile; first screens only.
    jc = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    jp = jc.new_page()
    jp.on("pageerror", lambda err: errors.append(str(err)))
    jp.goto(JOURNEY + "/app")
    jp.get_by_role("radio", name="小5").click()
    jp.get_by_role("button", name="はじめる").click()
    # J1: home before any page = the map: all unexplored territory, 0 taken, one card → 撮る
    expect(jp).to_have_url(JOURNEY + "/app/map")
    welcome = jp.get_by_test_id("map-welcome")
    expect(welcome).to_contain_text("プリントを撮ると、その単元が自分の領土になります")
    expect(jp.get_by_test_id("welcome-snap")).to_have_attribute("href", "/app/snap")
    expect(jp.locator("button.terr-unit")).to_have_count(110)
    expect(jp.locator('button.terr-unit:not([data-status="mada"])')).to_have_count(0)
    expect(jp.get_by_test_id("hud-taken")).to_have_text("0 / 15")
    expect(jp.get_by_test_id("hud-next")).to_have_count(0)
    expect(jp.locator("nav.tabbar a.tab-active")).to_have_text("マップ")
    own = jp.locator(".terr-reg.is-own")
    expect(own).to_contain_text("小5")
    wb, cb = welcome.bounding_box(), jp.get_by_test_id("compass").bounding_box()
    assert wb["x"] + wb["width"] <= cb["x"] and wb["y"] + wb["height"] <= 844 - 64, (wb, cb)
    jp.wait_for_timeout(300)
    shot(jp, "J1-empty-map", full=False)
    # 撮る from the map → the live sheet → confirm with the AI's ○✕ prefilled
    jp.get_by_test_id("welcome-snap").click()
    jp.get_by_test_id("file-input").set_input_files(str(ROOT / "fixtures" / "photos" / "live4.jpg"))
    expect(jp.get_by_role("heading", name="読み取り結果の確認")).to_be_visible(timeout=15000)
    jcards = jp.get_by_test_id("problem-card")
    expect(jcards).to_have_count(4)
    expect(jp.locator('[data-testid=mark-source][data-source=ai]')).to_have_count(4)
    for i, m in enumerate(["○", "✕", "✕", "○"]):
        expect(jcards.nth(i).get_by_role("radio", name=m, exact=True)).to_have_attribute("aria-checked", "true")
    expect(jcards.nth(0).locator("select")).to_have_value("4-A4")
    expect(jcards.nth(1).locator("select")).to_have_value("5-D2")
    expect(jcards.nth(2).get_by_test_id("ai-answer")).to_have_text("正答（AI）：480円")
    jp.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    shot(jp, "J2-confirm", full=False)
    jp.get_by_role("button", name="保存する").click()
    # J3: straight back to the map: the camera flies to the new tiles, they rise; the toast says what changed
    expect(jp).to_have_url(re.compile(re.escape(JOURNEY + "/app/map?saved=4&lit=4-A4,5-D2,4-A6&page=") + r"[\w-]+$"))
    expect(jp.get_by_test_id("lit-toast")).to_have_text("4問を保存しました：✕ 2問（平均、数量の関係を表す式）・○ 2問")
    expect(jp.get_by_test_id("toast-report")).to_have_text("レポートを見る")
    expect(jp.locator("button.terr-unit.is-lit")).to_have_count(3)
    for unit, st in [("4-A4", "master"), ("5-D2", "trying"), ("4-A6", "trying")]:  # all ○ on its newest page → gold
        expect(jp.locator(f'button.terr-unit[data-unit="{unit}"]')).to_have_attribute("data-status", st)
    jp.wait_for_timeout(820)  # fly done (0.65 s), tiles rising (0.8 s)
    shot(jp, "J3-saved-map", full=False)
    jp.wait_for_timeout(800)
    # all three new tiles framed on the first screen, clear of the toast (top) and the tab bar
    toast_bottom = jp.locator(".toast-map").bounding_box()
    toast_bottom = toast_bottom["y"] + toast_bottom["height"]
    for unit in ["4-A4", "5-D2", "4-A6"]:
        b = jp.locator(f'button.terr-unit[data-unit="{unit}"]').bounding_box()
        assert toast_bottom - 8 < b["y"] and b["y"] + b["height"] < 844 - 64 and 0 <= b["x"] and b["x"] + b["width"] <= 390, (unit, b, toast_bottom)
    # J4: the toast goes; HUD: 制覇 1 / 15 in 小5, 挑戦中 1, 次にやること 2 (平均, then 小4 数量の関係を表す式); red flags
    jp.wait_for_timeout(4600)
    expect(jp.get_by_test_id("lit-toast")).to_have_count(0)
    expect(jp.get_by_test_id("hud-taken")).to_have_text("1 / 15")
    expect(jp.get_by_test_id("hud-levels")).to_have_text("挑戦中 1")
    expect(jp.get_by_test_id("hud-next")).to_have_text("次にやること 2")
    expect(jp.locator("button.terr-unit .terr-flag")).to_have_count(2)
    expect(jp.get_by_test_id("snap-fab")).to_be_visible()
    shot(jp, "J4-map-after", full=False)
    # J5: 次にやること → the red 平均 tile: detail sheet with its history, root routes to 小4
    jp.get_by_test_id("hud-next").click()
    jsheet = jp.get_by_test_id("star-sheet")
    expect(jsheet).to_contain_text("平均")
    expect(jsheet.get_by_test_id("sheet-history").locator("li")).to_have_count(1)
    expect(jsheet.get_by_test_id("sheet-history")).to_contain_text("ドリル")
    expect(jsheet.get_by_test_id("sheet-history")).to_contain_text("✕1")
    expect(jsheet.get_by_test_id("tour-next")).to_have_text("次へ（1/2）")
    expect(jsheet.get_by_test_id("sheet-list")).to_have_attribute("href", "/app/list?unit=5-D2")
    expect(jp.locator("button.terr-unit.is-root")).not_to_have_count(0)
    expect(jp.get_by_test_id("snap-fab")).to_have_count(0)
    # layer 4 in the half-height sheet: the ✕ problem of 平均 (AI判定, 正答（AI）, tick, photo) on the first screen
    jprob = jsheet.get_by_test_id("unit-problem")
    expect(jprob).to_have_count(1)
    expect(jprob.nth(0)).to_contain_text("平均点を求めなさい")
    expect(jprob.nth(0).get_by_test_id("up-source")).to_have_text("AI判定")
    expect(jprob.nth(0).get_by_test_id("photo-thumb")).to_have_count(1)
    jp.wait_for_timeout(1000)
    jb = jprob.nth(0).locator(".up-q").bounding_box()
    assert jb["y"] + jb["height"] < 844, jb
    shot(jp, "J5-sheet", full=False)
    # J6: テスト前リスト from the sheet (multi-unit review stays its own screen): the ✕ problem of 平均
    jsheet.get_by_test_id("sheet-list").click()
    expect(jp).to_have_url(JOURNEY + "/app/list?unit=5-D2")
    jitems = jp.get_by_test_id("review-item")
    expect(jitems).to_have_count(1)
    expect(jitems.nth(0)).to_contain_text("平均点を求めなさい")
    shot(jp, "J6-list", full=False)
    jc.close()

    # E. テスト前モード with the founder's real example (open server): test tomorrow, range 平面図形の面積 + 割合 + 平均.
    ec = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", is_mobile=True, has_touch=True)
    # Web Share: record what would be shared (headless has no share sheet)
    ec.add_init_script("navigator.share = (d) => { window.__shared = d; return Promise.resolve(); };")
    ep = ec.new_page()
    ep.on("pageerror", lambda err: errors.append(str(err)))
    ep.goto(BASE + "/app")
    ep.get_by_role("radio", name="小5").click()
    ep.get_by_role("button", name="はじめる").click()
    expect(ep).to_have_url(BASE + "/app/map")
    ep.evaluate(exam_seed_js())
    ep.reload()
    expect(ep.locator('button.terr-unit[data-unit="5-D2"]')).to_have_attribute("data-status", "trying")
    for unit, st in [("5-B3", "master"), ("5-C3", "master"), ("4-A6", "trying"), ("4-A4", "master")]:
        expect(ep.locator(f'button.terr-unit[data-unit="{unit}"]')).to_have_attribute("data-status", st)
    expect(ep.get_by_test_id("hud-exam")).to_have_text("テスト前モード")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    # 22a: one question first
    ep.get_by_test_id("hud-exam").click()
    expect(ep.get_by_test_id("exam-date")).to_contain_text("テストはいつですか？")
    expect(ep.get_by_test_id("exam-tomorrow")).to_have_attribute("data-day", tomorrow)
    expect(ep.get_by_test_id("hud-next")).to_have_count(0)
    expect(ep.get_by_test_id("snap-fab")).to_have_count(0)
    ep.wait_for_timeout(300)
    shot(ep, "22a-exam-entry", full=False)
    # the date question is a history layer: back = the map as it was
    ep.go_back()
    expect(ep.get_by_test_id("exam-date")).to_have_count(0)
    expect(ep).to_have_url(BASE + "/app/map")
    ep.get_by_test_id("hud-exam").click()
    ep.get_by_test_id("exam-pick").click()
    expect(ep.get_by_test_id("exam-day-input")).to_be_visible()
    ep.get_by_test_id("exam-tomorrow").click()
    # range on the dimmed map: default = the 小5 units with data; tap a tile in / out; 「この地帯を全部」
    bar = ep.get_by_test_id("exam-rangebar")
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 3単元")
    expect(bar).to_contain_text("小5 平面図形の面積・割合・平均")
    expect(ep.locator('button.terr-unit[data-range="1"]')).to_have_count(3)
    expect(ep.get_by_test_id("zone-all")).to_have_count(12)
    tap = lambda unit: ep.locator(f'button.terr-unit[data-unit="{unit}"]').evaluate("b => b.click()")
    tap("5-A4")  # 分数 (no page yet) in …
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 4単元")
    expect(ep.locator('button.terr-unit[data-unit="5-A4"]')).to_have_attribute("aria-pressed", "true")
    tap("5-A4")  # … and out again
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 3単元")
    ep.locator('[data-testid=zone-all][data-grade="小5"]').evaluate("b => b.click()")
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 15単元")
    ep.locator('[data-testid=zone-all][data-grade="小5"]').evaluate("b => b.click()")
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 0単元")
    expect(ep.get_by_test_id("exam-decide")).to_be_disabled()
    for unit in ["5-B3", "5-C3", "5-D2"]:
        tap(unit)
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 3単元")
    for unit in ["5-B3", "5-C3", "5-D2"]:  # the range tiles on screen, above the bar
        b = ep.locator(f'button.terr-unit[data-unit="{unit}"]').bounding_box()
        assert 0 <= b["x"] <= 390 and 160 < b["y"] < bar.bounding_box()["y"], (unit, b)
    ep.wait_for_timeout(700)
    shot(ep, "22b-exam-range", full=False)
    # 今夜の作戦
    ep.get_by_test_id("exam-decide").click()
    plan = ep.get_by_test_id("exam-plan")
    expect(plan).to_have_attribute("data-size", "half")
    expect(ep.get_by_test_id("plan-title")).to_have_text("明日のテスト・範囲 3単元")
    expect(ep.get_by_test_id("plan-line")).to_have_text("今夜やること：4問 ・ めやす 約20分")
    expect(ep.get_by_test_id("plan-count")).to_have_text("復習した 0 / 4")
    expect(ep.get_by_test_id("exam-countdown")).to_have_text("テストまで あと1日")
    expect(ep.get_by_test_id("overview-row")).to_have_count(3)
    expect(ep.get_by_test_id("plan-first").get_by_test_id("plan-card")).to_have_count(3)
    expect(ep.get_by_test_id("plan-roots").get_by_test_id("plan-group")).to_contain_text("小4 数量の関係を表す式 — 小5 平均 のもと")
    expect(ep.get_by_test_id("plan-extra").get_by_test_id("plan-card")).to_have_count(0)  # ③ collapsed
    expect(ep.get_by_test_id("plan-missing")).to_have_count(0)
    expect(ep.locator('button.terr-unit[data-range="1"]')).to_have_count(3)
    expect(ep.locator("button.terr-unit.is-todo")).to_have_count(2)  # 平均 and 小4 数量の関係を表す式 pulse
    stored = json.loads(ep.evaluate("localStorage.getItem('lens-snap:exam:小5')"))
    assert stored["current"] == tomorrow and stored["tests"][tomorrow]["units"] == ["5-B3", "5-C3", "5-D2"], stored
    ep.wait_for_timeout(1000)  # camera: the range and tonight's units above the plan
    top = plan.bounding_box()["y"]
    for unit in ["5-B3", "5-C3", "5-D2", "4-A6"]:
        b = ep.locator(f'button.terr-unit[data-unit="{unit}"]').bounding_box()
        assert 56 < b["y"] < top and 0 <= b["x"] <= 390, (unit, b, top)
    shot(ep, "22c-exam-plan", full=False)
    # 23e: one 「解説動画（YouTube）」 in the plan header (the channel, new tab), not one per card
    pyt = ep.get_by_test_id("plan-youtube")
    expect(pyt).to_have_count(1)
    expect(pyt).to_have_attribute("href", "https://www.youtube.com/@Domo-ai")
    expect(pyt).to_have_attribute("target", "_blank")
    expect(pyt).to_have_attribute("rel", "noopener")
    expect(plan.locator(".plan-head").get_by_test_id("plan-youtube")).to_have_count(1)
    expect(ep.get_by_test_id("plan-body").get_by_test_id("plan-youtube")).to_have_count(0)
    shot(ep, "23e-exam-youtube", full=False)
    # 22d: re-solve first, then 「答えを確かめる」 (② 小4 数量の関係を表す式, 正答（AI） 480円)
    ep.get_by_test_id("plan-grab").click()
    expect(plan).to_have_attribute("data-size", "full")
    ep.get_by_test_id("overview-row").nth(1).click()
    root_card = ep.get_by_test_id("plan-roots").get_by_test_id("plan-card").first
    expect(root_card.get_by_test_id("plan-answer")).to_have_count(0)
    root_card.get_by_test_id("plan-check").click()
    expect(root_card.get_by_test_id("plan-answer")).to_contain_text("正答（AI）：480円")
    ep.wait_for_timeout(500)  # the smooth jump is done; start the shot at the ② heading
    ep.get_by_test_id("plan-body").evaluate("b => { b.scrollTop = b.querySelector('[data-testid=plan-roots]').offsetTop - 4; }")
    ab = root_card.get_by_test_id("plan-answer").bounding_box()
    assert ab["y"] + ab["height"] < 844, ab
    shot(ep, "22d-exam-reveal", full=False)
    # its page photo → the viewer (this unit's problems highlighted) → back to the plan, same URL
    root_card.get_by_test_id("photo-thumb").click()
    viewer = ep.get_by_test_id("page-viewer")
    expect(viewer).to_be_visible()
    expect(ep.get_by_test_id("viewer-photo")).to_be_visible()
    expect(viewer.locator('.pv-row[data-unit-row="1"]')).to_have_count(2)
    ep.go_back()
    expect(viewer).to_have_count(0)
    expect(plan).to_be_visible()
    expect(ep).to_have_url(BASE + "/app/map")
    # 22e: tick it → 1 / 4; its unit's last ✕ → the 小4 tile loses its flag (復習ずみ), said for a moment
    ep.get_by_test_id("plan-grab").click()
    expect(plan).to_have_attribute("data-size", "half")
    flags = ep.locator("button.terr-unit .terr-flag").count()
    root_card.get_by_test_id("plan-tick").check()
    expect(ep.get_by_test_id("plan-count")).to_have_text("復習した 1 / 4")
    expect(ep.locator('button.terr-unit[data-unit="4-A6"]')).to_have_attribute("data-status", "reviewed")
    expect(ep.locator("button.terr-unit .terr-flag")).to_have_count(flags - 1)
    expect(ep.locator("button.terr-unit.is-todo")).to_have_count(1)
    expect(ep.get_by_test_id("exam-secured")).to_have_text("小4 数量の関係を表す式：✕をすべて復習しました（復習ずみ）")
    root_card.scroll_into_view_if_needed()
    ep.wait_for_timeout(500)
    shot(ep, "22e-exam-progress", full=False)
    # 22f: the parent summary (one screen), shared as text with the Web Share API
    ep.get_by_test_id("plan-share").click()
    summary = ep.get_by_test_id("exam-summary")
    expect(ep.get_by_test_id("summary-when")).to_have_text(re.compile(r"^明日のテスト（\d+/\d+）$"))
    expect(ep.get_by_test_id("summary-range")).to_have_text("小5 平面図形の面積・割合・平均")
    expect(ep.get_by_test_id("summary-tonight")).to_have_text("今夜やること：4問 ・ めやす 約20分")
    expect(summary.locator(".sum-row")).to_have_count(3)
    expect(summary.locator(".sum-row.is-done")).to_contain_text("1問 済")
    expect(ep.get_by_test_id("summary-progress")).to_have_text("復習した 1 / 4")
    sb = summary.locator(".sum-card").bounding_box()
    assert sb["y"] + sb["height"] < 844, sb  # one screen
    ep.wait_for_timeout(300)
    shot(ep, "22f-exam-share", full=False)
    ep.get_by_test_id("summary-share").click()
    shared = ep.evaluate("window.__shared")
    assert shared["text"].startswith("【テスト前の作戦】明日のテスト") and "②つまずきのもと：小4 数量の関係を表す式 — 小5 平均 のもと 1問 済" in shared["text"], shared
    # back: summary → plan → the map (mode off), the tile stays 復習ずみ
    ep.go_back()
    expect(summary).to_have_count(0)
    expect(plan).to_be_visible()
    ep.go_back()
    expect(plan).to_have_count(0)
    expect(ep.get_by_test_id("exam-countdown")).to_have_count(0)
    expect(ep.get_by_test_id("hud-exam")).to_be_visible()
    expect(ep.locator('button.terr-unit[data-range="1"]')).to_have_count(0)
    expect(ep.locator('button.terr-unit[data-unit="4-A6"]')).to_have_attribute("data-status", "reviewed")
    expect(ep).to_have_url(BASE + "/app/map")
    # reopen: the current test opens straight on the plan, the tick kept; 「日付・範囲を変える」 remembers the range
    ep.get_by_test_id("hud-exam").click()
    expect(ep.get_by_test_id("plan-count")).to_have_text("復習した 1 / 4")
    ep.get_by_test_id("plan-change").click()
    ep.get_by_test_id("exam-tomorrow").click()
    expect(ep.get_by_test_id("exam-range-count")).to_have_text("範囲 3単元")
    ep.get_by_test_id("exam-decide").click()
    # everything in ① and ② ticked → a calm completion, what is left in 念のため
    for i in range(3):
        ep.get_by_test_id("plan-first").get_by_test_id("plan-tick").nth(i).check()
    expect(ep.get_by_test_id("plan-count")).to_have_text("復習した 4 / 4")
    expect(ep.get_by_test_id("plan-done")).to_contain_text("今夜の作戦は完了です")
    expect(ep.get_by_test_id("plan-done")).to_contain_text("念のための見直しがあと1問あります")
    expect(ep.locator('button.terr-unit[data-unit="5-D2"]')).to_have_attribute("data-status", "reviewed")
    ep.keyboard.press("Escape")
    expect(plan).to_have_count(0)
    ec.close()

    assert not errors, errors
    browser.close()
    print("UI flow OK")
