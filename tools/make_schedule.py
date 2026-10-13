"""Build the 4-week schedule (HTML → PDF) from the catalog and labels, so lens names and order never drift.

    python3 tools/make_schedule.py            # writes docs/parent/4-week-schedule.html
    node tools/print_pdf.mjs docs/parent/4-week-schedule.html apps/trainer/public/pdf/lens-4week-schedule.pdf
"""
import json, yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
labels = yaml.safe_load((ROOT / "labels/lenses.yaml").read_text(encoding="utf-8"))
tokens = json.loads((ROOT / "tokens/tokens.json").read_text(encoding="utf-8"))
mc = tokens["motion"]["masterclass"]
color = {k: v["value"] for k, v in tokens["color"]["lens"].items() if isinstance(v, dict)}
ORDER = ["enclose", "slide", "area", "constant", "balance", "freeze", "mirror", "unfold"]   # catalog lens order, geometry and story problems alternating
MC_MIN = round(mc["total_sec"] / 60)
ROUND = mc["practice_round"]

def chip(l):
    return f'<span class="chip" style="--c:{color[l]}">{labels[l]["ja"]}</span>'

A = lambda l: (chip(l), f"マスタークラス（約{MC_MIN}分）＋ いっしょに発見", "16分")
B = lambda l: (chip(l), f"ひとりで練習（{ROUND}問）＋ 時間をはかって確認", "15分")
days = []
days += [("はじめの8問チェック", "どのレンズ？ 8問（約3分）→ 保護者レポートに記録", "3分")]
days[0] = (chip("enclose"), f"はじめの8問チェック（約3分）＋ マスタークラス（約{MC_MIN}分）", "18分")
days += [B("enclose"), A("slide"), B("slide"), A("area"), B("area"), ("ふりかえり", "苦手だった1問をもう一度。「決め手の言葉」を声に出す", "10分")]
days += [A("constant"), B("constant"), A("balance"), B("balance"), A("freeze"), B("freeze"), ("ふりかえり", "総まとめドリル（10問）で、まちがえやすい組み合わせを見る", "12分")]
days += [A("mirror"), B("mirror"), A("unfold"), B("unfold"), ("苦手レンズ①", "保護者レポートで時間がかかったレンズの「ひとりで練習」", "15分"), ("苦手レンズ②", "2番目に時間がかかったレンズの「ひとりで練習」", "15分"), ("お休み", "", "")]
days += [("総まとめ①", "総まとめドリル（10問）：8つのレンズ＋使えない問題", "15分"), ("総まとめ②", "総まとめドリル（10問）", "15分"),
         ("総まとめ③", "時間をはかって確認：苦手レンズ2つ", "15分"), ("総まとめ④", "総まとめドリル（10問）", "15分"),
         ("苦手レンズ", "まだ★がないレンズの「ひとりで練習」", "15分"), ("お休み", "", ""),
         ("4週目チェック", "はじめと同じ8問形式（問題は別）→ 保護者レポートで、はじめと4週目をくらべる", "5分")]
assert len(days) == 28, len(days)

rows = []
for w in range(4):
    cells = []
    for d in range(7):
        n = w * 7 + d + 1
        what, how, mins = days[n - 1]
        rest = what == "お休み"
        cells.append(f'<td class="{"rest" if rest else ""}"><div class="dn"><span>{n}日目</span><span class="box"></span></div>'
                     f'<div class="what">{what}</div><div class="how">{how}</div><div class="min">{mins}</div></td>')
    rows.append(f'<tr><th>{w + 1}週目</th>{"".join(cells)}</tr>')

html = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>視点レンズ 4週間完成スケジュール</title>
<style>
@page {{ size: A4 landscape; margin: 10mm 11mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: "Noto Sans CJK JP", sans-serif; color: #1F1F1C; margin: 0; font-size: 9.2pt; line-height: 1.45; }}
h1 {{ font-size: 18pt; margin: 0; letter-spacing: .02em; }}
.sub {{ color: #6B6A63; margin: 2px 0 8px; }}
.top {{ display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1F1F1C; padding-bottom: 6px; margin-bottom: 8px; }}
.name {{ font-size: 9pt; color: #6B6A63; }} .name b {{ display: inline-block; width: 46mm; border-bottom: 1px solid #1F1F1C; }}
table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
th {{ width: 13mm; font-size: 9pt; text-align: left; vertical-align: top; padding: 4px 2px; }}
td {{ border: 1px solid #D9D6CC; vertical-align: top; padding: 4px 5px; height: 40mm; }}
td.rest {{ background: #F4F2EC; }}
.dn {{ display: flex; justify-content: space-between; color: #6B6A63; font-size: 8pt; }}
.box {{ width: 4mm; height: 4mm; border: 1.2px solid #1F1F1C; border-radius: 1mm; }}
.what {{ font-weight: 700; margin: 3px 0 2px; font-size: 9.6pt; }}
.how {{ font-size: 8pt; color: #3A3A36; }}
.min {{ font-size: 8pt; color: #6B6A63; margin-top: 2px; }}
.chip {{ display: inline-block; border: 1.4px solid var(--c); color: var(--c); border-radius: 99px; padding: 0 7px; font-weight: 700; }}
.page2 {{ page-break-before: always; }}
.cols {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9mm; }}
h2 {{ font-size: 11.5pt; margin: 0 0 5px; border-left: 4px solid #1F1F1C; padding-left: 6px; }}
ol, ul {{ margin: 0; padding-left: 1.2em; }} li {{ margin: 0 0 3px; }}
.step b {{ display: block; }}
.note {{ color: #6B6A63; font-size: 8pt; margin-top: 8mm; border-top: 1px solid #D9D6CC; padding-top: 4px; }}
.lenses {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; }}
</style></head><body>
<div class="top"><div><h1>視点レンズ　4週間完成スケジュール</h1><div class="sub">中学受験パス（新小5・新小6）　1日15〜20分 × 4週間　できた日は□にチェック</div></div>
<div class="name">なまえ <b>&nbsp;</b>　　はじめた日 <b style="width:30mm">&nbsp;</b></div></div>
<table>{''.join(rows)}</table>
<div class="page2">
<div class="top"><div><h1>このスケジュールの使い方</h1><div class="sub">問題を「とく速さ」ではなく、「どの道具で見るか決める速さ」をきたえる4週間です。</div></div></div>
<div class="cols">
<div><h2>1日の流れ（4ステップ）</h2><ol class="step">
<li><b>1 さわって学ぶ</b>マスタークラス 約{MC_MIN}分。わな → 例題2つ → 使えないとき → 練習のしかた</li>
<li><b>2 いっしょに発見</b>レンズを選んで、図を指で動かして答えへ</li>
<li><b>3 ひとりで練習</b>{ROUND}問。ヒントなしで、手がかり → 道具 → ドラッグ</li>
<li><b>4 時間をはかって確認</b>{ROUND}問。「くせでやると約N分」と自分の時間をくらべる</li></ol>
<h2 style="margin-top:6mm">8つのレンズ</h2><div class="lenses">{''.join(f'<div>{chip(l)} {labels[l]["hint_ja"]}</div>' for l in ORDER)}</div></div>
<div><h2>保護者の方へ：声かけのコツ</h2><ul>
<li>答えではなく、<b>「どのレンズにした？」「決め手の言葉はどれ？」</b>と聞いてください。</li>
<li>まちがえたときは「どの言葉を見て、そのレンズにした？」。理由が言えれば、次は速くなります。</li>
<li>1日の時間は守り、長くやりすぎないでください。短く毎日が効きます。</li>
<li>「ふりかえり」の日は、苦手な1問を子どもに説明してもらうだけで十分です。</li>
<li>はじめのおすすめレンズ（チェック結果）があれば、そのレンズの日を先にしてもかまいません。</li></ul></div>
<div><h2>はじめと4週目をくらべる</h2><ul>
<li>1日目の「はじめの8問チェック」と28日目の「4週目チェック」は同じ形式（問題は別）です。</li>
<li>保護者レポートに、1問あたりの<b>判断時間（中央値）</b>と、<b>1回目で正しい道具を選べた数</b>が、日付つきでならびます。</li>
<li>はかっているのは「どの道具を使うか決めるまでの時間」です。点数や合否を予測するものではありません。</li>
<li>記録はお使いの端末の中だけに保存されます。</li></ul></div>
</div>
<div class="note">視点レンズ（The Lens）／ Beyond Culture 獨歩文化株式会社　·　domo-ai.com　·　このスケジュールは目安です。学校や塾の予定に合わせて調整してください。</div>
</div></body></html>"""
out = ROOT / "docs/parent/4-week-schedule.html"
out.write_text(html, encoding="utf-8")
print(out)
