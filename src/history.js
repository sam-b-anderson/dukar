const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const readline = require('readline');

async function history() {
  const dukarDir = path.join(os.homedir(), '.dukar');
  const historyPath = path.join(dukarDir, 'history.jsonl');

  try {
    const runs = [];
    const fileStream = (await fs.open(historyPath, 'r')).createReadStream();
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        runs.push(JSON.parse(line));
      }
    }

    if (runs.length === 0) {
      console.log('No history yet.');
      return;
    }

    console.log('Dukar history\n');

    const last7Days = runs.filter(r => (Date.now() - new Date(r.timestamp).getTime()) < 7 * 24 * 60 * 60 * 1000);
    const last30Days = runs.filter(r => (Date.now() - new Date(r.timestamp).getTime()) < 30 * 24 * 60 * 60 * 1000);

    const printStats = (title, periodRuns) => {
      const counts = { healthy: 0, degraded: 0, skipped: 0, unknown: 0 };
      let carWashAdaptivePasses = 0;
      let carWashAdaptiveTotal = 0;
      let toolUsePasses = 0;
      let toolUseTotal = 0;
      let totalCost = 0;

      periodRuns.forEach(r => {
        counts[r.verdict] = (counts[r.verdict] || 0) + 1;
        if (r.verdict !== 'skipped' && r.tests) {
          if (r.tests.carWash?.adaptive) {
            if (r.tests.carWash.adaptive.score === 'pass') carWashAdaptivePasses++;
            if (r.tests.carWash.adaptive.score !== 'error') carWashAdaptiveTotal++;
          }
          if (r.tests.toolUse) {
            if (r.tests.toolUse.score === 'pass') toolUsePasses++;
            if (r.tests.toolUse.score !== 'error') toolUseTotal++;
          }
        }
        totalCost += (r.totals?.costUsd || 0);
      });

      console.log(`${title}:`);
      console.log(`  Healthy:  ${counts.healthy} days`);
      console.log(`  Degraded: ${counts.degraded} days`);
      console.log(`  Skipped:  ${counts.skipped} day${counts.skipped === 1 ? '' : 's'}`);
      console.log(`  Unknown:  ${counts.unknown} day${counts.unknown === 1 ? '' : 's'}`);
      console.log(`  Car wash adaptive pass rate: ${carWashAdaptiveTotal > 0 ? ((carWashAdaptivePasses / carWashAdaptiveTotal) * 100).toFixed(0) : 0}% (${carWashAdaptivePasses}/${carWashAdaptiveTotal} non-skipped days)`);
      console.log(`  Tool use pass rate: ${toolUseTotal > 0 ? ((toolUsePasses / toolUseTotal) * 100).toFixed(0) : 0}% (${toolUsePasses}/${toolUseTotal} non-skipped days)`);
      console.log('');
      return totalCost;
    };

    printStats('Last 7 days', last7Days);
    printStats('Last 30 days', last30Days);

    let totalCostAll = runs.reduce((acc, r) => acc + (r.totals?.costUsd || 0), 0);
    console.log(`Total runs: ${runs.length}`);
    console.log(`Total cost: $${totalCostAll.toFixed(2)}`);

  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No history yet.');
    } else {
      console.error('Error reading history:', e.message);
    }
  }
}

module.exports = { history };
