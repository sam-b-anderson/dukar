const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeVerdict, computeEngagementGap } = require('../src/scorer');

test('computeVerdict: quota over 90% returns skipped before any other check', () => {
  const result = computeVerdict({
    carWashAdaptive: { score: 'fail' },
    toolUse: { score: 'fail' },
    quotaUtilization: 0.95,
  });
  assert.equal(result, 'skipped');
});

test('computeVerdict: error in either test returns unknown', () => {
  assert.equal(
    computeVerdict({
      carWashAdaptive: { score: 'error' },
      toolUse: { score: 'pass' },
      quotaUtilization: 0.5,
    }),
    'unknown'
  );
  assert.equal(
    computeVerdict({
      carWashAdaptive: { score: 'pass' },
      toolUse: { score: 'error' },
      quotaUtilization: 0.5,
    }),
    'unknown'
  );
});

test('computeVerdict: error takes precedence over fail', () => {
  const result = computeVerdict({
    carWashAdaptive: { score: 'error' },
    toolUse: { score: 'fail' },
    quotaUtilization: 0.5,
  });
  assert.equal(result, 'unknown');
});

test('computeVerdict: any fail returns degraded', () => {
  assert.equal(
    computeVerdict({
      carWashAdaptive: { score: 'fail' },
      toolUse: { score: 'pass' },
      quotaUtilization: 0.5,
    }),
    'degraded'
  );
  assert.equal(
    computeVerdict({
      carWashAdaptive: { score: 'pass' },
      toolUse: { score: 'fail' },
      quotaUtilization: 0.5,
    }),
    'degraded'
  );
});

test('computeVerdict: both pass returns healthy', () => {
  const result = computeVerdict({
    carWashAdaptive: { score: 'pass' },
    toolUse: { score: 'pass' },
    quotaUtilization: 0.5,
  });
  assert.equal(result, 'healthy');
});

test('computeVerdict: pass-hedged on adaptive is treated as pass (only fail/error are negative)', () => {
  const result = computeVerdict({
    carWashAdaptive: { score: 'pass-hedged' },
    toolUse: { score: 'pass' },
    quotaUtilization: 0.5,
  });
  assert.equal(result, 'healthy');
});

test('computeEngagementGap: both thinking present', () => {
  const gap = computeEngagementGap(
    { thinkingPresent: true, outputTokens: 100 },
    { thinkingPresent: true, outputTokens: 250 }
  );
  assert.equal(gap.thinkingChange, 'both_present');
  assert.equal(gap.interpretation, 'both_engaged');
  assert.equal(gap.tokenDelta, 150);
});

test('computeEngagementGap: adaptive skipped, forced engaged is the diagnostic signal', () => {
  const gap = computeEngagementGap(
    { thinkingPresent: false, outputTokens: 80 },
    { thinkingPresent: true, outputTokens: 320 }
  );
  assert.equal(gap.thinkingChange, 'absent_to_present');
  assert.equal(gap.interpretation, 'adaptive_skipped_thinking');
  assert.equal(gap.tokenDelta, 240);
});

test('computeEngagementGap: both absent', () => {
  const gap = computeEngagementGap(
    { thinkingPresent: false, outputTokens: 60 },
    { thinkingPresent: false, outputTokens: 65 }
  );
  assert.equal(gap.thinkingChange, 'both_absent');
  assert.equal(gap.interpretation, 'both_skipped');
  assert.equal(gap.tokenDelta, 5);
});

test('computeEngagementGap: present then absent flagged as unexpected', () => {
  const gap = computeEngagementGap(
    { thinkingPresent: true, outputTokens: 200 },
    { thinkingPresent: false, outputTokens: 90 }
  );
  assert.equal(gap.thinkingChange, 'present_to_absent');
  assert.equal(gap.interpretation, 'unexpected');
  assert.equal(gap.tokenDelta, -110);
});
