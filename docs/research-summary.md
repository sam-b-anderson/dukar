# Reddit Research Summary: Claude Degradation Claims (Feb 12 – Apr 13, 2026)

## Purpose

This document summarizes 60 days of Reddit research across r/ClaudeCode and r/ClaudeAI to inform the design of a system that measures Claude model degradation. Another agent will use this to build measurement tooling.

## Data Collected

- **3,965 unique posts** scraped (1,880 r/ClaudeCode, 1,976 r/ClaudeAI)
- **1,708 posts** matched degradation/investigation/measurement categories
- **5,304 comments** fetched from the top 30 highest-engagement posts
- Sentiment analysis, claim extraction, and weekly trend data computed
- All raw data available in JSON files in this directory

## The Three Core Technical Claims

The community has converged on three distinct root causes. Each would need its own measurement approach.

### 1. Adaptive Thinking / Reasoning Effort Regression

**What people claim:** In February 2026, Anthropic shipped "adaptive thinking" — the model now decides how much to reason per turn instead of using a fixed budget. Since then, Opus 4.6 consistently fails tests it used to pass (e.g., the "car wash test"), produces shallower analysis, and rushes to finish rather than thinking deeply.

**Key evidence cited by the community:**
- A developer ran **6,852 sessions** and showed thinking depth dropped 67% (1,569 pts, 241 comments)
- AMD's director of AI (Stella Laurenzo) filed a GitHub issue documenting that Claude reads code 3x less before editing and rewrites entire files 2x more often than before (2,129 pts, 330 comments)
- A user identified **3 stacked bugs in Claude Code v2.0.64+** that cause `alwaysThinkingEnabled: true` and `CLAUDE_CODE_EFFORT_LEVEL=max` to silently fail (672 pts)
- The post "Something happened to Opus 4.6's reasoning effort" (4,247 pts) reports consistent car wash test failure (5/5 tries) with no thinking block displayed, while Sonnet 4.6 and Opus 4.5 still pass

**What to measure:**
- Thinking token count per response (before vs. after Feb 2026)
- Thinking depth: does the model read files before editing? How many reads per edit?
- Test suite: known reasoning puzzles (car wash test, logic puzzles) tracked over time
- Compare behavior with `alwaysThinkingEnabled` on vs. off
- Compare Opus 4.6 vs Opus 4.5 on identical prompts

### 2. Cache TTL Silent Regression (1h → 5m)

**What people claim:** Around March 6, 2026, the prompt cache TTL was silently reduced from ~1 hour to ~5 minutes. This means cached context (which is cheap) expires much faster, so users hit full-price re-reads constantly, burning through usage quotas 5-20x faster than before.

**Key evidence cited by the community:**
- **120,000 API calls across 2 machines** proving the TTL change with before/after data (749 pts)
- A reverse-engineering post identified **two cache bugs** that compound the TTL issue, causing 10-20x API cost inflation (997 pts r/ClaudeCode + 957 pts r/ClaudeAI)
- A user patched the leaked Claude Code source to fix the cache behavior and reported usage returned to normal (2,735 pts)
- The creator of Claude Code (Boris) acknowledged caching is "a big current problem" (192 pts)
- Anthropic's official post "Investigating usage limits hitting faster than expected" (1,046 pts) confirmed the issue exists

**What to measure:**
- Actual cache hit rate per session (track `cache_creation_input_tokens` vs `cache_read_input_tokens` in API responses)
- Effective TTL: send identical requests at increasing intervals, measure when cache misses start
- Total tokens billed per session vs. unique tokens sent (the ratio reveals cache efficiency)
- Compare API users vs Claude Code users (Claude Code may add invisible overhead)

### 3. Tier-Based Differential Treatment / A/B Testing

**What people claim:** Personal accounts (Max, Pro, Free) receive degraded model quality compared to Team and Enterprise accounts. Users report being placed in "buckets" with different reasoning effort levels, and some claim to have confirmed this with side-by-side comparisons on different plan tiers.

**Key evidence cited by the community:**
- Side-by-side comparison of Claude Team vs personal Max account showing different reasoning depth on identical prompts (374 pts)
- A user set up a transparent API proxy and found a `fallback-percentage: 0.5` header, claiming every plan gets 50% of advertised capacity (246 pts) — though community investigation later questioned the interpretation
- Multiple posts report sudden quality changes that correlate with high-usage periods (peak hours), suggesting load-based routing to cheaper/faster model variants
- Post about Claude blazing fast with no rate limits immediately after Max 5x subscription expired (346 pts) — suggesting different routing

**What to measure:**
- Send identical prompts from different plan tiers simultaneously, compare response quality and thinking depth
- Track response quality vs. time of day (peak vs. off-peak)
- Monitor HTTP response headers for routing/bucketing signals
- Compare API-direct responses vs. Claude Code responses (Claude Code may add system prompt overhead that affects behavior)

## Community Sentiment Context

Understanding the emotional landscape matters for interpreting the data — angry users may overstate effects, while analytical users may provide the most reliable signal.

