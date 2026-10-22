// English translation of copy.ja.ts (follows i18n/glossary.md). Keep in step with the Japanese.
import type * as ja from './copy.ja';
import type { Widen } from '../i18n/lang';

export const LANDING: Widen<typeof ja.LANDING> = {
  logo: 'The Lens',
  nav: { courses: 'Courses', books: 'Workbooks', faq: 'FAQ', owned: 'Already purchased' },
  eyebrow: 'Math for middle-school, high-school and university entrance exams',
  h1: ['Before the method, ', 'change how you see it', '.'],
  sub: 'Eight tools that change how you look at a problem, so the way to solve it comes into view.',
  lead: 'When a child gets stuck on a hard problem, it is usually not because their arithmetic is weak. It is because they have not decided which angle to look at it from. The Lens gives them eight tools (lenses) for seeing a problem from a different angle. Once they know how to use these tools, even a problem they have never seen before tells them "this is the lens to use", and they can work through it by an efficient path.',
  what: {
    title: 'What does The Lens do?',
    steps: [
      ['Learn the tools for seeing', 'Eight ways of seeing that come up again and again on entrance exams, such as Enclose, Balance and Area Diagram. Your child learns them one at a time through master classes (6 min, with narration).'],
      ['Choose which tool to use', 'Practice looking at a problem and choosing "Which lens?" before starting to solve it. Instead of a roundabout method, your child finds the efficient angle on their own.'],
      ['Solve it all the way with that tool', 'Your child actually solves the problem with the lens they chose. The same tool works on new problems where the numbers and shapes have changed.'],
    ],
    note: 'Not more formulas to memorize, but a toolbox that changes how your child sees the problem in front of them. It works alongside cram school and schoolwork.',
  },
  tryFree: 'Try free for 3 days',
  seeCourses: 'See courses and prices',
  heroNote: 'No sign-up, no card needed. Try the first lens for 3 days.',
  bookNews: 'NEW  Printed workbooks now on Amazon',
  mapBundle: {
    kicker: 'Included with every course',
    title: 'Stumble Map annual plan, 1 year (a ¥5,800 value)',
    body: 'Just take a photo of homework, drills or graded tests. AI identifies the unit (topic) of each problem, records ✓ and ✕, and builds a daily redo list and a review list for before the test. Practice "how to see" with The Lens, and keep track of "where they stumbled" with Stumble Map. Together, they connect everyday study with test preparation.',
    cta: 'See Stumble Map',
    url: 'https://tsumazuki.domo-ai.com/?src=lens',
  },
  books: {
    title: 'Printed workbooks, on Amazon too.',
    lead: 'The same eight lenses, on paper. The QR code in each chapter opens that chapter\'s master class (6 min, with narration) for free. Solve in the book, then move things around in the app to check.',
    price: (yen: number) => `¥${yen.toLocaleString('en-US')} (tax incl.)`,
    buy: 'View on Amazon',
    soon: 'Coming soon',
    note: 'Sold on Amazon.co.jp (paperback, full color). The book works on its own from start to finish. Practice, time tracking and parent reports are in the web course.',
  },
  twoRoads: 'Same problem, two roads.',
  roadsLead: 'The area of a tilted square. Try to find the length of a side, and you get stuck. "Enclose" it in a rectangle from the outside, and it is done with subtraction alone.',
  trapRoad: 'The trap road',
  trapPath: 'Try to find the side length → can\'t find the slanted length → split it into triangles, and get stuck again',
  lensRoad: (lens: string) => `The lens road (${lens})`,
  lensPath: 'Enclose it in an outer rectangle → subtract the right triangles in the corners → answer',
  roadsPoint: 'The difference in speed is not talent. It is the difference in the first move.',
  trialHow: 'How the free trial works',
  trialSteps: [
    ['Choose a course', 'Choose the course that fits your child, for the middle-school, high-school or university entrance exam, and tap "Start free". No sign-up or card needed.'],
    ['The first lens for 3 days', 'Use the first lens\'s master class (6 min, with narration) and practice problems as many times as you like for 3 days.'],
    ['To continue, purchase', 'Purchasing unlocks all eight lenses and every problem (one-time purchase). It also includes 1 year of the Stumble Map annual plan. Use the link in your email to pick up right where you left off.'],
  ],
  lenses: 'The 8 lenses',
  lensesLead: 'Not "what are we looking for?" but "where do we look from?" Your child learns, one at a time, eight ways of seeing that come up again and again on entrance exams.',
  freeBadge: 'Try free',
  freeNote: 'The free trial covers the first lens of each course (Enclose for the middle-school and high-school entrance exams, Balance for the university entrance exam).',
  lesson: 'How one lens works',
  lessonSteps: [
    ['Master class (6 min, with narration)', 'Compare the trap road with the lens road, then solve two examples by moving the figures with a finger. Your child also learns "when this lens doesn\'t work".'],
    ['Practice (5 problems)', 'With no hints, choose "Which lens?" first, then solve.'],
    ['Report after 4 weeks', 'Parents receive a report on how the time it takes to choose the first move has changed.'],
  ],
  lessonNote: 'No scores or rankings. The only thing we look at is how quickly your child chose the right tool.',
  courses: 'Choose a course',
  launch: 'Launched Friday, October 16, 2026',
  course: {
    chugaku_juken: { audience: 'Grade 5–6 · Math', blurb: 'The first move on geometry and word problems, with eight lenses. Area, speed, salt-water concentration, and solid figures.' },
    koukou_juken: { audience: 'Grade 7–9 · Math', blurb: 'Coordinate geometry and simultaneous-equation word problems, seen faster than with equations. Up to Pythagorean theorem problems on nets.' },
    daigaku_juken: { audience: 'Grade 10–12 · Common Test / university exams', blurb: 'The 1/6 formula, fixed points, symmetric points, cone nets, probability tables. Before writing an equation: "What do I hold fixed?"' },
  },
  rows: { content: 'Contents', term: 'Access', free: 'Free trial', bonus: 'Bonus' },
  content: (lessons: number, problems: number) => `${lessons} lenses · ${problems} problems · ${lessons} master classes`,
  term: 'One-time purchase, no expiry',
  bonus: 'Stumble Map annual plan, 1 year (a ¥5,800 value)',
  free: (lens: string) => `"${lens}" for 3 days`,
  price: '¥6,800',
  priceNote: '(tax incl.) one-time purchase',
  buy: 'Buy this course',
  trial: 'Start free (3 days)',
  parents: 'For parents',
  parentsBody: 'This is not a program that hands out answers. It practices "how to see" a problem before going for the answer. Use it from 10 minutes a day, before cram-school homework or past exam papers.',
  parentsNote: 'We do not guarantee scores or exam results.',
  safety: 'For peace of mind',
  safetyLines: ['The app does not connect to AI.', 'Your child is never asked to enter their name or other personal information.', 'No ads, no rankings.', 'Works in the browser alone (iPad, smartphone, PC).'],
  access: 'Already purchased',
  accessLine: 'Open the "Open course" link in your purchase email once on the device you will use. The course opens on that device, and your child continues straight from where the free trial left off. Open the same link on another device to use it there too.',
  accessHelp: (email: string) => `If you can't find the email, please contact ${email}.`,
  faq: 'FAQ',
  faqs: [
    ['How much can I use in the free trial?', 'You can use the first lens of the course you chose (master class and practice problems) for 3 days from the day you start. No sign-up or card needed. Trial progress is saved on the device you are using.'],
    ['What happens after 3 days?', 'You will never be charged automatically. If you want to continue, purchase the course. Open the link in your email, and on the same device you can continue from where the trial left off.'],
    ['Can I get a refund?', 'If it is within 8 days of purchase and you have not opened any lesson since purchasing, we will refund you in full. For details, see the Legal Notice (Specified Commercial Transactions Act).'],
    ['From what grade can it be used?', 'As a guide: the Middle-School Exam Pass is for Grade 5–6, the High-School Exam Pass for Grade 7–9, and the University Exam Pass for Grade 10–12.'],
    ['Does it renew automatically?', 'No. You pay once at purchase (one-time purchase) and can use it with no expiry.'],
    ['Is Stumble Map included too?', 'Yes. Whichever course you purchase, you can use the Stumble Map annual plan (an app that records ✓ and ✕ by unit and builds a review list for before the test, just from photos of homework and tests) for 1 year at no extra charge (¥5,800/year on its own). Activate it from the button in your order confirmation email.'],
    ['Which devices does it work on?', 'It works in the browser on iPad, smartphones and computers. No app download needed.'],
    ['How can I pay?', 'Credit card (Visa, Mastercard, American Express, JCB), Apple Pay, Google Pay, Shop Pay and PayPal are accepted.'],
  ],
  operator: 'Operated by Beyond Culture 獨歩文化株式会社',
  voice: 'Voice: VOICEVOX:春日部つむぎ',
  top: 'Back to domo-ai.com',
};

