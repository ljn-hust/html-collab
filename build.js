'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, content) => {
  fs.mkdirSync(path.join(ROOT, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
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
