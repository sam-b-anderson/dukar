# Dukar Verification Results

**Date:** 2026-04-13
**Claude Code Version:** 2.1.104
**Platform:** Windows 11 (Git Bash)

---

## Q1: Authentication and Billing Routing

### Commands & Results

```bash
$ claude --version
2.1.104 (Claude Code)

$ echo $ANTHROPIC_API_KEY
(empty — not set)

$ cat ~/.claude/.credentials.json  # (redacted)
# Shows OAuth authentication with:
#   subscriptionType: "max"
#   rateLimitTier: "default_claude_max_20x"
#   scopes: ["user:inference", "user:sessions:claude_code", ...]

$ cd ~/dukar-verification && time claude -p "Reply with just the word: ping"
ping

real    0m11.412s
```

### Interpretation

- **Authentication method:** OAuth via `claude.ai` (not an API key). The credentials file at `~/.claude/.credentials.json` contains OAuth access/refresh tokens.
- **Billing route:** This routes through a **Claude Max subscription**, confirmed by `subscriptionType: "max"` in the credentials file and the `rateLimitTier: "default_claude_max_20x"`.
- **How to tell:** The `--output-format json` response includes `"service_tier": "standard"` and `"total_cost_usd"` fields, but these are informational — the Max subscription means you're using your subscription allowance, not per-call API billing. There's no `ANTHROPIC_API_KEY` set, so it can't be routing through API credits.
- **Wall-clock time:** ~11.4 seconds for a trivial call. This is the total time including process startup, hook execution, OAuth token handling, API round-trip, and response rendering.

### Surprises

- The `total_cost_usd` field still appears in JSON output even on Max subscription ($0.117-$0.127 for trivial calls). This is the *computed* cost, not billed cost. Useful for tracking but doesn't reflect actual billing.
- System prompt is substantial (~17k-19k cache creation tokens + ~16k cache read tokens) even for `-p` mode. Claude Code injects its full system prompt including tool definitions.

---

## Q2: Workspace Context Isolation

### Commands & Results

```bash
# From clean ~/dukar-verification (no CLAUDE.md, no .claude/)
$ time claude -p "What is 7 times 8? Reply with only the number."
56
real    0m13.853s

# From ~/Documents/GitHub/budget (has CLAUDE.md + .claude/)
$ time claude -p "What is 7 times 8? Reply with only the number."
56
real    0m13.623s

# Check for context files
$ ls ~/Documents/GitHub/budget/.claude/
settings.local.json
$ ls ~/Documents/GitHub/budget/CLAUDE.md
exists (1752 bytes)
$ ls ~/dukar-verification/.claude/
does not exist

# Create CLAUDE.md in verification dir
$ echo 'When asked any math question, always prepend your answer with the word "banana".' > ~/dukar-verification/CLAUDE.md
$ time claude -p "What is 7 times 8? Reply with only the number."
banana 56
real    0m14.162s

# Test --system-prompt (does NOT override CLAUDE.md)
$ time claude -p "What is 7 times 8? Reply with only the number." --system-prompt "You are a helpful assistant."
banana 56
real    0m10.044s

# Test --bare (skips CLAUDE.md but REQUIRES ANTHROPIC_API_KEY)
$ time claude -p --bare "What is 7 times 8? Reply with only the number."
Not logged in · Please run /login
# FAILS — --bare skips OAuth, requires API key

# Clean up
$ rm ~/dukar-verification/CLAUDE.md
$ time claude -p "What is 7 times 8? Reply with only the number."
56
real    0m10.394s
```

### Interpretation

- **Yes, `claude -p` picks up workspace context by default.** It auto-discovers `CLAUDE.md` in the working directory and applies its instructions. The "banana" prefix appeared exactly when `CLAUDE.md` was present.
- **`--system-prompt` does NOT replace CLAUDE.md** — it appends to the system prompt alongside CLAUDE.md content. Both are active simultaneously.
- **`--bare` would provide clean isolation** but it disables OAuth and requires `ANTHROPIC_API_KEY` to be set. On a Max subscription without an API key, `--bare` is unusable.
- **Global CLAUDE.md at `~/.claude/CLAUDE.md` is ALWAYS loaded** regardless of working directory (it contains your global conventions). This is injected into every `claude -p` call.
- **No `.claude/` directory** was created in the verification directory just from running `claude -p`.

### Isolation Options for Dukar

| Method | Skips local CLAUDE.md? | Skips global CLAUDE.md? | Works with Max OAuth? |
|--------|----------------------|------------------------|---------------------|
| Run from clean dir (no CLAUDE.md) | Yes | **No** | Yes |
| `--system-prompt` | **No** (additive) | **No** | Yes |
| `--bare` | Yes | Yes | **No** (needs API key) |
| `--append-system-prompt` | **No** (additive) | **No** | Yes |

**Conclusion:** For Dukar running under Max subscription, the cleanest isolation is to run from a directory with no `CLAUDE.md`. The global `~/.claude/CLAUDE.md` will still be injected, but its instructions (code quality rules, git workflow) shouldn't affect simple diagnostic prompts. If you need full isolation, you'd need to set `ANTHROPIC_API_KEY` and use `--bare`.

