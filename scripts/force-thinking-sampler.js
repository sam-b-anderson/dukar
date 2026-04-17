#!/usr/bin/env node
/**
 * Test every known mechanism for forcing thinking on Opus 4.7 with the
 * bare car-wash prompt. We've already shown the env var doesn't work; this
 * tries the other levers.
 */
const { spawn } = require('child_process');

const QUESTION = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';
const N = 3; // per condition

function quoteForCmd(arg) {
  if (arg === '') return '""';
  if (/[\s"&|<>^()%!,;=]/.test(arg)) return `"${arg.replace(/"/g, '\\"')}"`;
  return arg;
}

function callClaude({ model, env, extraArgs = [] }) {
  const args = [
    '-p',
    '--setting-sources', '',
    '--output-format', 'stream-json',
    '--verbose',
    '--no-session-persistence',
    '--model', model,
    ...extraArgs,
    QUESTION,
  ];
  const cmdString = `claude ${args.map(quoteForCmd).join(' ')}`;
  const child = spawn(cmdString, [], {
    shell: true,
    env: { ...process.env, ...env, DUKAR_RUNNING: '1' },
  });

  return new Promise(resolve => {
    let buffer = '';
    let thinkingPresent = false;
    let responseText = '';
    let cost = 0;
    child.stdout.on('data', d => {
      buffer += d.toString();
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
      const score = (driveIdx >= 0 && (walkIdx < 0 || driveIdx < walkIdx)) ? 'pass' : 'fail';
      resolve({ thinkingPresent, score, cost, responseText });
    });
  });
}

const CONDITIONS = [
  { name: 'baseline (4.7 default)', model: 'claude-opus-4-7', env: {} },
  { name: 'env var: DISABLE_ADAPTIVE_THINKING=1', model: 'claude-opus-4-7', env: { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' } },
  { name: 'env var: EFFORT_LEVEL=max', model: 'claude-opus-4-7', env: { CLAUDE_CODE_EFFORT_LEVEL: 'max' } },
  { name: 'env var: EFFORT_LEVEL=xhigh', model: 'claude-opus-4-7', env: { CLAUDE_CODE_EFFORT_LEVEL: 'xhigh' } },
  { name: 'both env vars (DISABLE + EFFORT=max)', model: 'claude-opus-4-7', env: { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1', CLAUDE_CODE_EFFORT_LEVEL: 'max' } },
  { name: 'system prompt forces step-by-step', model: 'claude-opus-4-7', env: {}, extraArgs: ['--append-system-prompt', 'Think step by step before answering. Show your reasoning.'] },
];

async function main() {
  for (const cond of CONDITIONS) {
    console.log(`\n=== ${cond.name} ===`);
    let passes = 0, thinks = 0, cost = 0;
    for (let i = 1; i <= N; i++) {
      const r = await callClaude(cond);
      cost += r.cost;
      if (r.score === 'pass') passes++;
      if (r.thinkingPresent) thinks++;
      console.log(
        `  run ${i}: ${r.score.toUpperCase().padEnd(5)} | thinking=${r.thinkingPresent ? 'YES' : 'NO '} | "${r.responseText.slice(0, 110).replace(/\n/g, ' ')}"`
      );
    }
    console.log(`  → ${passes}/${N} pass, ${thinks}/${N} thinking, $${cost.toFixed(2)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
