// Renders the toolbar and store icons from the SVG masters. Run after changing one:
// pnpm -F @tabshoal/extension icons
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const master = (name: string) => readFile(new URL(`../../../assets-src/${name}`, import.meta.url));
const out = (size: number) => new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname;
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

await Promise.all([
  sharp(await render(small, 16, 128)).toFile(out(16)),
  sharp(await render(medium, 32, 128)).toFile(out(32)),
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
