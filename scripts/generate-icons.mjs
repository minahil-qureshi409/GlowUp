/**
 * Rasterises the GlowUp mark into the PNG sizes installers actually require.
 *
 * Run from the project root: `node scripts/generate-icons.mjs`
 *
 * Three source shapes, because the platforms crop differently:
 *
 *   browser    rounded rect, drawn to the edges. This is `public/icon.svg`,
 *              used as-is for the tab favicon.
 *   maskable   full-bleed background, mark pulled into the centre 80% "safe
 *              zone". Android composites its own shape over this, and a
 *              rounded rect inside a circular mask looks like a mistake.
 *   apple      full-bleed background, mark at its natural size. iOS applies a
 *              squircle itself and renders any transparency as black, so this
 *              one must never have an alpha channel.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'public');

// The mark: two sparkles, matching `--grad-from`/`--grad-to` in globals.css.
const GRADIENT = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9C6272"/>
      <stop offset="100%" stop-color="#E8C7B0"/>
    </linearGradient>
  </defs>`;

const MARK = `
  <path d="M32 14c1.6 7.4 4.2 10 11.6 11.6C36.2 27.2 33.6 29.8 32 37.2c-1.6-7.4-4.2-10-11.6-11.6C27.8 24 30.4 21.4 32 14Z" fill="#fff" opacity=".95"/>
  <path d="M43 38c.9 4.2 2.4 5.7 6.6 6.6-4.2.9-5.7 2.4-6.6 6.6-.9-4.2-2.4-5.7-6.6-6.6 4.2-.9 5.7-2.4 6.6-6.6Z" fill="#fff" opacity=".8"/>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${GRADIENT}${body}</svg>`;

/** Rounded rect, for anything that draws the icon unmasked. */
const rounded = svg(`<rect width="64" height="64" rx="16" fill="url(#g)"/>${MARK}`);

/**
 * Full bleed, mark scaled to 0.9 and recentred.
 *
 * The mark's own bounding box is centred near (35, 32.6), not (32, 32) — the
 * lower sparkle sits right of centre — so it needs translating as well as
 * scaling, or a circular mask clips its right edge.
 */
const maskable = svg(
  `<rect width="64" height="64" fill="url(#g)"/>
   <g transform="translate(32 32) scale(0.9) translate(-35 -32.6)">${MARK}</g>`,
);

/** Full bleed, mark at natural size. iOS crops very little. */
const apple = svg(`<rect width="64" height="64" fill="url(#g)"/>${MARK}`);

const TARGETS = [
  { file: 'icon-192.png', source: rounded, size: 192, alpha: true },
  { file: 'icon-512.png', source: rounded, size: 512, alpha: true },
  { file: 'icon-maskable-192.png', source: maskable, size: 192, alpha: true },
  { file: 'icon-maskable-512.png', source: maskable, size: 512, alpha: true },
  // 180 is the size current iOS asks for; it downscales for everything else.
  { file: 'apple-touch-icon.png', source: apple, size: 180, alpha: false },
];

await mkdir(OUT, { recursive: true });

for (const { file, source, size, alpha } of TARGETS) {
  let pipeline = sharp(Buffer.from(source), { density: 512 }).resize(size, size);

  // Flattening is what guarantees no alpha channel reaches iOS.
  if (!alpha) pipeline = pipeline.flatten({ background: '#9C6272' });

  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(OUT, file), png);
  console.log(`  ${file.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}

// The browser favicon stays vector — it is the one place nothing crops it.
await writeFile(path.join(OUT, 'icon.svg'), `${rounded}\n`);
console.log('  icon.svg                   vector');
