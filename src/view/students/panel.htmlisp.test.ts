import { describe, expect, it } from "vitest";
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
  it("defaults the add-log meeting date/time field to the saved next meeting time", () => {
    const html = renderSelectedStudentPanel(BASE_STUDENT, [], []);
    const addLogFormHtml = html.match(/<form action="\/actions\/add-log\/1"[\s\S]*?<\/form>/)?.[0];
    const nextMeetingInputHtml = addLogFormHtml?.match(/<input[^>]*name="nextMeetingAt"[^>]*><\/input>/)?.[0];

    expect(addLogFormHtml).toBeDefined();
    expect(addLogFormHtml).toMatch(/Meeting date\/time[\s\S]*?<input[^>]*name="happenedAt"[^>]*value="2026-04-10T12:00"/);
    expect(nextMeetingInputHtml).toBeDefined();
    expect(nextMeetingInputHtml).not.toContain(' value="');
  });
});
