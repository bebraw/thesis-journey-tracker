import styles from "./styles.css";
import favicon from "./favicon.ico";

type PhaseId =
  | "research_plan"
  | "researching"
  | "first_complete_draft"
  | "editing"
  | "submission_ready"
  | "submitted";

interface Phase {
  id: PhaseId;
  label: string;
}

interface Student {
  id: number;
  name: string;
  email: string | null;
  startDate: string;
  targetSubmissionDate: string;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  isMock: boolean;
  logCount: number;
  lastLogAt: string | null;
}

interface MeetingLog {
  id: number;
  happenedAt: string;
  discussed: string;
  agreedPlan: string;
  nextStepDeadline: string | null;
  isMock: boolean;
}

interface Metrics {
  total: number;
  noMeeting: number;
  pastTarget: number;
  submitted: number;
}

interface DashboardPageData {
  students: Student[];
  selectedStudent: Student | null;
  logs: MeetingLog[];
  notice: string | null;
  error: string | null;
  metrics: Metrics;
}

interface SettingsPageData {
  showMockData: boolean;
  notice: string | null;
  error: string | null;
}

interface AddStudentPageData {
  notice: string | null;
  error: string | null;
}

type D1Value = string | number | null;

interface D1ExecMeta {
  last_row_id?: number | string;
  changes?: number;
}

interface D1ExecResult {
  success: boolean;
  meta: D1ExecMeta;
}

interface D1AllResult<T> {
  results: T[];
}

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>;
  run(): Promise<D1ExecResult>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  DB: D1Database;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
}

interface StudentRow {
  id: number;
  name: string;
  email: string | null;
  start_date: string;
  target_submission_date: string;
  current_phase: PhaseId;
  next_meeting_at: string | null;
  is_mock: number;
  log_count: number | string | null;
  last_log_at: string | null;
}

interface LogRow {
  id: number;
  happened_at: string;
  discussed: string;
  agreed_plan: string;
  next_step_deadline: string | null;
  is_mock: number;
}

const SESSION_COOKIE = "thesis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const PHASES: Phase[] = [
  { id: "research_plan", label: "Planning research" },
  { id: "researching", label: "Researching" },
  { id: "first_complete_draft", label: "First complete draft" },
  { id: "editing", label: "Editing" },
  { id: "submission_ready", label: "Draft ready to submit" },
  { id: "submitted", label: "Submitted" }
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Unhandled error", error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/styles.css") {
    return cssResponse(styles);
  }

  if (pathname === "/favicon.ico") {
    return iconResponse(favicon);
  }

  if (!env.DB) {
    return new Response("D1 binding is missing. Configure DB in wrangler.toml.", { status: 500 });
  }

  if (!env.APP_PASSWORD || !env.SESSION_SECRET) {
    return new Response("APP_PASSWORD and SESSION_SECRET must be configured.", { status: 500 });
  }

  if (pathname === "/login" && request.method === "GET") {
    if (await isAuthenticated(request, env)) {
      return redirect("/");
    }
    const showError = url.searchParams.get("error") === "1";
    return htmlResponse(renderLoginPage(showError));
  }

  if (pathname === "/login" && request.method === "POST") {
    const formData = await request.formData();
    const password = (formData.get("password") || "").toString();
    if (password !== env.APP_PASSWORD) {
      return redirect("/login?error=1");
    }

    const token = await createSessionToken(env.SESSION_SECRET);
    return redirect("/", { "Set-Cookie": buildSessionCookie(token, request.url) });
  }

  if (pathname === "/logout" && request.method === "POST") {
    return redirect("/login", { "Set-Cookie": clearSessionCookie(request.url) });
  }

  const authenticated = await isAuthenticated(request, env);
  if (!authenticated) {
    return redirect("/login");
  }

  if (pathname === "/" && request.method === "GET") {
    return await renderDashboard(request, env, url);
  }

  if (pathname === "/settings" && request.method === "GET") {
    return await renderSettings(env, url);
  }

  if (pathname === "/students/new" && request.method === "GET") {
    return renderAddStudent(url);
  }

  if (pathname === "/actions/add-student" && request.method === "POST") {
    return await handleAddStudent(request, env);
  }

  if (pathname === "/actions/toggle-mock" && request.method === "POST") {
    return await handleToggleMock(request, env);
  }

  const updateMatch = pathname.match(/^\/actions\/update-student\/(\d+)$/);
  if (updateMatch && request.method === "POST") {
    return await handleUpdateStudent(request, env, Number(updateMatch[1]));
  }

  const addLogMatch = pathname.match(/^\/actions\/add-log\/(\d+)$/);
  if (addLogMatch && request.method === "POST") {
    return await handleAddLog(request, env, Number(addLogMatch[1]));
  }

  return new Response("Not found", { status: 404 });
}

