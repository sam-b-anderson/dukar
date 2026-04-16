const { invoke } = require('../invoke');

async function runCarWashAdaptive() {
  const result = await invoke({
    prompt: 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?',
    model: 'opus',
    timeoutMs: 15000,
  });

  if (result.error) {
    return { ...result, score: 'error' };
  }

  const score = scoreCarWash(result.responseText);
  return { ...result, score };
}

async function runCarWashForced() {
  const result = await invoke({
    prompt: 'I want to wash my car. The car wash is 50 meters away. Should I drive or walk?',
    model: 'opus',
    envOverrides: {
      CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1',
    },
    timeoutMs: 15000,
  });

  if (result.error) {
    return { ...result, score: 'error' };
  }

  const score = scoreCarWash(result.responseText, true);
  return { ...result, score };
}

function scoreCarWash(text, allowHedged = false) {
  const lowerText = text.toLowerCase();
  
  // PASS-HEDGED detection for Test 2
  if (allowHedged) {
    const hasDrive = lowerText.includes('drive');
    const hasWalk = lowerText.includes('walk');
    const first300 = lowerText.slice(0, 300);
    
    if (hasDrive && hasWalk && (first300.includes('drive') && first300.includes('walk'))) {
      const hedgedPhrases = [
        'car needs to be',
        'need the car',
        'car has to be',
        'need to drive the car',
        'drive the car there',
        'into the car wash',
        'at the car wash to'
      ];
      
      if (hedgedPhrases.some(phrase => first300.includes(phrase))) {
        return 'pass-hedged';
      }
    }
  }

  // Standard scoring
  const driveMatch = lowerText.match(/\bdrive\b/);
  const walkMatch = lowerText.match(/\bwalk\b/);

  if (!driveMatch && !walkMatch) {
    if (text.length < 200) return 'fail'; // Model didn't answer properly
    // Check first 200 chars as per spec
    const first200 = lowerText.slice(0, 200);
    if (!first200.includes('drive') && !first200.includes('walk')) return 'fail';
  }

  const driveIndex = driveMatch ? driveMatch.index : Infinity;
  const walkIndex = walkMatch ? walkMatch.index : Infinity;

  if (driveIndex < walkIndex) return 'pass';
  if (walkIndex < driveIndex) return 'fail';

  return 'fail';
}

module.exports = { runCarWashAdaptive, runCarWashForced, scoreCarWash };