**Sentiment distribution across top 30 posts + 5,304 comments:**
- Analytical: 164 signals (dominant — people are investigating, not just venting)
- Frustration: 108
- Resignation: 104 (paired with frustration — "I'm done with this")
- Constructive: 104 (surprisingly high — lots of people sharing fixes and workarounds)
- Anger: 86
- Concern: 47
- Skeptical: 21 (small but important — "works fine for me", "confirmation bias")

**The skeptical minority raises valid points:**
- Confirmation bias is real — once people expect degradation, they notice every imperfection
- No controlled before/after comparison exists with frozen prompts
- Claude Code version updates change system prompts and tool behavior independently of model changes
- "Vibe checks" are not measurement — most complaints are subjective

## The Escalation Timeline

| Week of | Total Target Posts | Degradation Posts | Notes |
|---------|-------------------|-------------------|-------|
| Feb 9 | 20 | 8 | Baseline — scattered complaints |
| Feb 23 | 43 | 22 | Adaptive thinking ships, first rumblings |
| Mar 9 | 83 | 28 | Growing awareness |
| Mar 16 | 127 | 46 | Usage limit complaints surge |
| Mar 23 | 204 | 62 | Source code leak; cache bugs found |
| Mar 30 | 251 | 91 | Anthropic acknowledges investigation |
| **Apr 6** | **784** | **329** | **Explosion — 4x prior week** |
| Apr 13 | 94 (partial) | 26 | Ongoing |

Key inflection points:
- **Feb ~15:** Adaptive thinking ships
- **Mar ~6:** Cache TTL allegedly changed
- **Mar ~24:** Claude Code source leaked, community starts reverse-engineering
- **Mar ~30:** Anthropic official post acknowledging usage limit issues
- **Apr ~2:** AMD AI director files GitHub issue
- **Apr ~7-10:** "67% dumber" post goes viral, mainstream awareness

## Specific Posts Worth Deep-Diving

These posts contain the most actionable technical detail for building measurement:

1. **"Claude Code's max effort thinking broken since v2.0.64"** — Identifies 3 specific bugs with reproduction steps and a fix
   - https://reddit.com/r/ClaudeCode/comments/1shjfxb/
2. **"Data from 120k API calls proves cache TTL regression"** — Hard quantitative data
   - https://reddit.com/r/ClaudeCode/comments/1sj1zb0/
3. **"PSA: Two cache bugs that 10-20x your API costs"** — Reverse-engineered root cause with workarounds
   - https://reddit.com/r/ClaudeCode/comments/1s7mitf/
4. **"Leaked source code → cache fix patch"** — Actual code patch that reportedly fixes the issue
   - https://reddit.com/r/ClaudeAI/comments/1s8zxt4/
5. **"I reverse-engineered why Claude Code burns through usage"** — 7 stacking bugs identified
   - https://reddit.com/r/ClaudeAI/comments/1sbqalg/
6. **"Hidden fallback-percentage header"** — API proxy methodology (even though findings were disputed)
   - https://reddit.com/r/ClaudeAI/comments/1sip74m/
7. **"Throttling reasoning on personal vs Team accounts"** — Side-by-side tier comparison
   - https://reddit.com/r/ClaudeCode/comments/1sgtkcy/
8. **"Claude isn't dumber, it's just not trying. Here's how to fix it"** — Counterpoint with practical workaround
   - https://reddit.com/r/ClaudeAI/comments/1sjz1hg/

## Data Files

All in the `dukar/` directory:

| File | Description |
|------|-------------|
| `reddit-60d.json` | All 3,965 posts with metadata, selftext, categories |
| `reddit-target-posts.json` | 1,708 filtered target posts |
| `reddit-enriched-top30.json` | Top 30 posts with full comment trees (5,304 comments), sentiment, claims |
| `reddit-claudeai-raw.json` | Raw r/ClaudeAI scrape data |
| `fetch-reddit.mjs` | Main scraper script (reusable) |
| `merge-and-analyze.mjs` | Merge + comment fetch + analysis script |

## Recommendations for Measurement Design

Based on what the community has found (and what they haven't been able to prove):

1. **Start with what's objectively measurable** — cache hit rates and token counts are unambiguous. Reasoning quality is subjective and hard to baseline.

2. **The cache TTL claim is the easiest to verify or falsify** — send identical requests at 1min, 5min, 15min, 30min, 60min intervals and track cache hit/miss. This is a binary, repeatable test.

3. **Thinking depth needs a benchmark suite** — the "car wash test" and similar reasoning puzzles that the community uses informally. Run them daily, track pass rate over time.

4. **Tier comparison needs simultaneous identical requests** — same prompt, same time, different accounts. Compare thinking token count and response quality.

5. **Control for Claude Code vs. raw API** — many complaints may stem from Claude Code's system prompt overhead, not model changes. Test both paths.

6. **Track over time, not just snapshot** — a single measurement means nothing. Daily runs with the same prompts create a trend line that reveals real changes vs. noise.
