const { invoke } = require('../invoke');

const PROMPT = 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?';

async function runCarWashAdaptive() {
  const result = await invoke({ prompt: PROMPT, model: 'opus', timeoutMs: 15000 });
  if (result.error) return { ...result, score: 'error' };
  return { ...result, score: scoreCarWash(result.responseText) };
}

async function runCarWashForced() {
  const result = await invoke({
    prompt: PROMPT,
    model: 'opus',
    envOverrides: { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' },
    timeoutMs: 15000,
  });
  if (result.error) return { ...result, score: 'error' };
  return { ...result, score: scoreCarWash(result.responseText, true) };
}

function scoreCarWash(text, allowHedged = false) {
  const lower = text.toLowerCase();

  // PASS-HEDGED: response acknowledges the car must be at the wash
  if (allowHedged) {
    const first300 = lower.slice(0, 300);
    if (first300.includes('drive') && first300.includes('walk')) {
      const hedgedPhrases = [
        'car needs to be', 'need the car', 'car has to be',
        'need to drive the car', 'drive the car there',
        'into the car wash', 'at the car wash to',
      ];
      if (hedgedPhrases.some(p => first300.includes(p))) {
        return 'pass-hedged';
      }
    }
  }

  // Standard: which word appears first?
  const driveIndex = lower.search(/\bdrive\b/);
  const walkIndex = lower.search(/\bwalk\b/);

  if (driveIndex === -1 && walkIndex === -1) return 'fail';
  if (driveIndex >= 0 && (walkIndex === -1 || driveIndex < walkIndex)) return 'pass';
  return 'fail';
}

module.exports = { runCarWashAdaptive, runCarWashForced, scoreCarWash };
