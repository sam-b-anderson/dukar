const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function writeResults(data) {
  const dukarDir = path.join(os.homedir(), '.dukar');
  await fs.mkdir(dukarDir, { recursive: true });

  const latestPath = path.join(dukarDir, 'latest.json');
  await fs.writeFile(latestPath, JSON.stringify(data, null, 2));

  const historyPath = path.join(dukarDir, 'history.jsonl');
  await fs.appendFile(historyPath, JSON.stringify(data) + '\n');
}

function printReport(data) {
  const { verdict, timestamp, tests, totals, quota } = data;
  const dateStr = new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  console.log(`Dukar diagnostic report — ${dateStr}`);
  console.log(`Verdict: ${verdict.toUpperCase()}\n`);

  const adaptive = tests.carWash?.adaptive;
  if (adaptive) {
    console.log(`Test 1 (car wash, adaptive):       ${adaptive.score.toUpperCase()}`);
    console.log(`  Response: "${(adaptive.responseText || '').slice(0, 60).replace(/\n/g, ' ')}..."`);
    console.log(`  Thinking: ${adaptive.thinkingPresent ? 'present' : 'absent'}`);
    console.log(`  Tokens: ${adaptive.outputTokens ?? 0}, Duration: ${((adaptive.durationApiMs ?? 0) / 1000).toFixed(1)}s, Cost: $${(adaptive.costUsd ?? 0).toFixed(3)}`);
    console.log('');
  }

  const forced = tests.carWash?.forced;
  if (forced) {
    console.log(`Test 2 (car wash, forced thinking): ${forced.score.toUpperCase()}`);
    console.log(`  Response: "${(forced.responseText || '').slice(0, 60).replace(/\n/g, ' ')}..."`);
    console.log(`  Thinking: ${forced.thinkingPresent ? 'present' : 'absent'}${forced.thinkingContent ? ` (${forced.thinkingContent.length} chars)` : ''}`);
    console.log(`  Tokens: ${forced.outputTokens ?? 0}, Duration: ${((forced.durationApiMs ?? 0) / 1000).toFixed(1)}s, Cost: $${(forced.costUsd ?? 0).toFixed(3)}`);
    console.log('');
  }

  console.log(`Test 3 (cache health):              info`);
  console.log(`  Cache tier: ${tests.cacheHealth?.cacheTier ?? 'unknown'}`);
  if (quota?.utilization != null) {
    console.log(`  Quota utilization: ${(quota.utilization * 100).toFixed(0)}% of ${quota.rateLimitType || 'window'}`);
  }
  console.log('');

  const tool = tests.toolUse;
  if (tool) {
    console.log(`Test 4 (tool use):                  ${tool.score.toUpperCase()}`);
    console.log(`  Read before edit: ${tool.readBeforeEdit ? 'yes' : 'no'}`);
    console.log(`  Edit type: ${tool.writeInvoked ? 'full-rewrite' : 'surgical'}`);
    console.log(`  Thinking: ${tool.thinkingPresent ? 'present' : 'absent'}`);
    console.log(`  Tokens: ${tool.outputTokens ?? 0}, Duration: ${((tool.durationApiMs ?? 0) / 1000).toFixed(1)}s, Cost: $${(tool.costUsd ?? 0).toFixed(3)}`);
    console.log('');
  }

  console.log(`Total: $${(totals.costUsd ?? 0).toFixed(3)} across ${((totals.durationMs ?? 0) / 1000).toFixed(1)}s`);
  console.log('');

  if (verdict === 'degraded') {
    console.log('Recommendation: set CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 in your shell');
  }
  console.log('Detailed results: ~/.dukar/latest.json');
}

function printDegradedWarning(tests) {
  const tokens = tests.carWash?.adaptive?.outputTokens ?? '?';
  process.stderr.write('Dukar: DEGRADED today\n');
  process.stderr.write(`  Car wash test failed (adaptive thinking skipped, ${tokens} output tokens)\n`);
  process.stderr.write('  Recommendation: set CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 in your shell\n');
  process.stderr.write('  Background tests still running. Full results: ~/.dukar/latest.json\n');
}

module.exports = { writeResults, printReport, printDegradedWarning };