export const OPEN: Widen<typeof ja.OPEN> = {
  wrong: 'This link is not valid. Please open the link in your purchase email again.',
  help: 'If it won\'t open, please contact us here:',
  opening: 'Opening your course…',
};

export const SIGNUP: Widen<typeof ja.SIGNUP> = {
  title: 'Get an email about continuing the free version and when new lenses are released',
  consent: 'By signing up, you agree to receive email updates from The Lens. You can unsubscribe at any time.',
};

export const FOOTER: Widen<typeof ja.FOOTER> = {
  privacy: 'Privacy',
  tokushoho: 'Legal Notice (Specified Commercial Transactions Act)',
  contact: 'Contact',
  company: 'Company',
  external: 'External data transmission',
};

export const EXTERNAL: Widen<typeof ja.EXTERNAL> = {
  lede: 'To improve the course, this site sends information about how it is used to the following company.',
  rows: [
    ['Recipient', 'Google LLC (Google Analytics)'],
    ['Information sent', 'Pages viewed, buttons tapped, time spent, whether you arrived from a book\'s QR code, and, for purchasers, the order number. Names, email addresses and anything your child types are never sent.'],
    ['Purpose', 'To improve the course (to learn which pages are viewed most and how much the course is used).'],
    ['Use for advertising', 'Not used for advertising.'],
  ],
  optOut: 'To stop this transmission, please use the Google Analytics Opt-out Browser Add-on.',
  optOutTitle: 'Stopping transmission',
  optOutUrl: 'https://tools.google.com/dlpage/gaoptout?hl=en',
  google: 'Google Privacy Policy',
  googleUrl: 'https://policies.google.com/privacy?hl=en',
};

export const PRIVACY: Widen<typeof ja.PRIVACY> = [
  'Learning records (time spent and number of attempts) are saved only on your device.',
  'We do not collect your child\'s name or other personal information.',
  'Your name, email address and payment details at purchase are handled only by Shopify (payments) and never reach this app.',
  'For how site usage is measured, see "External data transmission".',
];

export const PROPOSED: Widen<typeof ja.PROPOSED> = {
  emailLabel: 'Email address',
  signupButton: 'Sign up',
  signupSent: 'We\'ve received your sign-up. Please complete it on the page that opened.',
  checkLink: 'Which lens? check (free, 8 problems)',
};