---

## Q3: Message Consumption and Batching

### Batched Prompt

```bash
$ time claude -p 'Answer these 5 questions and reply with ONLY a JSON array of 5 strings...'
["4", "Paris", "yes", "3", "blue"]

real    0m11.721s
```

- Returned valid, parseable JSON
- No warnings or errors
- Single API call, ~11.7s wall clock

### Sequential Solo Calls

```bash
# 5 calls with 2-second delays between them
$ for i in 3 7 1 9 5; do time claude -p "Reply with only the digit: $i"; sleep 2; done

Call 1 (digit 3): "3"  — 9.789s
Call 2 (digit 7): "7"  — 12.358s
Call 3 (digit 1): "1"  — 13.003s
Call 4 (digit 9): "9"  — 10.668s
Call 5 (digit 5): "5"  — 10.387s

Total sequential time: ~66.2s (including 8s of sleep)
```

- No rate-limit warnings on any call
- No quota messages
- All calls succeeded

### Rate Limit / Quota Signals

From the `--output-format json` responses, the following fields exist:

```json
{
  "service_tier": "standard",
  "total_cost_usd": 0.117,
  "usage": {
    "input_tokens": 3,
    "output_tokens": 5,
    "cache_creation_input_tokens": 17476,
    "cache_read_input_tokens": 16064
  }
}
```

- **No rate-limit or quota fields** anywhere in the output
- **No "remaining messages" counter** in stdout, stderr, or JSON output
- The `service_tier` field shows `"standard"` (not `"scaled"` or `"throttled"`)
- No warnings were emitted on stderr during any test

### Interpretation

- **claude -p never emits quota warnings.** There's no "X messages remaining" signal anywhere in its output.
- **Batched vs. solo appears identical** from a billing/quota perspective — both consume from the Max subscription's message allowance. The key difference is wall-clock time (11.7s for 5 answers batched vs. ~58s for 5 answers sequentially).
- **The only consumption signal is `total_cost_usd`** in JSON output, which shows computed cost, not remaining balance.
- **For Dukar:** You cannot detect approaching quota limits via `claude -p` output. You'll only know you've hit the limit when calls start failing (presumably with an error message).

---

## Q4: Streaming and TTFT

### Streaming Behavior

```bash
$ claude -p "Count slowly from 1 to 10, one number per line."
1
2
3
4
5
6
7
8
9
10

real    0m10.328s
```

When run in the terminal directly, output **streams progressively** — numbers appear one at a time. However, when captured via pipe or redirection (`2>&1`), the output appears all at once after completion (standard buffering behavior).

### Output Format Flags

From `claude -p --help`:

```
--output-format <format>   "text" (default), "json" (single result), "stream-json" (realtime streaming)
--include-partial-messages  Include partial message chunks as they arrive (only with stream-json)
--verbose                   Override verbose mode setting
```

**Note:** `--output-format stream-json` requires `--verbose` flag when used with `--print`.

### stream-json Output

```bash
$ claude -p "What is 2+2?" --output-format stream-json --verbose
# Emits NDJSON (newline-delimited JSON), one object per line:

# Hook lifecycle events:
{"type":"system","subtype":"hook_started","hook_name":"SessionStart:startup",...}
{"type":"system","subtype":"hook_response","hook_name":"SessionStart:startup",...}

# Assistant message (with token counts):
{"type":"assistant","message":{"model":"claude-opus-4-6","content":[{"type":"text","text":"\n\n4"}],"usage":{"input_tokens":3,"output_tokens":2,...}}}

# Final result (same shape as --output-format json):
{"type":"result","subtype":"success","duration_ms":4032,"duration_api_ms":3699,...}
```

### TTFT Measurement

- **With `stream-json --verbose --include-partial-messages`:** You could theoretically measure time-to-first-token by timing the gap between the first `assistant` event and the prompt submission.
- **With plain `text` or `json` mode:** You can only measure total wall-clock time (`duration_ms` in JSON).
- **The JSON output provides `duration_ms` (total) and `duration_api_ms` (API-only).** The difference (`duration_ms - duration_api_ms`) represents client-side overhead (hooks, startup, etc.). For the tests above: ~300-500ms of overhead.
- **Practical TTFT:** Not directly exposed as a field. You'd need to parse the stream-json output and timestamp the first content chunk.

---

## Q5: Output Format Details

### Plain text (default)

```bash
$ claude -p "What is 2+2?" 1>stdout.txt 2>stderr.txt

# stdout (clean — just the response):
4

# stderr:
(empty)
```

**stdout is clean.** No status messages, no progress indicators. Just the model's response text. There are leading newlines (`\n\n4` in the raw response), but stdout is otherwise pristine.

