import { describe, expect, it } from "vitest";
import { renderPhaseLanes } from "./phase-lanes.htmlisp";
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

describe("phase lanes", () => {
  it("highlights the selected lane card with a border-only treatment", () => {
    const html = renderPhaseLanes(
      [
        buildStudent({ id: 13, name: "Selected Student" }),
        buildStudent({ id: 14, name: "Other Student", currentPhase: "editing" }),
      ],
      buildStudent({ id: 13, name: "Selected Student" }),
      DEFAULT_FILTERS,
      getDefaultDashboardLanes(),
    );

    const selectedCardMatch = html.match(/<li class="([^"]+)" data-lane-student-card data-student-id="13"[\s\S]*?aria-selected="true"/);
    expect(selectedCardMatch).not.toBeNull();

    const selectedCardClass = selectedCardMatch?.[1] || "";
    expect(selectedCardClass).toContain("border-app-brand");
    expect(selectedCardClass).toContain("bg-app-surface-soft");
    expect(selectedCardClass).not.toContain("bg-app-brand-soft");
  });

  it("renders custom dashboard lane labels and phase summaries", () => {
    const html = renderPhaseLanes(
      [
        buildStudent({ id: 13, name: "Selected Student", currentPhase: "researching" }),
        buildStudent({ id: 14, name: "Other Student", currentPhase: "editing" }),
      ],
      null,
      DEFAULT_FILTERS,
      [
        { label: "Planning research", phaseId: "research_plan" },
        { label: "Deep work", phaseId: "researching" },
        { label: "Writing", phaseId: "editing" },
        { label: "Delivered", phaseId: "submitted" },
      ],
    );

    expect(html).toContain("Deep work");
    expect(html).toContain("Writing");
    expect(html).not.toContain("Planning research + Researching");
  });
});
