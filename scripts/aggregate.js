#!/usr/bin/env node
/**
 * Aggregate raw comparison runs into summary tables and stats.
 *
 * Reads runs/<date>/raw/*.json and writes:
 *   runs/<date>/summary.json   — machine-readable
 *   runs/<date>/summary.md     — human-readable tables
 */
const fs = require('fs/promises');
const path = require('path');

function shortModel(id) {
  return id.replace('claude-opus-', '').replace('-20251101', '');
}

function pct(n, d) {
  if (d === 0) return '—';
  return `${((n / d) * 100).toFixed(0)}%`;
}

function avg(nums) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function wilsonLowerBound(passes, total) {
  if (total === 0) return 0;
  const z = 1.96; // 95% CI
  const p = passes / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return Math.max(0, (center - margin) / denom);
}

function wilsonUpperBound(passes, total) {
  if (total === 0) return 0;
  const z = 1.96;
  const p = passes / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return Math.min(1, (center + margin) / denom);
}

function summarizeCell(records) {
  const passes = records.filter(r => r.score === 'pass' || r.score === 'pass-hedged').length;
  const fails = records.filter(r => r.score === 'fail').length;
  const errors = records.filter(r => r.score === 'error').length;
  const valid = passes + fails;
  const thinkingPresent = records.filter(r => r.thinkingPresent).length;
  const outputTokens = records.filter(r => r.outputTokens != null).map(r => r.outputTokens);
  const durationMs = records.filter(r => r.durationApiMs != null).map(r => r.durationApiMs);
  const cost = records.reduce((acc, r) => acc + (r.costUsd || 0), 0);
  return {
    n: records.length,
    passes,
    fails,
    errors,
    valid,
    passRate: valid ? passes / valid : null,
    passRateLow: valid ? wilsonLowerBound(passes, valid) : null,
    passRateHigh: valid ? wilsonUpperBound(passes, valid) : null,
    thinkingPresentRate: records.length ? thinkingPresent / records.length : null,
    avgOutputTokens: Math.round(avg(outputTokens)),
    medianOutputTokens: Math.round(median(outputTokens)),
    avgDurationMs: Math.round(avg(durationMs)),
    cost,
  };
}

async function main() {
  const runDate = process.argv[2] || new Date().toISOString().slice(0, 10);
  const runsDir = path.join(__dirname, '..', 'runs', runDate);
  const rawDir = path.join(runsDir, 'raw');

  const files = await fs.readdir(rawDir);
  const records = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const raw = await fs.readFile(path.join(rawDir, f), 'utf8');
    records.push(JSON.parse(raw));
  }
  console.log(`Loaded ${records.length} records from ${rawDir}`);

  // Group by cell
  const cells = new Map();
  for (const r of records) {
    const k = `${r.cell.model}__${r.cell.probe}__${r.cell.condition}`;
    if (!cells.has(k)) cells.set(k, { cell: r.cell, records: [] });
    cells.get(k).records.push(r);
  }

  const summary = [];
  for (const [k, { cell, records }] of cells) {
    summary.push({ cell, ...summarizeCell(records) });
  }

  // Engagement gap per model: adaptive vs forced for each probe
  const gaps = [];
  const models = [...new Set(summary.map(s => s.cell.model))];
  const probes = [...new Set(summary.map(s => s.cell.probe))];
  for (const model of models) {
    for (const probe of probes) {
      const adaptive = summary.find(s =>
        s.cell.model === model && s.cell.probe === probe && s.cell.condition === 'adaptive'
      );
      const forced = summary.find(s =>
        s.cell.model === model && s.cell.probe === probe && s.cell.condition === 'forced'
      );
      if (!adaptive || !forced) continue;
      gaps.push({
        model,
        probe,
        adaptivePassRate: adaptive.passRate,
        forcedPassRate: forced.passRate,
        gap: forced.passRate - adaptive.passRate,
        adaptiveThinkingRate: adaptive.thinkingPresentRate,
        forcedThinkingRate: forced.thinkingPresentRate,
        adaptiveTokens: adaptive.medianOutputTokens,
        forcedTokens: forced.medianOutputTokens,
      });
    }
  }

  const totalCost = summary.reduce((a, s) => a + s.cost, 0);

  // Write summary.json
  const summaryJson = {
    runDate,
    totalCalls: records.length,
    totalCost,
    cells: summary,
    engagementGaps: gaps,
  };
  await fs.writeFile(path.join(runsDir, 'summary.json'), JSON.stringify(summaryJson, null, 2));

  // Write summary.md
  const md = renderMarkdown(summaryJson);
  await fs.writeFile(path.join(runsDir, 'summary.md'), md);

  console.log(`Wrote summary.json and summary.md`);
  console.log(`\nTotal cost across all cells: $${totalCost.toFixed(2)}`);
}

