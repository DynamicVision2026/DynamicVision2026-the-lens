// 简体中文 translation of copy.ja.ts (follows i18n/glossary.md, mainland usage). Keep in step with the Japanese.
import type * as ja from './copy.ja';
import type { Widen } from '../i18n/lang';

export const LANDING: Widen<typeof ja.LANDING> = {
  logo: '视角透镜',
  nav: { courses: '课程', books: '练习册', faq: '常见问题', owned: '已购买用户' },
  eyebrow: '小升初考试・中考・高考的数学',
  h1: ['先别急着解题，', '换个角度看', '。'],
  sub: '用8个改变看题角度的工具，让解法自己浮现。',
  lead: '孩子遇到难题卡住，往往不是计算能力不够，而是还没想好从哪个角度看这道题。视角透镜就是8个帮助孩子换个角度看题的工具（透镜）。掌握了这些工具的用法，即使是第一次见到的题目，也能看出“用这个透镜就对了”，沿着高效的思路一步步解出来。',
  what: {
    title: '视角透镜是做什么的？',
    steps: [
      ['认识看题的工具', '“围起来”“天平”“面积图”等升学考试中反复出现的8种看题方法，通过大师课（6分钟・配语音讲解）逐一掌握。'],
      ['选择用哪个工具', '看到题目后、动笔之前，先练习选出“用哪个透镜？”。不走弯路，自己找到最高效的角度。'],
      ['用这个工具把题解完', '用选好的透镜，真正把题解出来。数字和图形变了的新题，同样的工具照样适用。'],
    ],
    note: '不是让孩子多背公式，而是一个改变眼前这道题“看法”的工具箱。可以和补习班、学校的学习一起使用。',
  },
  tryFree: '免费试用3天',
  seeCourses: '查看课程和价格',
  heroNote: '无需注册、无需绑卡。第一个透镜可试用3天。',
  bookNews: 'NEW　纸质练习册已在亚马逊上架',
  mapBundle: {
    kicker: '购买课程即赠送',
    title: '卡点地图 年度会员1年（价值¥5,800）',
    body: '作业、练习题、批改后的试卷，拍下来就行。AI会逐题识别所属单元并记录对错，生成每天的错题重做清单和考前复习清单。用视角透镜练习“怎么看题”，用卡点地图记下“在哪里卡住了”。两者结合，让日常学习和考前复习连成一体。',
    cta: '了解卡点地图',
    url: 'https://tsumazuki.domo-ai.com/?src=lens',
  },
  books: {
    title: '纸质练习册，亚马逊也有售。',
    lead: '同样的8个透镜，在纸上练。扫描每章的二维码，即可免费打开该章的大师课（6分钟・配语音讲解）。在书上解题，再到App里动手验证。',
    price: (yen: number) => `¥${yen.toLocaleString('zh-CN')}（含税）`,
    buy: '在亚马逊查看',
    soon: '即将上市',
    note: '在 Amazon.co.jp（日本亚马逊）销售（平装・彩色印刷）。只用书也能完整学完。练习、用时记录和家长报告请使用网页版课程。',
  },
  twoRoads: '同一道题，两条路。',
  roadsLead: '求一个斜放的正方形的面积。如果想先求边长，就会卡住。从外面用长方形“围起来”，只用减法就能解决。',
  trapRoad: '陷阱之路',
  trapPath: '想求边长 → 斜边长度求不出来 → 拆成三角形，又卡住了',
  lensRoad: (lens: string) => `透镜之路（${lens}）`,
  lensPath: '用外框长方形围起来 → 减去四角的直角三角形 → 得出答案',
  roadsPoint: '速度的差距不在天赋，而在于“第一步”的差距。',
  trialHow: '免费试用说明',
  trialSteps: [
    ['选择课程', '从小升初考试、中考、高考中选出适合孩子的课程，点击“免费开始”。无需注册，也无需绑卡。'],
    ['第一个透镜试用3天', '第一个透镜的大师课（6分钟・配语音讲解）和练习题，3天内可以反复使用。'],
    ['想继续就购买', '购买后，8个透镜和全部题目都会解锁（一次买断）。还附赠卡点地图年度会员1年。点击邮件中的链接，马上就能接着学。'],
  ],
  lenses: '8个透镜',
  lensesLead: '不是“要求什么”，而是“从哪里看”。升学考试中反复出现的8种看题方法，一个一个掌握。',
  freeBadge: '可免费试用',
  freeNote: '可免费试用的是各课程的第一个透镜（小升初考试和中考课程为“围起来”，高考课程为“天平”）。',
  lesson: '一个透镜的学习流程',
  lessonSteps: [
    ['大师课（6分钟・配语音讲解）', '对比陷阱之路和透镜之路，用手指拖动图形解2道例题。还会学习“什么时候这个透镜用不上”。'],
    ['练习（5道题）', '没有提示，先选出“用哪个透镜？”，再动手解题。'],
    ['4周后的报告', '向家长发送报告，告诉您孩子选出第一步所用的时间有了怎样的变化。'],
  ],
  lessonNote: '不打分，也不排名。我们只看一件事：孩子能多快选出正确的工具。',
  courses: '选择课程',
  launch: '2026年10月16日（周五）上线',
  course: {
    chugaku_juken: { audience: '五年级～六年级・数学', blurb: '用8个透镜，找到几何题和应用题的“第一步”。涵盖面积、行程、浓度（盐水）、立体图形。' },
    koukou_juken: { audience: '初一～初三・数学', blurb: '坐标系中的几何题和方程组应用题，用比列方程更快的看法来解。直到勾股定理与展开图。' },
    daigaku_juken: { audience: '高一～高三・共通测试／各校单独考试', blurb: '1/6公式、定点、对称点、圆锥展开、概率表格。列式之前，先想“固定什么”。' },
  },
  rows: { content: '内容', term: '期限', free: '免费试用', bonus: '赠品' },
  content: (lessons: number, problems: number) => `${lessons}个透镜・${problems}道题・大师课${lessons}节`,
  term: '一次买断・永久有效',
  bonus: '卡点地图 年度会员1年（价值¥5,800）',
  free: (lens: string) => `“${lens}”试用3天`,
  price: '¥6,800',
  priceNote: '（含税）一次买断',
  buy: '购买此课程',
  trial: '免费开始（3天）',
  parents: '致家长',
  parentsBody: '这不是直接告诉孩子答案的教材，而是练习在求答案之前“怎么看题”。在做补习班作业或历年真题之前，每天10分钟就能用起来。',
  parentsNote: '本产品不保证分数提高或考试合格。',
  safety: '安心使用',
  safetyLines: ['App内不连接AI。', '孩子无需输入姓名等任何个人信息。', '没有广告，没有排行榜。', '只需浏览器即可使用（iPad・手机・电脑）。'],
  access: '已购买用户',
  accessLine: '请在要使用的设备上，打开一次购买后邮件中的“打开课程”链接。课程会在该设备上打开，并直接从免费试用的进度继续。在其他设备上打开同一链接，也可以使用。',
  accessHelp: (email: string) => `如果找不到邮件，请联系 ${email}。`,
  faq: '常见问题',
  faqs: [
    ['免费试用能用到哪些内容？', '所选课程的第一个透镜（大师课和练习题），从开始当天起可使用3天。无需注册，也无需绑卡。试用记录保存在您正在使用的设备上。'],
    ['3天后会怎样？', '不会自动扣费。如需继续，请购买课程。打开邮件中的链接，在同一台设备上即可从试用进度接着学。'],
    ['可以退款吗？', '购买后8天以内，且购买后从未打开过任何课程的，我们将全额退款。详情请参阅《特定商业交易法》相关标示。'],
    ['几年级可以开始用？', '大致参考：小升初通行证适合五年级～六年级，中考通行证适合初一～初三，高考通行证适合高一～高三。'],
    ['会自动续费吗？', '不会。购买时只需付款一次（一次买断），永久有效。'],
    ['卡点地图也是附赠的吗？', '是的。无论购买哪门课程，都可以免费使用卡点地图（只需拍下作业和试卷，就能按单元记录对错、生成考前复习清单的App）年度会员1年（单独购买为¥5,800／年）。可通过订单确认邮件中的按钮开通。'],
    ['可以在哪些设备上使用？', 'iPad、手机、电脑的浏览器均可使用，无需下载App。'],
    ['支持哪些付款方式？', '支持信用卡（Visa・Mastercard・American Express・JCB）、Apple Pay、Google Pay、Shop Pay、PayPal。'],
  ],
  operator: '运营：Beyond Culture 獨歩文化株式会社',
  voice: '语音 VOICEVOX:春日部つむぎ',
  top: '返回 domo-ai.com 首页',
};