async function renderDashboard(request: Request, env: Env, url: URL): Promise<Response> {
  const showMockData = await getShowMockData(env.DB);
  const students = await listStudents(env.DB, showMockData);

  const selectedId = Number(url.searchParams.get("selected") || 0);
  const selectedStudent = students.find((student) => student.id === selectedId) || null;
  const logs = selectedStudent ? await listLogsForStudent(env.DB, selectedStudent.id, showMockData) : [];

  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  const today = new Date().toISOString().slice(0, 10);
  const metrics = {
    total: students.length,
    noMeeting: students.filter((student) => !student.nextMeetingAt).length,
    pastTarget: students.filter(
      (student) => student.targetSubmissionDate < today && student.currentPhase !== "submitted"
    ).length,
    submitted: students.filter((student) => student.currentPhase === "submitted").length
  };

  return htmlResponse(
    renderDashboardPage({
      students,
      selectedStudent,
      logs,
      notice,
      error,
      metrics
    })
  );
}

async function renderSettings(env: Env, url: URL): Promise<Response> {
  const showMockData = await getShowMockData(env.DB);
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  return htmlResponse(
    renderSettingsPage({
      showMockData,
      notice,
      error
    })
  );
}

function renderAddStudent(url: URL): Response {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  return htmlResponse(
    renderAddStudentPage({
      notice,
      error
    })
  );
}

