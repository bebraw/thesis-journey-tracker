import { describe, expect, it } from "vitest";
import { createProfessorStatusReport } from "./report";
import type { Student } from "../students/store";

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

describe("professor status report", () => {
  it("reports non-MSc students as having no derived target date", () => {
    const report = createProfessorStatusReport(
      [
        {
          student: buildStudent({
            degreeType: "bsc",
            startDate: "2026-01-01",
            nextMeetingAt: "2026-09-10T10:00:00.000Z",
          }),
          latestLog: null,
        },
      ],
      new Date("2026-08-01T10:00:00.000Z"),
    );

    expect(report).toContain("- Past target date and not yet submitted: 0");
    expect(report).toContain("target not set");
  });
});
