function computeVerdict(results) {
  const { carWashAdaptive, toolUse, quotaUtilization } = results;

  if (quotaUtilization > 0.90) {
    return 'skipped';
  }

  if (carWashAdaptive.score === 'error' || toolUse.score === 'error') {
    return 'unknown';
  }

  if (carWashAdaptive.score === 'fail' || toolUse.score === 'fail') {
    return 'degraded';
  }

  return 'healthy';
}

function computeEngagementGap(adaptive, forced) {
  let thinkingChange = 'both_absent';
  if (adaptive.thinkingPresent && forced.thinkingPresent) {
    thinkingChange = 'both_present';
  } else if (!adaptive.thinkingPresent && forced.thinkingPresent) {
    thinkingChange = 'absent_to_present';
  } else if (adaptive.thinkingPresent && !forced.thinkingPresent) {
    thinkingChange = 'present_to_absent';
  }

  let interpretation = 'unexpected';
  if (thinkingChange === 'absent_to_present') {
    interpretation = 'adaptive_skipped_thinking';
  } else if (thinkingChange === 'both_present') {
    interpretation = 'both_engaged';
  } else if (thinkingChange === 'both_absent') {
    interpretation = 'both_skipped';
  }

  return {
    thinkingChange,
    tokenDelta: forced.outputTokens - adaptive.outputTokens,
    interpretation
  };
}

module.exports = { computeVerdict, computeEngagementGap };