async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();

  const name = normalizeString(formData.get("name"));
  const email = normalizeString(formData.get("email"));
  const startDate = normalizeDate(formData.get("startDate"));
  const targetSubmissionDateInput = normalizeDate(formData.get("targetSubmissionDate"), true);
  const targetSubmissionDate =
    targetSubmissionDateInput || (typeof startDate === "string" ? addSixMonths(startDate) : null);
  const currentPhase = normalizePhase(formData.get("currentPhase") || "research_plan");
  const nextMeetingAt = normalizeDateTime(formData.get("nextMeetingAt"), true);

  if (!name || !startDate || !targetSubmissionDate || !currentPhase || nextMeetingAt === undefined) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  const result = await env.DB.prepare(
    `INSERT INTO students (name, email, start_date, target_submission_date, current_phase, next_meeting_at, is_mock)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  )
    .bind(name, email, startDate, targetSubmissionDate, currentPhase, nextMeetingAt)
    .run();

  const selected = Number(result.meta.last_row_id ?? 0);
  return redirect(`/?selected=${selected}&notice=Student+added`);
}

async function handleUpdateStudent(request: Request, env: Env, studentId: number): Promise<Response> {
  const formData = await request.formData();

  const name = normalizeString(formData.get("name"));
  const email = normalizeString(formData.get("email"));
  const startDate = normalizeDate(formData.get("startDate"));
  const targetSubmissionDate = normalizeDate(formData.get("targetSubmissionDate"));
  const currentPhase = normalizePhase(formData.get("currentPhase"));
  const nextMeetingAt = normalizeDateTime(formData.get("nextMeetingAt"), true);

  if (!name || !startDate || !targetSubmissionDate || !currentPhase || nextMeetingAt === undefined) {
    return redirect(`/?selected=${studentId}&error=Invalid+update+input`);
  }

  const row = await env.DB.prepare("SELECT id FROM students WHERE id = ?").bind(studentId).first();
  if (!row) {
    return redirect("/?error=Student+not+found");
  }

  await env.DB.prepare(
    `UPDATE students
     SET name = ?, email = ?, start_date = ?, target_submission_date = ?, current_phase = ?, next_meeting_at = ?
     WHERE id = ?`
  )
    .bind(name, email, startDate, targetSubmissionDate, currentPhase, nextMeetingAt, studentId)
    .run();

  return redirect(`/?selected=${studentId}&notice=Student+updated`);
}

async function handleAddLog(request: Request, env: Env, studentId: number): Promise<Response> {
  const formData = await request.formData();

  const happenedAt = normalizeDateTime(formData.get("happenedAt"), true) || new Date().toISOString();
  const discussed = normalizeString(formData.get("discussed"));
  const agreedPlan = normalizeString(formData.get("agreedPlan"));
  const nextStepDeadline = normalizeDate(formData.get("nextStepDeadline"), true);

  if (!discussed || !agreedPlan || nextStepDeadline === undefined) {
    return redirect(`/?selected=${studentId}&error=Invalid+log+input`);
  }

  const row = await env.DB.prepare("SELECT id FROM students WHERE id = ?").bind(studentId).first();
  if (!row) {
    return redirect("/?error=Student+not+found");
  }

  await env.DB.prepare(
    `INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
     VALUES (?, ?, ?, ?, ?, 0)`
  )
    .bind(studentId, happenedAt, discussed, agreedPlan, nextStepDeadline)
    .run();

  return redirect(`/?selected=${studentId}&notice=Log+saved`);
}

async function handleToggleMock(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const showMockData = formData.get("showMockData") === "1";

  await env.DB.prepare(
    `INSERT INTO settings (key, value)
     VALUES ('show_mock_data', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
    .bind(showMockData ? "1" : "0")
    .run();

  return redirect(`/settings?notice=Mock+data+visibility+updated`);
}

async function getShowMockData(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = 'show_mock_data'`)
    .first<{ value: string }>();
  return row ? row.value === "1" : false;
}

async function listStudents(db: D1Database, showMockData: boolean): Promise<Student[]> {
  const includeMock = showMockData ? 1 : 0;
  const rows = await db
    .prepare(
      `SELECT
         s.*,
         COUNT(ml.id) AS log_count,
         MAX(ml.happened_at) AS last_log_at
       FROM students s
       LEFT JOIN meeting_logs ml
         ON ml.student_id = s.id
        AND (? = 1 OR ml.is_mock = 0)
       WHERE (? = 1 OR s.is_mock = 0)
       GROUP BY s.id
       ORDER BY
         CASE WHEN s.next_meeting_at IS NULL THEN 1 ELSE 0 END,
         s.next_meeting_at ASC,
         s.target_submission_date ASC,
         s.name ASC`
    )
    .bind(includeMock, includeMock)
    .all<StudentRow>();

  return rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    startDate: row.start_date,
    targetSubmissionDate: row.target_submission_date,
    currentPhase: row.current_phase as PhaseId,
    nextMeetingAt: row.next_meeting_at,
    isMock: Boolean(row.is_mock),
    logCount: Number(row.log_count || 0),
    lastLogAt: row.last_log_at || null
  }));
}

async function listLogsForStudent(
  db: D1Database,
  studentId: number,
  showMockData: boolean
): Promise<MeetingLog[]> {
  const includeMock = showMockData ? 1 : 0;
  const rows = await db
    .prepare(
      `SELECT *
       FROM meeting_logs
       WHERE student_id = ?
         AND (? = 1 OR is_mock = 0)
       ORDER BY happened_at DESC, id DESC`
    )
    .bind(studentId, includeMock)
    .all<LogRow>();

  return rows.results.map((row) => ({
    id: row.id,
    happenedAt: row.happened_at,
    discussed: row.discussed,
    agreedPlan: row.agreed_plan,
    nextStepDeadline: row.next_step_deadline,
    isMock: Boolean(row.is_mock)
  }));
}

function renderDashboardPage(data: DashboardPageData): string {
  const {
    students,
    selectedStudent,
    logs,
    notice,
    error,
    metrics
  } = data;

  const phaseFilterOptions = [
    '<option value="">All phases</option>',
    ...PHASES.map((phase) => `<option value="${phase.id}">${phase.label}</option>`)
  ].join("");
  const phaseLaneCards = PHASES.map((phase) => {
    const laneStudents = students
      .filter((student) => student.currentPhase === phase.id)
      .slice()
      .sort(
        (a, b) =>
          a.targetSubmissionDate.localeCompare(b.targetSubmissionDate) || a.name.localeCompare(b.name)
      );

    const laneStudentItems = laneStudents.length
      ? laneStudents
          .map(
            (student) => `
            <li class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div class="flex items-start justify-between gap-2">
                <a href="/?selected=${student.id}" class="font-medium text-slate-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-slate-100 dark:focus-visible:ring-offset-slate-900">${escapeHtml(student.name)}</a>
                ${student.isMock ? '<span class="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">Mock</span>' : ""}
              </div>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Target: ${escapeHtml(student.targetSubmissionDate)}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">${student.nextMeetingAt ? `Next: ${escapeHtml(formatDateTime(student.nextMeetingAt))}` : "Next: not booked"}</p>
              <p class="mt-2"><span class="rounded px-2 py-1 text-xs ${meetingStatusClass(student)}">${meetingStatusText(student)}</span></p>
            </li>
          `
          )
          .join("")
      : '<li class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-300">No students in this phase.</li>';

    return `
      <article class="snap-start rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 min-h-[14rem]">
        <div class="flex items-start justify-between gap-3">
          <h3 class="min-h-10 flex-1 text-sm font-semibold leading-5">${escapeHtml(phase.label)}</h3>
          <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">${laneStudents.length}</span>
        </div>
        <ul class="mt-3 space-y-2">${laneStudentItems}</ul>
      </article>
    `;
  }).join("");

  const studentRows = students.length
    ? students
        .map((student) => {
          const statusText = meetingStatusText(student);
          const statusId = meetingStatusId(student);
          const selectedClass =
            selectedStudent && selectedStudent.id === student.id
              ? "bg-blue-50 dark:bg-blue-900/20"
              : "";
          return `
            <tr
              class="${selectedClass}"
              data-student-row
              data-name="${escapeHtml(student.name).toLowerCase()}"
              data-email="${escapeHtml(student.email || "").toLowerCase()}"
              data-phase="${escapeHtml(student.currentPhase)}"
              data-status-id="${statusId}"
              data-target-date="${escapeHtml(student.targetSubmissionDate)}"
              data-next-meeting-date="${escapeHtml(student.nextMeetingAt || "")}"
            >
              <td class="px-2 py-2 align-top">
                <div class="font-medium">
                  ${escapeHtml(student.name)}
                  ${selectedStudent && selectedStudent.id === student.id ? '<span class="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">Selected</span>' : ""}
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-300">${escapeHtml(student.email || "-")}</div>
                ${student.isMock ? '<span class="mt-1 inline-block rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">Mock</span>' : ""}
              </td>
              <td class="px-2 py-2 align-top">${escapeHtml(getPhaseLabel(student.currentPhase))}</td>
              <td class="px-2 py-2 align-top">${escapeHtml(student.targetSubmissionDate)}</td>
              <td class="px-2 py-2 align-top">${student.nextMeetingAt ? escapeHtml(formatDateTime(student.nextMeetingAt)) : "Not booked"}</td>
              <td class="px-2 py-2 align-top"><span class="rounded px-2 py-1 text-xs ${meetingStatusClass(student)}">${statusText}</span></td>
              <td class="px-2 py-2 align-top">${student.logCount}</td>
              <td class="px-2 py-2 align-top">
                <a class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900" href="/?selected=${student.id}">View & Edit</a>
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="7" class="px-2 py-3 text-sm text-slate-500 dark:text-slate-300">No students yet.</td></tr>';

  const selectedPanel = selectedStudent
    ? renderSelectedStudentPanel(selectedStudent, logs)
    : `
      <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="text-lg font-semibold">Student Details & Logs</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Select a student from the table to edit details and view/add supervision logs.</p>
      </article>
    `;

  return `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thesis Journey Tracker</title>
    <script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="min-h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold">MSc Thesis Journey Tracker</h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">Track phases, next meetings, and supervision logs in one place.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <a href="/students/new" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">Add student</a>
          <a href="/settings" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Settings</a>
          <button
            id="themeToggle"
            type="button"
            title="Switch to dark mode"
            aria-label="Switch to dark mode"
            class="inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            <svg class="h-5 w-5 text-slate-700 dark:hidden dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="hidden h-5 w-5 text-slate-700 dark:block dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <form action="/logout" method="post">
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Log out</button>
          </form>
        </div>
      </header>

      ${
        notice
          ? `<p role="status" aria-live="polite" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200">${escapeHtml(
              notice
            )}</p>`
          : ""
      }
      ${
        error
          ? `<p role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">${escapeHtml(
              error
            )}</p>`
          : ""
      }

      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p class="text-sm text-slate-500 dark:text-slate-300">Students tracked</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.total}</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p class="text-sm text-slate-500 dark:text-slate-300">Meetings not booked</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.noMeeting}</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p class="text-sm text-slate-500 dark:text-slate-300">Past six-month target</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.pastTarget}</p>
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p class="text-sm text-slate-500 dark:text-slate-300">Submitted</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.submitted}</p>
        </article>
      </section>

      <section class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold">Phase Lanes</h2>
          <p class="text-xs text-slate-500 dark:text-slate-300">Overview of where students currently are in the thesis process.</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          ${phaseLaneCards}
        </div>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
          <div class="mb-4">
            <h2 class="text-lg font-semibold">Students</h2>
            <p class="text-xs text-slate-500 dark:text-slate-300">Use filters to quickly find students that need attention.</p>
          </div>
          <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              Search
              <input id="studentSearch" type="search" placeholder="Name or email" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
            </label>
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              Phase
              <select id="phaseFilter" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">${phaseFilterOptions}</select>
            </label>
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              Meeting status
              <select id="statusFilter" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
                <option value="">All statuses</option>
                <option value="not_booked">Not booked</option>
                <option value="overdue">Overdue</option>
                <option value="within_2_weeks">Within 2 weeks</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </label>
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              Sort by
              <select id="sortBy" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
                <option value="nextMeetingAsc">Next meeting (earliest)</option>
                <option value="targetAsc">Target date (earliest)</option>
                <option value="nameAsc">Name (A-Z)</option>
                <option value="statusPriority">Status priority</option>
              </select>
            </label>
          </div>
          <p id="studentResultsMeta" class="mb-2 text-xs text-slate-500 dark:text-slate-300"></p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[58rem] divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  <th class="px-2 py-2">Student</th>
                  <th class="px-2 py-2">Phase</th>
                  <th class="px-2 py-2">Target</th>
                  <th class="px-2 py-2">Next meeting (local)</th>
                  <th class="px-2 py-2">Status</th>
                  <th class="px-2 py-2">Logs</th>
                  <th class="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody id="studentsTableBody" class="divide-y divide-slate-100 dark:divide-slate-800">${studentRows}</tbody>
            </table>
          </div>
        </article>
        ${selectedPanel}
      </section>
    </div>

    <script>
      var themeToggle = document.getElementById("themeToggle");
      var root = document.documentElement;
      var tableBody = document.getElementById("studentsTableBody");
      var studentRows = Array.prototype.slice.call(document.querySelectorAll("[data-student-row]"));
      var searchInput = document.getElementById("studentSearch");
      var phaseFilter = document.getElementById("phaseFilter");
      var statusFilter = document.getElementById("statusFilter");
      var sortBy = document.getElementById("sortBy");
      var studentResultsMeta = document.getElementById("studentResultsMeta");

      function syncThemeToggleAccessibility() {
        var nextMode = root.classList.contains("dark") ? "light" : "dark";
        var label = "Switch to " + nextMode + " mode";
        themeToggle.setAttribute("title", label);
        themeToggle.setAttribute("aria-label", label);
      }

      function toTimestamp(value) {
        if (!value) return Number.POSITIVE_INFINITY;
        var ts = Date.parse(value);
        return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
      }

      function statusPriority(statusId) {
        if (statusId === "overdue") return 0;
        if (statusId === "not_booked") return 1;
        if (statusId === "within_2_weeks") return 2;
        if (statusId === "scheduled") return 3;
        return 4;
      }

      function applyStudentSort() {
        if (!tableBody || !sortBy || studentRows.length === 0) return;
        var mode = sortBy.value;
        studentRows.sort(function (a, b) {
          if (mode === "nameAsc") {
            return (a.getAttribute("data-name") || "").localeCompare(b.getAttribute("data-name") || "");
          }
          if (mode === "targetAsc") {
            return toTimestamp(a.getAttribute("data-target-date")) - toTimestamp(b.getAttribute("data-target-date"));
          }
          if (mode === "statusPriority") {
            return statusPriority(a.getAttribute("data-status-id") || "") - statusPriority(b.getAttribute("data-status-id") || "");
          }
          return toTimestamp(a.getAttribute("data-next-meeting-date")) - toTimestamp(b.getAttribute("data-next-meeting-date"));
        });

        studentRows.forEach(function (row) {
          tableBody.appendChild(row);
        });
      }

      function applyStudentFilters() {
        var query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        var phase = phaseFilter ? phaseFilter.value : "";
        var status = statusFilter ? statusFilter.value : "";
        var visibleCount = 0;

        studentRows.forEach(function (row) {
          var name = row.getAttribute("data-name") || "";
          var email = row.getAttribute("data-email") || "";
          var rowPhase = row.getAttribute("data-phase") || "";
          var rowStatus = row.getAttribute("data-status-id") || "";

          var matchesQuery = !query || name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
          var matchesPhase = !phase || rowPhase === phase;
          var matchesStatus = !status || rowStatus === status;
          var visible = matchesQuery && matchesPhase && matchesStatus;

          row.style.display = visible ? "" : "none";
          if (visible) visibleCount += 1;
        });

        if (studentResultsMeta) {
          studentResultsMeta.textContent = "Showing " + visibleCount + " of " + studentRows.length + " students";
        }
      }

      function refreshStudentTable() {
        applyStudentSort();
        applyStudentFilters();
      }

      syncThemeToggleAccessibility();
      refreshStudentTable();

      themeToggle.addEventListener("click", function () {
        root.classList.toggle("dark");
        localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
        syncThemeToggleAccessibility();
      });

      if (searchInput) searchInput.addEventListener("input", applyStudentFilters);
      if (phaseFilter) phaseFilter.addEventListener("change", applyStudentFilters);
      if (statusFilter) statusFilter.addEventListener("change", applyStudentFilters);
      if (sortBy) sortBy.addEventListener("change", refreshStudentTable);
    </script>
  </body>
</html>`;
}

