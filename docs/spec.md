Dukar v0.1 — Implementation Specification
Version: 0.1.0
Date: April 13, 2026
Status: Ready for implementation
Implementing agent: Claude Code

0. Purpose
Dukar is a daily diagnostic hook for Claude Code that tells Max subscribers whether Opus 4.6 is performing within its normal range before they start working. Named after Dukar from Brandon Sanderson's Stormlight Archive — head of King Taravangian's Testers, whose job was determining each day what kind of cognitive day Taravangian was having before he made important decisions.
This spec is the complete implementation contract. Build what's here, nothing more, nothing less. Where the spec is ambiguous, prefer the simpler implementation. Where the spec conflicts with itself, raise the conflict — don't guess.

1. Background and Problem
Claude Code users on Max subscriptions report that Opus 4.6 has bad days — sometimes the model is sloppy, argumentative, skips reading files before editing them, or pattern-matches instead of reasoning. The community has converged on a root cause: Opus 4.6's adaptive thinking allocator decides per-turn how much reasoning to apply, and increasingly decides "not much." Boris Cherny (Claude Code team lead) has confirmed: "the specific turns where it fabricated had zero reasoning emitted, while the turns with deep reasoning were correct."
The interim workaround Anthropic has documented is the environment variable CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1, which forces a fixed reasoning budget per turn instead of letting the model decide.
No tool exists for users to verify which kind of day Claude is having before they commit to important work. Benchmarks don't capture this because benchmarks include "think step by step" system prompts that force reasoning regardless of the adaptive allocator's decision. Users therefore have no daily empirical signal to compare against their gut feeling.
Dukar fills this gap by running a small diagnostic battery once per day, the first time Claude Code is invoked, and writing a HEALTHY or DEGRADED verdict that the user can trust.

