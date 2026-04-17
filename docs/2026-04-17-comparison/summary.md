# Dukar comparison: Opus 4.5 vs 4.6 vs 4.7

**Run date:** 2026-04-17
**Total calls:** 200
**Total cost:** $15.35

## Pass rates by model × probe × condition

| Model | Probe | Condition | Pass | Fail | Err | Pass rate | 95% CI | Thinking present | Median output tok |
|-------|-------|-----------|-----:|-----:|----:|----------:|--------|-----------------:|------------------:|
| 4-5 | car-wash | adaptive | 16 | 4 | 0 | 80% | 58–92% | 100% | 136 |
| 4-5 | tool-use | adaptive | 20 | 0 | 0 | 100% | 84–100% | 100% | 484 |
| 4-6 | car-wash | adaptive | 0 | 20 | 0 | 0% | 0–16% | 0% | 31 |
| 4-6 | car-wash | forced | 0 | 20 | 0 | 0% | 0–16% | 100% | 53 |
| 4-6 | tool-use | adaptive | 20 | 0 | 0 | 100% | 84–100% | 0% | 347 |
| 4-6 | tool-use | forced | 20 | 0 | 0 | 100% | 84–100% | 100% | 524 |
| 4-7 | car-wash | adaptive | 0 | 20 | 0 | 0% | 0–16% | 0% | 63 |
| 4-7 | car-wash | forced | 1 | 19 | 0 | 5% | 1–24% | 0% | 61 |
| 4-7 | tool-use | adaptive | 20 | 0 | 0 | 100% | 84–100% | 100% | 461 |
| 4-7 | tool-use | forced | 20 | 0 | 0 | 100% | 84–100% | 100% | 455 |

## Engagement gap (forced − adaptive)

The diagnostic signal: when forcing thinking with `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` flips a fail to a pass, the capability is present but the adaptive allocator is skipping reasoning.

| Model | Probe | Adaptive pass | Forced pass | Gap | Adaptive thinking | Forced thinking | Adaptive tok | Forced tok |
|-------|-------|--------------:|------------:|----:|------------------:|----------------:|-------------:|-----------:|
| 4-6 | car-wash | 0% | 0% | 0pp | 0% | 100% | 31 | 53 |
| 4-6 | tool-use | 100% | 100% | 0pp | 0% | 100% | 347 | 524 |
| 4-7 | car-wash | 0% | 5% | +5pp | 0% | 0% | 63 | 61 |
| 4-7 | tool-use | 100% | 100% | 0pp | 100% | 100% | 461 | 455 |

## Methodology

- **Probes:** car wash canary (one logic trap that pattern-matching fails), tool-use discipline (read-before-edit on a tiny Python fixture).
- **Conditions:** `adaptive` is the default (model decides reasoning per turn); `forced` sets `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`.
- **Naked prompts:** no system prompt, no "think step by step." The point is to see what the model does on its own.
- **Sample size:** 20 runs per cell. 95% CI computed via Wilson score interval.
- **Scoring:** car wash passes when "drive" appears before "walk"; tool-use passes when the model invokes Read before Edit on the fixture and never falls back to Write.
- **Harness:** `scripts/compare.js` in this repo. Each call's full JSON is in `runs/2026-04-17/raw/`.
