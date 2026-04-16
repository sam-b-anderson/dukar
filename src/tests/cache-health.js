const { invoke } = require('../invoke');

async function runCacheHealth() {
  const result = await invoke({
    prompt: 'What is 2+2? Reply with only the number.',
    model: 'opus',
    timeoutMs: 10000,
  });

  // Test 3 is informational only
  return { ...result, score: 'info' };
}

module.exports = { runCacheHealth };
