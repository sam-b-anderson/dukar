const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreToolUse } = require('../src/tests/tool-use');

const readEvent = { tool: 'Read', input: { file_path: '/tmp/example.py' } };
const editEvent = { tool: 'Edit', input: { file_path: '/tmp/example.py', old_string: 'a', new_string: 'b' } };
const writeEvent = { tool: 'Write', input: { file_path: '/tmp/example.py', content: '...' } };

test('scoreToolUse: read then edit, no write → pass', () => {
  const result = scoreToolUse({ toolUseEvents: [readEvent, editEvent], permissionDenials: [] });
  assert.equal(result.score, 'pass');
  assert.equal(result.readBeforeEdit, true);
  assert.equal(result.writeInvoked, false);
});

test('scoreToolUse: edit before read → fail (no read-before-edit discipline)', () => {
  const result = scoreToolUse({ toolUseEvents: [editEvent, readEvent], permissionDenials: [] });
  assert.equal(result.score, 'fail');
  assert.equal(result.readBeforeEdit, false);
});

test('scoreToolUse: write invoked at all → fail (full rewrite, not surgical)', () => {
  const result = scoreToolUse({
    toolUseEvents: [readEvent, writeEvent],
    permissionDenials: [],
  });
  assert.equal(result.score, 'fail');
  assert.equal(result.writeInvoked, true);
});

test('scoreToolUse: read + edit + write → fail (write disqualifies even with proper read order)', () => {
  const result = scoreToolUse({
    toolUseEvents: [readEvent, editEvent, writeEvent],
    permissionDenials: [],
  });
  assert.equal(result.score, 'fail');
});

test('scoreToolUse: edit only, no read → fail', () => {
  const result = scoreToolUse({ toolUseEvents: [editEvent], permissionDenials: [] });
  assert.equal(result.score, 'fail');
  assert.equal(result.readInvoked, false);
});

test('scoreToolUse: read only, never edits → fail', () => {
  const result = scoreToolUse({ toolUseEvents: [readEvent], permissionDenials: [] });
  assert.equal(result.score, 'fail');
  assert.equal(result.editInvoked, false);
});

test('scoreToolUse: zero tool events → error (subprocess never produced events)', () => {
  const result = scoreToolUse({ toolUseEvents: [], permissionDenials: [] });
  assert.equal(result.score, 'error');
  assert.equal(result.toolUseEventCount, 0);
});

test('scoreToolUse: events for unrelated files do not count as read/edit', () => {
  const otherRead = { tool: 'Read', input: { file_path: '/tmp/other.py' } };
  const otherEdit = { tool: 'Edit', input: { file_path: '/tmp/other.py', old_string: 'a', new_string: 'b' } };
  const result = scoreToolUse({ toolUseEvents: [otherRead, otherEdit], permissionDenials: [] });
  assert.equal(result.readInvoked, false);
  assert.equal(result.editInvoked, false);
  assert.equal(result.score, 'fail');
});

test('scoreToolUse: surfaces permission denial count', () => {
  const result = scoreToolUse({
    toolUseEvents: [readEvent, editEvent],
    permissionDenials: [{ tool: 'Bash' }, { tool: 'Bash' }],
  });
  assert.equal(result.permissionDenialCount, 2);
});

test('scoreToolUse: missing permissionDenials defaults to 0', () => {
  const result = scoreToolUse({ toolUseEvents: [readEvent, editEvent] });
  assert.equal(result.permissionDenialCount, 0);
});
