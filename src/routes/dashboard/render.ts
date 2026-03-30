import type { SessionUser } from "../../auth";
import type { Env } from "../../app-env";
import { isPastTargetSubmissionDate } from "../../students";
import { getStudentById, listLogsForStudent, listPhaseAuditEntriesForStudent, listStudents } from "../../students/store";
import { htmlFragmentResponse, htmlResponse } from "../../utils";
import { renderAddStudentPage, renderDashboardPage, renderEmptySelectedPanel, renderSelectedStudentPanel } from "../../views";
import { getDashboardFilters } from "./filters";

export async function renderDashboard(env: Env, url: URL, sessionUser: SessionUser, showStyleGuide: boolean): Promise<Response> {
  const [students, allStudents] = await Promise.all([listStudents(env.DB), listStudents(env.DB, { includeArchived: true })]);
  const filters = getDashboardFilters(url.searchParams);

  const selectedIdParam = url.searchParams.get("selected");
  const parsedSelectedId = selectedIdParam ? Number.parseInt(selectedIdParam, 10) : 0;
  const selectedId = Number.isFinite(parsedSelectedId) ? parsedSelectedId : 0;
  const selectedStudent = students.find((student) => student.id === selectedId) || null;
  const logs = selectedStudent ? await listLogsForStudent(env.DB, selectedStudent.id) : [];
  const phaseAudit = selectedStudent ? await listPhaseAuditEntriesForStudent(env.DB, selectedStudent.id) : [];

  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  const today = new Date().toISOString().slice(0, 10);
  const metrics = {
    total: allStudents.length,
    noMeeting: students.filter((student) => !student.nextMeetingAt).length,
    pastTarget: students.filter((student) => isPastTargetSubmissionDate(student, today)).length,
    submitted: students.filter((student) => student.currentPhase === "submitted").length,
  };

  return htmlResponse(
    renderDashboardPage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
      students,
      selectedStudent,
      logs,
      phaseAudit,
      filters,
      notice,
      error,
      metrics,
      showStyleGuide,
    }),
  );
}

export function renderAddStudent(url: URL, sessionUser: SessionUser, showStyleGuide: boolean): Response {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  return htmlResponse(
    renderAddStudentPage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
      notice,
      error,
      showStyleGuide,
    }),
  );
}

export async function renderStudentPanelPartial(env: Env, url: URL, studentId: number, sessionUser: SessionUser): Promise<Response> {
  const selectedStudent = await getStudentById(env.DB, studentId);

  if (!selectedStudent) {
    return htmlFragmentResponse(renderEmptySelectedPanel("Student not found."), 404);
  }

  const logs = await listLogsForStudent(env.DB, studentId);
  const phaseAudit = await listPhaseAuditEntriesForStudent(env.DB, studentId);
  return htmlFragmentResponse(
    renderSelectedStudentPanel(selectedStudent, logs, phaseAudit, {
      canEdit: sessionUser.role !== "readonly",
      filters: getDashboardFilters(url.searchParams),
    }),
  );
}
