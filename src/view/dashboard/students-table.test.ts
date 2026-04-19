import { describe, expect, it } from "vitest";
import { renderStudentsTable } from "./students-table.htmlisp";
import { getDefaultDashboardLanes } from "../../dashboard-lanes";
import type { Student } from "../../students/store";
import type { DashboardFilters } from "../types";

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

const DEFAULT_FILTERS: DashboardFilters = {
  search: "",
  degree: "",
  phase: "",
  status: "",
  viewMode: "list",
  sortKey: "nextMeeting",
  sortDirection: "asc",
};

describe("students table", () => {
  it("renders the selected row with the same highlight classes used by client-side selection", () => {
    const html = renderStudentsTable(
      [
        buildStudent({ id: 13, name: "Selected Student" }),
        buildStudent({ id: 14, name: "Other Student", currentPhase: "editing" }),
      ],
      buildStudent({ id: 13, name: "Selected Student" }),
      DEFAULT_FILTERS,
      getDefaultDashboardLanes(),
      "<div>Metrics</div>",
      "<div>Phases</div>",
      "<div>Panel</div>",
      "<div>Empty</div>",
      { canEdit: true },
    );

    const selectedRowMatch = html.match(/<tr class="([^"]+)" data-student-row data-select-href="\/\?selected=13" data-student-id="13"[\s\S]*?aria-selected="true"/);
    expect(selectedRowMatch).not.toBeNull();

    const selectedRowClass = selectedRowMatch?.[1] || "";
    expect(selectedRowClass).toContain("bg-app-brand-soft");
    expect(selectedRowClass).toContain("dark:bg-app-brand-soft-dark/20");
    expect(selectedRowClass).not.toContain("bg-app-brand-soft/90");
    expect(selectedRowClass).not.toContain("dark:bg-app-brand-soft-dark/25");
  });

  it("formats next meetings using the explicit table timezone", () => {
    const html = renderStudentsTable(
      [
        buildStudent({ id: 13, name: "Selected Student", nextMeetingAt: "2026-04-10T09:00:00.000Z" }),
      ],
      null,
      DEFAULT_FILTERS,
      getDefaultDashboardLanes(),
      "<div>Metrics</div>",
      "<div>Phases</div>",
      "<div>Panel</div>",
      "<div>Empty</div>",
      { timeZone: "UTC" },
    );

    expect(html).toContain("10 Apr 2026, 09:00 UTC");
    expect(html).not.toContain("10 Apr 2026, 12:00 EEST");
  });

  it("uses customized phase labels in the list view and phase filter", () => {
    const html = renderStudentsTable(
      [
        buildStudent({ id: 13, name: "Selected Student", currentPhase: "researching" }),
      ],
      null,
      DEFAULT_FILTERS,
      [
        { label: "Planning research", phaseId: "research_plan" },
        { label: "Deep work", phaseId: "researching" },
        { label: "Editing", phaseId: "editing" },
        { label: "Submitted", phaseId: "submitted" },
      ],
      "<div>Metrics</div>",
      "<div>Phases</div>",
      "<div>Panel</div>",
      "<div>Empty</div>",
    );

    expect(html).toContain(">Deep work</td>");
    expect(html).toContain(">Deep work</option>");
    expect(html).not.toContain(">Researching</td>");
  });
});
