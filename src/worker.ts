import styles from "./styles.css";
import favicon from "./favicon.ico";
import {
  createMeetingLog,
  createStudent,
  deleteStudent,
  type D1Database,
  listLogsForStudent,
  listStudents,
  studentExists,
  type MeetingLog,
  type PhaseId,
  type Student,
  updateStudent,
} from "./db";

interface Phase {
  id: PhaseId;
  label: string;
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

interface AddStudentPageData {
  notice: string | null;
  error: string | null;
}

interface Env {
  DB: D1Database;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
  ENABLE_TEST_DATA?: string;
}

const SESSION_COOKIE = "thesis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const PHASES: Phase[] = [
  { id: "research_plan", label: "Planning research" },
  { id: "researching", label: "Researching" },
  { id: "first_complete_draft", label: "First complete draft" },
  { id: "editing", label: "Editing" },
  { id: "submission_ready", label: "Draft ready to submit" },
  { id: "submitted", label: "Submitted" },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Unhandled error", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
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
    return new Response(
      "D1 binding is missing. Configure DB in wrangler.toml.",
      { status: 500 },
    );
  }

  if (!env.APP_PASSWORD || !env.SESSION_SECRET) {
    return new Response("APP_PASSWORD and SESSION_SECRET must be configured.", {
      status: 500,
    });
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
    return redirect("/", {
      "Set-Cookie": buildSessionCookie(token, request.url),
    });
  }

  if (pathname === "/logout" && request.method === "POST") {
    return redirect("/login", {
      "Set-Cookie": clearSessionCookie(request.url),
    });
  }

  const authenticated = await isAuthenticated(request, env);
  if (!authenticated) {
    return redirect("/login");
  }

  if (pathname === "/" && request.method === "GET") {
    return await renderDashboard(request, env, url);
  }

  if (pathname === "/students/new" && request.method === "GET") {
    return renderAddStudent(url);
  }

  const partialStudentMatch = pathname.match(/^\/partials\/student\/(\d+)$/);
  if (partialStudentMatch && request.method === "GET") {
    return await renderStudentPanelPartial(env, Number(partialStudentMatch[1]));
  }

  if (pathname === "/actions/add-student" && request.method === "POST") {
    return await handleAddStudent(request, env);
  }

  const updateMatch = pathname.match(/^\/actions\/update-student\/(\d+)$/);
  if (updateMatch && request.method === "POST") {
    return await handleUpdateStudent(request, env, Number(updateMatch[1]));
  }

  const addLogMatch = pathname.match(/^\/actions\/add-log\/(\d+)$/);
  if (addLogMatch && request.method === "POST") {
    return await handleAddLog(request, env, Number(addLogMatch[1]));
  }

  const deleteMatch = pathname.match(/^\/actions\/delete-student\/(\d+)$/);
  if (deleteMatch && request.method === "POST") {
    return await handleDeleteStudent(env, Number(deleteMatch[1]));
  }

  return new Response("Not found", { status: 404 });
}

async function renderDashboard(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const includeTestData = shouldIncludeTestData(env);
  const students = await listStudents(env.DB, includeTestData);

  const selectedIdParam = url.searchParams.get("selected");
  const parsedSelectedId = selectedIdParam
    ? Number.parseInt(selectedIdParam, 10)
    : 0;
  const selectedId = Number.isFinite(parsedSelectedId) ? parsedSelectedId : 0;
  const selectedStudent =
    students.find((student) => student.id === selectedId) || null;
  const logs = selectedStudent
    ? await listLogsForStudent(env.DB, selectedStudent.id, includeTestData)
    : [];

  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  const today = new Date().toISOString().slice(0, 10);
  const metrics = {
    total: students.length,
    noMeeting: students.filter((student) => !student.nextMeetingAt).length,
    pastTarget: students.filter(
      (student) =>
        student.targetSubmissionDate < today &&
        student.currentPhase !== "submitted",
    ).length,
    submitted: students.filter(
      (student) => student.currentPhase === "submitted",
    ).length,
  };

  return htmlResponse(
    renderDashboardPage({
      students,
      selectedStudent,
      logs,
      notice,
      error,
      metrics,
    }),
  );
}

function renderAddStudent(url: URL): Response {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  return htmlResponse(
    renderAddStudentPage({
      notice,
      error,
    }),
  );
}

