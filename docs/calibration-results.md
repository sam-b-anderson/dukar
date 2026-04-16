# SimpleBench Calibration Results for Dukar

**Date:** 2026-04-13 (Sunday)
**Time:** 14:49 - 16:01 EDT (71 minutes)
**Claude Code Version:** 2.1.104
**Quota Utilization at Start:** ~92% of 7-day rolling window
**Total Cost:** $8.51
**Total Calls:** 150 (10 questions x 3 probes x 5 runs)

---

## Methodology

### Probe Configurations

| Probe | Model | Config | Purpose |
|-------|-------|--------|---------|
| A | Opus 4.6 | Standard adaptive | What users experience |
| B | Opus 4.6 | CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 | Capability ceiling |
| C | Opus 4.5 | claude-opus-4-5-20251101 | Known healthy baseline |

### Invocation Pattern

All probes used:
```bash
claude -p --setting-sources "" --output-format stream-json --verbose \
  --no-session-persistence --model <MODEL> \
  --append-system-prompt "<SYSTEM_PROMPT>" "<QUESTION>"
```

### System Prompt (SimpleBench exact)

```
You are an expert at reasoning and you always pick the most realistic answer. Think step by step and output your reasoning followed by your final answer using the following format: Final Answer: X where X is one of the letters A, B, C, D, E, or F.
```

### Methodology Notes

- **Temperature:** `claude -p` does not support a `--temperature` flag. Default temperature was used for all calls. SimpleBench uses temp=0.7. This is a known deviation that could not be controlled.
- **AVG@5:** Each question was run 5 times per probe, matching SimpleBench's AVG@5 standard.
- **Answer extraction:** Regex `r"Final Answer:\s*\*{0,2}([A-F])\*{0,2}"` (case insensitive, first match). The `\*{0,2}` handles markdown bold formatting (e.g., `Final Answer: **B**`).
- **Resume capability:** Script skips existing output files, allowing safe restart after interruptions.

---

## Summary Table

| Q# | Canonical | Probe A (adaptive) | Probe B (forced) | Probe C (Opus 4.5) | Valid Dukar test? |
|-----|-----------|-------------------|-----------------|-------------------|-------------------|
| 1 | B | 5/5 correct [4/5 no-think] | 5/5 correct | 5/5 correct | VALID |
| 2 | A | 5/5 correct [1/5 no-think] | 5/5 correct | 5/5 correct | INVALID: memorized correct |
| 3 | A | 5/5 correct [0/5 no-think] | 5/5 correct | 4/5 correct | INVALID: memorized correct |
| 4 | C | 5/5 correct [0/5 no-think] | 4/5 correct | 2/5 correct | INVALID: stable baseline failure |
| 5 | B | 5/5 correct [0/5 no-think] | 5/5 correct | 5/5 correct | INVALID: memorized correct |
| 6 | A | 5/5 correct [0/5 no-think] | 5/5 correct | 0/5 correct | INVALID: stable baseline failure |
| 7 | C | 5/5 correct [0/5 no-think] | 5/5 correct | 5/5 correct | INVALID: memorized correct |
| 8 | F | 5/5 correct [1/5 no-think] | 5/5 correct | 5/5 correct | INVALID: memorized correct |
| 9 | A | 5/5 correct [0/5 no-think] | 5/5 correct | 5/5 correct | INVALID: memorized correct |
| 10 | B | 5/5 correct [0/5 no-think] | 5/5 correct | 0/5 correct | INVALID: stable baseline failure |

### Validity Classifications

- **VALID:** Q1 only
- **INVALID: stable baseline failure:** Q4, Q6, Q10
- **INVALID: memorized correct:** Q2, Q3, Q5, Q7, Q8, Q9

---

## Aggregate Statistics