function renderSettingsPage(data: SettingsPageData): string {
  const { showMockData, notice, error } = data;

  return `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thesis Journey Tracker - Settings</title>
    <script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="min-h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold">Settings</h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">Manage application preferences for your supervision dashboard.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <a href="/" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Dashboard</a>
          <button
            id="themeToggle"
            type="button"
            title="Switch to dark mode"
            aria-label="Switch to dark mode"
            class="inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            <svg class="h-5 w-5 text-slate-700 dark:hidden dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="hidden h-5 w-5 text-slate-700 dark:block dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <form action="/logout" method="post">
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Log out</button>
          </form>
        </div>
      </header>

      ${
        notice
          ? `<p role="status" aria-live="polite" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200">${escapeHtml(
              notice
            )}</p>`
          : ""
      }
      ${
        error
          ? `<p role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">${escapeHtml(
              error
            )}</p>`
          : ""
      }

      <section class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="text-lg font-semibold">Data & Privacy</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Control whether seeded mock students and logs are visible in your dashboard.</p>
        <form action="/actions/toggle-mock" method="post" class="mt-4 space-y-4">
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" name="showMockData" value="1" class="h-4 w-4" ${showMockData ? "checked" : ""} />
            Show seeded mock data
          </label>
          <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">Save settings</button>
        </form>
      </section>
    </div>

    <script>
      var themeToggle = document.getElementById("themeToggle");
      var root = document.documentElement;

      function syncThemeToggleAccessibility() {
        var nextMode = root.classList.contains("dark") ? "light" : "dark";
        var label = "Switch to " + nextMode + " mode";
        themeToggle.setAttribute("title", label);
        themeToggle.setAttribute("aria-label", label);
      }

      syncThemeToggleAccessibility();

      themeToggle.addEventListener("click", function () {
        root.classList.toggle("dark");
        localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
        syncThemeToggleAccessibility();
      });
    </script>
  </body>
</html>`;
}

