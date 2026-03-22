import styles from "../.generated/styles.css";
import favicon from "./favicon.ico";
import {
  createMeetingLog,
  createStudent,
  deleteStudent,
  type D1Database,
  getStudentById,
  listLogsForStudent,
  listStudents,
  studentExists,
  updateStudent,
} from "./db";
import { parseStudentFormSubmission } from "./student-form";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  cssResponse,
  htmlFragmentResponse,
  htmlResponse,
  iconResponse,
  isAuthenticated,
  normalizeDate,
  normalizeDateTime,
  normalizeString,
  redirect,
} from "./utils";
import {
  renderAddStudentPage,
  renderDashboardPage,
  renderEmptySelectedPanel,
  renderLoginPage,
  renderSelectedStudentPanel,
  renderStyleGuidePage,
} from "./views";

interface Env {
  DB: D1Database;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
}

const SESSION_COOKIE = "thesis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

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
    if (await isAuthenticated(request, env.SESSION_SECRET, SESSION_COOKIE)) {
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

    const token = await createSessionToken(
      env.SESSION_SECRET,
      SESSION_TTL_SECONDS,
    );
    return redirect("/", {
      "Set-Cookie": buildSessionCookie(token, request.url, {
        cookieName: SESSION_COOKIE,
        ttlSeconds: SESSION_TTL_SECONDS,
      }),
    });
  }

  if (pathname === "/logout" && request.method === "POST") {
    return redirect("/login", {
      "Set-Cookie": clearSessionCookie(request.url, {
        cookieName: SESSION_COOKIE,
        ttlSeconds: SESSION_TTL_SECONDS,
      }),
    });
  }

  const authenticated = await isAuthenticated(
    request,
    env.SESSION_SECRET,
    SESSION_COOKIE,
  );
  if (!authenticated) {
    return redirect("/login");
  }

  if (pathname === "/" && request.method === "GET") {
    return await renderDashboard(request, env, url);
  }

  if (pathname === "/students/new" && request.method === "GET") {
    return renderAddStudent(url);
  }

  if (pathname === "/style-guide" && request.method === "GET") {
    return htmlResponse(renderStyleGuidePage());
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
  const students = await listStudents(env.DB);

  const selectedIdParam = url.searchParams.get("selected");
  const parsedSelectedId = selectedIdParam
    ? Number.parseInt(selectedIdParam, 10)
    : 0;
  const selectedId = Number.isFinite(parsedSelectedId) ? parsedSelectedId : 0;
  const selectedStudent =
    students.find((student) => student.id === selectedId) || null;
  const logs = selectedStudent
    ? await listLogsForStudent(env.DB, selectedStudent.id)
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
  const selectedStudent = await getStudentById(env.DB, studentId);

  if (!selectedStudent) {
    return htmlFragmentResponse(
      renderEmptySelectedPanel("Student not found."),
      404,
    );
  }

  const logs = await listLogsForStudent(env.DB, studentId);
  return htmlFragmentResponse(
    renderSelectedStudentPanel(selectedStudent, logs),
  );
}

async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const studentInput = parseStudentFormSubmission(formData, { mode: "create" });
  if (!studentInput) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  const selected = await createStudent(env.DB, studentInput);
  return redirect(`/?selected=${selected}&notice=Student+added`);
}

async function handleUpdateStudent(
  request: Request,
  env: Env,
  studentId: number,
): Promise<Response> {
  const existingStudent = await getStudentById(env.DB, studentId);
  if (!existingStudent) {
    return redirect("/?error=Student+not+found");
  }

  const formData = await request.formData();
  const studentInput = parseStudentFormSubmission(formData, {
    mode: "update",
    existingStudent,
  });

  if (!studentInput) {
    return redirect(`/?selected=${studentId}&error=Invalid+update+input`);
  }

  await updateStudent(env.DB, studentId, studentInput);

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
  return redirect("/");
}
