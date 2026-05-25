# collab-html Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML format and browser annotation engine for LLM–human collaborative document editing, plus a Claude/OpenClaw skill for LLM integration.

**Architecture:** `src/utils.js` holds pure data-manipulation functions (testable with Node.js); `src/engine.js` holds DOM-dependent UI logic; `build.js` concatenates both and inlines them with `src/engine.css` into `template/template.html`, producing `dist/collab-template.html` — the file LLMs fill with content.

**Tech Stack:** Vanilla JS (ES2020), CSS3, HTML5 File System Access API (Chrome only), Node.js built-in `fs` + `node:test` (zero npm dependencies).

**Spec:** `docs/superpowers/specs/2026-05-25-collab-html-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/utils.js` | Pure functions: parse/set collab-data, generate CIDs, truncate quotes, extract LLM context, serialize HTML. Exports via CommonJS guard for testing. |
| `src/engine.js` | DOM engine: file access, comment flow, edit flow, state rendering. Requires utils. No exports. |
| `src/engine.css` | All annotation UI styles: header, sidebar, floating toolbar, highlights, edit badges. |
| `template/template.html` | HTML skeleton with `<!-- COLLAB_CSS -->` and `<!-- COLLAB_JS -->` placeholders, empty article + collab-data island. |
| `build.js` | Reads `src/utils.js` + `src/engine.js` + `src/engine.css`, inlines into template, writes `dist/collab-template.html`. Zero npm deps. |
| `schema/collab-data.schema.json` | JSON Schema (draft-07) for collab-data structure. |
| `tests/utils.test.js` | Unit tests for all pure functions in utils.js using `node:test`. |
| `tests/build.test.js` | Verifies build output contains inlined JS/CSS and no raw placeholders. |
| `skill/SKILL.md` | LLM skill defining GENERATE, READ, REVISE modes. |
| `examples/example.html` | Complete built document with pre-populated annotations (hand-crafted). |
| `README.md` | Project overview, quick-start, format spec summary. |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "collab-html",
  "version": "0.1.0",
  "description": "Single-file HTML format for LLM-human collaborative document editing",
  "type": "commonjs",
  "scripts": {
    "build": "node build.js",
    "test": "node --test tests/utils.test.js tests/build.test.js"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.DS_Store
dist/*.html
```

Note: `dist/collab-template.html` is excluded from git — it is a build artifact. Users run `node build.js` to produce it.

- [ ] **Step 3: Create LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 collab-html contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/collab-html
git add package.json .gitignore LICENSE
git commit -m "chore: project scaffold"
```

---

## Task 2: JSON Schema

**Files:**
- Create: `schema/collab-data.schema.json`
- Create: `tests/utils.test.js` (stub only — add first test)

- [ ] **Step 1: Write failing test for schema structure**

Create `tests/utils.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('collab-data schema file exists and is valid JSON', () => {
  const schemaPath = path.join(__dirname, '..', 'schema', 'collab-data.schema.json');
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw);
  assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#');
  assert.equal(schema.title, 'collab-data');
  assert.ok(schema.properties.version);
  assert.ok(schema.properties.meta);
  assert.ok(schema.properties.comments);
  assert.ok(schema.properties.edits);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Projects/collab-html
node --test tests/utils.test.js
```

Expected: FAIL — `schema/collab-data.schema.json` does not exist.

- [ ] **Step 3: Create schema/collab-data.schema.json**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "collab-data",
  "type": "object",
  "required": ["version", "meta", "comments", "edits"],
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "meta": {
      "type": "object",
      "required": ["title", "originalCreated", "lastRevised", "model", "maxImageBytes", "imageStorage"],
      "properties": {
        "title": { "type": "string" },
        "originalCreated": { "type": "string", "format": "date-time" },
        "lastRevised": { "type": "string", "format": "date-time" },
        "model": { "type": "string" },
        "maxImageBytes": { "type": "integer", "minimum": 1 },
        "imageStorage": { "type": "string", "enum": ["base64", "url"] }
      }
    },
    "comments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "target", "quote", "text", "images", "author", "timestamp"],
        "properties": {
          "id": { "type": "string" },
          "target": { "type": "string", "pattern": "^([a-z]+-[0-9]{3}|auto-[0-9]+)$" },
          "quote": { "type": "string", "maxLength": 500 },
          "text": { "type": "string" },
          "images": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "type", "sizeBytes"],
              "properties": {
                "id": { "type": "string" },
                "type": { "type": "string", "enum": ["base64", "url"] },
                "data": { "type": "string" },
                "url": { "type": "string", "format": "uri" },
                "sizeBytes": { "type": "integer", "minimum": 0 },
                "compressedBy": { "type": "string" }
              }
            }
          },
          "author": { "type": "string", "enum": ["human"] },
          "timestamp": { "type": "string", "format": "date-time" }
        }
      }
    },
    "edits": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "target", "original", "revised", "author", "timestamp"],
        "properties": {
          "id": { "type": "string" },
          "target": { "type": "string", "pattern": "^([a-z]+-[0-9]{3}|auto-[0-9]+)$" },
          "original": { "type": "string" },
          "revised": { "type": "string" },
          "author": { "type": "string", "enum": ["human"] },
          "timestamp": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/utils.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add schema/collab-data.schema.json tests/utils.test.js
git commit -m "feat: add collab-data JSON schema"
```

---

## Task 3: Pure Utility Functions

**Files:**
- Create: `src/utils.js`
- Modify: `tests/utils.test.js` (add tests for each function)

These functions have no DOM dependency and run in Node.js for testing.

- [ ] **Step 1: Write failing tests for all utility functions**

Append to `tests/utils.test.js`:

```js
const {
  getCollabData,
  setCollabData,
  generateCid,
  truncateQuote,
  extractLLMContext,
} = require('../src/utils.js');

// --- getCollabData ---
test('getCollabData parses JSON from script#collab-data innerHTML', () => {
  const mockDoc = {
    getElementById: (id) => id === 'collab-data'
      ? { textContent: JSON.stringify({ version: '0.1', meta: {}, comments: [], edits: [] }) }
      : null
  };
  const result = getCollabData(mockDoc);
  assert.equal(result.version, '0.1');
  assert.deepEqual(result.comments, []);
});

test('getCollabData returns null if script element missing', () => {
  const mockDoc = { getElementById: () => null };
  assert.equal(getCollabData(mockDoc), null);
});

// --- setCollabData ---
test('setCollabData serializes data into script#collab-data textContent', () => {
  let written = '';
  const el = {
    get textContent() { return written; },
    set textContent(v) { written = v; }
  };
  const mockDoc = { getElementById: (id) => id === 'collab-data' ? el : null };
  const data = { version: '0.1', meta: {}, comments: [], edits: [] };
  setCollabData(mockDoc, data);
  assert.equal(JSON.parse(written).version, '0.1');
});

// --- generateCid ---
test('generateCid returns p-001 when no existing p CIDs', () => {
  assert.equal(generateCid('p', []), 'p-001');
});

test('generateCid increments from highest existing CID of same type', () => {
  assert.equal(generateCid('p', ['p-001', 'p-003', 'sec-001']), 'p-004');
});

test('generateCid zero-pads to 3 digits', () => {
  const existing = Array.from({ length: 9 }, (_, i) => `p-00${i + 1}`);
  assert.equal(generateCid('p', existing), 'p-010');
});

// --- truncateQuote ---
test('truncateQuote returns string unchanged if under 500 chars', () => {
  const s = 'hello world';
  assert.equal(truncateQuote(s), s);
});

test('truncateQuote truncates to exactly 500 chars', () => {
  const s = 'a'.repeat(600);
  assert.equal(truncateQuote(s).length, 500);
});

// --- extractLLMContext ---
test('extractLLMContext replaces base64 image data with placeholder', () => {
  const data = {
    comments: [{
      id: 'c-001', target: 'p-001', quote: 'some text', text: 'fix this',
      images: [{ id: 'img-001', type: 'base64', data: 'data:image/png;base64,AAAA', sizeBytes: 100 }],
      author: 'human', timestamp: '2026-01-01T00:00:00Z'
    }],
    edits: []
  };
  const ctx = extractLLMContext(data);
  assert.ok(ctx.includes('[screenshot, 100B, base64]'));
  assert.ok(!ctx.includes('AAAA'));
});

test('extractLLMContext formats edits correctly', () => {
  const data = {
    comments: [],
    edits: [{ id: 'e-001', target: 'p-002', original: 'old text', revised: 'new text', author: 'human', timestamp: '2026-01-01T00:00:00Z' }]
  };
  const ctx = extractLLMContext(data);
  assert.ok(ctx.includes('[p-002]'));
  assert.ok(ctx.includes('"old text"'));
  assert.ok(ctx.includes('"new text"'));
});

test('extractLLMContext returns empty feedback message when no annotations', () => {
  const data = { comments: [], edits: [] };
  const ctx = extractLLMContext(data);
  assert.ok(ctx.includes('No human feedback'));
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
node --test tests/utils.test.js
```

Expected: FAIL — `src/utils.js` does not exist.

- [ ] **Step 3: Implement src/utils.js**

```js
'use strict';

/**
 * Parse collab-data JSON island from a document-like object.
 * @param {Document|object} doc - must have getElementById()
 * @returns {object|null}
 */
function getCollabData(doc) {
  const el = doc.getElementById('collab-data');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

/**
 * Serialize collabData back into the script#collab-data element.
 * @param {Document|object} doc
 * @param {object} data
 */
function setCollabData(doc, data) {
  const el = doc.getElementById('collab-data');
  if (!el) return;
  el.textContent = JSON.stringify(data, null, 2);
}

/**
 * Generate the next available CID for a given type.
 * @param {string} type - e.g. 'p', 'sec', 'h', 'li'
 * @param {string[]} existingCids - all data-cid values currently in the document
 * @returns {string} - e.g. 'p-004'
 */
function generateCid(type, existingCids) {
  const prefix = type + '-';
  const nums = existingCids
    .filter(cid => cid.startsWith(prefix))
    .map(cid => parseInt(cid.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return prefix + String(next).padStart(3, '0');
}

/**
 * Truncate a quote string to at most 500 characters.
 * @param {string} text
 * @returns {string}
 */
function truncateQuote(text) {
  return text.length <= 500 ? text : text.slice(0, 500);
}

/**
 * Format collab-data into a plain-text LLM context string.
 * Replaces base64 image data with size placeholders.
 * @param {object} data - parsed collab-data object
 * @returns {string}
 */
function extractLLMContext(data) {
  const lines = ['[HUMAN FEEDBACK]'];

  if (data.comments.length === 0 && data.edits.length === 0) {
    lines.push('No human feedback.');
    return lines.join('\n');
  }

  if (data.comments.length > 0) {
    lines.push('\nComments:');
    for (const c of data.comments) {
      const imgParts = c.images.map(img => {
        const size = img.sizeBytes >= 1024 * 1024
          ? `${(img.sizeBytes / 1024 / 1024).toFixed(1)}MB`
          : img.sizeBytes >= 1024
            ? `${Math.round(img.sizeBytes / 1024)}KB`
            : `${img.sizeBytes}B`;
        return `[screenshot, ${size}, ${img.type}]`;
      });
      const imgSuffix = imgParts.length > 0 ? ' ' + imgParts.join(' ') : '';
      lines.push(`  · [${c.target}] "${c.quote}" → "${c.text}"${imgSuffix}`);
    }
  }

  if (data.edits.length > 0) {
    lines.push('\nEdits:');
    for (const e of data.edits) {
      lines.push(`  · [${e.target}] "${e.original}" → "${e.revised}"`);
    }
  }

  return lines.join('\n');
}

// CommonJS export guard — allows Node.js testing without breaking browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCollabData, setCollabData, generateCid, truncateQuote, extractLLMContext };
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
node --test tests/utils.test.js
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils.js tests/utils.test.js
git commit -m "feat: pure utility functions with tests"
```

---

## Task 4: HTML Template

**Files:**
- Create: `template/template.html`

- [ ] **Step 1: Create template/template.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="collab-html/0.1">
  <title>collab-html document</title>
  <style id="collab-styles">
<!-- COLLAB_CSS -->
  </style>
</head>
<body>

  <header id="collab-header">
    <div id="collab-header-left">
      <span id="collab-logo">collab-html</span>
      <span id="collab-title-display"></span>
    </div>
    <div id="collab-header-right">
      <span id="collab-save-status"></span>
      <button id="collab-btn-open">Open File</button>
      <button id="collab-btn-save">Save</button>
    </div>
  </header>

  <div id="collab-layout">
    <main id="collab-main">
      <!-- LLM fills this article element with content -->
      <article id="collab-content">
        <!-- CONTENT_PLACEHOLDER -->
      </article>
    </main>
    <aside id="collab-sidebar">
      <div id="collab-comments-list"></div>
    </aside>
  </div>

  <!-- Floating comment toolbar (shown on text selection) -->
  <div id="collab-toolbar" style="display:none">
    <button id="collab-toolbar-comment">+ Comment</button>
  </div>

  <!-- Comment input panel (shown in sidebar when adding) -->
  <div id="collab-comment-panel" style="display:none">
    <textarea id="collab-comment-text" placeholder="Add a comment..."></textarea>
    <div id="collab-comment-images"></div>
    <div id="collab-comment-warning" style="display:none"></div>
    <div id="collab-comment-actions">
      <button id="collab-comment-add">Add</button>
      <button id="collab-comment-cancel">Cancel</button>
    </div>
  </div>

  <!-- collab-data JSON island — machine-readable, not rendered -->
  <script type="application/json" id="collab-data">
{
  "version": "0.1",
  "meta": {
    "title": "",
    "originalCreated": "",
    "lastRevised": "",
    "model": "",
    "maxImageBytes": 512000,
    "imageStorage": "base64"
  },
  "comments": [],
  "edits": []
}
  </script>

  <script id="collab-engine">
<!-- COLLAB_JS -->
  </script>

</body>
</html>
```

**Note on schema validity:** The template ships with `originalCreated: ""` and `lastRevised: ""`, which are not valid `date-time` strings. This is intentional — the template is a skeleton, not a valid document. It only becomes schema-valid after the LLM runs GENERATE and fills in real timestamps. No code change needed; just document this in a comment inside the template's collab-data block:

```html
  <!-- NOTE: originalCreated and lastRevised are filled by LLM at GENERATE time -->
```

Add this comment immediately before the `<script type="application/json" id="collab-data">` tag.

- [ ] **Step 2: Commit**

```bash
git add template/template.html
git commit -m "feat: add HTML template with placeholders"
```

---

## Task 5: Build Script

**Files:**
- Create: `build.js`
- Create: `tests/build.test.js`

- [ ] **Step 1: Write failing build test**

Create `tests/build.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/build.test.js
```

Expected: FAIL — `build.js` does not exist.

- [ ] **Step 3: Create build.js**

```js
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
```

Note: `src/engine.js` must exist before this test can pass. It will be created in Task 7. For now, create a stub (use `printf` to ensure the newline is written correctly):

```bash
printf '// engine stub\nconst collabEngine = {};\n' > src/engine.js
printf '/* styles stub */\n' > src/engine.css
```

- [ ] **Step 4: Run build tests**

```bash
node --test tests/build.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build.js tests/build.test.js src/engine.js src/engine.css
git commit -m "feat: build script with tests (engine stubs)"
```

---

## Task 6: Engine CSS

**Files:**
- Modify: `src/engine.css` (replace stub with full styles)

- [ ] **Step 1: Write src/engine.css**

```css
/* ============================================================
   collab-html engine styles
   All UI text is in English. No i18n.
   ============================================================ */

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 15px;
  color: #1a1a1a;
  background: #f9f9f7;
}

/* --- Header --- */
#collab-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 44px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  font-size: 13px;
}

#collab-header-left { display: flex; align-items: center; gap: 12px; }
#collab-logo { font-weight: 700; color: #2a6f4f; letter-spacing: 0.3px; }
#collab-title-display { color: #555; }
#collab-header-right { display: flex; align-items: center; gap: 10px; }

#collab-save-status { font-size: 12px; color: #888; min-width: 110px; text-align: right; }
#collab-save-status.unsaved { color: #c0392b; }
#collab-save-status.saved { color: #27ae60; }

#collab-header button {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
#collab-header button:hover { background: #f0f0f0; }
#collab-btn-save { background: #2a6f4f; color: #fff; border-color: #2a6f4f; }
#collab-btn-save:hover { background: #215c3f; }

/* --- Two-column layout --- */
#collab-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  min-height: calc(100vh - 44px);
}

#collab-main {
  padding: 40px 48px;
  max-width: 760px;
  justify-self: center;
  width: 100%;
}

#collab-sidebar {
  border-left: 1px solid #e0e0e0;
  background: #fafaf8;
  padding: 16px 12px;
  overflow-y: auto;
}

/* --- Article content --- */
#collab-content { line-height: 1.7; }
#collab-content h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
#collab-content h2 { font-size: 20px; font-weight: 600; margin-top: 32px; }
#collab-content p, #collab-content li { margin-bottom: 12px; }

/* Block hover state (edit target) */
[data-cid] { position: relative; border-radius: 4px; transition: background 0.15s; }
[data-cid]:hover { background: #f0f7f3; }
[data-cid].editing { background: #e8f4ee; outline: 2px solid #2a6f4f; }
[data-cid].dimmed { opacity: 0.35; pointer-events: none; }

/* Pencil icon on hover */
[data-cid] .collab-edit-btn {
  display: none;
  position: absolute;
  top: 4px; right: 4px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
  z-index: 10;
}
[data-cid]:hover .collab-edit-btn { display: inline-block; }

/* Edit confirm/cancel bar */
.collab-edit-bar {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.collab-edit-bar button {
  padding: 4px 12px;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
  font-size: 12px;
}
.collab-edit-bar .confirm { background: #2a6f4f; color: #fff; border-color: #2a6f4f; }

/* Edit diff display */
.collab-original { text-decoration: line-through; color: #c0392b; }
.collab-revised { color: #27ae60; }
.collab-edited-badge {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  background: #e8f4ee;
  color: #2a6f4f;
  border-radius: 3px;
  padding: 1px 5px;
  font-weight: 600;
  vertical-align: middle;
}

/* Comment highlight */
.collab-highlight {
  background: #fff3a8;
  border-radius: 2px;
  cursor: pointer;
}
.collab-highlight.active { background: #ffe066; }

/* --- Floating toolbar --- */
#collab-toolbar {
  position: fixed;
  background: #1a1a1a;
  color: #fff;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  z-index: 200;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
#collab-toolbar button {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
}
#collab-toolbar button:hover { background: rgba(255,255,255,0.15); }

/* --- Comment panel (in sidebar) --- */
#collab-comment-panel {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
#collab-comment-text {
  width: 100%;
  min-height: 80px;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}
#collab-comment-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
#collab-comment-images img {
  max-width: 100%;
  max-height: 120px;
  border-radius: 4px;
  border: 1px solid #ddd;
}
#collab-comment-warning {
  font-size: 11px;
  color: #c0392b;
  margin-top: 6px;
  padding: 4px 8px;
  background: #fef0ef;
  border-radius: 4px;
}
#collab-comment-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  justify-content: flex-end;
}
#collab-comment-actions button {
  padding: 5px 14px;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
  font-size: 12px;
}
#collab-comment-add { background: #2a6f4f; color: #fff; border-color: #2a6f4f; }

/* --- Comment bubbles in sidebar --- */
.collab-comment-bubble {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 13px;
  cursor: pointer;
}
.collab-comment-bubble:hover { border-color: #2a6f4f; }
.collab-comment-bubble.active { border-color: #2a6f4f; box-shadow: 0 0 0 2px #e8f4ee; }
.collab-comment-quote {
  font-size: 11px;
  color: #888;
  border-left: 2px solid #ccc;
  padding-left: 6px;
  margin-bottom: 6px;
  font-style: italic;
}
.collab-comment-text { color: #333; }
.collab-comment-meta { font-size: 11px; color: #aaa; margin-top: 6px; }
```

- [ ] **Step 2: Run build tests to confirm CSS is inlined**

```bash
node --test tests/build.test.js
```

Expected: PASS (the test checks for `#collab-header` in the built file)

- [ ] **Step 3: Commit**

```bash
git add src/engine.css
git commit -m "feat: engine CSS styles"
```

---

## Task 7: Engine — Initialization and File Access

**Files:**
- Modify: `src/engine.js` (replace stub, implement init + file access)

This task and Tasks 8–11 are DOM-dependent. Testing is done manually in Chrome as described in each step.

- [ ] **Step 1: Write src/engine.js — init and file access**

Replace the stub content of `src/engine.js` with:

```js
'use strict';
/* collab-html engine — DOM-dependent, runs in Chrome only */

(function collabEngine() {

  // ── State ──────────────────────────────────────────────────
  let fileHandle = null;
  let isDirty = false;
  let pendingCommentRange = null;   // Selection range when comment toolbar clicked
  let pendingCommentTarget = null;  // data-cid of targeted block

  // ── DOM refs ───────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const header = {
    title: $('collab-title-display'),
    status: $('collab-save-status'),
    btnOpen: $('collab-btn-open'),
    btnSave: $('collab-btn-save'),
  };

  // ── Init ───────────────────────────────────────────────────
  function init() {
    const data = getCollabData(document);
    if (data && data.meta.title) {
      header.title.textContent = data.meta.title;
      document.title = data.meta.title + ' — collab-html';
    }

    attachEditButtons();
    renderState();

    header.btnOpen.addEventListener('click', openFile);
    header.btnSave.addEventListener('click', saveFile);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
    });

    document.addEventListener('selectionchange', onSelectionChange);
  }

  // ── File access ────────────────────────────────────────────
  async function openFile() {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'collab-html documents', accept: { 'text/html': ['.html'] } }],
    });
    // Note: document.write() replaces the entire page including this IIFE.
    // The new document's embedded engine script re-executes from scratch,
    // which means fileHandle will be reset to null in the new instance.
    // This is intentional and consistent with the spec (Section 4.3):
    // "FileHandle is session-scoped; re-opening the tab requires showSaveFilePicker again."
    // The first Ctrl+S after opening a file will trigger showSaveFilePicker.
    const file = await handle.getFile();
    const html = await file.text();
    document.open();
    document.write(html);
    document.close();
  }

  async function saveFile() {
    if (!fileHandle) {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: (getCollabData(document)?.meta?.title || 'document') + '.html',
        types: [{ description: 'collab-html documents', accept: { 'text/html': ['.html'] } }],
      });
    }
    const writable = await fileHandle.createWritable();
    await writable.write(document.documentElement.outerHTML);
    await writable.close();
    setStatus('saved');
    isDirty = false;
  }

  function markDirty() {
    if (!isDirty) { isDirty = true; setStatus('unsaved'); }
  }

  function setStatus(state) {
    const el = header.status;
    el.className = state;
    if (state === 'saved') el.textContent = 'Saved ✓';
    else if (state === 'unsaved') el.textContent = '● Unsaved changes';
    else el.textContent = '';
  }

  // ── renderState stub — implemented fully in Task 11 ────────
  // Must exist here so init() can call it during Tasks 7-10.
  function renderState() { /* no-op until Task 11 */ }

  // ── Expose internal functions used in later tasks ──────────
  window._collab = { markDirty, setStatus };

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
```

- [ ] **Step 2: Build and open in Chrome to verify**

```bash
node build.js
```

Open `dist/collab-template.html` in Chrome. Verify:
- Header renders with "collab-html" logo, "Open File" and "Save" buttons
- Opening a file triggers the file picker
- Ctrl+S triggers save picker on a new file
- Save picker writes the file back

- [ ] **Step 3: Commit**

```bash
git add src/engine.js
git commit -m "feat: engine init and File System Access API"
```

---

## Task 8: Engine — Comment Flow

**Files:**
- Modify: `src/engine.js` (add comment functions)

- [ ] **Step 1: Add comment flow functions to src/engine.js**

Inside the `collabEngine` IIFE, replace `// ── Expose internal functions` with the following additions, then re-add the expose block at the end:

```js
  // ── Selection / toolbar ────────────────────────────────────
  function onSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      $('collab-toolbar').style.display = 'none';
      return;
    }
    // Only show toolbar if selection is inside #collab-content
    const range = sel.getRangeAt(0);
    const content = $('collab-content');
    if (!content.contains(range.commonAncestorContainer)) {
      $('collab-toolbar').style.display = 'none';
      return;
    }
    // Position toolbar above the selection
    const rect = range.getBoundingClientRect();
    const toolbar = $('collab-toolbar');
    toolbar.style.display = 'block';
    toolbar.style.top = (window.scrollY + rect.top - 38) + 'px';
    toolbar.style.left = (window.scrollX + rect.left) + 'px';

    $('collab-toolbar-comment').onclick = () => {
      pendingCommentRange = range.cloneRange();
      pendingCommentTarget = findTargetCid(range.commonAncestorContainer);
      toolbar.style.display = 'none';
      openCommentPanel();
    };
  }

  function findTargetCid(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body) {
      if (el.dataset.cid) return el.dataset.cid;
      el = el.parentElement;
    }
    return null;
  }

  // ── Comment panel ──────────────────────────────────────────
  function openCommentPanel() {
    const panel = $('collab-comment-panel');
    $('collab-comment-text').value = '';
    $('collab-comment-images').innerHTML = '';
    $('collab-comment-warning').style.display = 'none';
    panel.style.display = 'block';
    $('collab-comments-list').prepend(panel);
    $('collab-comment-text').focus();

    panel._images = [];   // staged images for current comment

    $('collab-comment-text').onpaste = handleCommentPaste;
    $('collab-comment-add').onclick = commitComment;
    $('collab-comment-cancel').onclick = () => {
      panel.style.display = 'none';
      pendingCommentRange = null;
      pendingCommentTarget = null;
    };
  }

  function commitComment() {
    const text = $('collab-comment-text').value.trim();
    if (!text && $('collab-comment-panel')._images.length === 0) return;

    const quote = pendingCommentRange
      ? truncateQuote(pendingCommentRange.toString())
      : '';

    const data = getCollabData(document);
    const existingIds = data.comments.map(c => c.id);
    const id = generateCid('c', existingIds);  // uses max existing c-NNN, avoids duplicates
    const comment = {
      id,
      target: pendingCommentTarget || 'unknown',
      quote,
      text,
      images: $('collab-comment-panel')._images,
      author: 'human',
      timestamp: new Date().toISOString(),
    };
    data.comments.push(comment);
    setCollabData(document, data);
    markDirty();

    // Highlight selection in article
    if (pendingCommentRange) {
      const mark = document.createElement('mark');
      mark.className = 'collab-highlight';
      mark.dataset.commentId = id;
      pendingCommentRange.surroundContents(mark);
    }

    $('collab-comment-panel').style.display = 'none';
    pendingCommentRange = null;
    pendingCommentTarget = null;
    renderCommentBubble(comment);
  }

  function renderCommentBubble(comment) {
    const list = $('collab-comments-list');
    const bubble = document.createElement('div');
    bubble.className = 'collab-comment-bubble';
    bubble.dataset.commentId = comment.id;
    bubble.innerHTML = `
      <div class="collab-comment-quote">${escapeHtml(comment.quote)}</div>
      <div class="collab-comment-text">${escapeHtml(comment.text)}</div>
      ${comment.images.map(img =>
        img.type === 'base64'
          ? `<img src="${img.data}" alt="screenshot">`
          : `<img src="${img.url}" alt="screenshot">`
      ).join('')}
      <div class="collab-comment-meta">${new Date(comment.timestamp).toLocaleString()}</div>
    `;
    list.appendChild(bubble);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
```

- [ ] **Step 2: Build and manually test in Chrome**

```bash
node build.js
```

Open `dist/collab-template.html`. Add some text to the article (for now edit the template directly). Verify:
- Selecting text shows the floating toolbar
- Clicking "+ Comment" opens the panel in the sidebar
- Typing a comment and clicking "Add" highlights the text and shows a bubble
- The collab-data JSON island updates (view source)
- Cancel dismisses the panel

- [ ] **Step 3: Commit**

```bash
git add src/engine.js
git commit -m "feat: engine comment flow"
```

---

## Task 9: Engine — Screenshot Paste

**Files:**
- Modify: `src/engine.js` (add paste handler)

- [ ] **Step 1: Add handleCommentPaste to src/engine.js**

Add inside the IIFE (before the expose block):

```js
  // ── Screenshot paste ───────────────────────────────────────
  function handleCommentPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const sizeBytes = blob.size;
        const data = getCollabData(document);
        const maxBytes = data?.meta?.maxImageBytes ?? 512000;

        if (sizeBytes > maxBytes) {
          const warn = $('collab-comment-warning');
          const sizeKB = Math.round(sizeBytes / 1024);
          const maxKB = Math.round(maxBytes / 1024);
          warn.textContent = `This image is ${sizeKB} KB (limit: ${maxKB} KB). Consider cropping it before attaching to keep the file AI-friendly.`;
          warn.style.display = 'block';
        }

        const imgObj = {
          id: 'img-' + Date.now(),
          type: 'base64',
          data: dataUrl,
          sizeBytes,
        };
        $('collab-comment-panel')._images.push(imgObj);

        const preview = document.createElement('img');
        preview.src = dataUrl;
        $('collab-comment-images').appendChild(preview);
      };
      reader.readAsDataURL(blob);
    }
  }
```

- [ ] **Step 2: Build and test in Chrome**

```bash
node build.js
```

Open `dist/collab-template.html`. Open a comment panel. Take a screenshot (e.g. with Cmd+Shift+4 on Mac, copy to clipboard), then paste into the comment textarea. Verify:
- Image preview appears below the textarea
- For an image > 500 KB: warning message appears in English
- Warning does not block adding the comment
- After clicking "Add", the comment bubble in the sidebar shows the image

- [ ] **Step 3: Commit**

```bash
git add src/engine.js
git commit -m "feat: screenshot paste in comment panel"
```

---

## Task 10: Engine — Inline Edit Flow

**Files:**
- Modify: `src/engine.js` (add edit functions)

- [ ] **Step 1: Add edit flow functions to src/engine.js**

Add inside the IIFE:

```js
  // ── Inline edit ────────────────────────────────────────────
  function attachEditButtons() {
    const content = $('collab-content');
    content.querySelectorAll('[data-cid]').forEach(attachEditButton);

    // Also handle auto-CID for blocks without data-cid
    let autoIdx = 0;
    const BLOCK_TAGS = ['P','SECTION','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','PRE','TABLE'];
    content.querySelectorAll(BLOCK_TAGS.join(',')).forEach(el => {
      if (!el.dataset.cid) {
        el.dataset.cid = 'auto-' + (++autoIdx);
        console.warn('[collab-html] auto-assigned CID:', el.dataset.cid, el);
        attachEditButton(el);
      }
    });
  }

  function attachEditButton(el) {
    if (el.querySelector('.collab-edit-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'collab-edit-btn';
    btn.textContent = '✎ Edit';
    btn.addEventListener('click', (e) => { e.stopPropagation(); startEdit(el); });
    el.appendChild(btn);
  }

  function startEdit(el) {
    // Dim all other blocks
    $('collab-content').querySelectorAll('[data-cid]').forEach(b => {
      b.classList.toggle('dimmed', b !== el);
    });
    el.classList.add('editing');
    el.contentEditable = 'true';
    el.focus();

    // Store original text (from LLM version, not previous human edit)
    const data = getCollabData(document);
    const existing = data.edits.find(e => e.target === el.dataset.cid);
    el.dataset.editOriginal = existing ? existing.original : el.innerText.trim();

    // Show confirm/cancel bar
    const bar = document.createElement('div');
    bar.className = 'collab-edit-bar';
    bar.innerHTML = `
      <button class="confirm">Confirm (Ctrl+Enter)</button>
      <button class="cancel">Cancel</button>
    `;
    bar.querySelector('.confirm').onclick = () => confirmEdit(el, bar);
    bar.querySelector('.cancel').onclick = () => cancelEdit(el, bar);
    el.after(bar);

    el.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirmEdit(el, bar);
        el.removeEventListener('keydown', handler);
      }
    });
  }

  function confirmEdit(el, bar) {
    const revised = el.innerText.trim();
    const original = el.dataset.editOriginal;

    if (revised === original) {
      cancelEdit(el, bar);
      return;
    }

    // Save diff to collab-data
    const data = getCollabData(document);
    const cid = el.dataset.cid;
    const existingIdx = data.edits.findIndex(e => e.target === cid);
    const editRecord = {
      id: existingIdx >= 0 ? data.edits[existingIdx].id : 'e-' + String(data.edits.length + 1).padStart(3, '0'),
      target: cid,
      original,
      revised,
      author: 'human',
      timestamp: new Date().toISOString(),
    };
    if (existingIdx >= 0) data.edits[existingIdx] = editRecord;
    else data.edits.push(editRecord);
    setCollabData(document, data);
    markDirty();

    // Render diff in place
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.innerHTML = `<span class="collab-original">${escapeHtml(original)}</span> <span class="collab-revised">${escapeHtml(revised)}</span><span class="collab-edited-badge">edited</span>`;

    // Remove edit button (re-add after undim)
    el.querySelector('.collab-edit-btn')?.remove();
    attachEditButton(el);

    bar.remove();
    undimAll();
  }

  function cancelEdit(el, bar) {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    delete el.dataset.editOriginal;
    bar.remove();
    undimAll();
  }

  function undimAll() {
    $('collab-content').querySelectorAll('[data-cid]').forEach(b => b.classList.remove('dimmed'));
  }
```

- [ ] **Step 2: Build and test in Chrome**

```bash
node build.js
```

Open `dist/collab-template.html` with some article content. Hover over a paragraph, click "✎ Edit". Verify:
- Other blocks dim
- Block becomes editable
- Ctrl+Enter confirms and shows strikethrough + green text + "edited" badge
- Cancel restores original, no change to collab-data
- A second edit to the same block overwrites the first entry in collab-data

- [ ] **Step 3: Commit**

```bash
git add src/engine.js
git commit -m "feat: inline edit flow with diff tracking"
```

---

## Task 11: Engine — State Rendering on Load

**Files:**
- Modify: `src/engine.js` (add renderState function)

When a file is opened, existing comments and edits in collab-data must be re-applied to the DOM.

- [ ] **Step 1: Add renderState to src/engine.js**

Replace the stub `renderState()` call in `init()` (it calls the function — now implement it):

```js
  // ── Render saved state ─────────────────────────────────────
  function renderState() {
    const data = getCollabData(document);
    if (!data) return;

    // Render edits
    for (const edit of data.edits) {
      const el = $('collab-content').querySelector(`[data-cid="${edit.target}"]`);
      if (!el) continue;
      el.innerHTML = `<span class="collab-original">${escapeHtml(edit.original)}</span> <span class="collab-revised">${escapeHtml(edit.revised)}</span><span class="collab-edited-badge">edited</span>`;
    }

    // Render comment bubbles (highlights are in the HTML already if saved after selection)
    for (const comment of data.comments) {
      renderCommentBubble(comment);
    }
  }
```

- [ ] **Step 2: Build and verify round-trip in Chrome**

```bash
node build.js
```

Full workflow test:
1. Open `dist/collab-template.html` (or an example file with content)
2. Add a comment → add an edit → click Save → note the filename
3. Close the tab
4. Re-open the saved `.html` file in Chrome
5. Verify: comment bubble appears in sidebar, edited block shows diff

- [ ] **Step 3: Commit**

```bash
git add src/engine.js
git commit -m "feat: render saved annotations on file load"
```

---

## Task 12: Build Integration and Example File

**Files:**
- Run all tests, rebuild
- Create: `examples/example.html`

- [ ] **Step 1: Run full test suite**

```bash
cd ~/Projects/collab-html
node --test tests/utils.test.js tests/build.test.js
```

Expected: all PASS

- [ ] **Step 2: Build final dist**

```bash
node build.js
```

Expected: `dist/collab-template.html` produced, no errors.

- [ ] **Step 3: Create examples/example.html**

Copy `dist/collab-template.html` to `examples/example.html`. Then edit the `<article>` and `collab-data` sections to contain a realistic demo:
- Article: a short market analysis document (3 paragraphs, 1 section) with `data-cid` values
- collab-data: 1 comment with a short quote, 1 edit showing a diff, no images

The example file should be hand-crafted (not built) so it lives permanently in the repo.

Key values to set in collab-data meta:
- `"title": "Market Analysis — Demo"`
- `"model": "claude-opus-4"`
- `"originalCreated"`: any valid ISO timestamp
- `"lastRevised"`: same as originalCreated (first generation)

- [ ] **Step 4: Open examples/example.html in Chrome and verify**

Verify all three states render correctly:
- Yellow highlight on commented text
- Comment bubble in sidebar with quote and text
- Edited block shows strikethrough + green text + "edited" badge

- [ ] **Step 5: Commit**

```bash
git add examples/example.html
git commit -m "feat: add example document with sample annotations"
```

---

## Task 13: LLM Skill

**Files:**
- Create: `skill/SKILL.md`

- [ ] **Step 1: Write skill/SKILL.md**

```markdown
# collab-html Skill

Use this skill when asked to create a document for human review, read an annotated collab-html file, or produce a revised version based on human feedback.

---

## GENERATE — Create a new collab-html document

**When:** User asks you to write, draft, or generate a document.

**Steps:**

1. Start with the content of `dist/collab-template.html` as your base structure.
2. Fill `<article id="collab-content">` with semantic HTML:
   - Use `<h1>` for the document title, `<h2>` for sections, `<p>` for paragraphs, `<ul>`/`<li>` for lists.
3. Assign a `data-cid` attribute to **every** block element. Rules:
   - Format: `<type>-<zero-padded-3-digits>` — e.g. `p-001`, `h-001`, `sec-001`, `li-001`
   - Types: `p` → `<p>`, `h` → `<h1>`–`<h6>`, `sec` → `<section>`, `li` → `<li>`, `bq` → `<blockquote>`, `pre` → `<pre>`, `tbl` → `<table>`
   - Sequential per type across the whole document (not per section)
   - Every block must have one; never skip or duplicate
4. Populate `collab-data` meta:
   - `title`: the document title
   - `originalCreated` and `lastRevised`: both set to the current ISO timestamp
   - `model`: your model identifier
   - `maxImageBytes`: 512000 (default; do not change unless user specifies)
   - `imageStorage`: "base64"
   - `comments`: []
   - `edits`: []
5. Output the complete `.html` file.

---

## READ — Extract context from an annotated file

**When:** User provides a `.html` file that has been annotated by a human.

**Steps:**

1. Parse `<article id="collab-content">` — this is the document text.
2. Parse the JSON inside `<script type="application/json" id="collab-data">`.
3. Build and present this context block:

```
[DOCUMENT CONTENT]
<paste the inner HTML of <article id="collab-content"> here>

[HUMAN FEEDBACK]

Comments:
  · [<target>] "<quote>" → "<comment text>" [screenshot, <size>KB, base64]

Edits:
  · [<target>] "<original>" → "<revised>"
```

The format above matches the output of `extractLLMContext()` in `src/utils.js` exactly. Do not change this format independently in the skill without also updating `extractLLMContext`.

4. Image handling:
   - **Default (text-only model):** replace each image's `data` value with `[screenshot, <size>KB, base64]`. Do not include the raw base64 string.
   - **Multimodal model:** decode each base64 image and send it as an image input alongside the text context.

5. Where the same `data-cid` appears in both Comments and Edits: note that the comment's quote reflects the **original** (pre-edit) text. In REVISE, apply the edit first, then interpret the comment against the updated text.

---

## REVISE — Produce a new version incorporating human feedback

**When:** After READ, the user asks you to revise the document.

**Steps:**

1. For each entry in `edits`: replace the text of the corresponding `data-cid` block with `revised` verbatim.
2. For each entry in `comments`: revise the content of the targeted block to address the feedback. For blocks with both an edit and a comment, apply the edit first, then address the comment.
3. Add new blocks as needed: assign fresh CIDs continuing from the highest existing number for each type (e.g. if `p-007` exists, next paragraph is `p-008`).
4. Remove blocks as needed: retire their CIDs permanently — never reuse them.
5. Output a new complete `.html` file with:
   - Updated `<article>` content
   - All original `data-cid` values preserved (do not reassign existing IDs)
   - `collab-data` reset: `comments: []`, `edits: []`
   - `meta.lastRevised` updated to current timestamp
   - `meta.model` updated to your model identifier
   - `meta.originalCreated` **unchanged**

---

## Image compression (multimodal models, REVISE mode)

If a comment contains images with `sizeBytes > meta.maxImageBytes`, and you support multimodal input:
1. Receive the image as a visual input.
2. Re-encode a compressed version (≤ `maxImageBytes`) to base64.
3. Write the compressed version to the new file with `"compressedBy": "<your model id>"`.

---

## Reference

- Format spec: `docs/superpowers/specs/2026-05-25-collab-html-design.md`
- Template: `dist/collab-template.html`
- Example: `examples/example.html`
```

- [ ] **Step 2: Verify skill is readable**

```bash
cat skill/SKILL.md | head -20
```

Expected: first lines of the skill render correctly.

- [ ] **Step 3: Commit and distribute**

```bash
git add skill/SKILL.md
git commit -m "feat: LLM skill for GENERATE / READ / REVISE modes"
```

Optionally copy to Claude Code user skills:
```bash
cp skill/SKILL.md ~/.claude/collab-html.md
```

---

## Task 14: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# collab-html

A lightweight, open-source format for LLM–human collaborative document editing.

One `.html` file contains LLM-generated content, human annotations, and inline edits —
all readable by the next LLM call. Open in Chrome, annotate, save, feed back to AI.

## Quick start

**For humans (Chrome):**
1. Open any `.html` file built with collab-html in Chrome
2. Select text → `+ Comment` to add a comment (paste screenshots with Ctrl+V)
3. Hover a paragraph → `✎ Edit` to edit inline (Ctrl+Enter to confirm)
4. `Ctrl+S` to save

**For LLMs:** See `skill/SKILL.md` for GENERATE / READ / REVISE instructions.

## Build

```bash
node build.js
# → dist/collab-template.html
```

No npm install required.

## Run tests

```bash
node --test tests/utils.test.js tests/build.test.js
```

## Format

A collab-html file has four layers:

| Layer | Element | Description |
|-------|---------|-------------|
| Content | `<article id="collab-content">` | LLM-generated HTML with `data-cid` on every block |
| Data | `<script id="collab-data" type="application/json">` | JSON island: comments, edits, meta |
| Styles | `<style id="collab-styles">` | Inlined annotation UI CSS |
| Engine | `<script id="collab-engine">` | Inlined vanilla JS annotation engine |

See `docs/superpowers/specs/2026-05-25-collab-html-design.md` for the full spec.

## Browser support

Chrome desktop only (requires [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)).

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quick start and format overview"
```

---

## Final Verification Checklist

- [ ] `node --test tests/utils.test.js tests/build.test.js` — all PASS
- [ ] `node build.js` — produces `dist/collab-template.html` without errors
- [ ] Open `examples/example.html` in Chrome — comments and edits render correctly
- [ ] Full round-trip: open → comment → edit → save → reopen → state restored
- [ ] `skill/SKILL.md` copied to `~/.claude/` for Claude Code use
