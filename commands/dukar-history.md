---
description: Show Dukar's recent verdict history (7-day and 30-day pass rates)
allowed-tools: Read
---

Read `~/.dukar/history.jsonl` (one JSON object per line, append-only log of every Dukar run). Compute and show:

```
Dukar history — <total runs>

Last 7 days:
  Healthy:  <N> days
  Degraded: <N> days
  Skipped:  <N> days
  Unknown:  <N> days
  Car wash pass rate: <X>% (<passes>/<non-skipped> days)

Last 30 days:
  Healthy:  <N> days
  Degraded: <N> days
  Skipped:  <N> days
  Unknown:  <N> days
  Car wash pass rate: <X>% (<passes>/<non-skipped> days)

Recent degraded days: <comma-separated dates, last 7 only>
```

If the file doesn't exist or is empty, say "No history yet."

Skip the per-run details unless I ask. Use the timestamp field on each record. Pass rate excludes skipped/unknown days from the denominator.
