// BOARDVERSE build: bundles the game into dist/ (for the APK) and a single self-contained
// HTML file (dist/boardverse-single.html) for browser preview.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const prod = !process.argv.includes('--dev');

// 1) AI worker bundle (search-heavy bots run off the main thread), embedded as a string.
const worker = await esbuild.build({
  entryPoints: [path.join(root, 'src/ai/worker.js')],
  bundle: true, write: false, format: 'iife', minify: prod, target: 'es2019',
});
const workerSrc = worker.outputFiles[0].text;

const workerPlugin = {
  name: 'ai-worker',
  setup(b) {
    b.onResolve({ filter: /^virtual:ai-worker$/ }, () => ({ path: 'ai-worker', namespace: 'virt' }));
    b.onLoad({ filter: /.*/, namespace: 'virt' }, () => ({
      contents: 'export default ' + JSON.stringify(workerSrc) + ';', loader: 'js',
    }));
  },
};

// 2) Main bundle
const main = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, write: false, format: 'iife', minify: prod, target: 'es2019',
  plugins: [workerPlugin], legalComments: 'none', sourcemap: false,
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
});
const js = main.outputFiles[0].text;
// 3) Audio bundle: every sample embedded as base64 in sounds.js (loads from file:// on Android and PC)
const audioRoot = path.join(root, 'assets/audio');
const snd = { ui: {}, fx: {}, music: {} };
for (const cat of Object.keys(snd)) {
  const dir = path.join(audioRoot, cat);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.mp3')) snd[cat][f.slice(0, -4)] = fs.readFileSync(path.join(dir, f)).toString('base64');
}
const soundsJs = 'window.BV_SOUNDS=' + JSON.stringify(snd) + ';';
// Nunito (SIL OFL) embedded for latin + cyrillic so the UI looks identical offline on every device
let fontCss = '';
for (const w of [700, 800, 900]) {
  const src = fs.readFileSync(path.join(root, `node_modules/@fontsource/nunito/${w}.css`), 'utf8');
  for (const block of src.split('/*').map((b) => b.split('*/')[1] || '')) {
    if (!/nunito-(latin|cyrillic)-\d+-normal\.woff2/.test(block) || /latin-ext|cyrillic-ext/.test(block)) continue;
    fontCss += block.replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\)(, url\([^)]+\) format\('woff'\))?/, (m, f) =>
      `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules/@fontsource/nunito/files', f)).toString('base64')}) format('woff2')`);
  }
}
const css = fontCss + fs.readFileSync(path.join(root, 'src/ui/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

fs.writeFileSync(path.join(dist, 'game.js'), js);
fs.writeFileSync(path.join(dist, 'sounds.js'), soundsJs);
fs.writeFileSync(path.join(dist, 'styles.css'), css);
fs.writeFileSync(path.join(dist, 'index.html'), html
  .replace('<!--CSS-->', '<link rel="stylesheet" href="styles.css">')
  .replace('<!--JS-->', '<script src="sounds.js"></script><script src="game.js"></script>'));
// Single-file build (inline everything)
fs.writeFileSync(path.join(dist, 'boardverse-single.html'), html
  .replace('<!--CSS-->', () => '<style>' + css + '</style>')
  .replace('<!--JS-->', () => '<script>' + soundsJs + '</script><script>' + js.replace(/<\/script/g, '<\\/script') + '</script>'));
console.log('built', (js.length / 1024).toFixed(0) + 'KB js', (workerSrc.length / 1024).toFixed(0) + 'KB worker');
