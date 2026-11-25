import type { SessionUser } from "../../auth";
import type { Env } from "../../app-env";
import { DEFAULT_TIME_ZONE } from "../../date-time";
import { resolveDashboardLanesForApp } from "../../dashboard-lanes";
import { htmlFragmentResponse, htmlResponse } from "../../http/response";
import { isPastTargetSubmissionDate, meetingStatusId } from "../../students";
import { canManageStudent, getStudentById, listLogsForStudent, listPhaseAuditEntriesForStudent, listStudents } from "../../students/store";
import { renderAddStudentPage, renderDashboardPage, renderEmptySelectedPanel, renderSelectedStudentPanel } from "../../views";
import { getDashboardFilters } from "./filters";

async function getWorkspaceHistory(env: Env, studentId: number, user: SessionUser) {
  const [logs, phaseAudit, canManage] = await Promise.all([
    listLogsForStudent(env.DB, studentId, user.id),
    listPhaseAuditEntriesForStudent(env.DB, studentId, user.id),
    user.canSupervise && user.role === "editor" ? canManageStudent(env.DB, studentId, user.id) : false,
  ]);
  return { logs, phaseAudit, canManage };
}

export async function renderDashboard(env: Env, url: URL, sessionUser: SessionUser, showStyleGuide: boolean): Promise<Response> {
  const filters = getDashboardFilters(url.searchParams);
  const [activeStudents, archivedStudents, dashboardLanes] = await Promise.all([
    listStudents(env.DB, { userId: sessionUser.id }),
    listStudents(env.DB, { onlyArchived: true, userId: sessionUser.id }),
    resolveDashboardLanesForApp(env),
  ]);
  const students = filters.scope === "archived" ? archivedStudents : activeStudents;
  const timeZone = DEFAULT_TIME_ZONE;

  const selectedIdParam = url.searchParams.get("selected");
  const parsedSelectedId = selectedIdParam ? Number.parseInt(selectedIdParam, 10) : 0;
  const selectedId = Number.isFinite(parsedSelectedId) ? parsedSelectedId : 0;
  const selectedStudent = students.find((student) => student.id === selectedId) || null;
  const { logs, phaseAudit, canManage } = selectedStudent
    ? await getWorkspaceHistory(env, selectedStudent.id, sessionUser)
    : { logs: [], phaseAudit: [], canManage: false };

  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  const today = new Date().toISOString().slice(0, 10);
  const metrics = {
    total: students.length,
    noMeeting: students.filter((student) => meetingStatusId(student) === "not_booked").length,
    pastTarget: students.filter((student) => isPastTargetSubmissionDate(student, today)).length,
    submitted: students.filter((student) => student.currentPhase === "submitted").length,
  };

  return htmlResponse(
    renderDashboardPage({
      viewer: sessionUser,
      students,
      canManageSelected: canManage,
      selectedStudent,
      logs,
      phaseAudit,
      dashboardLanes,
      filters,
      notice,
      error,
      metrics,
      activeStudentCount: activeStudents.length,
      archivedStudentCount: archivedStudents.length,
      timeZone,
      showStyleGuide,
    }),
  );
}

export async function renderAddStudent(env: Env, url: URL, sessionUser: SessionUser, showStyleGuide: boolean): Promise<Response> {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");
  const dashboardLanes = await resolveDashboardLanesForApp(env);

  return htmlResponse(
    renderAddStudentPage({
      viewer: sessionUser,
      dashboardLanes,
      notice,
      error,
      showStyleGuide,
    }),
  );
}

export async function renderStudentPanelPartial(env: Env, url: URL, studentId: number, sessionUser: SessionUser): Promise<Response> {
  const filters = getDashboardFilters(url.searchParams);
  const [selectedStudent, dashboardLanes] = await Promise.all([
    getStudentById(env.DB, studentId, { onlyArchived: filters.scope === "archived", userId: sessionUser.id }),
    resolveDashboardLanesForApp(env),
  ]);

  if (!selectedStudent) {
    return htmlFragmentResponse(renderEmptySelectedPanel("Student not found."), 404);
  }

  const { logs, phaseAudit, canManage } = await getWorkspaceHistory(env, studentId, sessionUser);
  return htmlFragmentResponse(
    renderSelectedStudentPanel(selectedStudent, logs, phaseAudit, {
      canEdit: sessionUser.role === "editor",
      canManage,
      dashboardLanes,
      filters,
      timeZone: DEFAULT_TIME_ZONE,
    }),
  );
}
