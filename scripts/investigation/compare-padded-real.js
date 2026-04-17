#!/usr/bin/env node
/**
 * Realistic-content padded car-wash probe for Opus 4.7.
 *
 * Today's data showed Lorem Ipsum padding fails because 4.7 *recognizes*
 * it as filler and dismisses the entire prompt. To test whether the
 * allocator gates on perceived-meaningful content (vs. raw token count),
 * pad with a paragraph of public-domain prose (Moby Dick) the model has
 * to actually parse. If this engages thinking and produces correct
 * answers while bare AND lorem-ipsum versions fail, that's strong evidence
 * the allocator is content-quality-aware.
 *
 * Usage: node scripts/compare-padded-real.js [--n 20]
 */
const fs = require('fs/promises');
const path = require('path');
const { invoke } = require('../src/invoke');
const { scoreCarWash } = require('../src/tests/car-wash');

// Opening of Moby Dick — public domain, recognizable as real prose,
// not topically related to cars / walking / distance.
const PADDING = `Call me Ishmael. Some years ago — never mind how long precisely — having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off — then, I account it high time to get to sea as soon as I can.

`;

const QUESTION = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';
const PROMPT = PADDING + QUESTION;

const RUN_DATE = new Date().toISOString().slice(0, 10);
const RAW_DIR = path.join(__dirname, '..', 'runs', RUN_DATE, 'raw-padded-real');

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
  return `${cell.model}__car-wash-padded-real__${cell.condition}`;
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
  console.log(`Realistic-padded car-wash probe: ${cells.length} cells × ${opts.n} runs = ${totalCalls} calls`);
  console.log(`Padding: Moby Dick opening, ${PADDING.length} chars\n`);

  let completed = 0;
  let costTotal = 0;
  const startTime = Date.now();

  for (const cell of cells) {
    for (let i = 1; i <= opts.n; i++) {
      const filePath = runFilePath(cell, i);
      try { await fs.access(filePath); completed++; continue; } catch {}

      const t0 = Date.now();
      let record;
      try {
        const result = await runOne(cell);
        record = {
          cell: { ...cell, probe: 'car-wash-padded-real' },
          runIndex: i,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - t0,
          ...result,
        };
      } catch (err) {
        record = {
          cell: { ...cell, probe: 'car-wash-padded-real' },
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
        `4-7 padded-real ${cell.condition.padEnd(8)} ` +
        `run ${String(i).padStart(2, '0')}: ${score.toUpperCase().padEnd(11)} ` +
        `[${thinking}] ${record.outputTokens || 0}tok`
      );
    }
  }

  console.log(`\nDone. Total: $${costTotal.toFixed(2)} across ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  console.log(`Raw outputs in ${RAW_DIR}`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