function renderAddStudentPage(data: AddStudentPageData): string {
  const { notice, error } = data;
  const phaseOptions = PHASES.map(
    (phase) => `<option value="${phase.id}">${phase.label}</option>`
  ).join("");

  return `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thesis Journey Tracker - Add Student</title>
    <script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="min-h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold">Add Student</h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">Create a new thesis supervision entry.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <a href="/" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Dashboard</a>
          <a href="/settings" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Settings</a>
          <button
            id="themeToggle"
            type="button"
            title="Switch to dark mode"
            aria-label="Switch to dark mode"
            class="inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            <svg class="h-5 w-5 text-slate-700 dark:hidden dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="hidden h-5 w-5 text-slate-700 dark:block dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <form action="/logout" method="post">
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Log out</button>
          </form>
        </div>
      </header>

      ${
        notice
          ? `<p role="status" aria-live="polite" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200">${escapeHtml(
              notice
            )}</p>`
          : ""
      }
      ${
        error
          ? `<p role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">${escapeHtml(
              error
            )}</p>`
          : ""
      }

      <section class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="text-lg font-semibold">Student Details</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Target submission defaults to six months from start date when left empty.</p>
        <form action="/actions/add-student" method="post" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label class="text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Name</span>
            <input name="name" required class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Email (optional)</span>
            <input name="email" type="email" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Phase</span>
            <select name="currentPhase" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">${phaseOptions}</select>
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Start date</span>
            <input name="startDate" type="date" required class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Target submission (optional)</span>
            <input name="targetSubmissionDate" type="date" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Next meeting (optional)</span>
            <input name="nextMeetingAt" type="datetime-local" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 sm:col-span-2 lg:col-span-3">Add student</button>
        </form>
      </section>
    </div>

    <script>
      var themeToggle = document.getElementById("themeToggle");
      var root = document.documentElement;

      function syncThemeToggleAccessibility() {
        var nextMode = root.classList.contains("dark") ? "light" : "dark";
        var label = "Switch to " + nextMode + " mode";
        themeToggle.setAttribute("title", label);
        themeToggle.setAttribute("aria-label", label);
      }

      syncThemeToggleAccessibility();

      themeToggle.addEventListener("click", function () {
        root.classList.toggle("dark");
        localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
        syncThemeToggleAccessibility();
      });
    </script>
  </body>
</html>`;
}

