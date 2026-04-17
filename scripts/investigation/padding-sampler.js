#!/usr/bin/env node
/**
 * Probe padding sampler. Tries different padding strategies at N=1 against
 * Opus 4.7 to find which ones actually trigger thinking on the car-wash
 * question. The winner becomes the basis for dukar's daily padded probe.
 *
 * Today's data: bare car-wash, Lorem Ipsum, and Moby Dick all fail to
 * engage thinking. The user's screenshots showed disjointed pop-culture
 * quotes and 40-question-repetition both engage thinking. We need padding
 * that forces parsing rather than pattern-recognition-and-dismissal.
 */
const fs = require('fs/promises');
const path = require('path');
const { invoke } = require('../src/invoke');
const { scoreCarWash } = require('../src/tests/car-wash');

const QUESTION = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';

const VARIANTS = {
  bare: QUESTION,

  // Repetition (per user's screenshot 4 — proven to work on web)
  repetition_5: Array(5).fill(QUESTION).join('\n'),
  repetition_10: Array(10).fill(QUESTION).join('\n'),

  // Two unrelated questions stacked — mimics real user behavior
  two_questions: `What is the capital of Mongolia?

${QUESTION}`,

  // Code snippet — many users paste code + question; requires parsing
  code_snippet: `def process_records(items, threshold=0.5):
    seen = set()
    out = []
    for x in items:
        if x.score > threshold and x.id not in seen:
            seen.add(x.id)
            out.append(x)
    return sorted(out, key=lambda x: -x.score)

${QUESTION}`,

  // Made-up jargon — model can't pattern-match it
  fake_jargon: `The Velogrant index for Q3 stabilized at 0.847 after the Marquette adjustment, well within the Henderson-Klein band. Subsidiary readings from the eastern array showed expected drift but no anomalous spikes. We're holding off on the Coltrane reweight until next quarter.

${QUESTION}`,

  // Real disjointed-dialogue collage (per user's screenshots) — mock movie quotes
  dialogue_collage: `"You can't handle the truth!" "I'll have what she's having." "Houston, we have a problem." "Show me the money!" "I see dead people." "You're gonna need a bigger boat." "Why so serious?" "I'll make him an offer he can't refuse." "Just keep swimming." "There's no place like home."

${QUESTION}`,
};

const RUN_DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(__dirname, '..', 'runs', RUN_DATE, 'padding-sampler');

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Padding sampler: ${Object.keys(VARIANTS).length} variants × adaptive only (4.7)\n`);

  const results = [];
  let totalCost = 0;
  const t0 = Date.now();

  for (const [name, prompt] of Object.entries(VARIANTS)) {
    process.stdout.write(`${name.padEnd(20)} ... `);
    const callStart = Date.now();
    const r = await invoke({
      prompt,
      model: 'claude-opus-4-7',
      timeoutMs: 30000,
    });
    const score = r.error ? 'error' : scoreCarWash(r.responseText, false);
    const callMs = Date.now() - callStart;
    totalCost += r.costUsd || 0;

    console.log(
      `${score.toUpperCase().padEnd(11)} | thinking=${r.thinkingPresent ? 'YES' : 'NO '} | ${r.outputTokens || 0}tok | $${(r.costUsd||0).toFixed(2)} | ${(callMs/1000).toFixed(1)}s`
    );

    const record = {
      variant: name,
      prompt,
      promptLength: prompt.length,
      score,
      thinkingPresent: r.thinkingPresent,
      thinkingContent: r.thinkingContent,
      responseText: r.responseText,
      outputTokens: r.outputTokens,
      costUsd: r.costUsd,
      durationMs: callMs,
      error: r.error,
    };
    results.push(record);
    await fs.writeFile(path.join(OUT_DIR, `${name}.json`), JSON.stringify(record, null, 2));
  }

  console.log(`\nTotal: $${totalCost.toFixed(2)} across ${((Date.now()-t0)/1000).toFixed(0)}s\n`);

  console.log('=== Variants that engaged thinking ===');
  for (const r of results) {
    if (r.thinkingPresent) {
      console.log(`  ${r.variant}: ${r.score} | "${r.responseText.slice(0, 100)}"`);
    }
  }

  console.log('\n=== Variants that did NOT engage thinking ===');
  for (const r of results) {
    if (!r.thinkingPresent) {
      console.log(`  ${r.variant}: ${r.score} | "${r.responseText.slice(0, 100)}"`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
