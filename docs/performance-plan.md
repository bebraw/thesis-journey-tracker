# Performance Plan

## Baseline

Measured on March 22, 2026 with `npm run lighthouse` against the authenticated dashboard on the local Wrangler setup.

| Mode    | Performance | FCP    | LCP    | Speed Index | TBT  | CLS | Transfer |
| ------- | ----------- | ------ | ------ | ----------- | ---- | --- | -------- |
| Mobile  | 94          | 752 ms | 902 ms | 6550 ms     | 0 ms | 0   | 14.6 KB  |
| Desktop | 93          | 202 ms | 242 ms | 2731 ms     | 0 ms | 0   | 14.6 KB  |

## Reading The Results

- The app is already in a healthy spot for the main dashboard.
- Server work is fast: Lighthouse measured the root document response at about 10 ms locally.
- CSS and JavaScript waste are not currently a problem: Lighthouse reported no unused CSS/JS savings and no render-blocking savings.
- The main metric that still leaves room for improvement is Speed Index, especially on mobile, even though FCP/LCP are already strong.
- The dashboard HTML is compressed well on the wire, but Lighthouse reports a relatively large parsed HTML resource size, which is the main scaling risk as student count and UI richness grow.

## Improvement Plan

### 1. Reduce initial dashboard HTML size

Why:

- Lighthouse reports the HTML document as the largest resource by far.
- This is manageable today, but it is the clearest growth risk as more cards, rows, logs, and inline markup are added.

Actions:

- Keep the initial dashboard focused on summary content only.
- Continue loading the selected student panel on demand and avoid expanding that payload with hidden-but-rendered content.
- Consider truncating or progressively revealing long thesis topics in the initial dashboard views.
- Add a small HTML-size budget check to future performance reviews.

### 2. Shrink the inline dashboard script footprint

Why:

- There is no blocking-time issue today, but the dashboard interaction logic is still shipped inside the HTML payload.
- As filtering and inline interactions grow, this can quietly inflate both document size and startup work.

Actions:

- Move the dashboard interaction script to its own static asset.
- Defer non-essential event wiring until after first paint.
- Keep selection/filter logic modular so it does not accumulate unused startup work.

### 3. Guard the current good baseline in CI

Why:

- The current scores are strong enough that the immediate task is preventing regressions.

Actions:

- Keep Lighthouse running in CI.
- Enforce a minimum performance score of 90 for both mobile and desktop runs.
- Revisit the threshold after any major dashboard redesign or if production hosting characteristics differ meaningfully from local Wrangler runs.

### 4. Re-measure after any heavier UI additions

Why:

- The current baseline was taken before any major data growth or media-heavy features.

Actions:

- Re-run Lighthouse after adding charts, avatars, richer lane cards, or additional dashboard widgets.
- If student counts grow substantially, test with a seed set closer to real upper-bound usage, not only the current small fixture set.
