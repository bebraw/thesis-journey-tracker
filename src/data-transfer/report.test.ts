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

  it("does not count future-start students with stale next meetings as overdue", () => {
    const report = createProfessorStatusReport(
      [
        {
          student: buildStudent({
            startDate: "2026-04-10",
            nextMeetingAt: "2026-03-25T09:00:00.000Z",
          }),
          latestLog: null,
        },
      ],
      new Date("2026-03-31T10:00:00.000Z"),
    );

    expect(report).toContain("- Overdue meetings: 0");
    expect(report).toContain("- No meeting booked: 1");
    expect(report).toContain("meeting not booked");
    expect(report).not.toContain("meeting overdue");
  });
});