async function renderStudentPanelPartial(
  env: Env,
  studentId: number,
): Promise<Response> {
  const includeTestData = shouldIncludeTestData(env);
  const students = await listStudents(env.DB, includeTestData);
  const selectedStudent =
    students.find((student) => student.id === studentId) || null;

  if (!selectedStudent) {
    return htmlFragmentResponse(
      renderEmptySelectedPanel("Student not found."),
      404,
    );
  }

  const logs = await listLogsForStudent(env.DB, studentId, includeTestData);
  return htmlFragmentResponse(
    renderSelectedStudentPanel(selectedStudent, logs),
  );
}

async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();

  const name = normalizeString(formData.get("name"));
  const email = normalizeString(
    formData.get("studentEmail") ?? formData.get("email"),
  );
  const startDate = normalizeDate(formData.get("startDate"));
  const targetSubmissionDateInput = normalizeDate(
    formData.get("targetSubmissionDate"),
    true,
  );
  const targetSubmissionDate =
    targetSubmissionDateInput ||
    (typeof startDate === "string" ? addSixMonths(startDate) : null);
  const currentPhase = normalizePhase(
    formData.get("currentPhase") || "research_plan",
  );
  const nextMeetingAt = normalizeDateTime(formData.get("nextMeetingAt"), true);

  if (
    !name ||
    !startDate ||
    !targetSubmissionDate ||
    !currentPhase ||
    nextMeetingAt === undefined
  ) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  const selected = await createStudent(env.DB, {
    name,
    email,
    startDate,
    targetSubmissionDate,
    currentPhase,
    nextMeetingAt,
  });
  return redirect(`/?selected=${selected}&notice=Student+added`);
}

async function handleUpdateStudent(
  request: Request,
  env: Env,
  studentId: number,
): Promise<Response> {
  const formData = await request.formData();

  const name = normalizeString(formData.get("name"));
  const email = normalizeString(
    formData.get("studentEmail") ?? formData.get("email"),
  );
  const startDate = normalizeDate(formData.get("startDate"));
  const targetSubmissionDate = normalizeDate(
    formData.get("targetSubmissionDate"),
  );
  const currentPhase = normalizePhase(formData.get("currentPhase"));
  const nextMeetingAt = normalizeDateTime(formData.get("nextMeetingAt"), true);

  if (
    !name ||
    !startDate ||
    !targetSubmissionDate ||
    !currentPhase ||
    nextMeetingAt === undefined
  ) {
    return redirect(`/?selected=${studentId}&error=Invalid+update+input`);
  }

  if (!(await studentExists(env.DB, studentId))) {
    return redirect("/?error=Student+not+found");
  }

  await updateStudent(env.DB, studentId, {
    name,
    email,
    startDate,
    targetSubmissionDate,
    currentPhase,
    nextMeetingAt,
  });

  return redirect(`/?selected=${studentId}&notice=Student+updated`);
}

async function handleAddLog(
  request: Request,
  env: Env,
  studentId: number,
): Promise<Response> {
  const formData = await request.formData();

  const happenedAt =
    normalizeDateTime(formData.get("happenedAt"), true) ||
    new Date().toISOString();
  const discussed = normalizeString(formData.get("discussed"));
  const agreedPlan = normalizeString(formData.get("agreedPlan"));
  const nextStepDeadline = normalizeDate(
    formData.get("nextStepDeadline"),
    true,
  );

  if (!discussed || !agreedPlan || nextStepDeadline === undefined) {
    return redirect(`/?selected=${studentId}&error=Invalid+log+input`);
  }

  if (!(await studentExists(env.DB, studentId))) {
    return redirect("/?error=Student+not+found");
  }

  await createMeetingLog(env.DB, {
    studentId,
    happenedAt,
    discussed,
    agreedPlan,
    nextStepDeadline,
  });

  return redirect(`/?selected=${studentId}&notice=Log+saved`);
}

async function handleDeleteStudent(
  env: Env,
  studentId: number,
): Promise<Response> {
  if (!(await studentExists(env.DB, studentId))) {
    return redirect("/?error=Student+not+found");
  }

  await deleteStudent(env.DB, studentId);
  return redirect("/?notice=Student+deleted");
}

