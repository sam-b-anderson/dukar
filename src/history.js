const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function history() {
  const historyPath = path.join(os.homedir(), '.dukar', 'history.jsonl');

  let raw;
  try {
    raw = await fs.readFile(historyPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No history yet.');
      return;
    }
    throw e;
  }

  const runs = raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

  if (runs.length === 0) {
    console.log('No history yet.');
    return;
  }

  console.log('Dukar history\n');

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const last7 = runs.filter(r => (now - new Date(r.timestamp).getTime()) < 7 * DAY);
  const last30 = runs.filter(r => (now - new Date(r.timestamp).getTime()) < 30 * DAY);

  printStats('Last 7 days', last7);
  printStats('Last 30 days', last30);

  const totalCost = runs.reduce((acc, r) => acc + (r.totals?.costUsd ?? 0), 0);
  console.log(`Total runs: ${runs.length}`);
  console.log(`Total cost: $${totalCost.toFixed(2)}`);
}

function printStats(title, runs) {
  const counts = { healthy: 0, degraded: 0, skipped: 0, unknown: 0 };
  let carWashPasses = 0, carWashTotal = 0;
  let toolPasses = 0, toolTotal = 0;

  for (const r of runs) {
    counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;

    if (r.verdict === 'skipped' || !r.tests) continue;

    const carWash = r.tests.carWash?.adaptive;
    if (carWash) {
      if (carWash.score === 'pass') carWashPasses++;
      if (carWash.score !== 'error') carWashTotal++;
    }

    const tool = r.tests.toolUse;
    if (tool) {
      if (tool.score === 'pass') toolPasses++;
      if (tool.score !== 'error') toolTotal++;
    }
  }

  console.log(`${title}:`);
  console.log(`  Healthy:  ${counts.healthy} days`);
  console.log(`  Degraded: ${counts.degraded} days`);
  console.log(`  Skipped:  ${counts.skipped} day${counts.skipped === 1 ? '' : 's'}`);
  console.log(`  Unknown:  ${counts.unknown} day${counts.unknown === 1 ? '' : 's'}`);
  if (carWashTotal > 0) {
    console.log(`  Car wash adaptive pass rate: ${((carWashPasses / carWashTotal) * 100).toFixed(0)}% (${carWashPasses}/${carWashTotal} non-skipped days)`);
  }
  if (toolTotal > 0) {
    console.log(`  Tool use pass rate: ${((toolPasses / toolTotal) * 100).toFixed(0)}% (${toolPasses}/${toolTotal} non-skipped days)`);
  }
  console.log('');
}

module.exports = { history };
