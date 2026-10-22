// 繁體中文 translation of copy.ja.ts (follows i18n/glossary.md, Taiwan usage). Keep in step with the Japanese.
import type * as ja from './copy.ja';
import type { Widen } from '../i18n/lang';

export const LANDING: Widen<typeof ja.LANDING> = {
  logo: '視角透鏡',
  nav: { courses: '課程', books: '練習本', faq: '常見問題', owned: '已購買的使用者' },
  eyebrow: '國中・高中・大學入學考試的數學',
  h1: ['先別急著解題，', '換個角度看', '。'],
  sub: '用8個改變看題角度的工具，讓解法自然浮現。',
  lead: '孩子遇到難題卡住，往往不是計算能力不夠，而是還沒決定要從哪個角度看這道題。視角透鏡就是8個幫助孩子換個角度看題的工具（透鏡）。學會這些工具的用法，即使是第一次看到的題目，也能看出「用這個透鏡就對了」，沿著有效率的思路一步步解出來。',
  what: {
    title: '視角透鏡是做什麼的？',
    steps: [
      ['認識看題的工具', '「圍起來」「天平」「面積圖」等入學考試中反覆出現的8種看題方法，透過大師課（6分鐘・附語音講解）一個一個學會。'],
      ['選擇要用哪個工具', '看到題目後、動筆之前，先練習選出「用哪個透鏡？」。不繞遠路，自己找到最有效率的角度。'],
      ['用這個工具把題目解完', '用選好的透鏡，實際把題目解出來。數字和圖形改變了的新題目，同樣的工具一樣適用。'],
    ],
    note: '不是要孩子背更多公式，而是一個改變眼前這道題「看法」的工具箱。可以搭配補習班和學校的課業一起使用。',
  },
  tryFree: '免費試用3天',
  seeCourses: '查看課程與價格',
  heroNote: '不用註冊、不用信用卡。第一個透鏡可試用3天。',
  bookNews: 'NEW　紙本練習本已在 Amazon 開賣',
  mapBundle: {
    kicker: '購買課程即贈送',
    title: '卡點地圖 年度方案1年（價值¥5,800）',
    body: '作業、練習卷、改好發回的考卷，拍下來就好。AI 會逐題判斷所屬單元並記錄對錯，製作每天的錯題重做清單和考前複習清單。用視角透鏡練習「怎麼看題」，用卡點地圖記下「在哪裡卡住」。兩者搭配，讓平常的學習和考前準備串連起來。',
    cta: '了解卡點地圖',
    url: 'https://tsumazuki.domo-ai.com/?src=lens',
  },
  books: {
    title: '紙本練習本，Amazon 也買得到。',
    lead: '同樣的8個透鏡，在紙上練習。掃描每章的 QR Code，就能免費打開該章的大師課（6分鐘・附語音講解）。在書上解題，再到 App 裡動手確認。',
    price: (yen: number) => `¥${yen.toLocaleString('zh-TW')}（含稅）`,
    buy: '到 Amazon 查看',
    soon: '即將上市',
    note: '於 Amazon.co.jp（日本亞馬遜）販售（平裝・全彩）。只用書也能完整學完。練習、計時紀錄和家長報告請使用網頁版課程。',
  },
  twoRoads: '同一道題，兩條路。',
  roadsLead: '求一個斜放的正方形的面積。如果想先求邊長，就會卡住。從外面用長方形「圍起來」，只用減法就能解決。',
  trapRoad: '陷阱之路',
  trapPath: '想求邊長 → 斜邊長度求不出來 → 切成三角形，又卡住了',
  lensRoad: (lens: string) => `透鏡之路（${lens}）`,
  lensPath: '用外框長方形圍起來 → 減去四個角的直角三角形 → 得到答案',
  roadsPoint: '速度的差別不在天分，而在「第一步」的差別。',
  trialHow: '免費試用說明',
  trialSteps: [
    ['選擇課程', '從國中入學考試、高中入學考試、大學入學考試中，選出適合孩子的課程，點選「免費開始」。不用註冊，也不用信用卡。'],
    ['第一個透鏡試用3天', '第一個透鏡的大師課（6分鐘・附語音講解）和練習題，3天內可以不限次數使用。'],
    ['想繼續就購買', '購買後，8個透鏡和所有題目都會開放（一次買斷）。另外附贈卡點地圖年度方案1年。點選信件中的連結，馬上就能接著學。'],
  ],
  lenses: '8個透鏡',
  lensesLead: '不是「要求什麼」，而是「從哪裡看」。入學考試中反覆出現的8種看題方法，一個一個學會。',
  freeBadge: '可免費試用',
  freeNote: '可免費試用的是各課程的第一個透鏡（國中、高中入學考試課程為「圍起來」，大學入學考試課程為「天平」）。',
  lesson: '一個透鏡的學習流程',
  lessonSteps: [
    ['大師課（6分鐘・附語音講解）', '比較陷阱之路和透鏡之路，用手指拖動圖形解2道例題。也會學到「什麼時候這個透鏡派不上用場」。'],
    ['練習（5題）', '沒有提示，先選出「用哪個透鏡？」再動手解題。'],
    ['4週後的報告', '寄送報告給家長，說明孩子選出第一步所需的時間有什麼變化。'],
  ],
  lessonNote: '不打分數，也不排名。我們只看一件事：孩子能多快選出正確的工具。',
  courses: '選擇課程',
  launch: '2026年10月16日（週五）上線',
  course: {
    chugaku_juken: { audience: '五年級～六年級・數學', blurb: '用8個透鏡，找到幾何題和應用題的「第一步」。涵蓋面積、速率、濃度（食鹽水）、立體圖形。' },
    koukou_juken: { audience: '國一～國三・數學', blurb: '坐標平面上的幾何題和聯立方程式應用題，用比列方程式更快的看法來解。一路到畢氏定理與展開圖。' },
    daigaku_juken: { audience: '高一～高三・共通測驗／各校個別考試', blurb: '1/6公式、定點、對稱點、圓錐展開、機率表格。列式之前，先想「要固定什麼」。' },
  },
  rows: { content: '內容', term: '期限', free: '免費試用', bonus: '贈品' },
  content: (lessons: number, problems: number) => `${lessons}個透鏡・${problems}題・大師課${lessons}堂`,
  term: '一次買斷・無使用期限',
  bonus: '卡點地圖 年度方案1年（價值¥5,800）',
  free: (lens: string) => `「${lens}」試用3天`,
  price: '¥6,800',
  priceNote: '（含稅）一次買斷',
  buy: '購買這個課程',
  trial: '免費開始（3天）',
  parents: '給家長',
  parentsBody: '這不是直接告訴孩子答案的教材，而是練習在找答案之前「怎麼看題」。在寫補習班作業或考古題之前，每天10分鐘就能開始使用。',
  parentsNote: '本產品不保證分數提升或考試錄取。',
  safety: '安心使用',
  safetyLines: ['App 內不會連線到 AI。', '孩子不需要輸入姓名等任何個人資料。', '沒有廣告，也沒有排行榜。', '只要瀏覽器就能使用（iPad・手機・電腦）。'],
  access: '已購買的使用者',
  accessLine: '請在要使用的裝置上，打開一次購買後信件中的「打開課程」連結。課程會在該裝置上開啟，並直接從免費試用的進度繼續。在其他裝置打開同一個連結，也可以使用。',
  accessHelp: (email: string) => `找不到信件時，請聯絡 ${email}。`,
  faq: '常見問題',
  faqs: [
    ['免費試用可以用到哪些內容？', '所選課程的第一個透鏡（大師課和練習題），從開始當天起可使用3天。不用註冊，也不用信用卡。試用紀錄會儲存在您使用的裝置上。'],
    ['3天後會怎麼樣？', '不會自動收費。想繼續的話，請購買課程。打開信件中的連結，在同一台裝置上就能從試用進度接著學。'],
    ['可以退款嗎？', '購買後8天內，且購買後從未打開過任何課程的情況下，我們將全額退款。詳情請參閱「特定商業交易法標示」。'],
    ['幾年級可以開始用？', '大致參考：國中入學通行證適合五年級～六年級，高中入學通行證適合國一～國三，大學入學通行證適合高一～高三。'],
    ['會自動續約嗎？', '不會。購買時只需付款一次（一次買斷），沒有使用期限。'],
    ['也會附贈卡點地圖嗎？', '會的。不論購買哪個課程，都可以免費使用卡點地圖（只要拍下作業和考卷，就能依單元記錄對錯、製作考前複習清單的 App）年度方案1年（單獨購買為¥5,800／年）。可從訂單確認信中的按鈕啟用。'],
    ['可以在哪些裝置上使用？', 'iPad、手機、電腦的瀏覽器都能使用，不需要下載 App。'],
    ['有哪些付款方式？', '可使用信用卡（Visa・Mastercard・American Express・JCB）、Apple Pay、Google Pay、Shop Pay、PayPal。'],
  ],
  operator: '營運：Beyond Culture 獨歩文化株式会社',
  voice: '語音 VOICEVOX:春日部つむぎ',
  top: '回到 domo-ai.com 首頁',
};

