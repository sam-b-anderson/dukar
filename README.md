# Dukar

[![CI](https://github.com/sam-b-anderson/dukar/actions/workflows/ci.yml/badge.svg)](https://github.com/sam-b-anderson/dukar/actions/workflows/ci.yml)

> *Named after the head of King Taravangian's Testers in Brandon Sanderson's Stormlight Archive — whose job was determining each day what kind of cognitive day the king was having before he made important decisions.*

A daily diagnostic hook for Claude Code that tells you whether Opus is performing within its normal range before you start working.

> **Update — April 17, 2026:** I tested the canary across Opus 4.5, 4.6, and 4.7 (200 controlled calls). 4.5 still passes ~80%; **4.6 and 4.7 fail 0/20**, even with `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`. On 4.7 the env var workaround doesn't even engage thinking on short prompts. Full data: [docs/2026-04-17-comparison/](docs/2026-04-17-comparison/).

## The Problem

Claude Code users on Max subscriptions report that Opus has bad days. Sometimes the model is sloppy, argumentative, skips reading files before editing them, or pattern-matches instead of reasoning. The community has converged on a root cause: the adaptive thinking allocator decides per-turn how much reasoning to apply, and increasingly decides "not much."

Boris Cherny (Claude Code team lead) has confirmed: *"the specific turns where it fabricated had zero reasoning emitted, while the turns with deep reasoning were correct."*

The interim workaround is the environment variable `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`, which forces a fixed reasoning budget. But no tool exists for users to verify which kind of day Claude is having before they commit to important work.

Benchmarks don't capture this because benchmarks include "think step by step" system prompts that force reasoning regardless of the adaptive allocator's decision. Dukar fills this gap.

## Background

Before designing Dukar, I spent 60 days collecting data on this problem from r/ClaudeCode and r/ClaudeAI — 3,965 unique posts, 5,304 comments from the top 30 highest-engagement threads, plus sentiment and claim analysis. The community had converged on three distinct technical claims; Dukar targets the one that's most actionable from a user's seat: adaptive thinking regression. See [docs/research-summary.md](docs/research-summary.md) for the synthesized findings.

I then ran a dedicated calibration against SimpleBench-style probes (150 calls, $8.51, 10 questions × 3 probe configs × 5 runs) to verify which test prompts actually discriminate between healthy and degraded Opus 4.6. Two prompts survived; the car wash test became Dukar's primary canary. See [docs/calibration-results.md](docs/calibration-results.md).

The pre-implementation spec is preserved as [docs/spec.md](docs/spec.md) and the platform/auth/billing verification work is in [docs/verification-results.md](docs/verification-results.md).

## Install

In Claude Code, paste:

```
/plugin marketplace add sam-b-anderson/dukar
/plugin install dukar@dukar
```

Two commands. The plugin registers a SessionStart hook automatically — no `npm install`, no manual settings.json edits, no `dukar install`. Restart Claude Code (or run `/plugin reload-plugins`) and you're done.

To remove: `/plugin uninstall dukar@dukar`.

<details>
<summary>Manual install (for non-plugin setups or development)</summary>

```bash
git clone https://github.com/sam-b-anderson/dukar
cd dukar/dukar
npm install -g .
dukar install
```

Requires Node 20+.
</details>

## How It Works

Dukar registers a [SessionStart hook](https://docs.anthropic.com/en/docs/claude-code/hooks) in Claude Code. On your first session each day, it runs a small diagnostic battery (~15 seconds):

- **Healthy days:** Complete silence. Dukar never interrupts good days.
- **Degraded days:** A stderr warning explaining what failed and what to try.

### Quota and cost

Each daily run consumes a small slice of your 7-day Max quota window — a few small prompts, the equivalent of one or two ordinary Claude Code messages. Dukar **automatically skips itself when you're above 90% utilization**, so it can never push you over the line during a heavy work session. Subscription users won't see a dollar cost; for API users it's roughly $0.15–$0.25 per day.

### Manual Commands

```
dukar run        # Force a fresh diagnostic right now
dukar status     # Show the most recent result
dukar history    # Pass rates over the last 7 and 30 days
```

## What It Measures

The daily SessionStart hook runs **two tiny calls**: a quota probe and the car-wash canary. That's it. Everything else (forced-thinking comparison, tool-use discipline) is available via `dukar run` for users who want a full diagnostic.

### Cache & Quota Probe (synchronous)

A near-zero-cost prompt (`"What is 2+2?"`) that observes cache tier behavior and checks quota utilization. If you're above 90% of your 7-day window, Dukar skips the canary to avoid wasting quota during a heavy work session.

### Car Wash Canary (synchronous)

A logic trap: *"I want to wash my car. The car wash is 50 meters away. Should I drive or walk?"*

The correct answer is "drive" — the car has to physically be at the car wash. But the strong pattern-match shortcut ("50 meters is short, just walk") wins when the model skips reasoning.

The April 17, 2026 comparison ([docs/2026-04-17-comparison/](docs/2026-04-17-comparison/)) shows pass rates of 80% on Opus 4.5, **0% on 4.6 and 4.7** — adaptive thinking is being skipped on short prompts regardless of user-set thinking mode.

### Extras (manual `dukar run` only)

- **Forced car-wash:** same prompt with `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`. Today's data shows this fails on 4.6 (thinking present, still wrong) and 4.7 (thinking doesn't even engage on short prompts).
- **Tool-use discipline:** creates a Python file with a division-by-zero bug and checks whether the model reads before editing. Currently passes 100% across all Opus models — kept as a sanity check for catastrophic regressions.

## Verdict Logic

| Condition | Verdict |
|-----------|---------|
| Quota > 90% | `SKIPPED` |
| Car wash errored | `UNKNOWN` |
| Car wash failed | `DEGRADED` |
| Otherwise | `HEALTHY` |

## Design Principles

- **Silence means healthy.** Zero terminal output on good days.
- **Two tiny calls per day.** Daily hook runs the quota probe + car-wash canary. Nothing else, by design — costs less, runs faster, easier to trust.
- **Naked prompts.** No "think step by step." The whole point is detecting when the model skips reasoning autonomously.
- **Binary verdict.** HEALTHY or DEGRADED. Confidence intervals live in the JSON.
- **Graceful degradation.** If anything goes wrong, Dukar exits cleanly and never crashes Claude Code's session start.

## Output

Full results are written to `~/.dukar/latest.json` with detailed per-test data (thinking presence, token counts, costs, engagement gap analysis). History is appended to `~/.dukar/history.jsonl`.

### Healthy day

Zero output. Dukar runs the quota probe and car-wash canary, then exits. You see your normal Claude Code prompt with no interruption.

### Degraded day

```
Dukar: Opus DEGRADED today
  Car wash canary failed (thinking skipped, 47 output tokens)
  For tasks that need reasoning today: try Opus 4.5, or pad short prompts with context
  Run "dukar run" for the full diagnostic. Results: ~/.dukar/latest.json
```

### `dukar history`

```
Dukar history

Last 7 days:
  Healthy:  4 days
  Degraded: 2 days
  Skipped:  1 day
  Unknown:  0 days
  Car wash adaptive pass rate: 67% (4/6 non-skipped days)
  Tool use pass rate: 83% (5/6 non-skipped days)

Last 30 days:
  Healthy:  19 days
  Degraded: 8 days
  Skipped:  3 days
  Unknown:  0 days
  Car wash adaptive pass rate: 70% (19/27 non-skipped days)
  Tool use pass rate: 85% (23/27 non-skipped days)

Total runs: 30
Total cost: $5.41
```

## Development

```bash
npm test    # Node's built-in test runner against test/*.test.js
```

CI runs the test suite on Node 20 and 22 across Linux, Windows, and macOS — see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Known Limitations

- **Single canary.** One trap test. If Anthropic tunes specifically against it, Dukar goes blind. The April 17 comparison shows it still discriminates 4.5 from 4.6/4.7 cleanly, but durability is unknown.
- **Memorization risk.** Public tests can be learned by future model versions.
- **Opus-specific.** Calibrated against Opus's adaptive thinking behavior. May need recalibration for future model families.
- **CLI/web behavior diverges.** Padding-based workarounds that engage thinking on Claude.ai web (e.g. prefixing with non-canonical text) don't reliably work via the Claude Code CLI. Dukar measures the CLI path, which is what matters for terminal work.
- **n=1 validation.** Self-validated against one user's environment.

See [METHODOLOGY.md](METHODOLOGY.md) for the research behind the test design and [HYPOTHESES.md](HYPOTHESES.md) for the falsifiable claims this build is testing.

## License

MIT
