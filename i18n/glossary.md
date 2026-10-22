# Translation glossary — ja → en / zh-Hans / zh-Hant

Used for every translated string in 視点レンズ (apps/trainer, cards, catalog) and つまずきマップ (apps/snap).
zh-Hans follows mainland-China school usage; zh-Hant follows Taiwan school usage.

## Products
| ja | en | zh-Hans | zh-Hant |
|---|---|---|---|
| 視点レンズ | The Lens | 视角透镜 | 視角透鏡 |
| レンズ | lens | 透镜 | 透鏡 |
| つまずきマップ | Stumble Map | 卡点地图 | 卡點地圖 |
| ナゼホリ | Nazehori | Nazehori | Nazehori |
| domo-ai / Beyond Culture | unchanged | unchanged | unchanged |

## The lenses (keep exactly these names everywhere)
| id | ja | en | zh-Hans | zh-Hant |
|---|---|---|---|---|
| enclose | 囲む | Enclose | 围起来 | 圍起來 |
| slide | 等積変形 | Equal-Area Slide | 等积变形 | 等積變形 |
| unfold | 展開 | Unfold | 展开 | 展開 |
| freeze | 止める | Freeze | 定住一方 | 定住一方 |
| balance | てんびん | Balance | 天平 | 天平 |
| area | 面積図 | Area Diagram | 面积图 | 面積圖 |
| mirror | 折り返す | Reflect | 翻折 | 翻折 |
| constant | 和差一定 | Constant Sum/Difference | 和差不变 | 和差不變 |
| direct | そのまま計算 | Direct Calculation | 直接计算 | 直接計算 |

## Grades (no country label)
| ja | en | zh-Hans | zh-Hant |
|---|---|---|---|
| 小1…小6 | Grade 1…Grade 6 | 一年级…六年级 | 一年級…六年級 |
| 中1 / 中2 / 中3 | Grade 7 / 8 / 9 | 初一 / 初二 / 初三 | 國一 / 國二 / 國三 |
| 高1 / 高2 / 高3 | Grade 10 / 11 / 12 | 高一 / 高二 / 高三 | 高一 / 高二 / 高三 |
| 小学校 / 中学校 / 高校 | elementary / middle school / high school | 小学 / 初中 / 高中 | 國小 / 國中 / 高中 |
| 大学 | university | 大学 | 大學 |

## Exams and school words
| ja | en | zh-Hans | zh-Hant |
|---|---|---|---|
| 中学受験 | middle-school entrance exam | 小升初考试 | 國中入學考試 |
| 高校受験 | high-school entrance exam | 中考 | 高中入學考試（會考） |
| 大学受験 | university entrance exam | 高考 | 大學入學考試（學測） |
| 中学受験パス / 高校受験パス / 大学受験パス | Middle-School Exam Pass / High-School Exam Pass / University Exam Pass | 小升初通行证 / 中考通行证 / 高考通行证 | 國中入學通行證 / 高中入學通行證 / 大學入學通行證 |
| 塾 | cram school | 补习班 | 補習班 |
| 入試 | entrance exam | 升学考试 | 入學考試 |
| 単元 | unit (topic) | 单元 | 單元 |
| 定期テスト | school test | 期中/期末考试 | 段考 |
| テスト前 | before the test | 考前 | 考前 |
| 復習 | review | 复习 | 複習 |
| 解き直す | redo / solve again | 重做 | 重做 |
| まちがい / ✕ | mistake / ✕ | 错题 / ✕ | 錯題 / ✕ |
| 保護者 | parent | 家长 | 家長 |

## Money and units
- Keep yen as the currency, never convert: 円 → "yen" (en), 日元 (zh-Hans), 日圓 (zh-Hant). 50円玉 → "50-yen coin" / 50日元硬币 / 50日圓硬幣. Prices like ¥6,800（税込） → ¥6,800 (tax incl.) / ¥6,800（含税）/ ¥6,800（含稅）.
- Metric units stay as written (cm, cm², m, km, L, dL, g, kg, km/h, 分 → min / 分钟 / 分鐘, 秒 → s / 秒 / 秒).
- Counter/unit fields (`names.counter`, `unit`, `problem.unit`, `diagram.unit`) are appended straight after a number in the app (`${n}${unit}`): in English start a word unit with a space (" coins", " people", " yen", " years old"); symbols get a space too (" cm"). In Chinese use the natural measure word with no space (枚, 个/個, 人, 岁/歲, 日元/日圓).

## Style
- Keep every number, formula and symbol exactly: ×, ÷, −, ＝/=, □, x, y, fractions a/b, √, π, ², brackets, line breaks (\n), placeholders like {n} {lens} {grade}.
- Same register as the Japanese: friendly and plain for children and parents; short UI labels stay short.
- Names of people in problems: keep the Japanese given name in romaji (en) or the same kanji (zh) — e.g. たろう → Taro / 太郎.
- Japanese-only items (furigana hints, kanji counters) are rendered naturally, not literally.
