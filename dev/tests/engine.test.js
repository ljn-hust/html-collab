'use strict';
// DOM smoke tests for the collab engine — loads the BUILT template into
// happy-dom and exercises the edit flow end-to-end. These cover the layer
// where past release bugs actually happened (buttons, clicks, dimming),
// which the pure-function tests in utils.test.js cannot reach.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Window } = require('happy-dom');

const DIST = path.join(__dirname, '..', '..', 'dist', 'collab-template.html');

const TEST_CONTENT = `
<section data-cid="sec-001">
  <h2 data-cid="h-001">Section title</h2>
  <p data-cid="p-001">First paragraph inside the section.</p>
</section>
<p data-cid="p-002">Standalone second paragraph.</p>
`;

/** Build a fresh happy-dom window with the built template + test content. */
function loadDocument() {
  if (!fs.existsSync(DIST)) {
    execSync('node build.js', { cwd: path.join(__dirname, '..') });
  }
  const html = fs.readFileSync(DIST, 'utf8')
    .replace('<!-- CONTENT_PLACEHOLDER -->', TEST_CONTENT);
  const window = new Window({
    url: 'file:///test/doc.html',
    settings: { enableJavaScriptEvaluation: true },
  });
  window.document.write(html);
  return window;
}

function collabData(document) {
  return JSON.parse(document.getElementById('collab-data').textContent);
}

function clickEditButton(document, cid) {
  const el = document.querySelector(`[data-cid="${cid}"]`);
  const btn = el.querySelector('.collab-edit-btn');
  assert.ok(btn, `edit button must exist on ${cid}`);
  btn.click();
  return el;
}

function editBar(document) {
  const bar = document.querySelector('.collab-edit-bar');
  assert.ok(bar, 'edit bar must appear');
  return bar;
}

test('container blocks get no edit button; leaf blocks do', () => {
  const { document } = loadDocument();
  assert.equal(document.querySelector('[data-cid="sec-001"] > .collab-edit-btn'), null,
    'section (container) must not have an edit button');
  assert.ok(document.querySelector('[data-cid="p-001"] .collab-edit-btn'), 'p-001 has button');
  assert.ok(document.querySelector('[data-cid="h-001"] .collab-edit-btn'), 'h-001 has button');
  assert.ok(document.querySelector('[data-cid="p-002"] .collab-edit-btn'), 'p-002 has button');
});

test('edit → confirm writes an edit record to collab-data', () => {
  const { document } = loadDocument();
  const el = clickEditButton(document, 'p-002');
  el.textContent = 'A fully revised paragraph.';
  editBar(document).querySelector('.confirm').click();

  const data = collabData(document);
  assert.equal(data.edits.length, 1);
  assert.equal(data.edits[0].target, 'p-002');
  assert.equal(data.edits[0].original, 'Standalone second paragraph.');
  assert.equal(data.edits[0].revised, 'A fully revised paragraph.');
  assert.ok(el.querySelector('.collab-revised'), 'diff markup rendered in place');
});

test('captured text never contains the edit button label', () => {
  const { document } = loadDocument();
  const el = clickEditButton(document, 'p-002');
  el.textContent = el.textContent + ' plus more';
  editBar(document).querySelector('.confirm').click();

  const data = collabData(document);
  assert.ok(!data.edits[0].original.includes('Edit'), 'original is clean');
  assert.ok(!data.edits[0].revised.includes('Edit'), 'revised is clean');
});

test('editing a nested block does not dim its ancestors (bar stays clickable)', () => {
  const { document } = loadDocument();
  clickEditButton(document, 'p-001');
  const section = document.querySelector('[data-cid="sec-001"]');
  assert.ok(!section.classList.contains('dimmed'),
    'ancestor section must not be dimmed — dimming blocks pointer events on the bar');
  const other = document.querySelector('[data-cid="p-002"]');
  assert.ok(other.classList.contains('dimmed'), 'unrelated block is dimmed');
});

test('cancel restores the original content and records nothing', () => {
  const { document } = loadDocument();
  const el = clickEditButton(document, 'p-002');
  el.textContent = 'Abandoned typing that must vanish.';
  editBar(document).querySelector('.cancel').click();

  assert.equal(collabData(document).edits.length, 0, 'no edit record');
  assert.ok(el.textContent.includes('Standalone second paragraph.'),
    'original text restored');
  assert.ok(el.querySelector('.collab-edit-btn'), 'edit button re-attached');
});

test('re-editing an edited block edits the revised text, not the diff markup', () => {
  const { document } = loadDocument();
  // First edit
  let el = clickEditButton(document, 'p-002');
  el.textContent = 'Version two.';
  editBar(document).querySelector('.confirm').click();
  // Second edit on the same block
  el = clickEditButton(document, 'p-002');
  assert.equal(el.textContent.trim(), 'Version two.',
    'edit view shows only the revised text, no strikethrough original or badge');
  el.textContent = 'Version three.';
  editBar(document).querySelector('.confirm').click();

  const data = collabData(document);
  assert.equal(data.edits.length, 1, 'still one record per block');
  assert.equal(data.edits[0].original, 'Standalone second paragraph.',
    'original stays the LLM text across re-edits');
  assert.equal(data.edits[0].revised, 'Version three.');
});

test('generated template carries the engine version', () => {
  const { document } = loadDocument();
  const version = require('../package.json').version;
  assert.equal(collabData(document).meta.engineVersion, version);
});
