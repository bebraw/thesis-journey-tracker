import type { Env } from "../../app-env";
import type { SessionUser } from "../../auth";
import { addDaysToDateString, DEFAULT_TIME_ZONE, localDateTimeToUtcIso } from "../../date-time";
import { toDateTimeLocalInput } from "../../formatting";
import { normalizeDate, normalizeDateTime, normalizeString } from "../../forms/normalize";
import { readFormData } from "../../http/request-body";
import { redirect } from "../../http/response";
import { logError } from "../../observability/error-logging";
import { parseStudentFormSubmission } from "../../students";
import { saveMeetingNote } from "../../students/meeting-notes";
import {
  archiveStudent,
  canManageStudent,
  createStudent,
  getStudentById,
  restoreStudent,
  updateStudent,
  updateStudentWithPhaseAudit,
} from "../../students/store";
import { appendDashboardMessage, getDashboardReturnPath } from "./filters";

export async function handleAddStudent(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const formData = await readFormData(request);
  const timeZone = DEFAULT_TIME_ZONE;
  const studentInput = parseStudentFormSubmission(formData, { mode: "create", timeZone });
  if (!studentInput) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  try {
    const selected = await createStudent(env.DB, studentInput, user.id);
    return redirect(`/?selected=${selected}&notice=Student+added`);
  } catch (error) {
    logError("student.create_failed", error);
    return redirect("/students/new?error=Failed+to+save+student");
  }
}

export async function handleUpdateStudent(request: Request, env: Env, studentId: number, user: SessionUser): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request, { selectedId: studentId });
  const existingStudent = await getStudentById(env.DB, studentId, { userId: user.id });
  if (!existingStudent) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  const formData = await readFormData(request);
  const timeZone = DEFAULT_TIME_ZONE;
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
      await updateStudentWithPhaseAudit(
        env.DB,
        studentId,
        studentInput,
        {
          studentId,
          changedAt: new Date().toISOString(),
          fromPhase: existingStudent.currentPhase,
          toPhase: studentInput.currentPhase,
        },
        user.id,
      );
    } else {
      await updateStudent(env.DB, studentId, studentInput, user.id);
    }
  } catch (error) {
    logError("student.update_failed", error);
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Failed to save student update" }));
  }

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Student updated" }));
}

export async function handleAddLog(request: Request, env: Env, studentId: number, user: SessionUser): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request, { selectedId: studentId });
  const formData = await readFormData(request);
  const timeZone = DEFAULT_TIME_ZONE;

  const happenedAt = normalizeDateTime(formData.get("happenedAt"), true, timeZone);
  const discussed = normalizeString(formData.get("discussed"));
  const agreedPlan = normalizeString(formData.get("agreedPlan"));
  const nextStepDeadlineValue = formData.get("nextStepDeadline");
  const nextStepDeadline = nextStepDeadlineValue === null ? null : normalizeDate(nextStepDeadlineValue, true);
  const followUpAction = formData.get("followUpAction");
  const nextMeetingAtValue = formData.get("nextMeetingAt");
  const nextMeetingAtText = typeof nextMeetingAtValue === "string" ? nextMeetingAtValue.trim() : "";
  const nextMeetingAt = nextMeetingAtText ? normalizeDateTime(nextMeetingAtText, true, timeZone) : null;

  const validFollowUp =
    followUpAction === null ||
    followUpAction === "keep" ||
    (followUpAction === "next-week" && Boolean(happenedAt)) ||
    followUpAction === "clear" ||
    (followUpAction === "set" && Boolean(nextMeetingAt));
  if (
    happenedAt === undefined ||
    !discussed ||
    !agreedPlan ||
    nextStepDeadline === undefined ||
    nextMeetingAt === undefined ||
    !validFollowUp
  ) {
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Invalid log input" }));
  }

  const student = await getStudentById(env.DB, studentId, { userId: user.id });
  if (!student) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  let followUpMeeting = nextMeetingAt;
  if (followUpAction === "next-week" && happenedAt) {
    const local = toDateTimeLocalInput(happenedAt, timeZone);
    const nextLocal = `${addDaysToDateString(local.slice(0, 10), 7)}${local.slice(10)}`;
    followUpMeeting = localDateTimeToUtcIso(nextLocal, timeZone);
    if (toDateTimeLocalInput(followUpMeeting, timeZone) !== nextLocal) {
      return redirect(
        appendDashboardMessage(returnPath, {
          selectedId: studentId,
          error: "Next week's local time does not exist; choose another meeting time",
        }),
      );
    }
  }

  try {
    const logInput = {
      studentId,
      happenedAt: happenedAt || new Date().toISOString(),
      discussed,
      agreedPlan,
      nextStepDeadline,
    };

    await saveMeetingNote(
      env.DB,
      student,
      logInput,
      followUpAction === "keep" ? "keep" : followUpAction === "clear" ? "clear" : "set",
      followUpMeeting,
      user.id,
    );
  } catch (error) {
    logError("meeting_log.create_failed", error);
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Failed to save log" }));
  }

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Log saved" }));
}

export async function handleArchiveStudent(request: Request, env: Env, studentId: number, user: SessionUser): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request);
  if (!(await canManageStudent(env.DB, studentId, user.id))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  try {
    await archiveStudent(env.DB, studentId, new Date().toISOString(), user.id);
  } catch (error) {
    logError("student.archive_failed", error);
    return redirect(appendDashboardMessage(returnPath, { error: "Failed to archive student" }));
  }

  return redirect("/?scope=archived&notice=Student+archived");
}

export async function handleRestoreStudent(request: Request, env: Env, studentId: number, user: SessionUser): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request);
  if (!(await canManageStudent(env.DB, studentId, user.id))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Archived student not found" }));
  }

  try {
    await restoreStudent(env.DB, studentId, user.id);
  } catch (error) {
    logError("student.restore_failed", error);
    return redirect(appendDashboardMessage(returnPath, { error: "Failed to restore student" }));
  }

  return redirect("/?notice=Student+restored");
}