| Metric | Probe A (adaptive) | Probe B (forced) | Probe C (Opus 4.5) |
|--------|-------------------|-----------------|-------------------|
| Correct answers | 50/50 | 49/50 | 36/50 |
| Accuracy | **100.0%** | **98.0%** | **72.0%** |
| Runs with thinking events | 44/50 (88%) | 50/50 (100%) | 50/50 (100%) |
| Avg thinking chars | 1,279 | 1,379 | 3,318 |
| SimpleBench published score | 67.6% | N/A | N/A |

### Cost Breakdown

| Probe | Total Cost | Avg per call |
|-------|-----------|-------------|
| A | ~$2.40 | ~$0.048 |
| B | ~$2.40 | ~$0.048 |
| C | ~$3.71 | ~$0.074 |
| **Total** | **$8.51** | **$0.057** |

---

## Thinking Event Analysis

### Per-Probe Thinking Engagement

| Probe | Runs with thinking | Avg thinking chars | Avg output tokens |
|-------|-------------------|-------------------|-------------------|
| A (adaptive) | 44/50 (88%) | 1,279 | 808 |
| B (forced) | 50/50 (100%) | 1,379 | 832 |
| C (Opus 4.5) | 50/50 (100%) | 3,318 | 1,769 |

**Critical observation:** Probe A had thinking events on 88% of runs (44/50). Only Q1 showed significant no-thinking behavior (4/5 runs without thinking). The SimpleBench system prompt ("Think step by step") appears to OVERRIDE the adaptive thinking system's tendency to skip reasoning. This is in stark contrast to the car wash test (Round 3), where zero thinking events appeared on standard invocation.

### Questions Where Probe A Had No Thinking Events

| Q# | Runs without thinking | Answer still correct? |
|-----|----------------------|----------------------|
| Q1 | 4/5 | Yes (all 5/5 correct) |
| Q2 | 1/5 | Yes (all 5/5 correct) |
| Q8 | 1/5 | Yes (all 5/5 correct) |

Only Q1 shows a strong no-thinking pattern on Probe A. The other questions consistently trigger thinking even in adaptive mode.

### Probe B Thinking Content Samples (first run per question)

| Q# | Thinking excerpt | Chars |
|-----|-----------------|-------|
| Q1 | "Let me work through this step by step. Minutes 1-4, ice cubes placed: 4, 5, x, 0. Average over 4 minutes = 5..." | 424 |
| Q2 | "The juggler throws a blue ball 1 meter in the air, then a purple ball 2 meters in the air. Then she climbs a tall ladder. Both balls would have come back down due to gravity..." | 282 |
| Q3 | "Let me think about this carefully. We have three men in a 200m race..." | 5,299 |
| Q4 | "Let me think about this carefully. We have two sisters: Amy: always speaks 'mistruths', Sam: always lies..." | 1,425 |
| Q5 | "This is a reasoning question about human behavior in an emergency situation..." | 597 |
| Q6 | "Think about this carefully. The question asks what John is 'far more shocked than Jen could have imagined'..." | 1,019 |
| Q7 | "Let me carefully parse this scenario. John is in a bathroom, brushing his teeth, looking at a mirror..." | 1,819 |
| Q8 | "Let me work through this step by step. Initial shelf: green apple, red pear, pink peach..." | 606 |
| Q9 | "Let me think about this carefully. Agatha makes 5 sandwiches in Room A, stacked..." | 3,069 |
| Q10 | "The glove falls from the car when it's halfway over the bridge..." | 1,209 |

All Probe B thinking content is substantive and directly relevant to solving the problem. No instances of the "Simple non-technical question." dismissive thinking seen in Round 3's car wash test.

---

## Detailed Per-Run Results

### Q1: Ice cubes in frying pan (Answer: B)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | B (think:450) | B (no-think) | B (no-think) | B (no-think) | B (no-think) | 5/5 |
| B | B (think:424) | B (think:422) | B (think:596) | B (think:508) | B (think:422) | 5/5 |
| C | B (think:1990) | B (think:2119) | B (think:1728) | B (think:1734) | B (think:1383) | 5/5 |

