#!/usr/bin/env node
/**
 * Extract notable model responses from raw run JSONs for use in the post.
 *
 * Picks: shortest pass + longest fail per (model, condition) for the car-wash
 * probe. Short passes are punchy quotes; long fails show the model talking
 * itself into the wrong answer.
 */
const fs = require('fs/promises');
const path = require('path');

async function main() {
  const runDate = process.argv[2] || new Date().toISOString().slice(0, 10);
  const rawDir = path.join(__dirname, '..', 'runs', runDate, 'raw');
  const files = await fs.readdir(rawDir);

  const records = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const r = JSON.parse(await fs.readFile(path.join(rawDir, f), 'utf8'));
    if (r.cell.probe !== 'car-wash') continue;
    if (!r.responseText) continue;
    records.push(r);
  }

  const byCell = new Map();
  for (const r of records) {
    const k = `${r.cell.model}__${r.cell.condition}`;
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(r);
  }

  const lines = [];
  lines.push(`# Notable car-wash responses (run ${runDate})`);
  lines.push('');
  lines.push('Picked one short PASS and one long FAIL per cell, plus the average.');
  lines.push('');

  const sortedKeys = [...byCell.keys()].sort();
  for (const k of sortedKeys) {
    const cellRuns = byCell.get(k);
    const passes = cellRuns.filter(r => r.score === 'pass' || r.score === 'pass-hedged');
    const fails = cellRuns.filter(r => r.score === 'fail');

    const [model, condition] = k.split('__');
    const shortModel = model.replace('claude-opus-', '').replace('-20251101', '');

    lines.push(`## ${shortModel} — ${condition} (N=${cellRuns.length}, ${passes.length} pass / ${fails.length} fail)`);
    lines.push('');

    if (passes.length > 0) {
      const shortest = passes.reduce((a, b) =>
        a.responseText.length < b.responseText.length ? a : b
      );
      lines.push(`**Pass example** (${shortest.outputTokens} tok, thinking ${shortest.thinkingPresent ? 'present' : 'absent'}):`);
      lines.push('');
      lines.push('> ' + shortest.responseText.replace(/\n/g, '\n> '));
      lines.push('');
    } else {
      lines.push(`**No passes in this cell.**`);
      lines.push('');
    }

    if (fails.length > 0) {
      const longest = fails.reduce((a, b) =>
        a.responseText.length > b.responseText.length ? a : b
      );
      lines.push(`**Fail example** (${longest.outputTokens} tok, thinking ${longest.thinkingPresent ? 'present' : 'absent'}):`);
      lines.push('');
      lines.push('> ' + longest.responseText.replace(/\n/g, '\n> '));
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  const md = lines.join('\n');
  const runsPath = path.join(__dirname, '..', 'runs', runDate, 'notable-responses.md');
  const docsDir = path.join(__dirname, '..', 'docs', `${runDate}-comparison`);
  await fs.mkdir(docsDir, { recursive: true });
  const docsPath = path.join(docsDir, 'notable-responses.md');

  await fs.writeFile(runsPath, md);
  await fs.writeFile(docsPath, md);
  console.log(`Wrote notable-responses.md to:`);
  console.log(`  ${runsPath}`);
  console.log(`  ${docsPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
