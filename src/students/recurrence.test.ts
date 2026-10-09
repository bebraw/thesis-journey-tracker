import { describe, expect, it } from "vitest";
import { nextScheduledMeeting, parseMeetingSchedule, type MeetingSchedule } from "./recurrence";
import { saveMeetingNote } from "./meeting-notes";
import { MockD1Database } from "../../tests/helpers/mock-d1";
import { getStudentById, updateStudent } from "./store";
import { createDataExport } from "../data-transfer/export";
import { parseDataImport } from "../data-transfer/import";

const schedule: MeetingSchedule = { startLocal: "2026-10-16T14:00", timeZone: "Europe/Helsinki", intervalWeeks: 1, untilDate: null };

describe("internal repeating meetings", () => {
  it("keeps Friday 14:00 across autumn and spring clock changes", () => {
    expect(nextScheduledMeeting(schedule)).toBe("2026-10-16T11:00:00.000Z");
    expect(nextScheduledMeeting(schedule, "2026-10-23T11:00:00.000Z")).toBe("2026-10-30T12:00:00.000Z");
    expect(nextScheduledMeeting(schedule, "2027-03-26T12:00:00.000Z")).toBe("2027-04-02T11:00:00.000Z");
  });
  it("supports fortnightly intervals and an inclusive end date", () => {
    const finite = { ...schedule, intervalWeeks: 2, untilDate: "2026-10-30" };
    expect(nextScheduledMeeting(finite, "2026-10-16T11:00:00.000Z")).toBe("2026-10-30T12:00:00.000Z");
    expect(nextScheduledMeeting(finite, "2026-10-30T12:00:00.000Z")).toBeNull();
  });
  it("rejects impossible dates, invalid timezones, and malformed recurrence", () => {
    for (const invalid of [
      { intervalWeeks: 0 },
      { intervalWeeks: 1.5 },
      { timeZone: "Missing/Zone" },
      { startLocal: "2026-02-30T14:00" },
      { startLocal: "2026-10-16T25:00" },
      { untilDate: "2026-10-01" },
      { untilDate: "2026-99-99" },
    ])
      expect(parseMeetingSchedule({ ...schedule, ...invalid })).toBeNull();
  });
  it("advances after a meeting, preserves later bookings for historical notes, and clears recurrence explicitly", async () => {
    const db = new MockD1Database();
    const original = (await getStudentById(db, 1))!;
    await updateStudent(db, 1, { ...original, meetingSchedule: schedule, nextMeetingAt: nextScheduledMeeting(schedule) });
    const note = { studentId: 1, happenedAt: "2026-10-16T11:00:00.000Z", discussed: "Draft", agreedPlan: "Revise", nextStepDeadline: null };
    await saveMeetingNote(db, (await getStudentById(db, 1))!, note, "keep");
    expect((await getStudentById(db, 1))?.nextMeetingAt).toBe("2026-10-23T11:00:00.000Z");
    await saveMeetingNote(db, (await getStudentById(db, 1))!, { ...note, happenedAt: "2026-10-09T11:00:00.000Z" }, "keep");
    expect((await getStudentById(db, 1))?.nextMeetingAt).toBe("2026-10-23T11:00:00.000Z");
    const student = (await getStudentById(db, 1))!;
    expect(
      parseDataImport(JSON.stringify(createDataExport([{ student, logs: [], phaseAudit: [] }]))).data?.[0]?.student.meetingSchedule,
    ).toEqual(schedule);
    await saveMeetingNote(db, student, note, "clear");
    expect(await getStudentById(db, 1)).toMatchObject({ nextMeetingAt: null, meetingSchedule: null });
  });
});
