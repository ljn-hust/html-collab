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
