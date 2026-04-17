#!/usr/bin/env node
/**
 * Padded car-wash probe for Opus 4.7.
 *
 * Hypothesis (from today's manual testing on Claude.ai web): 4.7's adaptive
 * thinking allocator gates on prompt size. The bare car-wash question fails
 * 0/20 because the model judges it not worth thinking about. Adding ~80
 * tokens of irrelevant text in front of the same question should push the
 * prompt past the allocator's threshold and produce correct answers.
 *
 * If 4.7-padded passes consistently while 4.7-bare fails consistently, that's
 * the smoking gun: the capability is present, the allocator is the bottleneck.
 *
 * Usage: node scripts/compare-padded.js [--n 20]
 */
const fs = require('fs/promises');
const path = require('path');
const { invoke } = require('../src/invoke');
const { scoreCarWash } = require('../src/tests/car-wash');

const PADDING = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

`;

const QUESTION = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';
const PROMPT = PADDING + QUESTION;

const RUN_DATE = new Date().toISOString().slice(0, 10);
const RAW_DIR = path.join(__dirname, '..', 'runs', RUN_DATE, 'raw-padded');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { n: 20 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n') opts.n = parseInt(args[++i], 10);
  }
  return opts;
}

function buildCells() {
  return [
    { model: 'claude-opus-4-7', condition: 'adaptive' },
    { model: 'claude-opus-4-7', condition: 'forced' },
  ];
}

function cellKey(cell) {
  return `${cell.model}__car-wash-padded__${cell.condition}`;
}

function runFilePath(cell, runIndex) {
  return path.join(RAW_DIR, `${cellKey(cell)}__run-${String(runIndex).padStart(2, '0')}.json`);
}

async function runOne(cell) {
  const envOverrides = cell.condition === 'forced'
    ? { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' }
    : {};

  const result = await invoke({
    prompt: PROMPT,
    model: cell.model,
    envOverrides,
    timeoutMs: 30000,
  });

  const score = result.error
    ? 'error'
    : scoreCarWash(result.responseText, cell.condition === 'forced');
  return { ...result, score };
}

async function main() {
  const opts = parseArgs();
  await fs.mkdir(RAW_DIR, { recursive: true });

  const cells = buildCells();
  const totalCalls = cells.length * opts.n;
  console.log(`Padded car-wash probe: ${cells.length} cells × ${opts.n} runs = ${totalCalls} calls`);
  console.log(`Padding length: ${PADDING.length} chars`);
  console.log(`Output: ${RAW_DIR}\n`);

  let completed = 0;
  let costTotal = 0;
  const startTime = Date.now();

  for (const cell of cells) {
    for (let i = 1; i <= opts.n; i++) {
      const filePath = runFilePath(cell, i);
      try {
        await fs.access(filePath);
        completed++;
        continue;
      } catch {}

      const t0 = Date.now();
      let record;
      try {
        const result = await runOne(cell);
        record = {
          cell: { ...cell, probe: 'car-wash-padded' },
          runIndex: i,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - t0,
          ...result,
        };
      } catch (err) {
        record = {
          cell: { ...cell, probe: 'car-wash-padded' },
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
        `4-7 padded ${cell.condition.padEnd(8)} ` +
        `run ${String(i).padStart(2, '0')}: ${score.toUpperCase().padEnd(11)} ` +
        `[${thinking}] ${record.outputTokens || 0}tok`
      );
    }
  }

  console.log(`\nDone. Total: $${costTotal.toFixed(2)} across ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  console.log(`Raw outputs in ${RAW_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
