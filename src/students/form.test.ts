import { describe, expect, it } from "vitest";
import { getStudentFormValues, parseStudentFormSubmission, STUDENT_FORM_FIELDS } from "./form";
import type { Student } from "./store";

const EXISTING_STUDENT: Student = {
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

describe("parseStudentFormSubmission", () => {
  it("converts datetime-local next meetings using the app timezone instead of the server timezone", () => {
    const formData = new FormData();
    formData.set(STUDENT_FORM_FIELDS.name, EXISTING_STUDENT.name);
    formData.set(STUDENT_FORM_FIELDS.email, EXISTING_STUDENT.email || "");
    formData.set(STUDENT_FORM_FIELDS.degreeType, EXISTING_STUDENT.degreeType);
    formData.set(STUDENT_FORM_FIELDS.currentPhase, EXISTING_STUDENT.currentPhase);
    formData.set(STUDENT_FORM_FIELDS.nextMeetingAt, "2026-04-10T12:00");

    const parsed = parseStudentFormSubmission(formData, {
      mode: "update",
      existingStudent: EXISTING_STUDENT,
    });

    expect(parsed?.nextMeetingAt).toBe("2026-04-10T09:00:00.000Z");
  });

  it("clears an existing next meeting when the clear control is selected", () => {
    const formData = new FormData();
    formData.set(STUDENT_FORM_FIELDS.name, EXISTING_STUDENT.name);
    formData.set(STUDENT_FORM_FIELDS.email, EXISTING_STUDENT.email || "");
    formData.set(STUDENT_FORM_FIELDS.degreeType, EXISTING_STUDENT.degreeType);
    formData.set(STUDENT_FORM_FIELDS.currentPhase, EXISTING_STUDENT.currentPhase);
    formData.set(STUDENT_FORM_FIELDS.clearNextMeetingAt, "yes");

    const parsed = parseStudentFormSubmission(formData, {
      mode: "update",
      existingStudent: EXISTING_STUDENT,
    });

    expect(parsed?.nextMeetingAt).toBeNull();
  });

  it("preserves the existing next meeting when update payload omits the field", () => {
    const formData = new FormData();
    formData.set(STUDENT_FORM_FIELDS.name, EXISTING_STUDENT.name);
    formData.set(STUDENT_FORM_FIELDS.email, EXISTING_STUDENT.email || "");
    formData.set(STUDENT_FORM_FIELDS.degreeType, EXISTING_STUDENT.degreeType);
    formData.set(STUDENT_FORM_FIELDS.currentPhase, EXISTING_STUDENT.currentPhase);

    const parsed = parseStudentFormSubmission(formData, {
      mode: "update",
      existingStudent: EXISTING_STUDENT,
    });

    expect(parsed?.nextMeetingAt).toBe(EXISTING_STUDENT.nextMeetingAt);
  });

  it("renders stored next meetings back into a deterministic datetime-local value", () => {
    expect(getStudentFormValues(EXISTING_STUDENT).nextMeetingAt).toBe("2026-04-10T12:00");
  });
});
