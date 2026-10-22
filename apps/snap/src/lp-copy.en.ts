import type * as ja from "./lp-copy.ja";
import type { Widen } from "./lib/lang";

export const lp: Widen<typeof ja.lp> = {
  meta: {
    title: "Stumble Map | Just snap a photo and know what to review (Grade 1–Grade 12 math)",
    description:
      "Just snap your homework, drills or graded tests. AI identifies the unit of each problem, records ○ and ✕, and builds your daily redo list plus a \"Tonight's Plan\" before the test. Math for Grade 1 through Grade 12. Try up to 30 photos for free.",
  },
  nav: [
    { href: "#map", label: "Features" },
    { href: "#video", label: "Video" },
    { href: "#how", label: "How it works" },
    { href: "#price", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ],
  hero: {
    eyebrow: "Math for Grade 1 through Grade 12",
    pre: "For daily review, and before the test.",
    title: ["Just snap a photo,", "and know what to review."],
    body:
      "One photo of a graded test. One photo of tonight's homework. The night before the test, \"Tonight's Plan\" appears. AI identifies the unit of each problem, records ○ and ✕, and builds up your child's very own Stumble Map.",
    start: "Start for free",
    startNote: "No sign-up. Snap everything free until the next test (30 photos)",
    waitlist: "Join the waitlist (free)",
    waitlistNote: "We are currently in an invitation-only trial. We will email you when it opens to everyone.",
    price: "See pricing",
    badges: ["No sign-up", "Photos are not kept on our server after reading", "Works on smartphones and iPad", "110 units · Grade 1–Grade 12"],
    imgAlt: "Stumble Map's unit map (iPad)",
    phoneAlt: "Reading results confirmation screen (smartphone)",
  },
  video: {
    kicker: "3-minute how-to video",
    heading: "See how much one photo tells you",
    alt: "Stumble Map how-to guide video (about 3 minutes)",
    note: "With audio · about 3 minutes. No sign-up needed; try up to 30 photos for free.",
  },
  pain: {
    heading: "Does this sound familiar?",
    items: [
      { who: "Daily review", text: "The homework is done. But which problems should be redone?" },
      { who: "Before the test", text: "So much to cover, so little time. Where do we even start?" },
      { who: "Parents", text: "I want to go over the mistakes together, but I can't find the worksheet." },
    ],
    answer: "Stumble Map is an app that answers that \"what?\"",
  },
  map: {
    kicker: "Unit map",
    heading: "110 math units, all on one continent.",
    body:
      "From the Grade 1 coastline to the Grade 12 summit. The units of the national curriculum spread across the map, and the units of the problems you snap rise up. One look at the colors shows where your child is strong and where they are stumbling.",
    ladderHeading: "Colors show the stage of understanding",
    ladder: [
      { name: "Not yet", tone: "grey", note: "Units not snapped yet" },
      { name: "In progress", tone: "red", note: "Has ✕ not yet redone" },
      { name: "Reviewed", tone: "green", note: "Every ✕ has been redone" },
      { name: "Mastered", tone: "gold", note: "All ○ on the latest page" },
      { name: "Retained", tone: "purple", note: "Still ○ two weeks later" },
    ],
    imgAlt: "A continent map spreading out units from elementary to high school",
  },
  how: {
    kicker: "How it works",
    heading: "Three simple steps",
    steps: [
      { title: "Snap", body: "Take a photo of a whole worksheet. Works for homework, drills, tests and cram school worksheets.", img: "phone-snap", alt: "Camera screen" },
      {
        title: "Check",
        body: "AI reads each problem one by one and records its unit and ○ or ✕. If the teacher has already marked it, those marks come first; AI judges any unmarked problems. You can check and fix everything before saving.",
        img: "phone-confirm",
        alt: "Reading results confirmation screen",
      },
      { title: "See it on the map", body: "When you save, that unit rises up on the map. Tap any time to look back at the problems you got wrong.", img: "phone-saved", alt: "Unit map after saving" },
    ],
  },
  features: {
    kicker: "Key features",
    heading: "From daily redos to a plan before the test",
    items: [
      {
        title: "Before-the-test mode: \"Tonight's Plan\"",
        body: "Just choose the test date and what it covers. You get a list of \"① Problems to redo first\", \"② Where the stumbling starts\" and \"③ Quick checks, just in case\", each with an estimated time. You can check the answers right there, too.",
        img: "exam-plan",
        alt: "Tonight's Plan in before-the-test mode",
      },
      {
        title: "Trace stumbles back to earlier grades",
        body: "The cause of a stumble often lies in an earlier grade. For example, if your child stumbles on \"averages\" in Grade 5, the app points to the Grade 4 units it builds on.",
        img: "roots",
        alt: "Screen tracing back to earlier-grade units",
      },
      {
        title: "A record for every unit",
        body: "Tap a unit to look back at past pages, mistakes and the photos you took. The stage of understanding is shown on a 5-step scale.",
        img: "unit-sheet",
        alt: "Unit record",
      },
      {
        title: "Share with parents on one page",
        body: "Tonight's Plan and progress are summed up on one page you can send to family with the share button. Check your child's \"to-do for today\" together.",
        img: "exam-summary",
        alt: "Summary for sharing",
      },
    ],
  },
  scenes: {
    heading: "Made for two moments",
    items: [
      { title: "Daily review", body: "Snap the worksheets that come back and redo the ✕ problems. Each time you check one off, the map turns your color.", tone: "cyan" },
      { title: "Before the test", body: "Choose the test date and what it covers, and tonight's to-do is clear at a glance. You can also review stumbles from earlier grades all at once.", tone: "accent" },
    ],
  },
  price: {
    kicker: "Pricing",
    heading: "Plans",
    note: "All prices include tax.",
    free: {
      name: "Free trial",
      price: "¥0",
      unit: "",
      lines: [
        "Snap everything free until the next test.",
        "30 photos is just right for one test's worth of homework, drills and graded tests.",
        "Try everything up to \"Tonight's Plan\" the night before the test, with no payment.",
        "No sign-up or payment details needed (the trial is one-time only and does not reset monthly)",
      ],
      cta: "Start for free",
    },
    annual: {
      name: "Annual Plan",
      badge: "Recommended",
      price: "¥5,800",
      unit: " / year (tax incl.)",
      perDay: "About 480 yen per month",
      lines: ["Up to 200 photos a month (resets on the 1st)", "Up to 3 family devices", "One payment for the full year; no automatic renewal", "Free for one year for families who purchased The Lens."],
      cta: "Buy the Annual Plan",
    },
    after: "After purchase, open \"Plan\" → \"Already purchased\" in the app and enter the order number from your order confirmation email and the email address you used to buy. Your plan will then be activated.",
    bundle: {
      kicker: "Together with The Lens",
      title: "The Lens courses include one year of the Stumble Map Annual Plan",
      body: "The Lens is a math course that changes how you look at a problem before you solve it. Buy any of the three courses and you can use the Stumble Map Annual Plan for one year at no extra cost. Activate it straight from the button in your order confirmation email.",
      courses: [
        { name: "Middle-School Exam Pass", who: "Grade 5–6 · Math" },
        { name: "High-School Exam Pass", who: "Grade 7–9 · Math" },
        { name: "University Exam Pass", who: "Grade 10–12 · Math" },
      ],
      cta: "See The Lens courses",
    },
    pay: "Payment is handled by the Beyond Culture online store (credit card, Apple Pay, Google Pay, PayPal and more).",
  },
  trust: {
    heading: "Use it with peace of mind",
    items: [
      { title: "Photos are not kept on our server after reading", body: "Photos pass through our server once for reading, but they are not kept there after reading is done. They are stored only on your own device. We do not collect your child's name either." },
      { title: "We do not promise higher scores", body: "We don't promise scores. But you won't be stuck wondering what to do tonight. Stumble Map helps with deciding what to review. Working out how to solve the problems is up to your child." },
      { title: "Reading is done by AI", body: "Reading and marking may contain mistakes. You can check the results before saving, and fix the unit or ○/✕ with a single tap." },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      { q: "How much can I use for free?", a: "Snap everything free until the next test. 30 photos is just right for one test's worth of homework, drills and graded tests. You can try everything up to \"Tonight's Plan\" the night before the test, with no payment. No sign-up or payment details needed. The trial is one-time only and does not reset monthly. After you use all 30 photos, your records, unit map and before-the-test plans stay available. To keep snapping, please use the Annual Plan (up to 200 photos a month)." },
      { q: "If I send a photo to an AI, it gives me an explanation. What's the difference?", a: "You can get explanations anywhere. What Stumble Map keeps is a record of \"which unit my child stumbled on, and when.\" Before the test, that record is what really helps." },
      { q: "How much is the Annual Plan, and how do I pay?", a: "The Annual Plan is ¥5,800 (tax incl.), paid once for the full year. You can pay at the Beyond Culture online store by credit card, Apple Pay, Google Pay, PayPal and more." },
      { q: "Does it renew automatically?", a: "No, there is no automatic renewal. You can check the expiry date at any time on the \"Plan\" screen in the app. To keep using it, please purchase again." },
      { q: "Can we use it on several family devices?", a: "The Annual Plan works on up to 3 family devices. For the second device onward, enter the code shown on the Plan screen." },
      { q: "Which grades can use it?", a: "It covers math from Grade 1 through Grade 12. High school years are treated as Grade 10, Grade 11 and Grade 12 separately. You can change the grade later." },
      { q: "Which textbooks and worksheets does it support?", a: "Because units are organized by the national curriculum rather than by textbook publisher, it works with any textbook. You can also snap school tests, store-bought drills and cram school worksheets." },
      { q: "How are my photos and personal information handled?", a: "Photos are saved on your own device (in the browser). They pass through our server once for reading, but are not kept on the server after reading. We do not collect your child's name, and no account sign-up is needed. For details, please see our Privacy Policy." },
      { q: "How accurate is the reading?", a: "Before saving, you can check what was read on screen, and fix the unit or ○/✕ with a single tap. If a photo is too dark, we may ask you to retake it." },
      { q: "What devices are recommended?", a: "We recommend the latest version of iPhone/iPad (Safari) or Android (Chrome). Add it to your home screen to use it just like an app." },
      { q: "If I buy a course from The Lens, can I use Stumble Map too?", a: "Yes. Buy any of the three The Lens courses (Middle-School Exam Pass, High-School Exam Pass, University Exam Pass) and you can use the Stumble Map Annual Plan for one year. Just press the \"Open Stumble Map and activate\" button in your order confirmation email." },
      { q: "Can I return the product or get a refund?", a: "For return and refund conditions, please see our Legal Notice (Specified Commercial Transactions Act)." },
    ],
  },
  final: {
    heading: "From tonight, no more guessing what to review.",
    body: "We don't promise scores. But you won't be stuck wondering what to do tonight. Start for free — snap just one worksheet.",
  },
  footer: {
    brand: "Stumble Map",
    operator: "Operated by Beyond Culture 獨歩文化株式会社 (Ota-ku, Tokyo)",
    legal: "Legal Notice (Specified Commercial Transactions Act)",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    family: "Nazehori Math",
    familyUrl: "https://domo-ai.com",
    copyright: "© 2026 Beyond Culture 獨歩文化株式会社",
  },
};
