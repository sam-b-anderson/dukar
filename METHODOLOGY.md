# Dukar Methodology

Dukar uses four key diagnostic tests to determine whether Opus 4.6 is performing within its normal range.

## Why Naked Prompts?

Standard benchmarks often use "think step by step" or specific system prompts that force reasoning. This defeats the purpose of detecting **adaptive thinking degradation**, where the model autonomously decides to skip reasoning. Dukar uses "naked" prompts—no system prompt, no reasoning instructions—to see what the model does on its own.

## The A/B Engagement Gap

By running the same test (Car Wash) with and without forced thinking (`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`), we can measure the "engagement gap."
- **If both pass:** The model is healthy.
- **If adaptive fails but forced passes:** Capability is present, but allocation is degraded.
- **If both fail:** The issue might be more fundamental (e.g., training data saturation).

## Tool Use Discipline

Research has shown that model degradation is strongly correlated with a drop in "Read-before-Edit" discipline. Healthy models read a file before attempting to edit it; degraded models often try to pattern-match an edit without reading the surrounding context. Dukar's Test 4 explicitly measures this sequence.

## Known Limitations

- **Memorization Risk:** As Dukar's tests become more public, Anthropic or future model versions may memorize the answers, making them useless as diagnostic canaries.
- **Single-Test Fragility:** A single failed test might just be a "unlucky" turn. Dukar requires at least one of Test 1 or Test 4 to fail before issuing a DEGRADED verdict.
- **Opus 4.6 Only:** These tests are specifically calibrated for Opus 4.6 and its adaptive thinking behavior.