### Q2: Juggler balls (Answer: A)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | A (think:353) | A (think:349) | A (think:379) | A (think:353) | A (no-think) | 5/5 |
| B | A (think:282) | A (think:267) | A (think:307) | A (think:279) | A (think:272) | 5/5 |
| C | A (think:2192) | A (think:2122) | A (think:2362) | A (think:1517) | A (think:2305) | 5/5 |

### Q3: 200m race (Answer: A)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | A (think:5622) | A (think:3181) | A (think:2254) | A (think:2916) | A (think:3663) | 5/5 |
| B | A (think:5299) | A (think:5998) | A (think:5764) | A (think:3407) | A (think:3799) | 5/5 |
| C | A (think:2854) | A (think:3522) | A (think:2143) | A (think:5016) | **C** (think:5713) | 4/5 |

### Q4: Two sisters / treasure (Answer: C)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | C (think:2236) | C (think:1478) | C (think:2583) | C (think:1574) | C (think:2462) | 5/5 |
| B | C (think:1425) | C (think:1350) | C (think:1836) | C (think:1030) | **A** (think:1761) | 4/5 |
| C | C (think:7895) | **A** (think:6935) | **A** (think:6516) | C (think:8742) | **A** (think:3545) | 2/5 |

### Q5: CPR emergency (Answer: B)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | B (think:553) | B (think:695) | B (think:598) | B (think:862) | B (think:886) | 5/5 |
| B | B (think:597) | B (think:658) | B (think:440) | B (think:749) | B (think:565) | 5/5 |
| C | B (think:2553) | B (think:2487) | B (think:1745) | B (think:1891) | B (think:2285) | 5/5 |

### Q6: Nuclear war / John returns (Answer: A)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | A (think:1040) | A (think:1026) | A (think:922) | A (think:1013) | A (think:970) | 5/5 |
| B | A (think:1019) | A (think:1022) | A (think:1047) | A (think:910) | A (think:919) | 5/5 |
| C | **F** (think:2810) | **F** (think:2763) | **F** (think:2190) | **F** (think:2348) | **F** (think:2377) | 0/5 |

### Q7: Mirror / bald man (Answer: C)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | C (think:1204) | C (think:1396) | C (think:1403) | C (think:1354) | C (think:1457) | 5/5 |
| B | C (think:1819) | C (think:1215) | C (think:829) | C (think:1323) | C (think:1467) | 5/5 |
| C | C (think:2792) | C (think:2330) | C (think:2288) | C (think:1969) | C (think:2749) | 5/5 |

### Q8: Fruit shelf (Answer: F)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | F (think:866) | F (think:739) | F (no-think) | F (think:722) | F (think:662) | 5/5 |
| B | F (think:606) | F (think:732) | F (think:744) | F (think:744) | F (think:704) | 5/5 |
| C | F (think:1339) | F (think:1683) | F (think:1584) | F (think:1531) | F (think:1391) | 5/5 |

### Q9: Sandwich on walking stick (Answer: A)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | A (think:2005) | A (think:2005) | A (think:1133) | A (think:2219) | A (think:1046) | 5/5 |
| B | A (think:3069) | A (think:1509) | A (think:1653) | A (think:1581) | A (think:2607) | 5/5 |
| C | A (think:3202) | A (think:4452) | A (think:3269) | A (think:3868) | A (think:3183) | 5/5 |

### Q10: Glove on bridge (Answer: B)

| Probe | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Score |
|-------|-------|-------|-------|-------|-------|-------|
| A | B (think:2041) | B (think:1387) | B (think:1118) | B (think:880) | B (think:1890) | 5/5 |
| B | B (think:1209) | B (think:800) | B (think:1280) | B (think:979) | B (think:729) | 5/5 |
| C | **A** (think:6668) | **F** (think:6302) | **A** (think:11074) | **F** (think:5086) | **A** (think:3379) | 0/5 |

---

## Analysis and Recommendations

