// Generates the home-screen icons from one SVG mark: a lens ring with a small four-point star on navy.
// Usage (from apps/snap): node scripts/icons.mjs   → public/icon.svg + public/icons/*.png (commit them)
// Colours match theme/tokens.css (--sky-bg, --sky-ink, --sky-gold).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const NAVY = "#13203a";
const INK = "#e8eef8";
const GOLD = "#ffcc55";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public");
mkdirSync(join(out, "icons"), { recursive: true });

/** Four-point star centred at (cx, cy), outer radius R, soft concave sides. */
function star(cx, cy, R) {
  const r = R * 0.17;
  const p = (x, y) => `${(cx + x).toFixed(1)} ${(cy + y).toFixed(1)}`;
  return `M${p(0, -R)}Q${p(r, -r)} ${p(R, 0)}Q${p(r, r)} ${p(0, R)}Q${p(-r, r)} ${p(-R, 0)}Q${p(-r, -r)} ${p(0, -R)}Z`;
}

/**
 * The mark on a 512 canvas. `scale` shrinks it around the centre (maskable icons keep it inside
 * the 80 % safe zone); `rounded` gives the "any" icon soft corners, full-bleed otherwise.
 */
function svg({ scale = 1, rounded = true } = {}) {
  const bg = rounded ? `<rect width="512" height="512" rx="112" fill="${NAVY}"/>` : `<rect width="512" height="512" fill="${NAVY}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
${bg}
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
  <circle cx="240" cy="272" r="132" fill="none" stroke="${INK}" stroke-width="30"/>
  <circle cx="240" cy="272" r="96" fill="none" stroke="${INK}" stroke-opacity="0.28" stroke-width="6"/>
  <path d="${star(358, 152, 74)}" fill="${GOLD}" stroke="${NAVY}" stroke-width="16" stroke-linejoin="round" paint-order="stroke"/>
</g>
</svg>
`;
}

const png = (svgText, size, file) => sharp(Buffer.from(svgText)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(out, file));

writeFileSync(join(out, "icon.svg"), svg());
await png(svg(), 192, "icons/icon-192.png");
await png(svg(), 512, "icons/icon-512.png");
await png(svg({ scale: 0.78, rounded: false }), 512, "icons/icon-maskable-512.png");
await png(svg({ scale: 0.86, rounded: false }), 180, "icons/apple-touch-icon.png"); // iOS rounds the corners itself
console.log("icons written to public/icons/");