function renderDashboardPage(data: DashboardPageData): string {
  const { students, selectedStudent, logs, notice, error, metrics } = data;

  const phaseFilterOptions = [
    '<option value="">All phases</option>',
    ...PHASES.map(
      (phase) => `<option value="${phase.id}">${phase.label}</option>`,
    ),
  ].join("");
  const phaseLaneCards = PHASES.map((phase) => {
    const laneStudents = students
      .filter((student) => student.currentPhase === phase.id)
      .slice()
      .sort(
        (a, b) =>
          a.targetSubmissionDate.localeCompare(b.targetSubmissionDate) ||
          a.name.localeCompare(b.name),
      );

    const laneStudentItems = laneStudents.length
      ? laneStudents
          .map((student) => {
            const isLaneSelected =
              selectedStudent && selectedStudent.id === student.id;
            const laneSelectedClass = isLaneSelected
              ? " ring-2 ring-blue-400/60 dark:ring-blue-400/40"
              : "";
            return `
            <li class="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors dark:border-slate-700 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-500 cursor-pointer${laneSelectedClass}" data-lane-student-card data-student-id="${student.id}" aria-selected="${isLaneSelected ? "true" : "false"}" tabindex="0">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <a href="/?selected=${student.id}" data-inline-select="1" data-lane-select="1" data-student-id="${student.id}" class="min-w-0 flex-1 break-words font-medium text-slate-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-slate-100 dark:focus-visible:ring-offset-slate-900">${escapeHtml(student.name)}</a>
                <div class="flex max-w-full flex-wrap justify-end gap-1">
                  ${student.isMock ? '<span class="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">Mock</span>' : ""}
                </div>
              </div>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Target: ${escapeHtml(student.targetSubmissionDate)}</p>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">${student.nextMeetingAt ? `Next: ${escapeHtml(formatDateTime(student.nextMeetingAt))}` : "Next: not booked"}</p>
              <p class="mt-2"><span class="rounded px-2 py-1 text-xs ${meetingStatusClass(student)}">${meetingStatusText(student)}</span></p>
            </li>
          `;
          })
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
          const isSelected =
            selectedStudent && selectedStudent.id === student.id;
          const selectedClass = isSelected
            ? "bg-blue-50 dark:bg-blue-900/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/35";
          return `
            <tr
              class="${selectedClass} cursor-pointer"
              data-student-row
              data-select-href="/?selected=${student.id}"
              data-student-id="${student.id}"
              data-name="${escapeHtml(student.name).toLowerCase()}"
              data-email="${escapeHtml(student.email || "").toLowerCase()}"
              data-phase="${escapeHtml(student.currentPhase)}"
              data-status-id="${statusId}"
              data-target-date="${escapeHtml(student.targetSubmissionDate)}"
              data-next-meeting-date="${escapeHtml(student.nextMeetingAt || "")}"
              aria-selected="${isSelected ? "true" : "false"}"
              tabindex="0"
            >
              <td class="px-2 py-2 align-top">
                <div class="font-medium">
                  <a class="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900" href="/?selected=${student.id}" data-inline-select="1" data-student-id="${student.id}">${escapeHtml(student.name)}</a>
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
                <a class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800/70 dark:focus-visible:ring-offset-slate-900" href="/?selected=${student.id}" data-inline-select="1" data-student-id="${student.id}">View & Edit</a>
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="7" class="px-2 py-3 text-sm text-slate-500 dark:text-slate-300">No students yet.</td></tr>';

  const selectedPanel = selectedStudent
    ? renderSelectedStudentPanel(selectedStudent, logs)
    : renderEmptySelectedPanel();

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
              notice,
            )}</p>`
          : ""
      }
      ${
        error
          ? `<p role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">${escapeHtml(
              error,
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
          <p class="mb-2 text-xs text-slate-500 dark:text-slate-300">Tip: click a row to open student details.</p>
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
        <div id="selectedStudentPanel">${selectedPanel}</div>
      </section>
      <template id="emptySelectedStudentPanelTemplate">${renderEmptySelectedPanel()}</template>
    </div>

    <script>
      var themeToggle = document.getElementById("themeToggle");
      var root = document.documentElement;
      var tableBody = document.getElementById("studentsTableBody");
      var studentRows = Array.prototype.slice.call(document.querySelectorAll("[data-student-row]"));
      var laneStudentCards = Array.prototype.slice.call(document.querySelectorAll("[data-lane-student-card]"));
      var searchInput = document.getElementById("studentSearch");
      var phaseFilter = document.getElementById("phaseFilter");
      var statusFilter = document.getElementById("statusFilter");
      var sortBy = document.getElementById("sortBy");
      var studentResultsMeta = document.getElementById("studentResultsMeta");
      var selectedStudentPanel = document.getElementById("selectedStudentPanel");
      var emptySelectedStudentPanelTemplate = document.getElementById("emptySelectedStudentPanelTemplate");

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

      function getRowStudentId(row) {
        var value = row.getAttribute("data-student-id");
        var parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        return Number.isFinite(parsed) ? parsed : 0;
      }

      function getLaneStudentId(card) {
        var value = card.getAttribute("data-student-id");
        var parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        return Number.isFinite(parsed) ? parsed : 0;
      }

      function applySelectedRowState(selectedId) {
        studentRows.forEach(function (row) {
          var isSelected = selectedId > 0 && getRowStudentId(row) === selectedId;
          row.classList.toggle("bg-blue-50", isSelected);
          row.classList.toggle("dark:bg-blue-900/20", isSelected);
          row.classList.toggle("hover:bg-slate-50", !isSelected);
          row.classList.toggle("dark:hover:bg-slate-800/35", !isSelected);
          row.setAttribute("aria-selected", isSelected ? "true" : "false");

          var badge = row.querySelector("[data-selected-badge]");
          if (badge) {
            badge.classList.toggle("hidden", !isSelected);
          }
        });
      }

      function applySelectedLaneState(selectedId) {
        laneStudentCards.forEach(function (card) {
          var isSelected = selectedId > 0 && getLaneStudentId(card) === selectedId;
          card.classList.toggle("ring-2", isSelected);
          card.classList.toggle("ring-blue-400/60", isSelected);
          card.classList.toggle("dark:ring-blue-400/40", isSelected);
          card.setAttribute("aria-selected", isSelected ? "true" : "false");

          var badge = card.querySelector("[data-lane-selected-badge]");
          if (badge) {
            badge.classList.toggle("hidden", !isSelected);
          }
        });
      }

      function setEmptySelectedPanel() {
        if (!selectedStudentPanel || !emptySelectedStudentPanelTemplate) return;
        selectedStudentPanel.innerHTML = emptySelectedStudentPanelTemplate.innerHTML;
        applySelectedRowState(0);
        applySelectedLaneState(0);
      }

      async function selectStudentWithoutRefresh(studentId, pushHistory) {
        if (!studentId || !selectedStudentPanel) return;

        try {
          var response = await fetch("/partials/student/" + studentId, {
            headers: {
              "X-Requested-With": "fetch"
            }
          });
          if (!response.ok) {
            window.location.href = "/?selected=" + studentId;
            return;
          }

          var panelHtml = await response.text();
          selectedStudentPanel.innerHTML = panelHtml;
          applySelectedRowState(studentId);
          applySelectedLaneState(studentId);

          if (pushHistory) {
            var url = new URL(window.location.href);
            url.searchParams.set("selected", String(studentId));
            url.searchParams.delete("notice");
            url.searchParams.delete("error");
            window.history.pushState({ selectedId: studentId }, "", url.pathname + url.search);
          }
        } catch (_error) {
          window.location.href = "/?selected=" + studentId;
        }
      }

      function bindInlineSelectionLinks() {
        var inlineLinks = document.querySelectorAll("a[data-inline-select='1']");
        inlineLinks.forEach(function (link) {
          link.addEventListener("click", function (event) {
            event.preventDefault();
            var value = link.getAttribute("data-student-id");
            var parsed = value ? Number.parseInt(value, 10) : Number.NaN;
            if (!Number.isFinite(parsed)) return;
            void selectStudentWithoutRefresh(parsed, true);
          });
        });
      }

      function bindStudentRowSelection() {
        studentRows.forEach(function (row) {
          row.addEventListener("click", function (event) {
            var target = event.target;
            if (target && target.closest && target.closest("a[data-inline-select='1']")) {
              return;
            }
            if (target && target.closest && target.closest("button,input,select,textarea,label")) {
              return;
            }
            void selectStudentWithoutRefresh(getRowStudentId(row), true);
          });

          row.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            void selectStudentWithoutRefresh(getRowStudentId(row), true);
          });
        });
      }

      function bindLaneSelection() {
        laneStudentCards.forEach(function (card) {
          card.addEventListener("click", function (event) {
            var target = event.target;
            if (target && target.closest && target.closest("a[data-inline-select='1']")) {
              return;
            }
            if (target && target.closest && target.closest("button,input,select,textarea,label")) {
              return;
            }
            void selectStudentWithoutRefresh(getLaneStudentId(card), true);
          });

          card.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            void selectStudentWithoutRefresh(getLaneStudentId(card), true);
          });
        });
      }

      function bindHistorySelection() {
        window.addEventListener("popstate", function () {
          var selectedParam = new URL(window.location.href).searchParams.get("selected");
          var parsed = selectedParam ? Number.parseInt(selectedParam, 10) : Number.NaN;
          if (!Number.isFinite(parsed) || parsed <= 0) {
            setEmptySelectedPanel();
            return;
          }
          void selectStudentWithoutRefresh(parsed, false);
        });
      }

      syncThemeToggleAccessibility();
      refreshStudentTable();
      var initialSelectedParam = new URL(window.location.href).searchParams.get("selected");
      var initialSelected = initialSelectedParam ? Number.parseInt(initialSelectedParam, 10) : 0;
      var normalizedInitialSelected = Number.isFinite(initialSelected) ? initialSelected : 0;
      applySelectedRowState(normalizedInitialSelected);
      applySelectedLaneState(normalizedInitialSelected);
      bindInlineSelectionLinks();
      bindStudentRowSelection();
      bindLaneSelection();
      bindHistorySelection();

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

function renderAddStudentPage(data: AddStudentPageData): string {
  const { notice, error } = data;
  const phaseOptions = PHASES.map(
    (phase) => `<option value="${phase.id}">${phase.label}</option>`,
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
              notice,
            )}</p>`
          : ""
      }
      ${
        error
          ? `<p role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">${escapeHtml(
              error,
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
            <input name="studentEmail" type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
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

function renderEmptySelectedPanel(
  message = "Select a student from the table to edit details and view/add supervision logs.",
): string {
  return `
    <article class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 class="text-lg font-semibold">Student Details & Logs</h2>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(message)}</p>
    </article>
  `;
}

function renderSelectedStudentPanel(
  student: Student,
  logs: MeetingLog[],
): string {
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
        `,
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
            <input name="studentEmail" type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true" value="${escapeHtml(student.email || "")}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
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
              student.targetSubmissionDate,
            )}" class="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600 dark:text-slate-300">Next meeting</span>
            <input name="nextMeetingAt" type="datetime-local" value="${escapeHtml(
              toDateTimeLocalInput(student.nextMeetingAt),
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

      <section class="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
        <h2 class="text-lg font-semibold text-rose-900 dark:text-rose-100">Delete Student</h2>
        <p class="mt-1 text-sm text-rose-800 dark:text-rose-200">This removes the student and all related meeting log entries permanently.</p>
        <form
          action="/actions/delete-student/${student.id}"
          method="post"
          class="mt-4"
          onsubmit="return window.confirm('Delete ${escapeJsString(
            student.name,
          )}? This will also remove all supervision logs for this student.');"
        >
          <button
            type="submit"
            class="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            Delete student
          </button>
        </form>
      </section>
    </article>
  `;
}

function shouldIncludeTestData(env: Env): boolean {
  const value = env.ENABLE_TEST_DATA?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
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
      "cache-control": "no-store",
    },
  });
}

function htmlFragmentResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function cssResponse(css: string): Response {
  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

function iconResponse(icon: ArrayBuffer): Response {
  return new Response(icon, {
    headers: {
      "content-type": "image/x-icon",
      "cache-control": "public, max-age=604800",
    },
  });
}

function normalizeString(
  value: FormDataEntryValue | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeDate(
  value: FormDataEntryValue | string | null | undefined,
  allowNull = false,
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
  allowNull = false,
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

function normalizePhase(
  value: FormDataEntryValue | string | null | undefined,
): PhaseId | null {
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
    timeZoneName: "short",
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

function escapeJsString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}

function redirect(pathname: string, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers({ Location: pathname, ...extraHeaders });
  return new Response(null, { status: 302, headers });
}

function buildSessionCookie(token: string, requestUrl: string): string {
  const securePart =
    new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie(requestUrl: string): string {
  const securePart =
    new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
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
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return bufferToBase64Url(signatureBuffer);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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
