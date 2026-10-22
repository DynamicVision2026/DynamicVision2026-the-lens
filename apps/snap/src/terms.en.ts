import type * as ja from "./terms.ja";
import type { Widen } from "./lib/lang";

export const TERMS: Widen<typeof ja.TERMS> = {
  metaTitle: "Terms of Use | Stumble Map",
  metaDesc: "Terms of Use for Stumble Map.",
  logo: "Stumble Map",
  title: "Terms of Use",
  note: "This translation is provided for reference. If it differs from the Japanese version, the Japanese version prevails.",
  listIndex: 6,
  articles: [
    ["Article 1 (Scope)", ["These Terms set out the conditions for using \"Stumble Map\" (the \"Service\") provided by Beyond Culture 獨歩文化株式会社 (the \"Company\"). Users shall use the Service after agreeing to these Terms. Minors must obtain the consent of a parent or guardian before using the Service."]],
    ["Article 2 (Description of the Service)", ["The Service is a web application that reads photos of math problems taken by users, classifies them into the units of the national curriculum, records whether each answer is correct, and helps users plan their review."]],
    [
      "Article 3 (Plans and Fees)",
      [
        "The free trial allows up to a total of 30 photos to be read per device. The trial is one-time only and does not reset monthly.",
        "The fee for the Annual Plan is the amount (tax included) shown on the Company's online store. The Annual Plan is paid in a single payment for one year and does not renew automatically.",
        "The Annual Plan is valid for one year from the payment date of the order (or, when activated by code, for one year from the date the code is first entered). Up to 200 photos may be read per month (combined across all devices on the same plan), and this limit resets at 0:00 (Japan Standard Time) on the 1st of each month.",
        "The Annual Plan may be used on up to 3 devices belonging to the same family.",
      ],
    ],
    ["Article 4 (Returns and Refunds)", ["Conditions for returns and refunds are as set out in the Legal Notice under the Specified Commercial Transactions Act."]],
    [
      "Article 5 (Handling of Data)",
      [
        "Photos taken and records are stored on the user's device (in the browser). Because they may be lost when the device is changed or browser data is deleted, users should use the app's backup function as appropriate.",
        "Photos are sent temporarily to the Company's server for reading, but the Company does not store them. The handling of personal information is set out in the Privacy Policy.",
      ],
    ],
    ["Article 6 (AI Judgments)", ["Reading, unit classification and correctness judgments in the Service are performed by AI and may contain errors. Users shall check the content before saving and correct it as needed. The Service does not guarantee any improvement in academic results."]],
    [
      "Article 7 (Prohibited Acts)",
      [
        "Acts that violate laws and regulations or public order and morals",
        "Acts that interfere with the operation of the Service, including unauthorized access or placing an excessive load on it",
        "Selling or transferring codes to third parties",
        "Use for the purpose of infringing the copyrights or other rights of third parties",
        "Any other acts the Company deems inappropriate",
      ],
    ],
    ["Article 8 (Disclaimer)", ["The Company does not guarantee the accuracy, completeness or usefulness of the content of the Service. Except in cases of intentional misconduct or gross negligence by the Company, the Company shall not be liable for any damage arising from use of the Service."]],
    ["Article 9 (Changes to or Suspension of the Service)", ["The Company may change the content of the Service, or temporarily suspend or end its provision, without prior notice. If the Service ends while an Annual Plan is still valid, the Company will respond by a method it designates."]],
    ["Article 10 (Changes to These Terms)", ["The Company may change these Terms as necessary. The revised Terms take effect from the time they are posted on this page."]],
    ["Article 11 (Governing Law and Jurisdiction)", ["These Terms are governed by the laws of Japan, and the Tokyo District Court shall have exclusive agreed jurisdiction as the court of first instance for any dispute relating to the Service."]],
  ],
  datedBefore: "Established: October 20, 2026 / For business operator information, please see the ",
  legalLink: "Legal Notice (Specified Commercial Transactions Act)",
  datedAfter: ".",
};