function renderSelectedStudentPanel(student: Student, logs: MeetingLog[]): string {
  const phaseOptions = PHASES.map((phase) => {
    const selected = phase.id === student.currentPhase ? "selected" : "";
    return `<option value="${phase.id}" ${selected}>${phase.label}</option>`;
  }).join("");

  const logsHtml = logs.length
    ? logs
        .map(
          (log) => `
          <article class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p class="font-medium">${escapeHtml(formatDateTime(log.happenedAt))} ${
              log.isMock
                ? '<span class="ml-2 rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">Mock</span>'
                : ""
            }</p>
            <p class="mt-1"><span class="font-medium">Discussed:</span> ${escapeHtml(log.discussed)}</p>
            <p class="mt-1"><span class="font-medium">Agreed:</span> ${escapeHtml(log.agreedPlan)}</p>
            ${
              log.nextStepDeadline
                ? `<p class="mt-1"><span class="font-medium">Next-step deadline:</span> ${escapeHtml(log.nextStepDeadline)}</p>`
                : ""
            }
          </article>
        `
        )
        .join("")
    : '<p class="rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">No entries yet.</p>';

  return `
    <article class="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <section>
        <h2 class="text-lg font-semibold">Edit Student</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">Currently viewing: ${escapeHtml(student.name)}</p>
        <form action="/actions/update-student/${student.id}" method="post" class="mt-3 space-y-3">
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Name</span>
            <input name="name" required value="${escapeHtml(student.name)}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Email</span>
            <input name="email" type="email" value="${escapeHtml(student.email || "")}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Phase</span>
            <select name="currentPhase" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">${phaseOptions}</select>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Start date</span>
            <input name="startDate" type="date" required value="${escapeHtml(student.startDate)}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Target submission date</span>
            <input name="targetSubmissionDate" type="date" required value="${escapeHtml(
              student.targetSubmissionDate
            )}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Next meeting</span>
            <input name="nextMeetingAt" type="datetime-local" value="${escapeHtml(
              toDateTimeLocalInput(student.nextMeetingAt)
            )}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <button type="submit" class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">Save student updates</button>
        </form>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Add Log Entry</h2>
        <form action="/actions/add-log/${student.id}" method="post" class="mt-3 space-y-3">
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Meeting date/time</span>
            <input name="happenedAt" type="datetime-local" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">What was discussed</span>
            <textarea name="discussed" required rows="3" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"></textarea>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Agreed plan / next actions</span>
            <textarea name="agreedPlan" required rows="3" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"></textarea>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Next-step deadline (optional)</span>
            <input name="nextStepDeadline" type="date" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <button type="submit" class="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">Save log entry</button>
        </form>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Meeting Log History</h2>
        <div class="mt-3 space-y-3">${logsHtml}</div>
      </section>
    </article>
  `;
}

