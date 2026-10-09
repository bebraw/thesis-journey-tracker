import type { D1Database } from "../db-core";
import { nextScheduledMeeting } from "./recurrence";
import { createMeetingLog, createMeetingLogWithNextMeeting, type CreateLogInput, type Student } from "./store";

export async function saveMeetingNote(
  db: D1Database,
  student: Student,
  input: CreateLogInput,
  action: "keep" | "set" | "clear",
  nextMeetingAt: string | null = null,
): Promise<void> {
  if (action === "clear") {
    await createMeetingLogWithNextMeeting(db, input, null, true);
  } else if (action === "set") {
    await createMeetingLogWithNextMeeting(db, input, nextMeetingAt);
  } else if (student.meetingSchedule && student.nextMeetingAt && input.happenedAt >= student.nextMeetingAt) {
    await createMeetingLogWithNextMeeting(db, input, nextScheduledMeeting(student.meetingSchedule, input.happenedAt));
  } else {
    await createMeetingLog(db, input);
  }
}
