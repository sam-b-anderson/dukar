---
description: Force a fresh Dukar diagnostic run right now (manual)
allowed-tools: Bash
---

Run this command and show me the full output:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/dukar.js" run
```

This forces a fresh diagnostic battery (cache health + bare car-wash + forced car-wash + tool-use) regardless of whether dukar already ran today. Takes ~30 seconds and consumes a small slice of your weekly quota.

After it finishes, results are written to `~/.dukar/latest.json` and appended to `~/.dukar/history.jsonl`. Use `/dukar-status` to see the latest result, `/dukar-history` for the trend.
