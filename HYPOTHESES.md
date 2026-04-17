# Dukar Hypotheses

Dukar v0.1 was built on five core hypotheses. The April 17, 2026 comparison run (200 calls, $15.35) provided early data on several of them.

- **H1:** The car wash test is a reliable daily indicator of adaptive thinking health.
  - *Status:* Supported. Cleanly separates 4.5 (80% pass, always thinks) from 4.6/4.7 (0% pass, never thinks). The test measures whether the model engages reasoning, not whether it's capable of reasoning.

- **H2:** The A/B engagement gap (adaptive vs forced thinking) produces diagnostic signal worth surfacing.
  - *Status:* Partially falsified. On 4.6, forced thinking engages but is too shallow (~30 chars vs 4.5's ~400) to change the answer. On 4.7, the `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` env var has no effect at all — thinking never engages. The A/B gap still tells you *what kind* of failure you're seeing, but the forced condition no longer serves as a "capability ceiling" check.

- **H3:** The tool use probe catches degradation that the canary misses, or vice versa.
  - *Status:* Not yet observed. All three Opus models pass tool use 100% (20/20). The adaptive allocator does not skip reasoning on multi-turn tool use tasks — it specifically skips on short, conversational prompts. Kept as a sanity check for catastrophic regressions.

- **H4:** A single verified trap test plus a tool use probe is enough signal for a useful daily verdict.
  - *Status:* Revised. v0.2 simplified to just the car wash canary for the daily hook. Tool use runs only in manual mode (`dukar run`). One canary is fragile but sufficient given current data.

- **H5:** A SessionStart hook is a tolerable intrusion on the user's workflow.
  - *Status:* Open. Requires broader user feedback to validate.
