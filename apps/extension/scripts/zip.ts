// Packs dist/ into the zip the Chrome Web Store takes. `pnpm -F @tabshoal/extension zip` builds the
// release first.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import packageJson from '../package.json' with { type: 'json' };

const dist = new URL('../dist/', import.meta.url).pathname;
const zip = new URL(`../tabshoal-${packageJson.version}.zip`, import.meta.url).pathname;
rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-X', zip, '.'], { cwd: dist, stdio: 'inherit' });
