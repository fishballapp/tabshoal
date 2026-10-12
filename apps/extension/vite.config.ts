import { stripHtmlComments } from '@fishballapps/vite-plugins/strip-html-comments';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import packageJson from './package.json' with { type: 'json' };
import { productionPolar } from './src/licence/polar-config.ts';

const ICON_SIZES = [16, 32, 48, 128] as const;
const icons = Object.fromEntries(ICON_SIZES.map(size => [size, `icons/icon-${size}.png`]));

const manifest: chrome.runtime.ManifestV3 = {
  manifest_version: 3,
  name: 'TabShoal',
  short_name: 'TabShoal',
  description: 'Groups your tabs by site, automatically.',
  version: packageJson.version,
  minimum_chrome_version: '128',
  icons,
  action: { default_popup: 'popup.html', default_title: 'TabShoal', default_icon: icons },
  options_ui: { page: 'options.html', open_in_tab: true },
  background: { service_worker: 'background.js', type: 'module' },
  permissions: ['tabs', 'tabGroups', 'storage', 'alarms'],
};

/** Writes manifest.json from the object above, so the version comes from package.json. */
const emitManifest = (): Plugin => ({
  name: 'tabshoal-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'manifest.json',
      source: `${JSON.stringify(manifest, null, 2)}\n`,
    });
  },
});

export default defineConfig(({ mode }) => {
  // Stops a release build that would talk to a production product that doesn't exist yet.
  if (mode === 'release') productionPolar();
  return {
    plugins: [react(), tailwindcss(), stripHtmlComments(), emitManifest()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: { background: 'src/background.ts', popup: 'popup.html', options: 'options.html' },
        output: {
          entryFileNames: chunk =>
            chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
