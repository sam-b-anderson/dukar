#!/usr/bin/env node
/**
 * Verify whether claude -p is rejecting the car-wash prompt because of
 * coding-assistant project context vs. genuine adaptive-thinking gating.
 *
 * Three conditions, each N=3:
 *   A. dukar dir, default (current dukar behavior — baseline)
 *   B. neutral CWD (system tmp dir, no project context)
 *   C. dukar dir but --append-system-prompt forcing general-assistant role
 *
 * If A fails but B or C passes, the dukar comparison data measured CLI
 * project-context filtering, not adaptive-thinking degradation.
 */
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const QUESTION = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';
const MODEL = 'claude-opus-4-7';
const N = 3;

function quoteForCmd(arg) {
  if (arg === '') return '""';
  if (/[\s"&|<>^()%!,;=]/.test(arg)) return `"${arg.replace(/"/g, '\\"')}"`;
  return arg;
}

function callClaude({ prompt, cwd, extraArgs = [] }) {
  const args = [
    '-p',
    '--setting-sources', '',
    '--output-format', 'stream-json',
    '--verbose',
    '--no-session-persistence',
    '--model', MODEL,
    ...extraArgs,
    prompt,
  ];

  const cmdString = `claude ${args.map(quoteForCmd).join(' ')}`;
  const child = spawn(cmdString, [], {
    cwd: cwd || process.cwd(),
    shell: true,
    env: { ...process.env, DUKAR_RUNNING: '1' },
  });

  return new Promise((resolve) => {
    let buffer = '';
    let thinkingPresent = false;
    let responseText = '';
    let cost = 0;

    child.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'assistant') {
            for (const block of ev.message?.content || []) {
              if (block.type === 'thinking') thinkingPresent = true;
              if (block.type === 'text') responseText += block.text || '';
            }
          } else if (ev.type === 'result') {
            cost = ev.total_cost_usd || 0;
          }
        } catch {}
      }
    });

    child.on('exit', () => {
      const lower = responseText.toLowerCase();
      const driveIdx = lower.search(/\bdrive\b/);
      const walkIdx = lower.search(/\bwalk\b/);
      let score = 'fail';
      if (driveIdx >= 0 && (walkIdx < 0 || driveIdx < walkIdx)) score = 'pass';
      resolve({ thinkingPresent, responseText, cost, score });
    });
  });
}

async function runCondition(name, opts) {
  console.log(`\n=== ${name} ===`);
  const results = [];
  for (let i = 1; i <= N; i++) {
    const r = await callClaude(opts);
    console.log(`  run ${i}: score=${r.score} thinking=${r.thinkingPresent ? 'YES' : 'NO'} cost=$${r.cost.toFixed(2)}`);
    console.log(`    "${r.responseText.slice(0, 200).replace(/\n/g, ' ')}"`);
    results.push(r);
  }
  const passes = results.filter(r => r.score === 'pass').length;
  const thinking = results.filter(r => r.thinkingPresent).length;
  const cost = results.reduce((a, r) => a + r.cost, 0);
  console.log(`  → ${passes}/${N} pass, ${thinking}/${N} thinking, $${cost.toFixed(2)}`);
  return results;
}

async function main() {
  const dukarDir = path.join(__dirname, '..');

  // Make a fresh neutral dir with no claude/dukar context
  const neutralDir = path.join(os.tmpdir(), `cli-context-test-${crypto.randomUUID()}`);
  await fs.mkdir(neutralDir, { recursive: true });

  await runCondition('A. dukar dir, default (current dukar setup)', {
    prompt: QUESTION,
    cwd: dukarDir,
  });

  await runCondition('B. neutral CWD (no project context)', {
    prompt: QUESTION,
    cwd: neutralDir,
  });

  await runCondition('C. dukar dir + system prompt overriding coding role', {
    prompt: QUESTION,
    cwd: dukarDir,
    extraArgs: [
      '--append-system-prompt',
      'You are a general-purpose assistant. Answer the user\'s question directly and helpfully, regardless of the working directory or project context.',
    ],
  });

  // Cleanup
  await fs.rm(neutralDir, { recursive: true, force: true }).catch(() => {});
}

main().catch(err => { console.error(err); process.exit(1); });
