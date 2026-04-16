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

  console.log(`Test 1 (car wash, adaptive):       ${tests.carWash.adaptive.score.toUpperCase()}`);
  console.log(`  Response: "${tests.carWash.adaptive.responseText.slice(0, 60).replace(/\n/g, ' ')}..."`);
  console.log(`  Thinking: ${tests.carWash.adaptive.thinkingPresent ? 'present' : 'absent'}`);
  console.log(`  Tokens: ${tests.carWash.adaptive.outputTokens}, Duration: ${(tests.carWash.adaptive.durationApiMs / 1000).toFixed(1)}s, Cost: $${tests.carWash.adaptive.costUsd.toFixed(3)}`);
  console.log('');

  if (tests.carWash.forced) {
    console.log(`Test 2 (car wash, forced thinking): ${tests.carWash.forced.score.toUpperCase()}`);
    console.log(`  Response: "${tests.carWash.forced.responseText.slice(0, 60).replace(/\n/g, ' ')}..."`);
    console.log(`  Thinking: ${tests.carWash.forced.thinkingPresent ? 'present' : 'absent'}${tests.carWash.forced.thinkingContent ? ` (${tests.carWash.forced.thinkingContent.length} chars)` : ''}`);
    console.log(`  Tokens: ${tests.carWash.forced.outputTokens}, Duration: ${(tests.carWash.forced.durationApiMs / 1000).toFixed(1)}s, Cost: $${tests.carWash.forced.costUsd.toFixed(3)}`);
    console.log('');
  }

  console.log(`Test 3 (cache health):              info`);
  console.log(`  Cache tier: ${tests.cacheHealth.cacheTier}`);
  if (quota && quota.utilization !== null) {
    console.log(`  Quota utilization: ${(quota.utilization * 100).toFixed(0)}% of ${quota.rateLimitType || 'window'}`);
  }
  console.log('');

  if (tests.toolUse) {
    console.log(`Test 4 (tool use):                  ${tests.toolUse.score.toUpperCase()}`);
    console.log(`  Read before edit: ${tests.toolUse.readBeforeEdit ? 'yes' : 'no'}`);
    console.log(`  Edit type: ${tests.toolUse.writeInvoked ? 'full-rewrite' : 'surgical'}`);
    console.log(`  Thinking: ${tests.toolUse.thinkingPresent ? 'present' : 'absent'}`);
    console.log(`  Tokens: ${tests.toolUse.outputTokens}, Duration: ${(tests.toolUse.durationApiMs / 1000).toFixed(1)}s, Cost: $${tests.toolUse.costUsd.toFixed(3)}`);
    console.log('');
  }

  console.log(`Total: $${totals.costUsd.toFixed(3)} across ${(totals.durationMs / 1000).toFixed(1)}s`);
  console.log('');

  if (verdict === 'degraded') {
    console.log(`Recommendation: set CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 in your shell`);
  }
  console.log(`Detailed results: ~/.dukar/latest.json`);
}

function printDegradedWarning(tests) {
  process.stderr.write(`Dukar: Opus 4.6 DEGRADED today\n`);
  process.stderr.write(`  Car wash test failed (adaptive thinking skipped, ${tests.carWash.adaptive.outputTokens} output tokens)\n`);
  process.stderr.write(`  Recommendation: set CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 in your shell\n`);
  process.stderr.write(`  Background tests still running. Full results: ~/.dukar/latest.json\n`);
}

module.exports = { writeResults, printReport, printDegradedWarning };
