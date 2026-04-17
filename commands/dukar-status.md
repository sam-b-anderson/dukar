---
description: Show the most recent Dukar diagnostic result
allowed-tools: Read
---

Read `~/.dukar/latest.json` and show me a compact summary, in this format:

```
Dukar status — <timestamp>
Verdict: <HEALTHY|DEGRADED|SKIPPED|UNKNOWN>
Car wash canary: <pass|fail> (thinking <present|skipped>, <N> output tokens)
Quota: <utilization% if known, else "below threshold">
Model: <model id>
```

Then a one-line interpretation:
- HEALTHY → "Opus engaged thinking on the canary today."
- DEGRADED → "Opus skipped reasoning on the canary today."
- SKIPPED → "Quota above 90% — diagnostic was skipped."
- UNKNOWN → "Diagnostic errored — check ~/.dukar/error.log"

If the file doesn't exist, say "No Dukar runs yet — fire one with /dukar-run."

Don't show the raw JSON unless I ask.