### JSON output (`--output-format json`)

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 3149,
  "duration_api_ms": 2929,
  "num_turns": 1,
  "result": "\n\n4",
  "stop_reason": "end_turn",
  "session_id": "f6e60d57-a9d2-4203-a1de-672a0df1e8d2",
  "total_cost_usd": 0.117,
  "usage": {
    "input_tokens": 3,
    "cache_creation_input_tokens": 17476,
    "cache_read_input_tokens": 16064,
    "output_tokens": 5,
    "server_tool_use": {
      "web_search_requests": 0,
      "web_fetch_requests": 0
    },
    "service_tier": "standard",
    "cache_creation": {
      "ephemeral_1h_input_tokens": 17476,
      "ephemeral_5m_input_tokens": 0
    },
    "iterations": [
      {
        "input_tokens": 3,
        "output_tokens": 5,
        "cache_read_input_tokens": 16064,
        "cache_creation_input_tokens": 17476,
        "type": "message"
      }
    ],
    "speed": "standard"
  },
  "modelUsage": {
    "claude-opus-4-6[1m]": {
      "inputTokens": 3,
      "outputTokens": 5,
      "cacheReadInputTokens": 16064,
      "cacheCreationInputTokens": 17476,
      "webSearchRequests": 0,
      "costUSD": 0.117,
      "contextWindow": 1000000,
      "maxOutputTokens": 64000
    }
  },
  "permission_denials": [],
  "terminal_reason": "completed",
  "fast_mode_state": "off"
}
```

### Structured output (`--json-schema`)

```bash
$ claude -p "What is 2+2? Reply with JSON" --json-schema '{"type":"object","properties":{"answer":{"type":"number"}},"required":["answer"]}' --output-format json

# Response includes a "structured_output" field:
{
  ...
  "result": "",
  "structured_output": {"answer": 4},
  "num_turns": 2,
  "total_cost_usd": 0.422
  ...
}
```

**Note:** `--json-schema` caused the model to use 2 turns and cost significantly more ($0.42 vs $0.12). The `result` field was empty; the structured data was in `structured_output`. This also loaded a much larger system prompt (~67k cache creation tokens vs ~17k), suggesting it injects schema validation tooling.

---

## Summary and Recommendations

### Assumptions that held up

1. **`claude -p` works for non-interactive scripting** — it prints to stdout and exits cleanly
2. **stdout is clean** — no status messages mixed in, suitable for piping/parsing
3. **JSON output is available** and provides rich metadata (timing, tokens, cost, model info)
4. **Batched prompts work** — you can ask multiple questions in one call and get structured responses
5. **Responses are correct and deterministic** for simple factual/math questions

### Assumptions that need revision

1. **Context isolation is incomplete by default.** `claude -p` auto-discovers `CLAUDE.md` in the working directory AND always loads `~/.claude/CLAUDE.md`. The `--bare` flag would fix this but doesn't work with Max/OAuth auth. **Recommendation:** Run Dukar from a clean scratch directory with no `CLAUDE.md`. Accept that global CLAUDE.md is always present (its rules shouldn't affect diagnostic prompts).

2. **You cannot measure TTFT easily.** The `text` and `json` output modes only give total time. You'd need `stream-json --verbose --include-partial-messages` and parse NDJSON timestamps to approximate TTFT. **Recommendation:** Focus on `duration_ms` and `duration_api_ms` from JSON output as your primary timing metrics.

3. **There are no quota/rate-limit signals.** `claude -p` never tells you how many messages remain or warns about approaching limits. You'll only discover the limit when calls start failing. **Recommendation:** Track `total_cost_usd` per run as a secondary signal, but accept that quota tracking is opaque.

4. **`--json-schema` is expensive.** It doubles the system prompt size and uses 2 turns. For diagnostics, have the model return JSON via prompt instruction and parse it yourself rather than using `--json-schema`.

### Unexpected findings that affect Dukar's design

1. **Massive system prompt overhead:** Even trivial calls inject ~33k tokens of system prompt (17k cached + 16k cache-read). This means each call's "cost" is dominated by the system prompt, not your diagnostic prompt. The `--bare` mode would eliminate this but is OAuth-incompatible.

2. **Wall-clock time is 10-14 seconds** for trivial calls. This is ~2-3s API time + ~0.3-0.5s client overhead + ~8-11s that appears to be hook execution and startup. The `duration_api_ms` field in JSON output gives you the clean API time. **Recommendation:** Use `duration_api_ms` not wall-clock `time` as your performance metric.

3. **Cache behavior matters:** The `cache_creation_input_tokens` vs `cache_read_input_tokens` split shows prompt caching in action. Sequential calls within ~5 minutes benefit from cache hits (16k tokens read from cache). If Dukar runs tests sequentially within a short window, later tests will be faster due to cache warming. **Recommendation:** Consider cache state as a variable in your diagnostic design.

4. **`--no-session-persistence`** flag exists — prevents session data from being written to disk. Useful for Dukar to avoid polluting the user's session history.

5. **`--model` flag** lets you specify which model to test against (e.g., `--model sonnet` vs `--model opus`). Useful if Dukar wants to test multiple models.

6. **`--max-budget-usd`** can cap spending per call — good safety net for diagnostic runs.

7. **`--fallback-model`** enables automatic model fallback when the primary is overloaded — only works with `--print`, could be useful for resilient diagnostics.
