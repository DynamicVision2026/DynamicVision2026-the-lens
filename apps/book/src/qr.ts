// QR codes as inline vector SVG (qrcode, MIT). Synchronous, so the whole book renders in one pass.
import QRCode from 'qrcode';

/** A square SVG for `text`, one path, with a 4-module quiet zone. */
export function qrSvg(text: string, ink: string, paper: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const q = 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules.get(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
    }
  }
  const size = n + 2 * q;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" class="qr"><rect width="${size}" height="${size}" fill="${paper}"/><path d="${d}" fill="${ink}"/></svg>`;
}
