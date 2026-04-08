import type { Env } from "../../app-env";
import { resolveGoogleCalendarSourceForApp, resolveScheduleTimeZone } from "../../calendar";
import { normalizeDate, normalizeDateTime, normalizeString } from "../../forms/normalize";
import { redirect } from "../../http/response";
import { parseStudentFormSubmission } from "../../students";
import {
  archiveStudent,
  createMeetingLog,
  createMeetingLogWithNextMeeting,
  createStudent,
  getStudentById,
  studentExists,
  updateStudent,
  updateStudentWithPhaseAudit,
} from "../../students/store";
import { appendDashboardMessage, getDashboardReturnPath } from "./filters";

export async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const timeZone = await resolveDashboardTimeZone(env);
  const studentInput = parseStudentFormSubmission(formData, { mode: "create", timeZone });
  if (!studentInput) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  try {
    const selected = await createStudent(env.DB, studentInput);
    return redirect(`/?selected=${selected}&notice=Student+added`);
  } catch (error) {
    console.error("Failed to save new student", error);
    return redirect("/students/new?error=Failed+to+save+student");
  }
}

export async function handleUpdateStudent(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request, { selectedId: studentId });
  const existingStudent = await getStudentById(env.DB, studentId);
  if (!existingStudent) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  const formData = await request.formData();
  const timeZone = await resolveDashboardTimeZone(env);
  const studentInput = parseStudentFormSubmission(formData, {
    mode: "update",
    existingStudent,
    timeZone,
  });

  if (!studentInput) {
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Invalid update input" }));
  }

  try {
    if (existingStudent.currentPhase !== studentInput.currentPhase) {
      await updateStudentWithPhaseAudit(env.DB, studentId, studentInput, {
        studentId,
        changedAt: new Date().toISOString(),
        fromPhase: existingStudent.currentPhase,
        toPhase: studentInput.currentPhase,
      });
    } else {
      await updateStudent(env.DB, studentId, studentInput);
    }
  } catch (error) {
    console.error("Failed to save student update", error);
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Failed to save student update" }));
  }

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Student updated" }));
}

export async function handleAddLog(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request, { selectedId: studentId });
  const formData = await request.formData();
  const timeZone = await resolveDashboardTimeZone(env);

  const happenedAt = normalizeDateTime(formData.get("happenedAt"), true, timeZone) || new Date().toISOString();
  const discussed = normalizeString(formData.get("discussed"));
  const agreedPlan = normalizeString(formData.get("agreedPlan"));
  const nextStepDeadlineValue = formData.get("nextStepDeadline");
  const nextStepDeadline =
    nextStepDeadlineValue === null ? null : normalizeDate(nextStepDeadlineValue, true);
  const nextMeetingAtValue = formData.get("nextMeetingAt");
  const nextMeetingAtText = typeof nextMeetingAtValue === "string" ? nextMeetingAtValue.trim() : "";
  const nextMeetingAt = nextMeetingAtText ? normalizeDateTime(nextMeetingAtText, true, timeZone) : null;

  if (!discussed || !agreedPlan || nextStepDeadline === undefined || nextMeetingAt === undefined) {
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Invalid log input" }));
  }

  if (!(await studentExists(env.DB, studentId))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  try {
    const logInput = {
      studentId,
      happenedAt,
      discussed,
      agreedPlan,
      nextStepDeadline,
    };

    if (nextMeetingAt) {
      await createMeetingLogWithNextMeeting(env.DB, logInput, nextMeetingAt);
    } else {
      await createMeetingLog(env.DB, logInput);
    }
  } catch (error) {
    console.error("Failed to save meeting log", error);
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Failed to save log" }));
  }

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Log saved" }));
}

export async function handleArchiveStudent(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request);
  if (!(await studentExists(env.DB, studentId))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  try {
    await archiveStudent(env.DB, studentId, new Date().toISOString());
  } catch (error) {
    console.error("Failed to archive student", error);
    return redirect(appendDashboardMessage(returnPath, { error: "Failed to archive student" }));
  }

  return redirect(appendDashboardMessage(returnPath, { notice: "Student archived" }));
}

async function resolveDashboardTimeZone(env: Env): Promise<string> {
  const calendarSource = await resolveGoogleCalendarSourceForApp(env);
  return resolveScheduleTimeZone(calendarSource?.timeZone);
}
