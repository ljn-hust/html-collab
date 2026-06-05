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

const css = read('src/engine.css');
const utilsJs = read('src/utils.js');
const engineJs = read('src/engine.js');
const combinedJs = utilsJs + '\n\n' + engineJs;

let template = read('template/template.html');
template = template.replace('<!-- COLLAB_CSS -->', css);
template = template.replace('<!-- COLLAB_JS -->', combinedJs);

write('dist/collab-template.html', template);
console.log('Built: dist/collab-template.html');