export const OPEN: Widen<typeof ja.OPEN> = {
  wrong: '链接无效。请重新打开购买时邮件中的链接。',
  help: '如果无法打开，请通过以下方式联系我们：',
  opening: '正在打开课程…',
};

export const SIGNUP: Widen<typeof ja.SIGNUP> = {
  title: '免费版后续内容和新透镜上线时，我们会通过邮件通知您',
  consent: '注册即表示您同意接收视角透镜发送的通知邮件。可随时退订。',
};

export const FOOTER: Widen<typeof ja.FOOTER> = {
  privacy: '隐私',
  tokushoho: '《特定商业交易法》相关标示',
  contact: '联系我们',
  company: '运营公司',
  external: '关于外部数据传输',
};

export const EXTERNAL: Widen<typeof ja.EXTERNAL> = {
  lede: '为了改进课程，本网站会将您的使用情况发送给以下企业。',
  rows: [
    ['接收方', 'Google LLC（Google Analytics）'],
    ['发送的信息', '浏览的页面、点击的按钮、使用时长、是否通过书中的二维码访问，以及已购买用户的订单号。不会发送姓名、邮箱地址以及孩子输入的内容。'],
    ['目的', '用于改进课程（了解哪些页面浏览较多、课程的使用程度）。'],
    ['是否用于广告', '不用于广告。'],
  ],
  optOut: '如需停止发送，请使用 Google Analytics 停用浏览器插件。',
  optOutTitle: '停止发送',
  optOutUrl: 'https://tools.google.com/dlpage/gaoptout?hl=zh-CN',
  google: 'Google 隐私权政策',
  googleUrl: 'https://policies.google.com/privacy?hl=zh-CN',
};

export const PRIVACY: Widen<typeof ja.PRIVACY> = [
  '学习记录（解题用时和次数）只保存在您的设备中。',
  '我们不收集孩子的姓名等个人信息。',
  '购买时的姓名、邮箱地址和支付信息仅由 Shopify（支付平台）处理，不会传到本App。',
  '关于网站使用情况的统计，请参阅“关于外部数据传输”。',
];

export const PROPOSED: Widen<typeof ja.PROPOSED> = {
  emailLabel: '邮箱地址',
  signupButton: '注册',
  signupSent: '已收到您的注册。请在打开的页面中完成注册。',
  checkLink: '用哪个透镜？小测验（免费・8道题）',
};