function renderMarkdown(s) {
  const lines = [];
  lines.push(`# Dukar comparison: Opus 4.5 vs 4.6 vs 4.7`);
  lines.push(``);
  lines.push(`**Run date:** ${s.runDate}`);
  lines.push(`**Total calls:** ${s.totalCalls}`);
  lines.push(`**Total cost:** $${s.totalCost.toFixed(2)}`);
  lines.push(``);
  lines.push(`## Pass rates by model × probe × condition`);
  lines.push(``);
  lines.push(`| Model | Probe | Condition | Pass | Fail | Err | Pass rate | 95% CI | Thinking present | Median output tok |`);
  lines.push(`|-------|-------|-----------|-----:|-----:|----:|----------:|--------|-----------------:|------------------:|`);

  const sorted = [...s.cells].sort((a, b) => {
    const m = a.cell.model.localeCompare(b.cell.model);
    if (m) return m;
    const p = a.cell.probe.localeCompare(b.cell.probe);
    if (p) return p;
    return a.cell.condition.localeCompare(b.cell.condition);
  });

  for (const c of sorted) {
    const ci = c.passRate != null
      ? `${(c.passRateLow * 100).toFixed(0)}–${(c.passRateHigh * 100).toFixed(0)}%`
      : '—';
    lines.push(
      `| ${shortModel(c.cell.model)} | ${c.cell.probe} | ${c.cell.condition} | ${c.passes} | ${c.fails} | ${c.errors} | ${pct(c.passes, c.valid)} | ${ci} | ${pct(Math.round((c.thinkingPresentRate || 0) * c.n), c.n)} | ${c.medianOutputTokens} |`
    );
  }

  lines.push(``);
  lines.push(`## Engagement gap (forced − adaptive)`);
  lines.push(``);
  lines.push(`The diagnostic signal: when forcing thinking with \`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1\` flips a fail to a pass, the capability is present but the adaptive allocator is skipping reasoning.`);
  lines.push(``);
  lines.push(`| Model | Probe | Adaptive pass | Forced pass | Gap | Adaptive thinking | Forced thinking | Adaptive tok | Forced tok |`);
  lines.push(`|-------|-------|--------------:|------------:|----:|------------------:|----------------:|-------------:|-----------:|`);
  for (const g of s.engagementGaps) {
    const gapStr = g.gap > 0 ? `+${(g.gap * 100).toFixed(0)}pp` : `${(g.gap * 100).toFixed(0)}pp`;
    lines.push(
      `| ${shortModel(g.model)} | ${g.probe} | ${(g.adaptivePassRate * 100).toFixed(0)}% | ${(g.forcedPassRate * 100).toFixed(0)}% | ${gapStr} | ${(g.adaptiveThinkingRate * 100).toFixed(0)}% | ${(g.forcedThinkingRate * 100).toFixed(0)}% | ${g.adaptiveTokens} | ${g.forcedTokens} |`
    );
  }

  lines.push(``);
  lines.push(`## Methodology`);
  lines.push(``);
  lines.push(`- **Probes:** car wash canary (one logic trap that pattern-matching fails), tool-use discipline (read-before-edit on a tiny Python fixture).`);
  lines.push(`- **Conditions:** \`adaptive\` is the default (model decides reasoning per turn); \`forced\` sets \`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1\`.`);
  lines.push(`- **Naked prompts:** no system prompt, no "think step by step." The point is to see what the model does on its own.`);
  lines.push(`- **Sample size:** ${s.cells[0]?.n || '?'} runs per cell. 95% CI computed via Wilson score interval.`);
  lines.push(`- **Scoring:** car wash passes when "drive" appears before "walk"; tool-use passes when the model invokes Read before Edit on the fixture and never falls back to Write.`);
  lines.push(`- **Harness:** \`scripts/compare.js\` in this repo. Each call's full JSON is in \`runs/${s.runDate}/raw/\`.`);
  return lines.join('\n') + '\n';
}

function shortModel(id) {
  return id.replace('claude-opus-', '').replace('-20251101', '');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
