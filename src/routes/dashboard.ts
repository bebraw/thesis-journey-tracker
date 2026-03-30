import { archiveStudent, createMeetingLog, createStudent, getStudentById, listLogsForStudent, listPhaseAuditEntriesForStudent, listStudents, studentExists, updateStudent, updateStudentWithPhaseAudit } from "../db";
import { parseStudentFormSubmission } from "../student-form";
import { htmlFragmentResponse, htmlResponse, isPastTargetSubmissionDate, normalizeDate, normalizeDateTime, normalizeString, redirect } from "../utils";
import { renderAddStudentPage, renderDashboardPage, renderEmptySelectedPanel, renderSelectedStudentPanel } from "../views";
import type { SessionUser } from "../auth";
import type { Env } from "../app-env";
import type { DashboardFilters } from "../view/types";

const DEFAULT_DASHBOARD_SORT_KEY = "nextMeeting";
const DEFAULT_DASHBOARD_SORT_DIRECTION: DashboardFilters["sortDirection"] = "asc";
const DASHBOARD_SORT_KEYS = new Set(["student", "degree", "phase", "target", "nextMeeting", "logs"]);

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

export async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const studentInput = parseStudentFormSubmission(formData, { mode: "create" });
  if (!studentInput) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  const selected = await createStudent(env.DB, studentInput);
  return redirect(`/?selected=${selected}&notice=Student+added`);
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

  await createMeetingLog(env.DB, {
    studentId,
    happenedAt,
    discussed,
    agreedPlan,
    nextStepDeadline,
  });

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Log saved" }));
}

export async function handleArchiveStudent(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request);
  if (!(await studentExists(env.DB, studentId))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  await archiveStudent(env.DB, studentId, new Date().toISOString());
  return redirect(appendDashboardMessage(returnPath, { notice: "Student archived" }));
}

export function getDashboardFilters(searchParams: URLSearchParams): DashboardFilters {
  const rawSortKey = searchParams.get("sort") || "";
  const rawSortDirection = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const sortKey = DASHBOARD_SORT_KEYS.has(rawSortKey) ? rawSortKey : DEFAULT_DASHBOARD_SORT_KEY;

  return {
    search: (searchParams.get("search") || "").trim(),
    degree: searchParams.get("degree") || "",
    phase: searchParams.get("phase") || "",
    status: searchParams.get("status") || "",
    sortKey,
    sortDirection: rawSortDirection,
  };
}

export function buildDashboardPath(filters: DashboardFilters, options: { selectedId?: number; notice?: string; error?: string } = {}): string {
  const searchParams = new URLSearchParams();

  if (options.selectedId) {
    searchParams.set("selected", String(options.selectedId));
  }
  if (filters.search) {
    searchParams.set("search", filters.search);
  }
  if (filters.degree) {
    searchParams.set("degree", filters.degree);
  }
  if (filters.phase) {
    searchParams.set("phase", filters.phase);
  }
  if (filters.status) {
    searchParams.set("status", filters.status);
  }
  if (filters.sortKey !== DEFAULT_DASHBOARD_SORT_KEY || filters.sortDirection !== DEFAULT_DASHBOARD_SORT_DIRECTION) {
    searchParams.set("sort", filters.sortKey);
    searchParams.set("dir", filters.sortDirection);
  }
  if (options.notice) {
    searchParams.set("notice", options.notice);
  }
  if (options.error) {
    searchParams.set("error", options.error);
  }

  const query = searchParams.toString();
  return query ? `/?${query}` : "/";
}

export function appendDashboardMessage(pathname: string, options: { selectedId?: number; notice?: string; error?: string }): string {
  const url = new URL(pathname, "https://dashboard.local");
  return buildDashboardPath(getDashboardFilters(url.searchParams), options);
}

export async function getDashboardReturnPath(request: Request, options: { selectedId?: number } = {}): Promise<string> {
  const formData = await request.clone().formData();
  return buildDashboardPath(parseDashboardReturnTo(formData.get("returnTo")), {
    selectedId: options.selectedId,
  });
}

function parseDashboardReturnTo(rawValue: FormDataEntryValue | null): DashboardFilters {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return getDashboardFilters(new URLSearchParams());
  }

  try {
    const url = new URL(rawValue, "https://dashboard.local");
    if (url.pathname !== "/") {
      return getDashboardFilters(new URLSearchParams());
    }
    return getDashboardFilters(url.searchParams);
  } catch {
    return getDashboardFilters(new URLSearchParams());
  }
}
