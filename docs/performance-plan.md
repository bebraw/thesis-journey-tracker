# Performance Plan

## Baseline

Measured on March 24, 2026 with `npm run lighthouse` against the authenticated dashboard on the local Wrangler setup.

| Mode    | Performance | FCP    | LCP    | Speed Index | TBT  | CLS | Transfer |
| ------- | ----------- | ------ | ------ | ----------- | ---- | --- | -------- |
| Mobile  | 94          | 753 ms | 903 ms | 6568 ms     | 0 ms | 0   | 16.6 KB  |
| Desktop | 93          | 249 ms | 249 ms | 2758 ms     | 0 ms | 0   | 16.6 KB  |

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

### 2. Keep the dashboard script payload small

Why:

- There is no blocking-time issue today, and the dashboard interaction logic already ships as a separate deferred asset at `/dashboard.js`.
- As filtering and inline interactions grow, that asset can still quietly inflate startup work and total transferred bytes.

Actions:

- Keep `/dashboard.js` modular and avoid adding behavior that runs before the current selection and filter wiring are needed.
- Defer any future non-essential event wiring until after first paint.
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
