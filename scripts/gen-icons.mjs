// Renders the PNG app icons from public/icons/icon.svg. Run with `npm run icons`.
// The PNGs are committed, so a normal build does not need this (or sharp).
import sharp from 'sharp';

const src = 'public/icons/icon.svg';
const out = 'public/icons';

const sizes = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  // The art already keeps its content inside the maskable safe zone (central 80%).
  ['icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src, { density: 384 }).resize(size, size).flatten({ background: '#8a5a33' }).png().toFile(`${out}/${name}`);
  console.log(`wrote ${out}/${name}`);
}
