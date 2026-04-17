const { test } = require('node:test');
const assert = require('node:assert/strict');
const { invoke } = require('../src/invoke');
const { EventEmitter } = require('node:events');

function createMockChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.kill = () => {};
  return child;
}

test('invoke: correctly parses streaming NDJSON from claude CLI', async () => {
  const mockSpawn = () => {
    const child = createMockChild();
    
    // Simulate events after a small delay
    setImmediate(() => {
      child.stdout.emit('data', JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'thinking', thinking: 'I should think...' }] }
      }) + '\n');
      
      child.stdout.emit('data', JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'The answer is 42' }] }
      }) + '\n');
      
      child.stdout.emit('data', JSON.stringify({
        type: 'result',
        usage: { output_tokens: 10, input_tokens: 20 },
        total_cost_usd: 0.01
      }) + '\n');
      
      child.emit('exit', 0);
    });
    
    return child;
  };

  const result = await invoke({
    prompt: 'test',
    _spawn: mockSpawn
  });

  assert.equal(result.responseText, 'The answer is 42');
  assert.equal(result.thinkingPresent, true);
  assert.equal(result.thinkingContent, 'I should think...');
  assert.equal(result.outputTokens, 10);
  assert.equal(result.costUsd, 0.01);
  assert.equal(result.error, null);
});

test('invoke: handles malformed JSON by returning error after threshold', async () => {
  const mockSpawn = () => {
    const child = createMockChild();
    setImmediate(() => {
      for (let i = 0; i < 10; i++) {
        child.stdout.emit('data', 'not json\n');
      }
      child.emit('exit', 0);
    });
    return child;
  };

  const result = await invoke({
    prompt: 'test',
    _spawn: mockSpawn
  });

  assert.equal(result.error, 'malformed_output');
});

test('invoke: handles CLI exit error', async () => {
  const mockSpawn = () => {
    const child = createMockChild();
    setImmediate(() => {
      child.emit('exit', 1);
    });
    return child;
  };

  const result = await invoke({
    prompt: 'test',
    _spawn: mockSpawn
  });

  assert.equal(result.error, 'exit_code_1');
});

test('invoke: handles spawn error', async () => {
  const mockSpawn = () => {
    const child = createMockChild();
    setImmediate(() => {
      child.emit('error', new Error('spawn ENOENT'));
    });
    return child;
  };

  const result = await invoke({
    prompt: 'test',
    _spawn: mockSpawn
  });

  assert.equal(result.error, 'spawn ENOENT');
});
