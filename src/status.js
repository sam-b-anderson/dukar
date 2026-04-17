const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function status() {
  const latestPath = path.join(os.homedir(), '.dukar', 'latest.json');

  let data;
  try {
    data = JSON.parse(await fs.readFile(latestPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No Dukar runs yet. Try `dukar run`.');
      return;
    }
    throw e;
  }

  const timestamp = new Date(data.timestamp);
  const ageMs = Date.now() - timestamp.getTime();
  const dateStr = timestamp.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  if (ageMs > 48 * 60 * 60 * 1000) {
    console.log(`WARNING: results are STALE (last run: ${dateStr})`);
  }

  console.log(`Dukar status (last run: ${dateStr})`);
  console.log(`Verdict: ${data.verdict.toUpperCase()}`);

  if (data.tests?.carWash?.adaptive) {
    console.log(`  Car wash adaptive: ${data.tests.carWash.adaptive.score.toUpperCase()}`);
  }
  if (data.tests?.carWash?.forced) {
    console.log(`  Car wash forced:   ${data.tests.carWash.forced.score.toUpperCase()}`);
  }
  if (data.tests?.toolUse) {
    console.log(`  Tool use:          ${data.tests.toolUse.score.toUpperCase()}`);
  }
  if (data.tests?.cacheHealth) {
    console.log(`  Cache tier:        ${data.tests.cacheHealth.cacheTier}`);
  }
  if (data.quota?.utilization != null) {
    console.log(`  Quota:             ${(data.quota.utilization * 100).toFixed(0)}% of ${data.quota.rateLimitType || 'window'}`);
  }

  console.log('\nFull results: ~/.dukar/latest.json');
}

module.exports = { status };
