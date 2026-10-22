import { type Grade, readerUnitsForGrade } from "../curriculum";
import { lookalikesFor, sameNameGroups } from "./lookalikes";

/** Where the problems come from: a phone photo (the app) or plain text (the unit eval). */
export type ReaderInput = "photo" | "text";

/** The unit list block: one line per unit with grade, code, topic and its covers. */
export function unitListBlock(grade: Grade): string {
  return readerUnitsForGrade(grade)
    .map((u) => `${u.id}\t${u.grade} ${u.unit} ${u.topicJa}（${u.coversJa.join("、")}）`)
    .join("\n");
}

/** "How to choose a unit": general rules + the look-alike groups present in this grade's list. */
export function unitChoiceBlock(grade: Grade): string {
  const units = readerUnitsForGrade(grade);
  const pairs = lookalikesFor(units).map((g) => `- ${g.ids.join(" / ")}: ${g.hint}`);
  const same = sameNameGroups(units).map((ids) => `- ${ids.join(" / ")} share a name: decide by the covers in brackets and the numbers involved.`);
  return `How to choose the unit:
- Decide by the mathematics the problem actually tests (what the student must know to solve it), not by surface words. "割合" in the text does not make it 割合; a story about a car can be 速さ, 比例 or 小数のかけ算.
- Compare the problem with the knowledge points in brackets (covers). Pick the unit whose covers contain the skill being tested.
- This is a ${grade} student. When two units fit equally, choose the ${grade} unit, unless the content is clearly below ${grade} level (then choose the lower grade's unit).
- "unit_confidence": 0 to 1, how sure you are of the unit (not of the reading). Below 0.7 when another unit is a real possibility.
- "unit_alt": the id of the second-best unit from the list, or null when no other unit is plausible. Never the same id as "unit".
Look-alike units in this list:
${[...pairs, ...same].join("\n") || "- (none)"}`;
}

/** The reader prompt (from the OCR feasibility test), filled with the grade's unit list. */
export function readerPrompt(grade: Grade, input: ReaderInput = "photo"): string {
  const intro =
    input === "photo"
      ? `You are reading a phone photo of a Japanese math page (test, drill or notebook) from a ${grade} student.`
      : `You are given the text of a Japanese math problem from a ${grade} student's page (no photo; there is no student answer and no teacher mark). Treat it as a page with this one problem.`;
  return `${intro}

Return ONLY one JSON object, no prose, in exactly this shape:
{
  "page_type": "test" | "drill" | "note" | "other",
  "grade_guess": "小5" or null,
  "score": "60" or null,          // the score written on a graded test, as written
  "retake": false,                 // true when the photo is too poor to read reliably
  "problems": [
    { "n": 1, "q": "...", "unit": "5-C3", "unit_confidence": 0.0-1.0, "unit_alt": "4-C2" or null,
      "answer": "..." or null, "mark": "○" | "✕" | null,
      "correct_answer": "..." or null, "judge": "○" | "✕" | null,
      "confidence": 0.0-1.0 }
  ],
  "notes": "short English notes on anything uncertain"
}

Rules:
- Transcribe each problem's text exactly as printed. Fractions as a/b, mixed numbers as 1と1/2. Write measurements shown in a figure in [brackets], e.g. [底辺6cm 高さ4cm].
- Number problems by their order on the page (1, 2, 3 …). A red ✕ often covers the printed number; keep the order anyway.
- "unit": exactly ONE id from the unit list below — the unit the problem belongs to. Use null if none fits. See "How to choose the unit".
- "answer": the student's answer exactly as written (keep their mistakes and units). null if blank. Never correct the student's text.
- "mark": the teacher's red mark for that problem: "○", "✕", or null if there is none. Only a mark that is really on the page.
- "correct_answer": solve the problem yourself and give the correct final answer, short, in the same units the problem uses (e.g. "42L", "140", "3/4", "y=3×x"). null if you cannot solve it reliably (unreadable, depends on a figure you cannot see clearly, open-ended).
- "judge": your own judgment of the student's answer against correct_answer, separate from the teacher's mark:
  "○" when the student's final answer equals the correct answer; equivalent forms count (0.5 = 1/2 = 2/4 when not asked to reduce, 100cm² = 100 cm², 480円 = 480 when the unit is printed next to the answer box, 3:4 = 6:8 only if the problem does not ask for the simplest ratio).
  "✕" when it is wrong, blank, or only a 式 / working with no final answer.
  null when you cannot decide (unreadable, figure-dependent and unclear, open-ended, correct_answer null).
- "confidence": how sure you are of this problem's reading, 0 to 1.
- If the photo is too dark, blurred or cut off to read, set "retake": true and return the problems you can read reliably (possibly none).
- Never invent text you cannot see. Solving is only for correct_answer and judge; it never changes q, answer or mark.
- Ignore the child's name and any other personal information; do not include it anywhere.

${unitChoiceBlock(grade)}

Unit list (id, grade, code, topic（covers）):
${unitListBlock(grade)}`;
}