### 1. How many questions survived as VALID Dukar Reasoning Depth tests?

**ONE out of ten (Q1).** And even Q1 is marginal. The model gets it right 100% of the time across all probes; the only differentiator is that adaptive mode skips thinking on 4/5 runs for Q1. This makes Q1 a potential "memorization detector" but NOT a reasoning depth test in the sense Dukar needs. There is no question where Probe A fails and Probe B succeeds.

### 2. How does Probe A's aggregate score compare to SimpleBench's published 67.6%?

**Probe A scored 100.0% vs. published 67.6% -- a 32.4 percentage point gap.**

Possible explanations:
1. **The 10 public questions are the easy subset.** SimpleBench has 213 questions total. The 10 public ones may have been chosen as examples specifically because they're tractable. The hard questions (driving the published score down) are in the private 200+ set.
2. **Memorization / data contamination.** These 10 questions are publicly available on GitHub since October 2024. Opus 4.6 may have been trained on them or on discussions about them. The 100% score with thinking events suggests the model has genuinely learned these specific problems.
3. **System prompt effect.** "Think step by step" in the system prompt appears to FORCE Opus 4.6 to engage reasoning even in adaptive mode. The car wash test (no such prompt) fails 100%. This is perhaps the most important finding.
4. **Temperature difference.** SimpleBench uses temp=0.7; we used the default (unknown, possibly 1.0). Higher temperature could produce more varied (wrong) answers. However, 100% is 100% -- temperature would need to be very high to degrade from perfection.

### 3. Did any questions show the "memorized correct" pattern (right answer, zero thinking)?

**Q1 shows this clearly.** 4 out of 5 Probe A runs had zero thinking events but correct answers. Q2 and Q8 each had 1/5 runs without thinking.

However, the majority pattern across all 10 questions is "correct answer WITH thinking." The SimpleBench system prompt effectively defeats the adaptive-thinking skip. Even in Probe A (no DISABLE_ADAPTIVE env var), 88% of runs (44/50) produced thinking events.

### 4. Did any questions show the "adaptive thinking failure" pattern most clearly?

**NONE.** Zero questions showed the pattern where Probe A is wrong but Probe B is right. In fact, the only wrong answer in Probe B was Q4 run 5 (answered A instead of C) -- and Probe A got that same question right 5/5. The adaptive thinking failure pattern that exists for the car wash test does not exist for any SimpleBench public question.

### 5. Did Probe C (Opus 4.5) outperform Probe B (Opus 4.6 forced)?

**No -- the opposite. Opus 4.5 was dramatically WORSE.**

| Metric | Opus 4.6 forced (B) | Opus 4.5 (C) |
|--------|---------------------|--------------|
| Accuracy | 98.0% | 72.0% |
| Questions with 0/5 | None | Q6, Q10 |
| Questions with <3/5 | None | Q4 (2/5), Q6 (0/5), Q10 (0/5) |

This is NOT a capability regression from 4.5 to 4.6. It's a capability IMPROVEMENT. Opus 4.6 has genuinely gotten better at these shortcut-trap questions compared to 4.5. The specific failure patterns:

- **Q4 (two sisters):** Opus 4.5 answered A (the classic wrong answer -- falling for the standard liar-truth-teller pattern) 3/5 times despite spending 6,000-8,700 chars thinking. The model overthinks the "mistruth vs lie" distinction and reaches the wrong conclusion.
- **Q6 (nuclear war):** Opus 4.5 answered F (the escapades) 5/5 times. Despite 2,190-2,810 chars of thinking, it always falls for the infidelity trap. Opus 4.6 recognizes that Jen is an EX-partner, so infidelity doesn't apply.
- **Q10 (glove on bridge):** Opus 4.5 answered A or F (never B) 5/5 times. It gets confused by the river/wind physics and fails to realize the glove lands on the bridge road, not in the water. Opus 4.6 consistently gets this right.

### 6. Are there questions where Probe B thinking content was diagnostic gold vs. dismissive?

