import { describe, expect, it } from "vitest";
import { renderMetricCards } from "./metrics.htmlisp";

describe("dashboard metrics", () => {
  it("renders actionable metric cards that link to useful filtered views", () => {
    const html = renderMetricCards({
      total: 3,
      noMeeting: 1,
      pastTarget: 2,
      submitted: 1,
    });

    expect(html).toContain('href="/?status=not_booked"');
    expect(html).toContain('href="/?degree=msc&sort=target&dir=asc"');
    expect(html).toContain('href="/?phase=submitted"');
    expect(html).toContain("Review students");
    expect(html).toContain("Review timeline");
  });
});
