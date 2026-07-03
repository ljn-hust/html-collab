'use strict';
const fs = require('fs');
const path = require('path');

const DEV = __dirname;                        // dev/
const ROOT = path.join(DEV, '..');            // repo root
const read = (rel) => fs.readFileSync(path.join(DEV, rel), 'utf8');
const write = (rel, content) => {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
};

const VERSION = JSON.parse(read('package.json')).version;
const css = read('src/engine.css');
const utilsJs = read('src/utils.js');
const engineJs = read('src/engine.js');
const combinedJs = utilsJs + '\n\n' + engineJs;

// ── 1. Build the blank template (dist + skill asset are the same file) ──
let template = read('template/template.html');
template = template.replace('<!-- COLLAB_CSS -->', css);
template = template.replace('<!-- COLLAB_JS -->', combinedJs);
template = template.replaceAll('COLLAB_ENGINE_VERSION', VERSION);

write('dist/collab-template.html', template);
console.log('Built: dist/collab-template.html');

write('skill/assets/template.html', template);
console.log('Built: skill/assets/template.html');

// ── 2. Refresh the engine CSS/JS blocks inside index.html in place ──
// index.html is a content document (the live demo); only its engine blocks
// are regenerated — article content, collab-data, and doc-level UI are kept.
const INDEX = path.join(ROOT, 'index.html');
let index = fs.readFileSync(INDEX, 'utf8');

const styleRe = /(<style id="collab-styles">)[\s\S]*?(<\/style>)/;
const scriptRe = /(<script id="collab-engine">)[\s\S]*?(<\/script>)/;
if (!styleRe.test(index) || !scriptRe.test(index)) {
  throw new Error('index.html: collab-styles or collab-engine block not found');
}
index = index.replace(styleRe, (_, open, close) => open + '\n' + css + '\n  ' + close);
index = index.replace(scriptRe, (_, open, close) => open + '\n' + combinedJs + '\n  ' + close);
fs.writeFileSync(INDEX, index, 'utf8');
console.log('Refreshed engine blocks: index.html');