**All Probe B thinking was substantive.** Unlike the car wash test where forced thinking produced "Simple non-technical question." (4 words, dismissive), every SimpleBench question generated hundreds to thousands of characters of relevant reasoning. The system prompt "Think step by step" appears to be the key differentiator -- it tells the model these questions deserve real reasoning.

### 7. Surprises and implications for Dukar

**SURPRISE 1: The system prompt changes everything.**

The car wash test fails 0/4 on adaptive Opus 4.6 with no system prompt. But with SimpleBench's "Think step by step" system prompt, adaptive Opus 4.6 scores 100%. This means:
- **The adaptive thinking degradation is prompt-sensitive.** The model's decision to skip thinking depends on how the question is framed, not just the question's inherent difficulty.
- **A system prompt that says "think step by step" is a workaround for the degradation.** Users who include reasoning instructions in their prompts may never experience the failure mode.
- **For Dukar: test prompts should NOT include "think step by step" or similar reasoning cues.** The whole point is to detect when the model skips reasoning. If the prompt tells it to reason, the test is measuring prompt obedience, not autonomous reasoning engagement.

**SURPRISE 2: Opus 4.5 is NOT a reliable healthy baseline for these questions.**

We assumed Opus 4.5 would be the "known healthy" comparison, outperforming Opus 4.6 on trap questions due to its always-on thinking. Instead, Opus 4.5 fails 3/10 questions catastrophically despite thinking deeply. On Q6 (nuclear war), Opus 4.5 spends 2,000+ chars of thinking and STILL falls for the infidelity trap every single time. This is a genuine reasoning limitation of the older model, not a thinking-allocation issue.

**SURPRISE 3: The 10 public SimpleBench questions are useless for Dukar v0.1.**

Only 1/10 passes our validity criteria, and even that one (Q1) is marginal. The fundamental problem: Opus 4.6 has learned these 10 questions. Combined with the "Think step by step" system prompt, there is zero degradation signal.

**RECOMMENDATIONS FOR DUKAR v0.1:**

1. **Do NOT use SimpleBench public questions.** They are solved/memorized by Opus 4.6. Zero diagnostic value for reasoning depth detection.

2. **The car wash test (from Round 3) remains the strongest signal.** It works precisely because it has NO reasoning prompt -- it triggers the adaptive-thinking skip that these questions don't.

3. **If creating new trap questions for Dukar, do NOT include "think step by step" in the system prompt.** Instead, present them as conversational questions. The degradation pattern is specifically about the model's autonomous decision to skip reasoning.

4. **Consider reaching out to SimpleBench for the private 200+ questions.** The published 67.6% score for Opus 4.6 suggests those questions DO contain failures. The 10 public questions are likely the "showcase" subset.

5. **The thinking-chars metric IS diagnostic when degradation is present.** Compare Q1 Probe A (4/5 runs: 0 chars thinking) vs Q1 Probe B (all runs: 400-600 chars). When the model does skip thinking, the signal is clear and measurable.

6. **Opus 4.5 should NOT be used as a universal "healthy baseline."** It has its own failure patterns (Q4, Q6, Q10) that are capability limitations, not thinking-allocation issues. Use it selectively on questions where it's pre-verified to be correct.

---

## Raw Infrastructure

### Files Produced

```
~/dukar-verification/simplebench-calibration/
  run-calibration.py         # Automation script (150 calls)
  parse-results.py           # Result parser and report generator
  calibration-log.txt        # Execution log with timestamps
  parsed-output.md           # Full parsed output (including JSON audit data)
  raw/                       # 150 raw JSON stream outputs
    q{1-10}_probe{A,B,C}_run{1-5}.json
```

### Reproducibility Notes

- All raw output files are preserved for audit
- Script has resume capability (skips existing files)
- Parser handles markdown-formatted answers (`Final Answer: **B**`)
- Python 3.13.5 on Windows 11, Claude Code 2.1.104
