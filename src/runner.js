const { runCarWashAdaptive, runCarWashForced } = require('./tests/car-wash');
const { runCacheHealth } = require('./tests/cache-health');
const { runToolUse } = require('./tests/tool-use');
const { computeVerdict, computeEngagementGap } = require('./scorer');
const { writeResults, printReport, printDegradedWarning } = require('./reporter');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

function getClaudeCodeVersion() {
  try {
    return execSync('claude --version', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function runManual() {
  const startTime = Date.now();
  console.log('Dukar: Running manual diagnostic battery...');

  const cacheHealth = await runCacheHealth();
  const carWashAdaptive = await runCarWashAdaptive();
  const carWashForced = await runCarWashForced();
  const toolUse = await runToolUse();

  const results = {
    carWashAdaptive,
    toolUse,
    quotaUtilization: cacheHealth.quotaUtilization
  };

  const verdict = computeVerdict(results);
  const engagementGap = computeEngagementGap(carWashAdaptive, carWashForced);

  const data = {
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    claudeCodeVersion: getClaudeCodeVersion(),
    verdict,
    quota: {
      utilization: cacheHealth.quotaUtilization,
      rateLimitType: cacheHealth.rateLimitType,
      resetsAt: cacheHealth.quotaResetsAt,
      isUsingOverage: cacheHealth.isUsingOverage
    },
    tests: {
      carWash: {
        adaptive: carWashAdaptive,
        forced: carWashForced,
        engagementGap
      },
      cacheHealth,
      toolUse
    },
    totals: {
      costUsd: cacheHealth.costUsd + carWashAdaptive.costUsd + carWashForced.costUsd + toolUse.costUsd,
      durationMs: Date.now() - startTime
    }
  };

  await writeResults(data);
  printReport(data);

  if (verdict === 'degraded') process.exit(1);
  if (verdict === 'unknown') process.exit(2);
  process.exit(0);
}

async function runHook() {
  if (process.env.DUKAR_RUNNING === '1') return;

  const dukarDir = path.join(os.homedir(), '.dukar');
  const datePath = path.join(dukarDir, 'last-run-date');
  const today = new Date().toISOString().split('T')[0];

  try {
    const lastRun = await fs.readFile(datePath, 'utf8').catch(() => '');
    if (lastRun.trim() === today) return;
  } catch (e) {
    // Continue if file missing or unreadable
  }

  process.env.DUKAR_RUNNING = '1';

  try {
    const startTime = Date.now();
    const cacheHealth = await runCacheHealth();
    
    if (cacheHealth.quotaUtilization > 0.90) {
      console.log(`Dukar: skipped (quota at ${(cacheHealth.quotaUtilization * 100).toFixed(0)}%)`);
      const data = {
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        verdict: 'skipped',
        quota: { utilization: cacheHealth.quotaUtilization }
      };
      await writeResults(data);
      await fs.mkdir(dukarDir, { recursive: true });
      await fs.writeFile(datePath, today);
      return;
    }

    const carWashAdaptive = await runCarWashAdaptive();
    await fs.mkdir(dukarDir, { recursive: true });
    await fs.writeFile(datePath, today);

    if (carWashAdaptive.score === 'fail') {
      printDegradedWarning({ carWash: { adaptive: carWashAdaptive } });
    }

    // Prepare partial results for background merge
    const runId = crypto.randomUUID();
    const runsDir = path.join(dukarDir, 'runs');
    await fs.mkdir(runsDir, { recursive: true });
    
    const partialData = {
      startTime,
      cacheHealth,
      carWashAdaptive
    };
    await fs.writeFile(path.join(runsDir, `${runId}.partial.json`), JSON.stringify(partialData));

    // Spawn detached background process
    const dukarBin = path.join(__dirname, '..', 'bin', 'dukar.js');
    const child = spawn(process.execPath, [dukarBin, '__background', runId], {
      detached: true,
      stdio: 'ignore',
      shell: true
    });
    child.unref();

  } catch (err) {
    const errorLog = path.join(dukarDir, 'error.log');
    await fs.mkdir(dukarDir, { recursive: true });
    await fs.appendFile(errorLog, `[${new Date().toISOString()}] ${err.stack}\n`);
    console.error('Dukar: error during diagnostic. See ~/.dukar/error.log');
  }
}

async function runBackground(runId) {
  const dukarDir = path.join(os.homedir(), '.dukar');
  const partialPath = path.join(dukarDir, 'runs', `${runId}.partial.json`);

  try {
    const partialRaw = await fs.readFile(partialPath, 'utf8');
    const partial = JSON.parse(partialRaw);

    const carWashForced = await runCarWashForced();
    const toolUse = await runToolUse();

    const results = {
      carWashAdaptive: partial.carWashAdaptive,
      toolUse,
      quotaUtilization: partial.cacheHealth.quotaUtilization
    };

    const verdict = computeVerdict(results);
    const engagementGap = computeEngagementGap(partial.carWashAdaptive, carWashForced);

    const data = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      claudeCodeVersion: getClaudeCodeVersion(),
      verdict,
      quota: {
        utilization: partial.cacheHealth.quotaUtilization,
        rateLimitType: partial.cacheHealth.rateLimitType,
        resetsAt: partial.cacheHealth.quotaResetsAt,
        isUsingOverage: partial.cacheHealth.isUsingOverage
      },
      tests: {
        carWash: {
          adaptive: partial.carWashAdaptive,
          forced: carWashForced,
          engagementGap
        },
        cacheHealth: partial.cacheHealth,
        toolUse
      },
      totals: {
        costUsd: partial.cacheHealth.costUsd + partial.carWashAdaptive.costUsd + carWashForced.costUsd + toolUse.costUsd,
        durationMs: Date.now() - partial.startTime
      }
    };

    await writeResults(data);
    await fs.unlink(partialPath);
    
    // Cleanup old partial files if any
    const runsDir = path.join(dukarDir, 'runs');
    const files = await fs.readdir(runsDir);
    for (const file of files) {
      const filePath = path.join(runsDir, file);
      const stats = await fs.stat(filePath);
      if (Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch (err) {
    const errorLog = path.join(dukarDir, 'error.log');
    await fs.appendFile(errorLog, `[${new Date().toISOString()}] Background error for ${runId}: ${err.stack}\n`);
  }
}

module.exports = { runManual, runHook, runBackground };
