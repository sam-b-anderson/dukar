#!/usr/bin/env node
/**
 * Multi-model comparison harness for Dukar.
 *
 * Iterates models × probes × conditions × N runs, saves each call as
 * its own JSON for full traceability. Resumable — if a run file already
 * exists it is skipped, so you can safely Ctrl+C and restart.
 *
 * Usage:
 *   node scripts/compare.js              # full battery, default N=20
 *   node scripts/compare.js --n 5        # smoke run
 *   node scripts/compare.js --n 1 --models claude-opus-4-7
 */
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { invoke } = require('../src/invoke');
const { scoreCarWash } = require('../src/tests/car-wash');
const { scoreToolUse } = require('../src/tests/tool-use');

const CAR_WASH_PROMPT =
  'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';

const TOOL_USE_PROMPT =
  'Read the file example.py. There is a bug in calculate_average — it will crash on an empty list because of division by zero. Fix it by adding a guard that returns 0 for empty lists. Do not rewrite the entire file.';

const TOOL_USE_FIXTURE = `def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)


def format_percentage(value):
    return str(round(value * 100, 2)) + "%"
`;

const RUN_DATE = new Date().toISOString().slice(0, 10);
const RUNS_DIR = path.join(__dirname, '..', 'runs', RUN_DATE);
const RAW_DIR = path.join(RUNS_DIR, 'raw');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { n: 20, models: null, probes: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n') opts.n = parseInt(args[++i], 10);
    else if (args[i] === '--models') opts.models = args[++i].split(',');
    else if (args[i] === '--probes') opts.probes = args[++i].split(',');
  }
  return opts;
}

function buildCells(opts) {
  const allModels = ['claude-opus-4-5-20251101', 'claude-opus-4-6', 'claude-opus-4-7'];
  const models = opts.models || allModels;
  const probes = opts.probes || ['car-wash', 'tool-use'];
  const cells = [];
  for (const model of models) {
    for (const probe of probes) {
      // 4.5 lacks adaptive thinking, so the forced condition is redundant
      const conditions = model.startsWith('claude-opus-4-5')
        ? ['adaptive']
        : ['adaptive', 'forced'];
      for (const condition of conditions) {
        cells.push({ model, probe, condition });
      }
    }
  }
  return cells;
}

async function ensureToolUseFixture() {
  const cellTmp = path.join(os.tmpdir(), `dukar-tool-${crypto.randomUUID()}`);
  await fs.mkdir(cellTmp, { recursive: true });
  await fs.writeFile(path.join(cellTmp, 'example.py'), TOOL_USE_FIXTURE);
  return cellTmp;
}

async function runOne(cell, runIndex) {
  const envOverrides = cell.condition === 'forced'
    ? { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' }
    : {};

  if (cell.probe === 'car-wash') {
    const result = await invoke({
      prompt: CAR_WASH_PROMPT,
      model: cell.model,
      envOverrides,
      timeoutMs: 30000,
    });
    const score = result.error
      ? 'error'
      : scoreCarWash(result.responseText, cell.condition === 'forced');
    return { ...result, score };
  }

  if (cell.probe === 'tool-use') {
    const cwd = await ensureToolUseFixture();
    try {
      const result = await invoke({
        prompt: TOOL_USE_PROMPT,
        model: cell.model,
        envOverrides,
        cwd,
        timeoutMs: 60000,
      });
      const scoreResult = result.error
        ? { score: 'error' }
        : scoreToolUse(result);
      return { ...result, ...scoreResult };
    } finally {
      await fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
    }
  }

  throw new Error(`unknown probe: ${cell.probe}`);
}

function cellKey(cell) {
  return `${cell.model}__${cell.probe}__${cell.condition}`;
}

function runFilePath(cell, runIndex) {
  return path.join(RAW_DIR, `${cellKey(cell)}__run-${String(runIndex).padStart(2, '0')}.json`);
}

async function main() {
  const opts = parseArgs();
  await fs.mkdir(RAW_DIR, { recursive: true });

  const cells = buildCells(opts);
  const totalCalls = cells.length * opts.n;
  console.log(`Comparison run: ${cells.length} cells × ${opts.n} runs = ${totalCalls} calls`);
  console.log(`Output: ${RUNS_DIR}\n`);

  let completed = 0;
  let costTotal = 0;
  const startTime = Date.now();

  for (const cell of cells) {
    for (let i = 1; i <= opts.n; i++) {
      const filePath = runFilePath(cell, i);
      try {
        await fs.access(filePath);
        completed++;
        continue; // already done — resumable
      } catch {}

      const t0 = Date.now();
      let record;
      try {
        const result = await runOne(cell, i);
        record = {
          cell,
          runIndex: i,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - t0,
          ...result,
        };
      } catch (err) {
        record = {
          cell,
          runIndex: i,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: err.message || String(err),
          score: 'error',
        };
      }

      await fs.writeFile(filePath, JSON.stringify(record, null, 2));
      costTotal += record.costUsd || 0;
      completed++;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const score = record.score || 'error';
      const thinking = record.thinkingPresent ? 'T' : '-';
      console.log(
        `[${completed}/${totalCalls} ${elapsed}s $${costTotal.toFixed(2)}] ` +
        `${cell.model.replace('claude-opus-', '').replace('-20251101', '')} ` +
        `${cell.probe.padEnd(8)} ${cell.condition.padEnd(8)} ` +
        `run ${String(i).padStart(2, '0')}: ${score.toUpperCase().padEnd(11)} ` +
        `[${thinking}] ${record.outputTokens || 0}tok`
      );
    }
  }

  console.log(`\nDone. Total: $${costTotal.toFixed(2)} across ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  console.log(`Raw outputs in ${RAW_DIR}`);
  console.log(`Run: node scripts/aggregate.js`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
