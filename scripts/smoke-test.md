# Dukar install smoke test

End-to-end manual checklist. Run this before publishing the README install instructions or posting publicly. Should take ~10 minutes.

## 1. JSON validation (no claude calls)

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json'))" && echo OK
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json'))" && echo OK
node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json'))" && echo OK
```

All three should print `OK`.

## 2. Plugin schema validation

From inside Claude Code:

```
/plugin validate .
```

Should pass with no errors. Warnings about missing `commands`/`agents`/`skills` are OK (we don't ship any).

## 3. Local marketplace install

In a fresh Claude Code session (preferably in a different working directory than the repo):

```
/plugin marketplace add /absolute/path/to/dukar/dukar
/plugin install dukar@dukar
```

Expected: success messages, no errors. If it fails, check that you used an absolute path with no spaces, and that `.claude-plugin/marketplace.json` exists at the marketplace root.

## 4. Hook fires on session start

Restart Claude Code (or open a new terminal session). On the FIRST session of the day, dukar should fire silently in the background — you should not see any output unless the canary fails.

To force a fire even if it already ran today:

```bash
rm -f ~/.dukar/last-run-date
```

Then start a new Claude Code session. Within ~15 seconds you should see either:
- (silence — healthy day)
- `Dukar: Opus DEGRADED today` followed by 3 lines on stderr — degraded day

Check `~/.dukar/latest.json` for the full result.

## 5. Manual run

```bash
node "$(claude plugin path dukar 2>/dev/null || echo $HOME/.claude/plugins/cache/dukar/dukar)/bin/dukar.js" run
```

Or if dukar is on PATH (manual install):

```bash
dukar run
```

Should print a 4-section diagnostic report and write `~/.dukar/latest.json`. Should exit 0 (healthy), 1 (degraded), or 2 (unknown).

## 6. Quota safety valve

Manually edit `~/.dukar/latest.json` to set `"quota": {"utilization": 0.95}` and re-run. Dukar should print `Dukar: skipped (quota at 95%)` and exit early without consuming further quota.

(Skip this if you don't want to mess with the latest.json — it's a code-path verification, not a correctness one.)

## 7. Uninstall

```
/plugin uninstall dukar@dukar
```

Restart Claude Code. The hook should no longer fire on session start. Verify by running `cat ~/.claude/settings.json | grep dukar` — no matches expected (the plugin manages its own hook registration; nothing leaked into your global settings).

## 8. Re-install verifies idempotency

```
/plugin install dukar@dukar
```

Should succeed cleanly. No "already installed" errors that crash the flow.

## What to do if any step fails

- Capture the exact error and the command that produced it
- Check `~/.dukar/error.log`
- Don't push README updates or post until the failed step is understood and fixed
- Common gotchas:
  - **Windows paths in plugin.json**: use forward slashes
  - **`${CLAUDE_PLUGIN_ROOT}` not expanding**: ensure the hook command uses the literal string, not bash expansion
  - **Node version too low**: `node --version` should be 20+
