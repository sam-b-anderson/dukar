# Dukar

> *Named after the head of King Taravangian's Testers in Brandon Sanderson's Stormlight Archive — whose job was determining each day what kind of cognitive day the king was having before he made important decisions.*

A daily diagnostic hook for Claude Code that tells you whether Opus 4.6 is performing within its normal range before you start working.

## The Problem

Claude Code users on Max subscriptions report that Opus 4.6 has bad days. Sometimes the model is sloppy, argumentative, skips reading files before editing them, or pattern-matches instead of reasoning. The community has converged on a root cause: Opus 4.6's adaptive thinking allocator decides per-turn how much reasoning to apply, and increasingly decides "not much."

Boris Cherny (Claude Code team lead) has confirmed: *"the specific turns where it fabricated had zero reasoning emitted, while the turns with deep reasoning were correct."*

The interim workaround is the environment variable `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`, which forces a fixed reasoning budget. But no tool exists for users to verify which kind of day Claude is having before they commit to important work.

Benchmarks don't capture this because benchmarks include "think step by step" system prompts that force reasoning regardless of the adaptive allocator's decision. Dukar fills this gap.

## Install

```bash
npm install -g .
dukar install
```

## How It Works

Dukar registers a [SessionStart hook](https://docs.anthropic.com/en/docs/claude-code/hooks) in Claude Code. On your first session each day, it runs a small diagnostic battery (~$0.18, ~15 seconds):

- **Healthy days:** Complete silence. Dukar never interrupts good days.
- **Degraded days:** A stderr warning recommending you set `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`.

### Manual Commands

```
dukar run        # Force a fresh diagnostic right now
dukar status     # Show the most recent result
dukar history    # Pass rates over the last 7 and 30 days
dukar uninstall  # Remove the hook (--keep-history to preserve logs)
```

## What It Measures

### Test 1 — Car Wash Canary (synchronous)

A logic trap: *"I want to wash my car. The car wash is 50 meters away. Should I drive or walk?"*

The correct answer is "drive" — the car has to physically be at the car wash. But the strong pattern-match shortcut ("50 meters is short, just walk") wins when the model skips reasoning. Verified at 0/4 pass rate on adaptive Opus 4.6 during calibration (April 2026).

This is the only synchronous test. Its result determines whether you see an immediate warning.

### Test 2 — Car Wash Forced (background)

The same prompt with `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`. If Test 1 fails and Test 2 passes, the issue is allocation, not capability. This A/B comparison is the core diagnostic signal.

### Test 3 — Cache & Quota Probe (background)

A near-zero-cost prompt (`"What is 2+2?"`) that observes cache tier behavior and checks quota utilization. If you're above 90% of your 7-day window, Dukar skips the remaining tests to avoid wasting quota.

### Test 4 — Tool Use Discipline (background)

Creates a Python file with a division-by-zero bug and asks the model to fix it surgically. Measures whether the model reads the file before attempting to edit — a behavioral signal that [research has shown](https://community.anthropic.com/t/data-driven-analysis-of-claude-code-s-tool-use-patterns) drops from a 6.6:1 Read:Edit ratio to 2.0:1 during degradation.

## Verdict Logic

| Condition | Verdict |
|-----------|---------|
| Quota > 90% | `SKIPPED` |
| Test 1 or Test 4 errored | `UNKNOWN` |
| Test 1 or Test 4 failed | `DEGRADED` |
| Otherwise | `HEALTHY` |

## Design Principles

- **Silence means healthy.** Zero terminal output on good days.
- **Sub-3-second synchronous footprint.** Background tests run after the hook releases.
- **Naked prompts.** No "think step by step." The whole point is detecting when the model skips reasoning autonomously.
- **Binary verdict.** HEALTHY or DEGRADED. Confidence intervals live in the JSON.
- **Graceful degradation.** If anything goes wrong, Dukar exits cleanly and never crashes Claude Code's session start.

## Output

Full results are written to `~/.dukar/latest.json` with detailed per-test data (thinking presence, token counts, costs, engagement gap analysis). History is appended to `~/.dukar/history.jsonl`.

## Known Limitations

- **Single canary fragility.** One verified trap test. If Anthropic tunes specifically against it, Dukar goes blind.
- **Memorization risk.** Public tests can be learned by future model versions.
- **Opus 4.6 only.** Calibrated against the current adaptive thinking behavior.
- **n=1 validation.** Self-validated against one user's experience during a 14-day period.

See [METHODOLOGY.md](METHODOLOGY.md) for the research behind the test design and [HYPOTHESES.md](HYPOTHESES.md) for the falsifiable claims this build is testing.

## License

MIT