2. Design Principles
These principles override anything else in the spec when they conflict.
Silence means healthy. A healthy session must produce zero terminal output from Dukar. Users will uninstall a tool that interrupts good days.
Sub-3-second synchronous footprint. The user-blocking portion of every hook invocation must complete in under 3 seconds on the typical case. Background work runs after the hook releases.
Naked prompts. Test prompts must not include "think step by step," "reason carefully," or any instruction that would induce reasoning. The whole point is to detect when the model skips reasoning autonomously.
Binary verdict. The user gets HEALTHY or DEGRADED. No "partial," no "impaired," no "mostly fine." Confidence intervals and engagement gaps live in the JSON output for power users; the terminal output is binary.
Verified tests only. Every test in v0.1 has empirical support from the verification rounds documented in ~/dukar-verification/. No speculative tests.
Graceful degradation. If anything goes wrong — auth expired, subprocess hangs, disk full — Dukar fails closed (exits cleanly, writes what it can, never crashes Claude Code's session start).

3. Scope
3.1 In scope for v0.1
Four diagnostic tests, run once per day via SessionStart hook on the user's first Claude Code session. Binary verdict. Local JSON output. CLI for install, uninstall, manual run, status check, and history view.
3.2 Out of scope for v0.1
The following were considered and explicitly cut. Each has a hypothesis attached for v0.2 reconsideration.
Additional canary tests beyond car wash. SimpleBench's other 9 public questions tested at 100% pass rate on adaptive Opus 4.6 in our calibration, almost certainly due to training data contamination. Hypothesis: trap tests must be either short and conversational (car wash shape) or sourced from a non-public dataset. Adapt when we can verify additional traps, or when SimpleBench's private 200-question set becomes available.
Opus 4.5 daily comparison. Calibration showed Opus 4.5 fails multiple SimpleBench questions catastrophically (Q6 at 0/5, Q10 at 0/5), making it unreliable as a "known healthy" baseline. Also expensive and exposed to model deprecation. Hypothesis: Opus 4.5 may still be useful for specific tests where it's pre-verified correct. Adapt by adding selective per-test comparison if needed.
Reasoning Depth as a full category. We have one verified trap test (car wash). One test isn't a category. Hypothesis: more verified traps will emerge from community testing or from manual design once we know what shape works. Adapt when verified trap test count exceeds 3.
Stop hook violation detection. Detecting "ownership dodging" or "premature stopping" language patterns requires multi-turn observation that single-prompt canaries can't provide. Hypothesis: these patterns might be elicitable through specific prompt construction in v0.2.
Multi-time-of-day sampling. v0.1 runs once per day. Community reports suggest peak-hours degradation is a thing. Hypothesis: a 3-time-per-day schedule would surface this. Adapt via background scheduler in v0.2.
Public dashboard / community aggregation. Requires infrastructure, privacy design, and trust commitments. Hypothesis: useful only after the local tool has proven valuable to individual users. Adapt after v0.1 self-validation.
Canary rotation. With one verified trap test, rotation isn't possible. Hypothesis: rotation prevents Anthropic from tuning specifically against Dukar's tests. Adapt when verified trap test count exceeds 5.
Configurable tests, custom canaries, plugin system. v0.1 should be opinionated. Hypothesis: real user feedback will tell us what's worth configuring. Adapt based on issue feedback after release.
Cache TTL temporal probes. Measuring effective cache TTL requires sending identical requests at varying intervals. Hypothesis: would catch the cache regression issue independent of the adaptive thinking issue. Adapt when we have evidence Dukar's existing cache tier detection isn't enough.

4. Hypotheses This Build Tests
These hypotheses are the reason v0.1 exists. The self-validation period (Section 16) is designed to falsify or confirm them.
H1: The car wash test is a reliable daily indicator of adaptive thinking health. Falsifiable if Dukar's verdicts don't correlate with the user's gut sense of good days vs. bad days over a two-week self-validation period.
H2: The A/B engagement gap (Test 1 vs Test 2) produces diagnostic signal worth surfacing. Falsifiable if Test 2's results are either always identical to Test 1 (no information) or always different in the same direction (no variance to measure).
H3: The tool use probe catches degradation that the canary misses, or vice versa. Falsifiable if Tests 1 and 4 always agree (redundant) or are uncorrelated (measuring unrelated things).
H4: A single verified trap test plus a tool use probe is enough signal for a useful daily verdict. Falsifiable if the user finds the verdict unreliable in either direction during self-validation.
H5: A SessionStart hook is a tolerable intrusion on the user's workflow. Falsifiable if the user (or any future user) finds the hook annoying enough to uninstall.

5. Test Suite
Four tests. Test 1 runs synchronously and gates the warning. Tests 2, 3, 4 run in the background after the hook releases.
5.1 Test 1 — Car Wash Adaptive (synchronous canary)
Purpose: Lead canary. The single test whose result determines whether the user sees an immediate warning.
Rationale: Verified to fail consistently on Opus 4.6 in adaptive mode. The hidden premise (the car must physically be at the car wash) requires the model to override a strong pattern-match shortcut ("short distance → walk"). When adaptive thinking skips reasoning, the model loses the override. Round 3 verification confirmed 0/4 pass rate on the author's subscription on April 13, 2026.
Invocation:
claude -p \
  --setting-sources "" \
  --output-format stream-json \
  --verbose \
  --no-session-persistence \
  --model opus \
  "I want to wash my car. The car wash is 50 meters away. Should I drive or walk?"
No system prompt. No environment variables beyond DUKAR_RUNNING=1 (set by the runner for recursion prevention).
Captures:

Full response text (concatenated text content blocks from assistant events)
thinkingPresent: boolean — were any thinking events in the stream
thinkingContent: full thinking text if present, null otherwise
outputTokens: from result event's usage.output_tokens
durationApiMs: from result event's duration_api_ms
costUsd: from result event's total_cost_usd

Scoring logic:
Apply case-insensitive analysis to the response text:

Find the first imperative recommendation in the response. Heuristic: the first occurrence of the word "drive" or "walk" preceded by a sentence boundary, or appearing in the first sentence.
If the first recommendation is "drive" → PASS
If the first recommendation is "walk" → FAIL
If neither word appears in the first 200 characters → FAIL (model didn't answer the question)

PARTIAL is not a valid outcome for Test 1. The car wash test is binary by design.
Timeout: 15 seconds. If the subprocess hasn't produced a result event by 15 seconds, kill it and score as ERROR.
5.2 Test 2 — Car Wash Forced Thinking (background)
Purpose: A/B counterpart to Test 1. Demonstrates whether the model's capability ceiling is intact when reasoning is forced to engage.
Rationale: Round 3 verification showed CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 causes thinking events to always appear, and the model produces hedged-but-thoughtful responses on the car wash test that acknowledge the hidden premise. The A/B comparison between Test 1 and Test 2 produces the diagnostic signal: if adaptive fails and forced passes, the issue is allocation, not capability.
Invocation:
CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 claude -p \
  --setting-sources "" \
  --output-format stream-json \
  --verbose \
  --no-session-persistence \
  --model opus \
  "I want to wash my car. The car wash is 50 meters away. Should I drive or walk?"
Captures: Same fields as Test 1.
Scoring logic:
Apply the same analysis as Test 1, but with one additional category:

If the first recommendation is "drive" → PASS
If the response acknowledges the car must be at the car wash but doesn't commit firmly to "drive" (e.g., "walk, unless you need the car there...") → PASS-HEDGED. Counts as PASS for verdict purposes — the reasoning engaged.
If the first recommendation is "walk" with no acknowledgment of the hidden premise → FAIL
If neither word appears → ERROR

The PASS-HEDGED state exists because Round 3 Test B2 produced exactly this output. We don't want to score it as FAIL (the reasoning clearly engaged) or as a separate verdict-affecting state (binary verdict).
Detection of PASS-HEDGED: response contains both "drive" and "walk" within the first 300 characters AND contains a phrase from this set: "car needs to be," "need the car," "car has to be," "need to drive the car," "drive the car there," "into the car wash," "at the car wash to."
Timeout: 15 seconds.
5.3 Test 3 — Cache Health and Quota Probe (background; runs first in hook mode)
Purpose: Dual-purpose. Measures cache tier behavior and serves as the quota safety valve.
Rationale: Verified in Round 2 that rate_limit_event appears in stream-json output when quota utilization exceeds 75%. Verified in Round 3 that the cache_creation object exposes ephemeral_1h_input_tokens vs ephemeral_5m_input_tokens, indicating which TTL tier is active. By using a near-zero-cost prompt as the first call in hook mode, we get both cache observability and a quota check for the price of one tiny API call.
Invocation:
claude -p \
  --setting-sources "" \
  --output-format stream-json \
  --verbose \
  --no-session-persistence \
  --model opus \
  "What is 2+2? Reply with only the number."
Captures:

cacheCreationTokens: from usage.cache_creation_input_tokens
cacheReadTokens: from usage.cache_read_input_tokens
cacheTier: derived from cache_creation object — "1h" if ephemeral_1h_input_tokens > 0, "5m" if ephemeral_5m_input_tokens > 0, "unknown" otherwise
quotaUtilization: from rate_limit_event.utilization, or null if no rate_limit_event was emitted
rateLimitType: from rate_limit_event.rateLimitType
quotaResetsAt: from rate_limit_event.resetsAt
isUsingOverage: from rate_limit_event.isUsingOverage
costUsd: from result event

Scoring: Informational only. Test 3 does not produce a pass/fail score and does not affect the verdict.
Quota safety valve: In hook mode, after Test 3 completes, the runner checks quotaUtilization. If it is greater than 0.90, the runner exits cleanly with the message Dukar: skipped (quota at NN%) where NN is the integer percentage. No further tests run. The skip is recorded in latest.json with verdict: "skipped".
Timeout: 10 seconds.
5.4 Test 4 — Tool Use Pattern Probe (background)
Purpose: Measures the Read-before-Edit discipline that the Stella Laurenzo / AMD analysis identified as the strongest behavioral signal of degradation (Read:Edit ratio dropped from 6.6 to 2.0; edits without prior read went from 6.2% to 33.7%).
Rationale: Verified in Round 3 Test E2 that --setting-sources "" does not disable tool use, that tool_use events are visible in stream-json output, and that permission_denials captures denied tool calls. Edit will be permission-denied in non-interactive mode, but the attempt pattern (did the model invoke Read before attempting Edit) is what we measure.
Setup before invocation:

Ensure ~/.dukar/tmp/ exists (create if missing).
Write the fixture file to ~/.dukar/tmp/example.py. Overwrite if it already exists. Fixture content:

pythondef calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)


def format_percentage(value):
    return str(round(value * 100, 2)) + "%"
Invocation: Spawn subprocess with cwd set to ~/.dukar/tmp/:
claude -p \
  --setting-sources "" \
  --output-format stream-json \
  --verbose \
  --no-session-persistence \
  --model opus \
  "Read the file example.py. There is a bug in calculate_average — it will crash on an empty list because of division by zero. Fix it by adding a guard that returns 0 for empty lists. Do not rewrite the entire file."
Captures:

toolUseEvents: array of { tool: "Read"|"Edit"|"Write"|other, input: {...} } extracted in order from tool_use content blocks across all assistant events
permissionDenials: the permission_denials array from the result event
thinkingPresent: boolean — were any thinking events in the stream
responseText: concatenated text content blocks
outputTokens, durationApiMs, costUsd: from result event

Scoring logic:
Compute three booleans from toolUseEvents:

readInvoked = at least one tool_use event has tool == "Read" AND its input refers to example.py
editInvoked = at least one tool_use event has tool == "Edit" AND its input refers to example.py
writeInvoked = at least one tool_use event has tool == "Write" AND its input refers to example.py

Then:

PASS: readInvoked is true AND editInvoked is true AND writeInvoked is false AND the first Read event appears before the first Edit event in the toolUseEvents array
FAIL: any of:

editInvoked true but readInvoked false (edit without read)
writeInvoked true (full-file rewrite when surgical edit was instructed)
editInvoked true and readInvoked true but Edit appeared before Read in the event order


ERROR: subprocess errored, timed out, or no tool_use events at all

Timeout: 30 seconds (longer because tool use requires multiple turns).
5.5 Verdict logic
After all tests complete (or are skipped):
if quotaUtilization > 0.90:
    verdict = "skipped"
else if any of (Test 1, Test 4) returned ERROR:
    verdict = "unknown"
else if Test 1 == FAIL OR Test 4 == FAIL:
    verdict = "degraded"
else:
    verdict = "healthy"
Test 2's result does not affect the verdict directly. It is captured for the JSON output and surfaced in the terminal warning when DEGRADED, providing context ("forced thinking passed, so the issue is allocation, not capability"). Test 3's result does not affect the verdict directly except via the quota safety valve.

6. Architecture
6.1 Package layout
dukar/
├── bin/
│   └── dukar.js                 # CLI entry point with shebang
├── src/
│   ├── runner.js                # Orchestration (hook mode and manual mode)
│   ├── invoke.js                # Subprocess primitive
│   ├── scorer.js                # Per-test scoring + verdict logic
│   ├── reporter.js              # Terminal output + JSON file writing
│   ├── hook.js                  # SessionStart hook entry
│   ├── install.js               # Hook registration
│   ├── uninstall.js             # Hook removal
│   ├── status.js                # `dukar status` implementation
│   ├── history.js               # `dukar history` implementation
│   └── tests/
│       ├── car-wash.js          # Tests 1 and 2
│       ├── cache-health.js      # Test 3
│       └── tool-use.js          # Test 4
├── fixtures/
│   └── example.py               # Tool use probe fixture (committed to repo)
├── package.json
├── README.md
├── METHODOLOGY.md
├── HYPOTHESES.md
├── LICENSE                      # MIT
└── .gitignore
6.2 The invoke primitive
src/invoke.js exports a single async function. Every test calls it. Signature:
async function invoke({
  prompt,           // string, the user-message prompt
  model,            // string, "opus" or "claude-opus-4-5-20251101"
  envOverrides,     // object, additional env vars to set on subprocess
  cwd,              // string, working directory for subprocess (optional)
  timeoutMs,        // number, kill subprocess if it exceeds this
}) → Promise<InvokeResult>
Behavior:

Spawn claude -p --setting-sources "" --output-format stream-json --verbose --no-session-persistence --model <model> <prompt> as a child process
Set environment: inherit current env, then merge envOverrides, always set DUKAR_RUNNING=1
If cwd provided, set subprocess cwd
Read stdout line by line as NDJSON
Track:

All thinking content blocks from assistant events → concatenate into thinkingContent
All text content blocks from assistant events → concatenate into responseText
All tool_use content blocks → push to toolUseEvents array
The result event → extract usage, cost, duration, permission_denials, num_turns
The rate_limit_event if present → extract utilization fields


If subprocess exceeds timeoutMs, kill it and return result with error: "timeout"
If subprocess exits non-zero before producing a result event, return result with error: <stderr or exit code>
Otherwise return the structured result

InvokeResult shape:
{
  thinkingPresent: boolean,
  thinkingContent: string | null,
  responseText: string,
  toolUseEvents: Array<{ tool: string, input: object }>,
  outputTokens: number,
  inputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
  cacheTier: "1h" | "5m" | "unknown",
  durationApiMs: number,
  costUsd: number,
  permissionDenials: Array<object>,
  numTurns: number,
  quotaUtilization: number | null,
  rateLimitType: string | null,
  quotaResetsAt: number | null,
  isUsingOverage: boolean | null,
  model: string,
  error: string | null
}
6.3 Runner orchestration
src/runner.js exports two functions: runHook() and runManual().
runHook() — invoked by the SessionStart hook:
1. If process.env.DUKAR_RUNNING === "1", exit 0 immediately
2. Read ~/.dukar/last-run-date. If the contents equal today's date (YYYY-MM-DD in user's local timezone), exit 0
3. Set process.env.DUKAR_RUNNING = "1" before any subprocess calls
4. Try:
   a. Run Test 3 (cache-health). Await result.
   b. If quotaUtilization > 0.90:
      - Write skipped result to ~/.dukar/latest.json
      - Append to ~/.dukar/history.jsonl
      - Print "Dukar: skipped (quota at NN%)"
      - Write today's date to ~/.dukar/last-run-date
      - Exit 0
   c. Run Test 1 (car-wash adaptive). Await result.
   d. Write today's date to ~/.dukar/last-run-date (so a crash later doesn't cause re-run)
   e. If Test 1 FAILED, print the DEGRADED warning to stderr immediately
   f. Spawn detached background process for Tests 2 and 4 + final result writing
   g. Exit 0 (release the hook)
