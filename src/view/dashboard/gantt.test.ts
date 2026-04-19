import { describe, expect, it } from "vitest";
import { renderDashboardGantt } from "./gantt.htmlisp";
import type { Student } from "../../students/store";

function buildStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 1,
    name: "Test Student",
    email: "test@example.edu",
    degreeType: "msc",
    thesisTopic: "Test topic",
    studentNotes: null,
    startDate: "2026-01-10",
    currentPhase: "researching",
    nextMeetingAt: null,
    archivedAt: null,
    logCount: 0,
    lastLogAt: null,
    ...overrides,
  };
}

describe("dashboard gantt", () => {
  it("renders a timeline view with month headers and custom phase labels", () => {
    const html = renderDashboardGantt(
      [
        buildStudent(),
        buildStudent({ id: 2, name: "Second Student", degreeType: "bsc", startDate: "2026-02-01", currentPhase: "editing" }),
      ],
      null,
      {
        search: "",
        degree: "",
        phase: "",
        status: "",
        viewMode: "gantt",
        sortKey: "nextMeeting",
        sortDirection: "asc",
      },
      [
        { label: "Planning research", phaseId: "research_plan" },
        { label: "Deep work", phaseId: "researching" },
        { label: "Writing", phaseId: "editing" },
        { label: "Delivered", phaseId: "submitted" },
      ],
      { today: new Date("2026-03-15T00:00:00.000Z") },
    );

    expect(html).toContain("Advisor workload across assumed thesis timelines.");
    expect(html).toContain("Jan 2026");
    expect(html).toContain("Deep work");
    expect(html).toContain("Writing");
    expect(html).toContain("6 month assumption");
    expect(html).toContain("4 month assumption");
    expect(html).toContain("data-gantt-student-row");
  });

  it("shows a placeholder when a student is missing a start date", () => {
    const html = renderDashboardGantt(
      [buildStudent({ startDate: null })],
      null,
      {
        search: "",
        degree: "",
        phase: "",
        status: "",
        viewMode: "gantt",
        sortKey: "nextMeeting",
        sortDirection: "asc",
      },
      [
        { label: "Planning research", phaseId: "research_plan" },
        { label: "Researching", phaseId: "researching" },
        { label: "Editing", phaseId: "editing" },
        { label: "Submitted", phaseId: "submitted" },
      ],
      { today: new Date("2026-03-15T00:00:00.000Z") },
    );

    expect(html).toContain("Start date needed");
  });
});