export const OPEN: Widen<typeof ja.OPEN> = {
  wrong: '連結不正確。請重新打開購買時信件中的連結。',
  help: '無法打開時，請透過以下方式聯絡我們：',
  opening: '正在打開課程…',
};

export const SIGNUP: Widen<typeof ja.SIGNUP> = {
  title: '免費版的後續內容和新透鏡上線時，我們會寄信通知您',
  consent: '註冊即表示您同意收到視角透鏡寄送的通知信。可隨時取消訂閱。',
};

export const FOOTER: Widen<typeof ja.FOOTER> = {
  privacy: '隱私權',
  tokushoho: '特定商業交易法標示',
  contact: '聯絡我們',
  company: '營運公司',
  external: '關於外部資料傳送',
};

export const EXTERNAL: Widen<typeof ja.EXTERNAL> = {
  lede: '為了改善課程，本網站會將您的使用情況傳送給以下業者。',
  rows: [
    ['傳送對象', 'Google LLC（Google Analytics）'],
    ['傳送的資訊', '瀏覽的頁面、點選的按鈕、使用時間、是否從書中的 QR Code 進入，以及已購買者的訂單編號。不會傳送姓名、電子郵件地址以及孩子輸入的內容。'],
    ['目的', '用於改善課程（了解哪些頁面較常被瀏覽、課程的使用程度）。'],
    ['是否用於廣告', '不會用於廣告。'],
  ],
  optOut: '若要停止傳送，請使用 Google Analytics 不透露資訊瀏覽器外掛程式。',
  optOutTitle: '停止傳送',
  optOutUrl: 'https://tools.google.com/dlpage/gaoptout?hl=zh-TW',
  google: 'Google 隱私權政策',
  googleUrl: 'https://policies.google.com/privacy?hl=zh-TW',
};

export const PRIVACY: Widen<typeof ja.PRIVACY> = [
  '學習紀錄（解題時間和次數）只會儲存在您的裝置中。',
  '我們不會蒐集孩子的姓名等個人資料。',
  '購買時的姓名、電子郵件地址和付款資訊只由 Shopify（金流）處理，不會傳到這個 App。',
  '關於網站使用情況的統計，請參閱「關於外部資料傳送」。',
];

export const PROPOSED: Widen<typeof ja.PROPOSED> = {
  emailLabel: '電子郵件地址',
  signupButton: '註冊',
  signupSent: '已收到您的註冊。請在開啟的頁面上完成註冊。',
  checkLink: '用哪個透鏡？小測驗（免費・8題）',
};
