// node tools/print_pdf.mjs <in.html> <out.pdf>: print an HTML page to PDF with headless Chromium (CI-free helper).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const [, , input, output] = process.argv;
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage();
await p.goto('file://' + resolve(input));
mkdirSync(dirname(resolve(output)), { recursive: true });
await p.pdf({ path: output, preferCSSPageSize: true, printBackground: true });
await b.close();
console.log(output);
