// Renders the toolbar and store icons from the SVG masters. Run after changing one:
// pnpm -F @tabshoal/extension icons
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const master = (name: string) => readFile(new URL(`../../../assets-src/${name}`, import.meta.url));
const out = (size: number, name = 'icon') =>
  new URL(`../public/icons/${name}-${size}.png`, import.meta.url).pathname;
// Rendered at 8× and scaled down, for clean edges.
const render = async (svg: Buffer, size: number, viewBox: number) =>
  sharp(svg, { density: 72 * (size / viewBox) * 8 })
    .resize(size, size)
    .png()
    .toBuffer();

// Three drawings, each made for its size: the 16 px one is drawn on the 16 px pixel grid.
const [main, medium, small] = await Promise.all([
  master('icon.svg'),
  master('icon-32.svg'),
  master('icon-16.svg'),
]);

// The toolbar icon once grouping has stopped: a small Fishball amber dot with a "!" in the
// bottom-right corner, cut out of the icon by a transparent ring. Chrome's own badge is too big.
const STOPPED_CUTOUT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="25.5" cy="25.5" r="7.5"/></svg>',
);
const STOPPED_DOT = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <circle cx="25.5" cy="25.5" r="6" fill="#f2af48"/>
    <rect x="24.6" y="21.6" width="1.8" height="5.2" rx="0.9" fill="#00163a"/>
    <circle cx="25.5" cy="28.9" r="1" fill="#00163a"/>
  </svg>`,
);
const withStoppedDot = async (icon: Buffer, size: number) =>
  sharp(icon)
    .composite([
      { input: await render(STOPPED_CUTOUT, size, 32), blend: 'dest-out' },
      { input: await render(STOPPED_DOT, size, 32) },
    ])
    .toFile(out(size, 'stopped'));

await Promise.all([
  sharp(await render(small, 16, 128)).toFile(out(16)),
  sharp(await render(medium, 32, 128)).toFile(out(32)),
  withStoppedDot(await render(small, 16, 128), 16),
  withStoppedDot(await render(medium, 32, 128), 32),
  sharp(await render(medium, 48, 128)).toFile(out(48)),
  // The Chrome Web Store wants the artwork at 96 px inside a transparent 16 px border.
  sharp(await render(main, 96, 128))
    .extend({
      top: 16,
      bottom: 16,
      left: 16,
      right: 16,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toFile(out(128)),
]);
