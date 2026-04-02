import { describe, expect, it } from "vitest";
import { renderMetricCards } from "./metrics.htmlisp";

describe("dashboard metrics", () => {
  it("renders compact metric cards that link to useful filtered views without extra CTA copy", () => {
    const html = renderMetricCards({
      total: 3,
      noMeeting: 1,
      pastTarget: 2,
      submitted: 1,
    });

    expect(html).toContain('href="/?status=not_booked"');
    expect(html).toContain('href="/?degree=msc&amp;sort=target&amp;dir=asc"');
    expect(html).toContain('href="/?phase=submitted"');
    expect(html).not.toContain("Review students");
    expect(html).not.toContain("Review timeline");
  });
});
