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
