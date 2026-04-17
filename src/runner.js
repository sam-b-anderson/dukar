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
    version: '0.2.1',
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
      costUsd: (cacheHealth.costUsd ?? 0) + (carWashAdaptive.costUsd ?? 0) + (carWashForced.costUsd ?? 0) + (toolUse.costUsd ?? 0),
      durationMs: Date.now() - startTime
    }
  };

  await writeResults(data);
  printReport(data);

  process.exit(verdict === 'degraded' ? 1 : verdict === 'unknown' ? 2 : 0);
}

function emitHookOutput(message) {
  // SessionStart hooks surface user-visible output via this JSON shape
  // (stderr is not reliably shown). Also passes the message to Claude as
  // session context so Claude knows about the diagnostic result.
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: message,
    },
  }));
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
    const carWashAdaptive = await runCarWashAdaptive();
    await fs.mkdir(dukarDir, { recursive: true });
    await fs.writeFile(datePath, today);

    // Quota gate: if the car-wash response itself reported >90% utilization,
    // record skipped and exit. (rate_limit_event is only emitted above ~75%
    // utilization, so a null reading means we're well under the limit.)
    const quotaUtil = carWashAdaptive.quotaUtilization;
    if (quotaUtil != null && quotaUtil > 0.90) {
      const skippedData = {
        version: '0.2.1',
        timestamp: new Date().toISOString(),
        verdict: 'skipped',
        quota: { utilization: quotaUtil, resetsAt: carWashAdaptive.quotaResetsAt },
      };
      await writeResults(skippedData);
      emitHookOutput(`Dukar: skipped (quota at ${(quotaUtil * 100).toFixed(0)}%)`);
      return;
    }

    const verdict = computeVerdict({
      carWashAdaptive,
      quotaUtilization: quotaUtil,
    });

    const data = {
      version: '0.2.1',
      timestamp: new Date().toISOString(),
      claudeCodeVersion: getClaudeCodeVersion(),
      verdict,
      quota: {
        utilization: quotaUtil,
        rateLimitType: carWashAdaptive.rateLimitType,
        resetsAt: carWashAdaptive.quotaResetsAt,
        isUsingOverage: carWashAdaptive.isUsingOverage,
      },
      tests: {
        carWash: { adaptive: carWashAdaptive },
      },
      totals: {
        costUsd: carWashAdaptive.costUsd ?? 0,
        durationMs: Date.now() - startTime,
      },
    };

    await writeResults(data);
    emitHookOutput(formatHookMessage(verdict, carWashAdaptive));
  } catch (err) {
    const errorLog = path.join(dukarDir, 'error.log');
    await fs.mkdir(dukarDir, { recursive: true });
    await fs.appendFile(errorLog, `[${new Date().toISOString()}] ${err.stack}\n`);
    emitHookOutput(`Dukar: error during diagnostic — see ~/.dukar/error.log`);
  }
}

function formatHookMessage(verdict, carWashAdaptive) {
  if (verdict === 'healthy') {
    return 'Dukar: Opus appears healthy ✓ (canary passed, thinking engaged)';
  }
  if (verdict === 'degraded') {
    const thinkingNote = carWashAdaptive.thinkingPresent
      ? 'thinking present but answered wrong'
      : 'thinking skipped';
    return [
      'Dukar: Opus DEGRADED today',
      `  Canary failed (${thinkingNote}, ${carWashAdaptive.outputTokens ?? '?'} output tokens)`,
      '  What this means: Opus decided not to think on this question.',
      '  For critical reasoning today: claude --model claude-opus-4-5-20251101',
      '  /dukar-status for details · /dukar-history for trend',
    ].join('\n');
  }
  if (verdict === 'unknown') {
    return 'Dukar: canary errored today — see ~/.dukar/latest.json';
  }
  return `Dukar: ${verdict}`;
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
      version: '0.2.1',
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
        costUsd: (partial.cacheHealth.costUsd ?? 0) + (partial.carWashAdaptive.costUsd ?? 0) + (carWashForced.costUsd ?? 0) + (toolUse.costUsd ?? 0),
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
