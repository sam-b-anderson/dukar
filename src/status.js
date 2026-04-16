const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function status() {
  const dukarDir = path.join(os.homedir(), '.dukar');
  const latestPath = path.join(dukarDir, 'latest.json');

  try {
    const raw = await fs.readFile(latestPath, 'utf8');
    const data = JSON.parse(raw);
    
    const timestamp = new Date(data.timestamp);
    const ageMs = Date.now() - timestamp.getTime();
    
    if (ageMs > 48 * 60 * 60 * 1000) {
      console.log(`WARNING: results are STALE (last run: ${timestamp.toISOString().replace('T', ' ').slice(0, 19)} UTC)`);
    }

    console.log(`Dukar status (last run: ${timestamp.toISOString().replace('T', ' ').slice(0, 19)} UTC)`);
    console.log(`Verdict: ${data.verdict.toUpperCase()}`);
    
    if (data.tests && data.tests.carWash) {
      console.log(`  Car wash adaptive: ${data.tests.carWash.adaptive.score.toUpperCase()}`);
      console.log(`  Car wash forced:   ${data.tests.carWash.forced.score.toUpperCase()}`);
    }
    
    if (data.tests && data.tests.toolUse) {
      console.log(`  Tool use:          ${data.tests.toolUse.score.toUpperCase()}`);
    }
    
    if (data.tests && data.tests.cacheHealth) {
      console.log(`  Cache tier:        ${data.tests.cacheHealth.cacheTier}`);
    }

    if (data.quota && data.quota.utilization !== null) {
      console.log(`  Quota:             ${(data.quota.utilization * 100).toFixed(0)}% of ${data.quota.rateLimitType || 'window'}`);
    }

    console.log(`\nFull results: ~/.dukar/latest.json`);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No Dukar runs yet. Try `dukar run`.');
    } else {
      console.error('Error reading status:', e.message);
    }
  }
}

module.exports = { status };
