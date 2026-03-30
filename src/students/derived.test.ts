import { describe, expect, it } from "vitest";
import type { Student } from "./store";
import { getTargetSubmissionDate, isPastTargetSubmissionDate } from "./derived";

function buildStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 1,
    name: "Test Student",
    email: "test@example.edu",
    degreeType: "msc",
    thesisTopic: "Test topic",
    studentNotes: null,
    startDate: "2026-01-01",
    currentPhase: "researching",
    nextMeetingAt: null,
    archivedAt: null,
    logCount: 0,
    lastLogAt: null,
    ...overrides,
  };
}

describe("student target submission rules", () => {
  it("derives a six-month target only for MSc students", () => {
    expect(getTargetSubmissionDate(buildStudent({ degreeType: "msc", startDate: "2026-01-01" }))).toBe("2026-07-01");
    expect(getTargetSubmissionDate(buildStudent({ degreeType: "bsc", startDate: "2026-01-01" }))).toBeNull();
    expect(getTargetSubmissionDate(buildStudent({ degreeType: "dsc", startDate: "2026-01-01" }))).toBeNull();
  });

  it("only counts MSc students as past target", () => {
    expect(isPastTargetSubmissionDate(buildStudent({ degreeType: "msc", startDate: "2026-01-01" }), "2026-08-01")).toBe(true);
    expect(isPastTargetSubmissionDate(buildStudent({ degreeType: "bsc", startDate: "2026-01-01" }), "2026-08-01")).toBe(false);
    expect(isPastTargetSubmissionDate(buildStudent({ degreeType: "dsc", startDate: "2026-01-01" }), "2026-08-01")).toBe(false);
  });
});
