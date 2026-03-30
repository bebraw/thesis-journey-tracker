import { describe, expect, it } from "vitest";
import { renderStudentsTable } from "./students-table.htmlisp";
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
      "<div>Panel</div>",
      "<div>Empty</div>",
    );

    const selectedRowMatch = html.match(/<tr class="([^"]+)" data-student-row data-select-href="\/\?selected=13" data-student-id="13"[\s\S]*?aria-selected="true"/);
    expect(selectedRowMatch).not.toBeNull();

    const selectedRowClass = selectedRowMatch?.[1] || "";
    expect(selectedRowClass).toContain("bg-app-brand-soft");
    expect(selectedRowClass).toContain("dark:bg-app-brand-soft-dark/20");
    expect(selectedRowClass).not.toContain("bg-app-brand-soft/90");
    expect(selectedRowClass).not.toContain("dark:bg-app-brand-soft-dark/25");
  });
});
