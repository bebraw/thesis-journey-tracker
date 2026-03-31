import { describe, expect, it } from "vitest";
import type { Student } from "./store";
import { getTargetSubmissionDate, isPastTargetSubmissionDate, meetingStatusId, meetingStatusText } from "./derived";

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

describe("student meeting status rules", () => {
  it("does not mark future-start students as overdue when their stored next meeting is already in the past", () => {
    const now = new Date("2026-03-31T10:00:00.000Z");
    const student = buildStudent({
      startDate: "2026-04-10",
      nextMeetingAt: "2026-03-25T09:00:00.000Z",
    });

    expect(meetingStatusId(student, now)).toBe("not_booked");
    expect(meetingStatusText(student, now)).toBe("Not booked");
  });

  it("still marks started students with past meetings as overdue", () => {
    const now = new Date("2026-03-31T10:00:00.000Z");
    const student = buildStudent({
      startDate: "2026-03-01",
      nextMeetingAt: "2026-03-25T09:00:00.000Z",
    });

    expect(meetingStatusId(student, now)).toBe("overdue");
    expect(meetingStatusText(student, now)).toBe("Overdue");
  });

  it("keeps future upcoming meetings visible for students who have not started yet", () => {
    const now = new Date("2026-03-31T10:00:00.000Z");
    const student = buildStudent({
      startDate: "2026-04-10",
      nextMeetingAt: "2026-04-05T09:00:00.000Z",
    });

    expect(meetingStatusId(student, now)).toBe("within_2_weeks");
    expect(meetingStatusText(student, now)).toBe("Meeting soon");
  });
});