5. Catch errors:
   - Log to ~/.dukar/error.log
   - Exit 0 (never crash Claude Code's session start)
The detached background process is invoked by re-running dukar with a hidden subcommand dukar __background <runId> where runId is a UUID generated by the hook. The background process writes its results into ~/.dukar/runs/<runId>.partial.json, then merges with the partial result from the synchronous portion to produce the final latest.json and append to history.jsonl.
runManual() — invoked by dukar run:
1. Run Tests 3, 1, 2, 4 sequentially
2. Compute verdict
3. Write latest.json, append to history.jsonl
4. Print full terminal report (including for HEALTHY verdict, since user explicitly asked)
5. Exit with code 0 if HEALTHY/SKIPPED, code 1 if DEGRADED, code 2 if UNKNOWN/error
runManual() does not check the once-per-day gate and does not check the quota safety valve. The user explicitly invoked it.
6.4 Recursion prevention
Two layers:

Primary: --setting-sources "" on every subprocess call. This was verified in Round 2 to disable hook execution in child processes. The Dukar hook cannot trigger itself through normal means.
Backup: DUKAR_RUNNING=1 env var. Set by the runner before any subprocess calls. Checked at the top of runHook(). If somehow the primary layer is bypassed (different Claude Code version, settings.json corruption, etc.), the env var stops re-entry.

6.5 File locations
All under ~/.dukar/:

latest.json — the most recent complete run
history.jsonl — append-only log of all runs
last-run-date — single line, format YYYY-MM-DD, used for once-per-day gate
error.log — append-only error log for debugging
tmp/example.py — Test 4 fixture (rewritten on every run)
runs/<runId>.partial.json — temporary, deleted after merging into latest.json

The ~/.dukar/ directory is created on first run if it doesn't exist.

7. Output Format
7.1 latest.json schema
Canonical example with all fields populated:
json{
  "version": "0.1.0",
  "timestamp": "2026-04-13T16:35:00.123Z",
  "claudeCodeVersion": "2.1.104",
  "verdict": "degraded",
  "quota": {
    "utilization": 0.87,
    "rateLimitType": "seven_day",
    "resetsAt": 1776189600,
    "isUsingOverage": false
  },
  "tests": {
    "carWash": {
      "adaptive": {
        "score": "fail",
        "responseText": "Walk. 50 meters is a very short distance...",
        "thinkingPresent": false,
        "thinkingContent": null,
        "outputTokens": 43,
        "durationApiMs": 3497,
        "costUsd": 0.068,
        "error": null
      },
      "forced": {
        "score": "pass-hedged",
        "responseText": "50 meters is a very short distance... unless you need to drive the car there...",
        "thinkingPresent": true,
        "thinkingContent": "Simple non-technical question.",
        "outputTokens": 77,
        "durationApiMs": 4058,
        "costUsd": 0.014,
        "error": null
      },
      "engagementGap": {
        "thinkingChange": "absent_to_present",
        "tokenDelta": 34,
        "interpretation": "adaptive_skipped_thinking"
      }
    },
    "cacheHealth": {
      "cacheTier": "5m",
      "cacheCreationTokens": 9957,
      "cacheReadTokens": 12263,
      "costUsd": 0.011,
      "error": null
    },
    "toolUse": {
      "score": "pass",
      "readInvoked": true,
      "editInvoked": true,
      "writeInvoked": false,
      "readBeforeEdit": true,
      "thinkingPresent": true,
      "toolUseEventCount": 3,
      "permissionDenialCount": 1,
      "outputTokens": 412,
      "durationApiMs": 8234,
      "costUsd": 0.087,
      "error": null
    }
  },
  "totals": {
    "costUsd": 0.180,
    "durationMs": 16800
  }
}
Field rules:

verdict is always one of: "healthy", "degraded", "unknown", "skipped"
score on individual tests is one of: "pass", "fail", "pass-hedged", "error", "skipped"
Numeric fields use null when the value couldn't be obtained, not 0
engagementGap.thinkingChange is one of: "both_absent", "both_present", "absent_to_present", "present_to_absent"
engagementGap.interpretation is one of: "adaptive_skipped_thinking", "both_engaged", "both_skipped", "unexpected"
Timestamps are ISO 8601 with milliseconds, in UTC

7.2 history.jsonl schema
One JSON object per line. Each line has the same schema as latest.json. Append-only.
7.3 Terminal output
HEALTHY verdict in hook mode: No output. Silence.
DEGRADED verdict in hook mode (printed to stderr immediately after Test 1 fails):
Dukar: Opus 4.6 DEGRADED today
  Car wash test failed (adaptive thinking skipped, 43 output tokens)
  Recommendation: set CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 in your shell
  Background tests still running. Full results: ~/.dukar/latest.json
SKIPPED in hook mode:
Dukar: skipped (quota at 87%)
UNKNOWN in hook mode:
Dukar: error during diagnostic. See ~/.dukar/error.log
Manual mode (dukar run) prints a full report regardless of verdict. Format:
Dukar diagnostic report — 2026-04-13 16:35 UTC
Verdict: DEGRADED

Test 1 (car wash, adaptive):       FAIL
  Response: "Walk. 50 meters is a very short distance..."
  Thinking: absent
  Tokens: 43, Duration: 3.5s, Cost: $0.068

Test 2 (car wash, forced thinking): PASS-HEDGED
  Response: "50 meters is a very short distance... unless you need to drive..."
  Thinking: present (32 chars)
  Tokens: 77, Duration: 4.1s, Cost: $0.014

Test 3 (cache health):              info
  Cache tier: 5m
  Quota utilization: 87% of 7-day window

Test 4 (tool use):                  PASS
  Read before edit: yes
  Edit type: surgical
  Thinking: present
  Tokens: 412, Duration: 8.2s, Cost: $0.087

Total: $0.180 across 16.8s

Recommendation: set CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 in your shell
Detailed results: ~/.dukar/latest.json

8. CLI Commands
8.1 dukar install
Behavior:

Verify claude CLI is on PATH. If not, print error and exit 1.
Create ~/.dukar/ directory if it doesn't exist.
Read ~/.claude/settings.json. If it doesn't exist, create it as {}. If it exists but is malformed JSON, error out and refuse to clobber.
Merge a SessionStart hook entry into settings.json.hooks.SessionStart. The entry:

json{
  "matcher": "",
  "hooks": [
    { "type": "command", "command": "dukar hook" }
  ]
}
If the array doesn't exist, create it. If a Dukar entry already exists (matched by command === "dukar hook"), do nothing (idempotent). If other entries exist, preserve them.

Write the updated settings.json back, preserving formatting where possible.
Print: Dukar installed. Diagnostics will run on your first Claude Code session each day.

Exit codes: 0 success, 1 prerequisite failure, 2 settings.json corruption.
8.2 dukar uninstall
Behavior:

Read ~/.claude/settings.json. If missing or no hooks, print Dukar not installed. and exit 0.
Remove any entries from settings.json.hooks.SessionStart where the entry contains a hook with command === "dukar hook". Preserve all other entries.
If the resulting SessionStart array is empty, remove the SessionStart key. If hooks object is empty, remove it.
Write settings.json back.
If --keep-history flag not set, delete ~/.dukar/ directory entirely.
If --keep-history flag is set, delete everything in ~/.dukar/ except history.jsonl.
Print: Dukar uninstalled. (or Dukar uninstalled. History preserved at ~/.dukar/history.jsonl if --keep-history was set).

Idempotent.
8.3 dukar run
Calls runManual(). See Section 6.3.
8.4 dukar status
Behavior:

Read ~/.dukar/latest.json. If missing, print No Dukar runs yet. Try \dukar run`.` and exit 0.
Compute age of timestamp. If older than 48 hours, prepend WARNING: results are STALE (last run: <timestamp>). to output.
Print a short summary:

Dukar status (last run: 2026-04-13 16:35 UTC)
Verdict: DEGRADED
  Car wash adaptive: FAIL
  Car wash forced:   PASS-HEDGED
  Tool use:          PASS
  Cache tier:        5m
  Quota:             87% of 7-day window

Full results: ~/.dukar/latest.json
8.5 dukar history
Behavior:

Read ~/.dukar/history.jsonl. If missing or empty, print No history yet. and exit 0.
Compute summaries:

Dukar history

Last 7 days:
  Healthy:  3 days
  Degraded: 2 days
  Skipped:  1 day
  Unknown:  1 day
  Car wash adaptive pass rate: 60% (3/5 non-skipped days)
  Tool use pass rate: 80% (4/5 non-skipped days)

Last 30 days:
  Healthy:  18 days
  Degraded: 8 days
  Skipped:  3 days
  Unknown:  1 day
  Car wash adaptive pass rate: 69% (18/26)
  Tool use pass rate: 85% (22/26)

Total runs: 30
Total cost: $4.82
8.6 dukar hook
Calls runHook(). See Section 6.3. Internal command, not for direct user use, but exists as a CLI command because the SessionStart hook invokes it.
8.7 dukar __background <runId>
Calls the background portion of runHook(). Internal command, hidden from --help output. Spawned by runHook() as a detached process. Runs Tests 2 and 4, then merges with the partial result from runs/<runId>.partial.json, writes the final latest.json, appends to history.jsonl, and exits.
8.8 dukar --help and dukar --version
Standard. --help lists user-facing commands (install, uninstall, run, status, history). Hidden commands (hook, __background) are not listed.

9. Edge Cases and Error Handling
These are the failure modes the implementation must handle without crashing the user's Claude Code session.
Claude CLI not installed: dukar install errors out with a clear message. dukar hook exits 0 silently if Claude isn't installed (no point in running diagnostics).
Auth expired: Subprocess returns auth error. Caught by invoke.js, returned as error: "auth" field on the result. Test scoring treats this as score: "error". Verdict becomes UNKNOWN. Terminal prints Dukar: error during diagnostic. See ~/.dukar/error.log.
Subprocess hangs: invoke.js enforces per-test timeout (Section 5.x). On timeout, kill subprocess and return error result.
~/.claude/settings.json doesn't exist: dukar install creates it as {} and proceeds.
~/.claude/settings.json is malformed JSON: dukar install refuses to write, prints error with exact parse failure location, exits 2. Never clobber a file we can't parse.
~/.claude/settings.json has hooks from other tools: Preserve them. Only touch entries matching command === "dukar hook".
Background process crashes mid-suite: The synchronous portion (runHook() proper) has already written latest.json with the partial result. The background process appends or overwrites when it succeeds. If it crashes, the next day's run will produce a fresh latest.json. The runs/<runId>.partial.json file gets cleaned up on the next successful run.
Disk full when writing results: invoke.js and the runner catch ENOSPC errors, log to error.log if possible, exit cleanly.
Temp directory has stale files from previous run: ~/.dukar/tmp/ is treated as ephemeral. The fixture file is rewritten on every Test 4 run. Stale runs are cleaned up at the start of each runHook() call.
User runs dukar uninstall when not installed: Exit 0 with Dukar not installed. message.
User runs dukar install twice: Idempotent. Second invocation is a no-op.
Cross-platform path issues: Use Node's os.homedir(), path.join(), os.tmpdir() everywhere. No hardcoded / or \ separators.
claude -p subprocess returns malformed JSON: invoke.js catches parse errors per line. If too many lines fail to parse (more than 10), abort the test with error: "malformed_output".
No result event in stream: Wait until timeout, then treat as error.
Multiple result events: Use the first one. (Shouldn't happen but defensive.)
Quota check returns null: If rate_limit_event doesn't appear (quota below 75%), quotaUtilization is null. Don't treat null as "above 0.90." Only skip if utilization is explicitly known and above threshold.

10. Dependencies and Constraints
Runtime:

Node.js 20+ (for stable native fetch and AbortController, even though we don't use them — sets a reasonable floor)
claude CLI installed and on PATH
No npm runtime dependencies. Use stdlib only: child_process, fs/promises, path, os, crypto (for runId generation)

Dev:

No test framework in v0.1. Manual validation only.
No linter required, but use Prettier defaults if formatting is contested.

Package metadata:

Name: dukar (check npm availability before publish; fallback @sambanderson/dukar)
License: MIT
Bin: { "dukar": "./bin/dukar.js" }
Files: include bin/, src/, fixtures/, README.md, METHODOLOGY.md, HYPOTHESES.md, LICENSE

No telemetry. No network calls beyond what claude -p itself does.

11. Implementation Order
Build in five phases. Each phase has a definition of done. Don't proceed to the next phase until the current phase's DOD is met.
Phase 1: invoke.js + Test 1 manually verified

Implement src/invoke.js per Section 6.2
Implement src/tests/car-wash.js for Test 1 only
Write a tiny standalone script that calls Test 1 and prints the result object as JSON
Run it. Confirm: response text captured, thinking absent, output tokens around 40-50, cost around $0.07, no errors

DOD: standalone script runs and produces correct result object on the author's Max subscription.
Phase 2: All four tests + manual run

Implement Tests 2, 3, 4 in their respective files
Implement src/scorer.js with per-test scoring and verdict logic
Implement src/reporter.js for JSON file writing and manual-mode terminal output
Implement src/runner.js runManual() function
Implement bin/dukar.js with dukar run command only
Run dukar run. Confirm full report prints, latest.json is written, history.jsonl is appended

DOD: dukar run produces a complete terminal report and writes correct files.
Phase 3: Hook mode

Implement src/runner.js runHook() function with all gates (DUKAR_RUNNING, once-per-day, quota safety valve)
Implement detached background process pattern via dukar __background
Implement src/hook.js as the thin entry point
Add dukar hook and dukar __background <runId> commands to bin/dukar.js
Test by manually running dukar hook and observing: synchronous portion completes in <3s, background completes within 30s, files are correctly written

DOD: dukar hook produces the expected synchronous output and triggers the background portion without blocking.
Phase 4: Install/uninstall + status/history

Implement dukar install per Section 8.1 with idempotency and settings preservation
Implement dukar uninstall per Section 8.2 with --keep-history flag
Implement dukar status and dukar history
Test full lifecycle: install → trigger Claude Code session → observe hook fires → check status → check history → uninstall → confirm hooks removed and ~/.dukar gone

DOD: complete install/use/uninstall lifecycle works on the author's machine.
Phase 5: Edge cases and cross-platform

Walk through every case in Section 9 and verify the implementation handles it
Test on macOS or Linux (in addition to the Windows dev environment)
Verify cross-platform path handling
Write README, METHODOLOGY.md, HYPOTHESES.md (content sources are this spec's Sections 1, 4, 3 respectively)
Set version to 0.1.0 in package.json

DOD: ready to publish to npm. README is complete. All edge cases handled.

12. Documentation Files
12.1 README.md
Sections:

One-line description with Dukar/Taravangian framing
Why this exists (the felt problem)
Install (one command)
Usage (it just works after install; mention dukar status for checking)
What the verdicts mean (HEALTHY/DEGRADED/SKIPPED/UNKNOWN)
What Dukar measures (high-level summary of the four tests)
What Dukar does NOT measure (Section 3.2 highlights)
FAQ
Link to METHODOLOGY.md and HYPOTHESES.md
License, contributing pointer

12.2 METHODOLOGY.md
Content drawn from Section 1 (problem), Section 2 (principles), Section 5 (test details), and the verification rounds. Specifically explain:

Why naked prompts (system prompts defeat the degradation, per SimpleBench calibration)
Why these specific tests survived and what was cut and why
The A/B probe pattern and what the engagement gap means
The known limitations (memorization risk, single-test fragility, Opus 4.6 only)

12.3 HYPOTHESES.md
Content drawn from Section 4 of this spec. Lift it. Add a section at the bottom for "Self-validation log" where the author can document the two-week gut-vs-Dukar comparison.

13. Release Process
After Phase 5 completes:

Self-validation period: minimum 14 days of running Dukar against the author's own Max subscription. Author logs gut sense (1-5 scale) every morning before checking Dukar's verdict. Author tracks agreement rate.
Decision gate at end of self-validation:

80%+ agreement between gut and Dukar → publish to npm, post to r/ClaudeCode and r/ClaudeAI
60-79% → iterate on tests before publishing
Below 60% → v0.1 is a research spike; pivot to research post as primary deliverable; archive Dukar code in repo for v0.2 reconsideration


If publishing: research post and tool announcement go out together. The post explains the methodology (SimpleBench calibration finding, naked prompt requirement) and the tool is the actionable artifact.


14. Open Questions for the Implementing Agent to Raise (Don't Guess)
If you encounter any of these during implementation, stop and ask:

The exact format of tool_use content blocks in stream-json — confirm by examining a real output
Whether claude -p reliably emits rate_limit_event when utilization is between 75% and 90% (we've seen it at 85% but not below)
Whether Windows PATH resolution finds dukar after npm install -g dukar
Whether the SessionStart hook configuration format has changed between Claude Code versions
Whether --no-session-persistence interacts oddly with --setting-sources "" in some way we didn't observe in verification

If you encounter ambiguity that this spec doesn't address, prefer the simpler implementation, document the choice in code comments, and flag it for review.

15. Acceptance Criteria
The implementation is done when:

All four tests run end-to-end and produce correct result objects
dukar install registers the hook, dukar uninstall removes it, both are idempotent
The synchronous portion of dukar hook completes in under 3 seconds on a normal day
A DEGRADED verdict produces an immediate terminal warning
A HEALTHY verdict produces zero terminal output
The quota safety valve correctly skips when utilization > 90%
latest.json and history.jsonl match the schemas in Section 7
dukar status and dukar history produce useful output
All edge cases in Section 9 are handled without crashing
The package can be npm install-ed globally and dukar is on PATH
README, METHODOLOGY, HYPOTHESES files exist and reflect this spec's content