const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST = path.join(__dirname, '..', 'dist', 'collab-template.html');

test('build produces dist/collab-template.html', () => {
  execSync('node build.js', { cwd: path.join(__dirname, '..') });
  assert.ok(fs.existsSync(DIST), 'dist/collab-template.html must exist');
});

test('built file contains inlined CSS (no COLLAB_CSS placeholder)', () => {
  const content = fs.readFileSync(DIST, 'utf8');
  assert.ok(!content.includes('<!-- COLLAB_CSS -->'), 'CSS placeholder must be replaced');
  assert.ok(content.includes('#collab-header'), 'CSS content must be present');
});

test('built file contains inlined JS (no COLLAB_JS placeholder)', () => {
  const content = fs.readFileSync(DIST, 'utf8');
  assert.ok(!content.includes('<!-- COLLAB_JS -->'), 'JS placeholder must be replaced');
  assert.ok(content.includes('collabEngine'), 'JS content must be present');
});

test('built file contains empty collab-data island', () => {
  const content = fs.readFileSync(DIST, 'utf8');
  const match = content.match(/<script type="application\/json" id="collab-data">([\s\S]*?)<\/script>/);
  assert.ok(match, 'collab-data script tag must exist');
  const data = JSON.parse(match[1]);
  assert.deepEqual(data.comments, []);
  assert.deepEqual(data.edits, []);
});
