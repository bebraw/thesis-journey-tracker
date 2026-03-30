import type { Env } from "../../app-env";
import { normalizeDate, normalizeDateTime, normalizeString } from "../../forms/normalize";
import { redirect } from "../../http/response";
import { parseStudentFormSubmission } from "../../students";
import {
  archiveStudent,
  createMeetingLog,
  createStudent,
  getStudentById,
  studentExists,
  updateStudent,
  updateStudentWithPhaseAudit,
} from "../../students/store";
import { appendDashboardMessage, getDashboardReturnPath } from "./filters";

export async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const studentInput = parseStudentFormSubmission(formData, { mode: "create" });
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
  const studentInput = parseStudentFormSubmission(formData, {
    mode: "update",
    existingStudent,
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

  const happenedAt = normalizeDateTime(formData.get("happenedAt"), true) || new Date().toISOString();
  const discussed = normalizeString(formData.get("discussed"));
  const agreedPlan = normalizeString(formData.get("agreedPlan"));
  const nextStepDeadlineValue = formData.get("nextStepDeadline");
  const nextStepDeadline =
    nextStepDeadlineValue === null ? null : normalizeDate(nextStepDeadlineValue, true);

  if (!discussed || !agreedPlan || nextStepDeadline === undefined) {
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Invalid log input" }));
  }

  if (!(await studentExists(env.DB, studentId))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  try {
    await createMeetingLog(env.DB, {
      studentId,
      happenedAt,
      discussed,
      agreedPlan,
      nextStepDeadline,
    });
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
