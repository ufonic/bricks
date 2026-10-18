import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const buildDate = new Date().toISOString().slice(0, 10);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Emits sw.js from src/sw.js with a precache list of every built file plus public/,
 * and a version hash of their contents so any change triggers an update.
 */
function serviceWorker(): Plugin {
  return {
    name: 'bricks-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const hash = createHash('sha256');
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      for (const f of files.sort()) {
        const chunk = bundle[f];
        hash.update(f);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      const publicFiles = listFiles('public').map((f) => relative('public', f).replaceAll('\\', '/'));
      for (const f of publicFiles.sort()) {
        hash.update(f);
        hash.update(readFileSync(join('public', f)));
      }
      const precache = [...new Set(['./', './index.html', ...[...files, ...publicFiles].map((f) => `./${f}`)])];
      const version = hash.digest('hex').slice(0, 12);
      const source = readFileSync('src/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative paths: works at a domain root or under a subpath (e.g. GitHub Pages /repo/).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildDate),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  plugins: [serviceWorker()],
});
