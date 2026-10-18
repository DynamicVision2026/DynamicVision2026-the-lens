import { type Grade, readerUnitsForGrade } from "../curriculum";

/** The reader prompt (from the OCR feasibility test), filled with the grade's unit list. */
export function readerPrompt(grade: Grade): string {
  const units = readerUnitsForGrade(grade)
    .map((u) => `${u.id}\t${u.grade} ${u.unit} ${u.topic}（${u.covers.join("、")}）`)
    .join("\n");
  return `You are reading a phone photo of a Japanese math page (test, drill or notebook) from a ${grade} student.

Return ONLY one JSON object, no prose, in exactly this shape:
{
  "page_type": "test" | "drill" | "note" | "other",
  "grade_guess": "小5" or null,
  "score": "60" or null,          // the score written on a graded test, as written
  "retake": false,                 // true when the photo is too poor to read reliably
  "problems": [
    { "n": 1, "q": "...", "unit": "5-C3", "answer": "..." or null, "mark": "○" | "✕" | null, "confidence": 0.0-1.0 }
  ],
  "notes": "short English notes on anything uncertain"
}

Rules:
- Transcribe each problem's text exactly as printed. Fractions as a/b, mixed numbers as 1と1/2. Write measurements shown in a figure in [brackets], e.g. [底辺6cm 高さ4cm].
- Number problems by their order on the page (1, 2, 3 …). A red ✕ often covers the printed number; keep the order anyway.
- "unit": exactly ONE id from the unit list below — the unit the problem belongs to. Use null if none fits.
- "answer": the student's answer exactly as written (keep their mistakes and units). null if blank.
- "mark": the teacher's red mark for that problem: "○", "✕", or null if there is none.
- "confidence": how sure you are of this problem's reading, 0 to 1.
- If the photo is too dark, blurred or cut off to read, set "retake": true and return the problems you can read reliably (possibly none).
- Never solve a problem, never correct the student, never invent text you cannot see.
- Ignore the child's name and any other personal information; do not include it anywhere.

Unit list (id, grade, code, topic):
${units}`;
}
