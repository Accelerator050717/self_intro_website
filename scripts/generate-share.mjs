/** Local, reproducible Open Graph artwork. No image service or network request. */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'public', 'images', 'share.png');
const font = join(root, 'node_modules', '@fontsource-variable', 'manrope', 'files', 'manrope-latin-wght-normal.woff2');
const avatar = join(root, 'public', 'images', 'avatar', 'front-960.webp');

// Original isometric geometry: two visible side faces, a thick top face,
// and individual cylindrical studs. The supplied avatar is never redrawn.
function brick(x, y, columns = 4, rows = 2, scale = 1, opacity = 1) {
  const u = [54, 15];
  const v = [-54, 15];
  const thickness = 35;
  const a = [0, 0];
  const b = [columns * u[0], columns * u[1]];
  const c = [b[0] + rows * v[0], b[1] + rows * v[1]];
  const d = [rows * v[0], rows * v[1]];
  const down = ([px, py]) => [px, py + thickness];
  const points = (list) => list.map((point) => point.join(',')).join(' ');
  const studs = [];
  for (let col = 0; col < columns; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cx = (col + 0.5) * u[0] + (row + 0.5) * v[0];
      const cy = (col + 0.5) * u[1] + (row + 0.5) * v[1];
      studs.push({ depth: col + row, svg: `
        <ellipse cx="${cx}" cy="${cy + 2}" rx="20" ry="8.4" fill="#608eb4" opacity=".13"/>
        <path d="M ${cx - 19} ${cy - 12} v12 a19 8 0 0 0 38 0 v-12 Z" fill="url(#studSide)" stroke="#91bbdf" stroke-width="1"/>
        <ellipse cx="${cx}" cy="${cy - 12}" rx="19" ry="8" fill="url(#studTop)" stroke="#f7fcff" stroke-width="1.6"/>
        <path d="M ${cx - 15} ${cy - 14} Q ${cx - 3} ${cy - 21} ${cx + 13} ${cy - 15}" fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="1.6"/>
      ` });
    }
  }
  return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}" stroke-linejoin="round">
    <polygon points="${points([d, c, down(c), down(d)])}" fill="url(#iceFront)" stroke="#99c1e3" stroke-width="1.5"/>
    <polygon points="${points([b, c, down(c), down(b)])}" fill="url(#iceSide)" stroke="#89b4d7" stroke-width="1.5"/>
    <polygon points="${points([a, b, c, d])}" fill="url(#iceTop)" stroke="#f6fcff" stroke-width="2.2"/>
    <path d="M ${d[0] + 7} ${d[1] + 8} L ${c[0] - 7} ${c[1] + 8}" fill="none" stroke="#f5fbff" stroke-opacity=".68" stroke-width="2"/>
    <path d="M ${d[0] + 20} ${d[1] + 28} L ${c[0] - 40} ${c[1] + 30}" fill="none" stroke="#74a9d2" stroke-opacity=".28" stroke-width="1.4"/>
    <polygon points="${points([[d[0] + 33, d[1] + 11], [c[0] - 22, c[1] + 6], [c[0] - 63, c[1] + 29], [d[0] + 70, d[1] + 31]])}" fill="#e9f8ff" opacity=".16"/>
    ${studs.sort((left, right) => left.depth - right.depth).map((item) => item.svg).join('')}
  </g>`;
}

const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="air"><stop stop-color="#d9eaf9"/><stop offset="1" stop-color="#edf5fc" stop-opacity="0"/></radialGradient>
    <linearGradient id="iceTop" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#f1faff"/><stop offset=".52" stop-color="#cde7f7"/><stop offset="1" stop-color="#a8cdea"/></linearGradient>
    <linearGradient id="iceFront" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c1def1"/><stop offset=".55" stop-color="#a8cce8"/><stop offset="1" stop-color="#d6eaf7"/></linearGradient>
    <linearGradient id="iceSide" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a9cce7"/><stop offset=".6" stop-color="#84afd0"/><stop offset="1" stop-color="#b7d8ee"/></linearGradient>
    <linearGradient id="studSide"><stop stop-color="#c4e2f4"/><stop offset=".5" stop-color="#93bddc"/><stop offset="1" stop-color="#d9f0fb"/></linearGradient>
    <linearGradient id="studTop" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7fcff"/><stop offset=".5" stop-color="#d7edf9"/><stop offset="1" stop-color="#b5d5ec"/></linearGradient>
    <filter id="softShadow" x="-40%" y="-150%" width="180%" height="400%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="contactShadow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="3.5"/></filter>
  </defs>
  <rect width="1200" height="630" fill="#f4f8fc"/>
  <ellipse cx="965" cy="260" rx="480" ry="450" fill="url(#air)"/>
  <ellipse cx="928" cy="604" rx="164" ry="12" fill="#5c85a7" opacity=".18" filter="url(#softShadow)"/>
  <ellipse cx="1120" cy="423" rx="61" ry="9" fill="#5c85a7" opacity=".1" filter="url(#softShadow)"/>
  ${brick(1120, 353, 2, 2, 0.5, 0.62)}
  ${brick(870, 492)}
  <ellipse cx="916" cy="558" rx="79" ry="8" fill="#426583" opacity=".19" filter="url(#contactShadow)"/>
  ${brick(682, 552, 2, 2, 0.42, 0.8)}
  ${brick(107, 79, 2, 2, 0.24, 1)}
</svg>`;

await mkdir(dirname(output), { recursive: true });
const character = await sharp(await readFile(avatar)).resize(432, 576).png().toBuffer();
const fontBytes = await readFile(font);
// Sharp's Windows text backend does not register this WOFF2 variable font.
// Chromium renders only our authored SVG lettering, using the exact local font.
// It opens no website and sends no network request.
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let lettering;
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.route('**/*', (route) => route.abort());
  await page.setContent(`<html><head><style>
    @font-face { font-family: 'Share Manrope'; src: url(data:font/woff2;base64,${fontBytes.toString('base64')}) format('woff2'); font-weight: 200 800; font-style: normal; }
    html,body { width:1200px;height:630px;margin:0;padding:0;background:transparent; }
    svg { display:block;font-family:'Share Manrope',sans-serif; }
  </style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <text x="82" y="161" fill="#526a80" font-size="22" font-weight="500">UC Irvine · Computer Science</text>
    <text x="77" y="267" fill="#172c40" font-size="77" font-weight="700" letter-spacing="-2">Mingyang Yu</text>
    <text x="82" y="357" fill="#365b7b" font-size="36" font-weight="500">Building ideas,</text>
    <text x="82" y="403" fill="#365b7b" font-size="36" font-weight="500">one block at a time.</text>
  </svg></body></html>`);
  await page.evaluate(async () => { await document.fonts.load('700 77px "Share Manrope"'); await document.fonts.ready; });
  if (!await page.evaluate(() => document.fonts.check('700 77px "Share Manrope"'))) {
    throw new Error('The local Manrope font failed to load.');
  }
  lettering = await page.screenshot({ omitBackground: true });
} finally {
  await browser.close();
}
await sharp(Buffer.from(artwork))
  .composite([{ input: lettering, left: 0, top: 0 }, { input: character, left: 694, top: 4 }])
  .removeAlpha()
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
  .toFile(output);
const meta = await sharp(output).metadata();
if (meta.width !== 1200 || meta.height !== 630 || meta.format !== 'png') {
  throw new Error('Unexpected share-image dimensions or format.');
}
console.log(JSON.stringify({ output, width: meta.width, height: meta.height, format: meta.format }));
