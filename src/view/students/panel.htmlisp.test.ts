import { describe, expect, it, vi } from "vitest";
import { renderSelectedStudentPanel } from "./panel.htmlisp";
import type { Student } from "../../students/store";

const BASE_STUDENT: Student = {
  id: 1,
  name: "Base Student",
  email: "base@example.edu",
  degreeType: "msc",
  thesisTopic: "Baseline supervision topic",
  studentNotes: "Baseline student note",
  startDate: "2026-01-01",
  currentPhase: "researching",
  nextMeetingAt: "2026-04-10T09:00:00.000Z",
  archivedAt: null,
  logCount: 0,
  lastLogAt: null,
};

describe("renderSelectedStudentPanel", () => {
  it("uses configured dashboard lane labels in the phase dropdown", () => {
    const html = renderSelectedStudentPanel(BASE_STUDENT, [], [], {
      dashboardLanes: [
        { phaseId: "research_plan", label: "Planning research" },
        { phaseId: "researching", label: "Researching" },
        { phaseId: "editing", label: "Editing" },
        { phaseId: "submitted", label: "Submitting" },
      ],
    });

    expect(html).toContain('<option value="submitted">Submitting</option>');
    expect(html).not.toContain('<option value="submitted">Submitted</option>');
  });

  it("defaults meeting notes to the recording time and keeps the current follow-up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    const html = renderSelectedStudentPanel(BASE_STUDENT, [], []);
    vi.useRealTimers();
    const addLogFormHtml = html.match(/<form action="\/actions\/add-log\/1"[\s\S]*?<\/form>/)?.[0];
    const nextMeetingInputHtml = addLogFormHtml?.match(/<input[^>]*name="nextMeetingAt"[^>]*><\/input>/)?.[0];

    expect(addLogFormHtml).toBeDefined();
    expect(addLogFormHtml).toMatch(/Meeting time[\s\S]*?<input[^>]*name="happenedAt"[^>]*value="2026-10-02T15:00"/);
    expect(nextMeetingInputHtml).toBeDefined();
    expect(nextMeetingInputHtml).not.toContain(' value="');
    expect(addLogFormHtml).toContain('<option value="keep">Keep current meeting</option>');
    expect(addLogFormHtml).toContain('<option value="clear">Not booked</option>');
    expect(addLogFormHtml).toContain('<option value="set">Set new meeting</option>');
  });

  it("formats stored timestamps using the explicit panel timezone", () => {
    const html = renderSelectedStudentPanel(BASE_STUDENT, [], [], {
      canEdit: false,
      timeZone: "UTC",
    });

    expect(html).toContain("10 Apr 2026, 09:00 UTC");
    expect(html).not.toContain("10 Apr 2026, 12:00 EEST");
  });

  it("uses escaped data for archive confirmation instead of an inline handler", () => {
    const html = renderSelectedStudentPanel({ ...BASE_STUDENT, name: "O'Connor <script>" }, [], []);

    expect(html).toContain("data-confirm-message=");
    expect(html).not.toContain("onsubmit=");
    expect(html).not.toContain("window.confirm");
    expect(html).not.toContain("<script>");
  });

  it("renders archived students read-only with a restore action for editors", () => {
    const html = renderSelectedStudentPanel({ ...BASE_STUDENT, archivedAt: "2026-06-18T09:00:00.000Z" }, [], [], {
      filters: {
        scope: "archived",
        search: "",
        degree: "",
        phase: "",
        status: "",
        viewMode: "list",
        sortKey: "archived",
        sortDirection: "desc",
      },
      timeZone: "UTC",
    });

    expect(html).toContain("Archived 18 Jun 2026, 09:00 UTC");
    expect(html).toContain('action="/actions/restore-student/1"');
    expect(html).toContain("Restore to active students");
    expect(html).not.toContain("Save student updates");
    expect(html).not.toContain("Save log entry");
  });
});