function renderLoginPage(showError: boolean): string {
  return `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thesis Journey Tracker - Login</title>
    <script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <main class="mx-auto flex h-full max-w-md items-center px-6">
      <section class="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <h1 class="text-2xl font-semibold">Thesis Journey Tracker</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Private advisor dashboard login</p>
        ${
          showError
            ? '<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">Invalid password. Please try again.</p>'
            : ""
        }
        <form action="/login" method="post" class="mt-6 space-y-4">
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800" />
          <button type="submit" class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">Sign in</button>
        </form>
      </section>
    </main>
  </body>
</html>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function cssResponse(css: string): Response {
  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=86400"
    }
  });
}

function iconResponse(icon: ArrayBuffer): Response {
  return new Response(icon, {
    headers: {
      "content-type": "image/x-icon",
      "cache-control": "public, max-age=604800"
    }
  });
}

function normalizeString(value: FormDataEntryValue | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeDate(
  value: FormDataEntryValue | string | null | undefined,
  allowNull = false
): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return allowNull ? undefined : null;
  }
  return text;
}

function normalizeDateTime(
  value: FormDataEntryValue | string | null | undefined,
  allowNull = false
): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return allowNull ? undefined : null;
  }
  return date.toISOString();
}

function normalizePhase(value: FormDataEntryValue | string | null | undefined): PhaseId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return PHASES.some((phase) => phase.id === text) ? (text as PhaseId) : null;
}

function addSixMonths(dateText: string | null): string | null {
  if (!dateText) {
    return null;
  }
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return isoValue;
  }
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function toDateTimeLocalInput(isoValue: string | null): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function getPhaseLabel(phaseId: PhaseId): string {
  const phase = PHASES.find((item) => item.id === phaseId);
  return phase ? phase.label : phaseId;
}

function meetingStatusText(student: Student): string {
  if (!student.nextMeetingAt) {
    return "Not booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "Overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "Within 2 weeks";
  }
  return "Scheduled";
}

function meetingStatusId(student: Student): string {
  if (!student.nextMeetingAt) {
    return "not_booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "within_2_weeks";
  }
  return "scheduled";
}

function meetingStatusClass(student: Student): string {
  if (!student.nextMeetingAt) {
    return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function redirect(pathname: string, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers({ Location: pathname, ...extraHeaders });
  return new Response(null, { status: 302, headers });
}

function buildSessionCookie(token: string, requestUrl: string): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie(requestUrl: string): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${SESSION_COOKIE}=; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=0`;
}

async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = await hmacSign(payload, env.SESSION_SECRET);
  return timingSafeEqual(signature, expectedSignature);
}

function readCookie(cookieHeader: string, name: string): string | null {
  const items = cookieHeader.split(";");
  for (const item of items) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) {
      return valueParts.join("=");
    }
  }
  return null;
}

async function hmacSign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bufferToBase64Url(signatureBuffer);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
