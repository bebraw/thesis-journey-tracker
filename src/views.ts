import type { MeetingLog, Student } from "./db";
import {
  BODY_CLASS,
  BODY_CLASS_LOGIN,
  FIELD_CONTROL,
  FIELD_CONTROL_SM,
  FIELD_CONTROL_WITH_MARGIN,
  FILTER_LABEL,
  FOCUS_RING,
  FORM_LABEL,
  HEADER_CARD,
  MUTED_TEXT,
  MUTED_TEXT_XS,
  PAGE_WRAP,
  PAGE_WRAP_NARROW,
  STATUS_BADGE,
  SUBTLE_TEXT,
  SURFACE_CARD,
  SURFACE_CARD_SM,
  TEXT_LINK,
  renderBadge,
  renderButton,
  renderCard,
  renderCompactCard,
  renderInputField,
  renderSelectField,
  renderTextareaField,
  type SelectOption,
} from "./components";
import {
  escapeHtml,
  escapeJsString,
  formatDateTime,
  getDegreeLabel,
  getPhaseLabel,
  meetingStatusClass,
  meetingStatusId,
  meetingStatusText,
  toDateTimeLocalInput,
  type DegreeDefinition,
  type PhaseDefinition,
} from "./utils";

export interface Metrics {
  total: number;
  noMeeting: number;
  pastTarget: number;
  submitted: number;
}

export interface DashboardPageData {
  students: Student[];
  selectedStudent: Student | null;
  logs: MeetingLog[];
  notice: string | null;
  error: string | null;
  metrics: Metrics;
}

export interface AddStudentPageData {
  notice: string | null;
  error: string | null;
}

export const PHASES: PhaseDefinition[] = [
  { id: "research_plan", label: "Planning research" },
  { id: "researching", label: "Researching" },
  { id: "first_complete_draft", label: "First complete draft" },
  { id: "editing", label: "Editing" },
  { id: "submission_ready", label: "Draft ready to submit" },
  { id: "submitted", label: "Submitted" },
];

export const DEGREE_TYPES: DegreeDefinition[] = [
  { id: "bsc", label: "BSc" },
  { id: "msc", label: "MSc" },
  { id: "dsc", label: "DSc" },
];

function renderDocument(
  title: string,
  bodyContent: string,
  bodyClass = BODY_CLASS,
): string {
  return `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
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
  <body class="${bodyClass}">
    ${bodyContent}
  </body>
</html>`;
}

function renderThemeToggleButton(): string {
  return `<button
    id="themeToggle"
    type="button"
    title="Switch to dark mode"
    aria-label="Switch to dark mode"
    class="inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 ${FOCUS_RING}"
  >
    <svg class="h-5 w-5 text-slate-700 dark:hidden dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg class="hidden h-5 w-5 text-slate-700 dark:block dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  </button>`;
}

function renderThemeToggleScript(): string {
  return `<script>
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
  </script>`;
}

function renderFlashMessages(
  notice: string | null,
  error: string | null,
): string {
  return `
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
      }`;
}

function renderAuthedPageHeader(
  title: string,
  description: string,
  actionsHtml: string,
): string {
  return `<header class="${HEADER_CARD}">
        <div>
          <h1 class="text-xl font-semibold">${escapeHtml(title)}</h1>
          <p class="${SUBTLE_TEXT}">${escapeHtml(description)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          ${actionsHtml}
          ${renderThemeToggleButton()}
          <form action="/logout" method="post">
            ${renderButton({ label: "Log out", type: "submit", variant: "neutral" })}
          </form>
        </div>
      </header>`;
}

export function renderDashboardPage(data: DashboardPageData): string {
  const { students, selectedStudent, logs, notice, error, metrics } = data;

  const phaseFilterOptions = [
    '<option value="">All phases</option>',
    ...PHASES.map(
      (phase) => `<option value="${phase.id}">${phase.label}</option>`,
    ),
  ].join("");
  const degreeFilterOptions = [
    '<option value="">All degree types</option>',
    ...DEGREE_TYPES.map(
      (degree) => `<option value="${degree.id}">${degree.label}</option>`,
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
            <li class="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors cursor-pointer dark:border-slate-700 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-500${laneSelectedClass}" data-lane-student-card data-student-id="${student.id}" aria-selected="${isLaneSelected ? "true" : "false"}" tabindex="0">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <a href="/?selected=${student.id}" data-inline-select="1" data-lane-select="1" data-student-id="${student.id}" class="min-w-0 flex-1 break-words font-medium text-slate-800 dark:text-slate-100 ${TEXT_LINK}">${escapeHtml(student.name)}</a>
                <div class="flex max-w-full flex-wrap justify-end gap-1">
                  ${renderBadge({ label: getDegreeLabel(student.degreeType, DEGREE_TYPES) })}
                  ${student.isMock ? renderBadge({ label: "Mock", variant: "mock" }) : ""}
                </div>
              </div>
              ${
                student.thesisTopic
                  ? `<p class="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">${escapeHtml(student.thesisTopic)}</p>`
                  : ""
              }
              <p class="mt-1 ${MUTED_TEXT_XS}">Target: ${escapeHtml(student.targetSubmissionDate)}</p>
              <p class="mt-1 ${MUTED_TEXT_XS}">${student.nextMeetingAt ? `Next: ${escapeHtml(formatDateTime(student.nextMeetingAt))}` : "Next: not booked"}</p>
              <p class="mt-2"><span class="${STATUS_BADGE} ${meetingStatusClass(student)}">${meetingStatusText(student)}</span></p>
            </li>
          `;
          })
          .join("")
      : '<li class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-300">No students in this phase.</li>';

    return `
      <article class="snap-start min-h-[14rem] ${SURFACE_CARD_SM}">
        <div class="flex items-start justify-between gap-3">
          <h3 class="min-h-10 flex-1 text-sm font-semibold leading-5">${escapeHtml(phase.label)}</h3>
          ${renderBadge({ label: String(laneStudents.length), variant: "count" })}
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
              data-topic="${escapeHtml(student.thesisTopic || "").toLowerCase()}"
              data-degree="${escapeHtml(student.degreeType)}"
              data-phase="${escapeHtml(student.currentPhase)}"
              data-status-id="${statusId}"
              data-target-date="${escapeHtml(student.targetSubmissionDate)}"
              data-next-meeting-date="${escapeHtml(student.nextMeetingAt || "")}"
              aria-selected="${isSelected ? "true" : "false"}"
              tabindex="0"
            >
              <td class="px-2 py-2 align-top">
                <div class="font-medium">
                  <a class="${TEXT_LINK}" href="/?selected=${student.id}" data-inline-select="1" data-student-id="${student.id}">${escapeHtml(student.name)}</a>
                </div>
                ${
                  student.thesisTopic
                    ? `<div class="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">${escapeHtml(student.thesisTopic)}</div>`
                    : ""
                }
                <div class="${MUTED_TEXT_XS}">${escapeHtml(getDegreeLabel(student.degreeType, DEGREE_TYPES))} · ${escapeHtml(student.email || "-")}</div>
                ${student.isMock ? renderBadge({ label: "Mock", variant: "mock", className: "mt-1 inline-block" }) : ""}
              </td>
              <td class="px-2 py-2 align-top">${escapeHtml(getDegreeLabel(student.degreeType, DEGREE_TYPES))}</td>
              <td class="px-2 py-2 align-top">${escapeHtml(getPhaseLabel(student.currentPhase, PHASES))}</td>
              <td class="px-2 py-2 align-top">${escapeHtml(student.targetSubmissionDate)}</td>
              <td class="px-2 py-2 align-top">${student.nextMeetingAt ? escapeHtml(formatDateTime(student.nextMeetingAt)) : "Not booked"}</td>
              <td class="px-2 py-2 align-top"><span class="${STATUS_BADGE} ${meetingStatusClass(student)}">${statusText}</span></td>
              <td class="px-2 py-2 align-top">${student.logCount}</td>
              <td class="px-2 py-2 align-top">
                ${renderButton({
                  label: "View & Edit",
                  href: `/?selected=${student.id}`,
                  variant: "inline",
                  attributes: `data-inline-select=\"1\" data-student-id=\"${student.id}\"`,
                })}
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="8" class="px-2 py-3 text-sm text-slate-500 dark:text-slate-300">No students yet.</td></tr>';

  const selectedPanel = selectedStudent
    ? renderSelectedStudentPanel(selectedStudent, logs)
    : renderEmptySelectedPanel();

  return renderDocument(
    "Thesis Journey Tracker",
    `<div class="${PAGE_WRAP}">
      ${renderAuthedPageHeader(
        "MSc Thesis Journey Tracker",
        "Track phases, next meetings, and supervision logs in one place.",
        `${renderButton({ label: "Style guide", href: "/style-guide", variant: "neutral" })}
        ${renderButton({ label: "Add student", href: "/students/new", variant: "primary" })}`,
      )}
      ${renderFlashMessages(notice, error)}
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="${SURFACE_CARD_SM}">
          <p class="${MUTED_TEXT}">Students tracked</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.total}</p>
        </article>
        <article class="${SURFACE_CARD_SM}">
          <p class="${MUTED_TEXT}">Meetings not booked</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.noMeeting}</p>
        </article>
        <article class="${SURFACE_CARD_SM}">
          <p class="${MUTED_TEXT}">Past six-month target</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.pastTarget}</p>
        </article>
        <article class="${SURFACE_CARD_SM}">
          <p class="${MUTED_TEXT}">Submitted</p>
          <p class="mt-1 text-2xl font-semibold">${metrics.submitted}</p>
        </article>
      </section>

      <section class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold">Phase Lanes</h2>
          <p class="${MUTED_TEXT_XS}">Overview of where students currently are in the thesis process.</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          ${phaseLaneCards}
        </div>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article class="overflow-hidden xl:col-span-2 ${SURFACE_CARD}">
          <div class="mb-4">
            <h2 class="text-lg font-semibold">Students</h2>
            <p class="${MUTED_TEXT_XS}">Use filters to quickly find students that need attention.</p>
          </div>
          <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label class="${FILTER_LABEL}">
              Search
              <input id="studentSearch" type="search" placeholder="Name, email, or topic" class="${FIELD_CONTROL_WITH_MARGIN}" />
            </label>
            <label class="${FILTER_LABEL}">
              Degree type
              <select id="degreeFilter" class="${FIELD_CONTROL_WITH_MARGIN}">${degreeFilterOptions}</select>
            </label>
            <label class="${FILTER_LABEL}">
              Phase
              <select id="phaseFilter" class="${FIELD_CONTROL_WITH_MARGIN}">${phaseFilterOptions}</select>
            </label>
            <label class="${FILTER_LABEL}">
              Meeting status
              <select id="statusFilter" class="${FIELD_CONTROL_WITH_MARGIN}">
                <option value="">All statuses</option>
                <option value="not_booked">Not booked</option>
                <option value="overdue">Overdue</option>
                <option value="within_2_weeks">Within 2 weeks</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </label>
            <label class="${FILTER_LABEL}">
              Sort by
              <select id="sortBy" class="${FIELD_CONTROL_WITH_MARGIN}">
                <option value="nextMeetingAsc">Next meeting (earliest)</option>
                <option value="targetAsc">Target date (earliest)</option>
                <option value="nameAsc">Name (A-Z)</option>
                <option value="statusPriority">Status priority</option>
              </select>
            </label>
          </div>
          <p id="studentResultsMeta" class="mb-2 ${MUTED_TEXT_XS}"></p>
          <p class="mb-2 ${MUTED_TEXT_XS}">Tip: click a row to open student details.</p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[58rem] divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  <th class="px-2 py-2">Student</th>
                  <th class="px-2 py-2">Degree</th>
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
      var root = document.documentElement;
      var tableBody = document.getElementById("studentsTableBody");
      var studentRows = Array.prototype.slice.call(document.querySelectorAll("[data-student-row]"));
      var laneStudentCards = Array.prototype.slice.call(document.querySelectorAll("[data-lane-student-card]"));
      var searchInput = document.getElementById("studentSearch");
      var degreeFilter = document.getElementById("degreeFilter");
      var phaseFilter = document.getElementById("phaseFilter");
      var statusFilter = document.getElementById("statusFilter");
      var sortBy = document.getElementById("sortBy");
      var studentResultsMeta = document.getElementById("studentResultsMeta");
      var selectedStudentPanel = document.getElementById("selectedStudentPanel");
      var emptySelectedStudentPanelTemplate = document.getElementById("emptySelectedStudentPanelTemplate");

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
        var degree = degreeFilter ? degreeFilter.value : "";
        var phase = phaseFilter ? phaseFilter.value : "";
        var status = statusFilter ? statusFilter.value : "";
        var visibleCount = 0;

        studentRows.forEach(function (row) {
          var name = row.getAttribute("data-name") || "";
          var email = row.getAttribute("data-email") || "";
          var topic = row.getAttribute("data-topic") || "";
          var rowDegree = row.getAttribute("data-degree") || "";
          var rowPhase = row.getAttribute("data-phase") || "";
          var rowStatus = row.getAttribute("data-status-id") || "";

          var matchesQuery = !query || name.indexOf(query) !== -1 || email.indexOf(query) !== -1 || topic.indexOf(query) !== -1;
          var matchesDegree = !degree || rowDegree === degree;
          var matchesPhase = !phase || rowPhase === phase;
          var matchesStatus = !status || rowStatus === status;
          var visible = matchesQuery && matchesDegree && matchesPhase && matchesStatus;

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

      if (searchInput) searchInput.addEventListener("input", applyStudentFilters);
      if (degreeFilter) degreeFilter.addEventListener("change", applyStudentFilters);
      if (phaseFilter) phaseFilter.addEventListener("change", applyStudentFilters);
      if (statusFilter) statusFilter.addEventListener("change", applyStudentFilters);
      if (sortBy) sortBy.addEventListener("change", refreshStudentTable);
    </script>
    ${renderThemeToggleScript()}`,
  );
}

export function renderAddStudentPage(data: AddStudentPageData): string {
  const { notice, error } = data;
  const degreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));
  const phaseOptions: SelectOption[] = PHASES.map((phase) => ({
    label: phase.label,
    value: phase.id,
  }));

  return renderDocument(
    "Thesis Journey Tracker - Add Student",
    `<div class="${PAGE_WRAP_NARROW}">
      ${renderAuthedPageHeader(
        "Add Student",
        "Create a new thesis supervision entry.",
        `${renderButton({ label: "Dashboard", href: "/", variant: "neutral" })}
        ${renderButton({ label: "Style guide", href: "/style-guide", variant: "neutral" })}`,
      )}
      ${renderFlashMessages(notice, error)}
      ${renderCard(`
        <h2 class="text-lg font-semibold">Student Details</h2>
        <p class="mt-1 ${SUBTLE_TEXT}">Target submission defaults to six months from start date when left empty.</p>
        <form action="/actions/add-student" method="post" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${renderInputField({
            label: "Name",
            name: "name",
            required: true,
            className: FIELD_CONTROL_SM,
          })}
          ${renderInputField({
            label: "Email (optional)",
            name: "studentEmail",
            className: FIELD_CONTROL_SM,
            attributes:
              'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
          })}
          ${renderSelectField({
            label: "Degree type",
            name: "degreeType",
            options: degreeOptions,
            value: "msc",
            className: FIELD_CONTROL_SM,
          })}
          ${renderInputField({
            label: "Thesis topic (optional)",
            name: "thesisTopic",
            className: FIELD_CONTROL_SM,
            wrapperClassName: `${FORM_LABEL} sm:col-span-2 lg:col-span-3`,
          })}
          ${renderSelectField({
            label: "Phase",
            name: "currentPhase",
            options: phaseOptions,
            className: FIELD_CONTROL_SM,
          })}
          ${renderInputField({
            label: "Start date",
            name: "startDate",
            type: "date",
            required: true,
            className: FIELD_CONTROL_SM,
          })}
          ${renderInputField({
            label: "Target submission (optional)",
            name: "targetSubmissionDate",
            type: "date",
            className: FIELD_CONTROL_SM,
          })}
          ${renderInputField({
            label: "Next meeting (optional)",
            name: "nextMeetingAt",
            type: "datetime-local",
            className: FIELD_CONTROL_SM,
          })}
          ${renderButton({
            label: "Add student",
            type: "submit",
            variant: "primaryBlock",
            className: "sm:col-span-2 lg:col-span-3",
          })}
        </form>
      `)}
    </div>
    ${renderThemeToggleScript()}`,
  );
}

export function renderStyleGuidePage(): string {
  const sampleDegreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));

  return renderDocument(
    "Thesis Journey Tracker - Style Guide",
    `<div class="${PAGE_WRAP}">
      ${renderAuthedPageHeader(
        "Style Guide",
        "Reusable UI patterns for buttons, badges, fields, and surfaces.",
        `${renderButton({ label: "Dashboard", href: "/", variant: "neutral" })}
        ${renderButton({ label: "Add student", href: "/students/new", variant: "primary" })}`,
      )}

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        ${renderCard(`
          <h2 class="text-lg font-semibold">Buttons</h2>
          <p class="mt-1 ${SUBTLE_TEXT}">Primary actions, supporting actions, and destructive actions all come from the same helper.</p>
          <div class="mt-4 flex flex-wrap gap-3">
            ${renderButton({ label: "Primary", href: "#", variant: "primary" })}
            ${renderButton({ label: "Neutral", href: "#", variant: "neutral" })}
            ${renderButton({ label: "Inline", href: "#", variant: "inline" })}
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            ${renderButton({ label: "Primary Block", type: "button", variant: "primaryBlock" })}
            ${renderButton({ label: "Success Block", type: "button", variant: "successBlock" })}
            ${renderButton({ label: "Danger Block", type: "button", variant: "dangerBlock" })}
          </div>
        `)}

        ${renderCard(`
          <h2 class="text-lg font-semibold">Badges</h2>
          <p class="mt-1 ${SUBTLE_TEXT}">Badges keep metadata visually consistent across tables, cards, and logs.</p>
          <div class="mt-4 flex flex-wrap gap-3">
            ${renderBadge({ label: "MSc" })}
            ${renderBadge({ label: "Mock", variant: "mock" })}
            ${renderBadge({ label: "12", variant: "count" })}
            <span class="${STATUS_BADGE} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Scheduled</span>
            <span class="${STATUS_BADGE} bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Overdue</span>
          </div>
        `)}
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        ${renderCard(`
          <h2 class="text-lg font-semibold">Form Fields</h2>
          <p class="mt-1 ${SUBTLE_TEXT}">Inputs, selects, and textareas are rendered from small wrapper functions so labels and spacing stay aligned.</p>
          <form class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            ${renderInputField({
              label: "Student name",
              value: "Ada Lovelace",
              className: FIELD_CONTROL_SM,
            })}
            ${renderSelectField({
              label: "Degree type",
              options: sampleDegreeOptions,
              value: "msc",
              className: FIELD_CONTROL_SM,
            })}
            ${renderInputField({
              label: "Thesis topic",
              value: "Supervision dashboard usability",
              className: FIELD_CONTROL_SM,
              wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
            })}
            ${renderTextareaField({
              label: "Advisor notes",
              value:
                "This textarea uses the same label and border patterns as the forms in the app.",
              className: FIELD_CONTROL_SM,
              wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
            })}
          </form>
        `)}

        ${renderCard(`
          <h2 class="text-lg font-semibold">Surfaces</h2>
          <p class="mt-1 ${SUBTLE_TEXT}">Cards help sections feel consistent while still allowing different densities.</p>
          <div class="mt-4 grid gap-4">
            ${renderCompactCard(`
              <h3 class="text-sm font-semibold">Compact Card</h3>
              <p class="mt-1 ${MUTED_TEXT_XS}">Used for metrics and lane columns.</p>
            `)}
            ${renderCard(
              `
              <h3 class="text-sm font-semibold">Standard Card</h3>
              <p class="mt-1 ${SUBTLE_TEXT}">Used for larger panels like the student editor and form pages.</p>
            `,
              "p-4",
            )}
          </div>
        `)}
      </section>
    </div>
    ${renderThemeToggleScript()}`,
  );
}

export function renderEmptySelectedPanel(
  message = "Select a student from the table to edit details and view/add supervision logs.",
): string {
  return `
    <article class="${SURFACE_CARD}">
      <h2 class="text-lg font-semibold">Student Details & Logs</h2>
      <p class="mt-2 ${SUBTLE_TEXT}">${escapeHtml(message)}</p>
    </article>
  `;
}

export function renderSelectedStudentPanel(
  student: Student,
  logs: MeetingLog[],
): string {
  const degreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));
  const phaseOptions: SelectOption[] = PHASES.map((phase) => ({
    label: phase.label,
    value: phase.id,
  }));

  const logsHtml = logs.length
    ? logs
        .map(
          (log) => `
          <article class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p class="font-medium">${escapeHtml(formatDateTime(log.happenedAt))} ${
              log.isMock
                ? renderBadge({
                    label: "Mock",
                    variant: "mock",
                    className: "ml-2",
                  })
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
    <article class="space-y-6 ${SURFACE_CARD}">
      <section>
        <h2 class="text-lg font-semibold">Edit Student</h2>
        <p class="${SUBTLE_TEXT}">Currently viewing: ${escapeHtml(student.name)}</p>
        ${
          student.thesisTopic
            ? `<p class="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">${escapeHtml(student.thesisTopic)}</p>`
            : ""
        }
        <form action="/actions/update-student/${student.id}" method="post" class="mt-3 space-y-3">
          ${renderInputField({
            label: "Name",
            name: "name",
            required: true,
            value: student.name,
            className: FIELD_CONTROL,
          })}
          ${renderInputField({
            label: "Email",
            name: "studentEmail",
            value: student.email || "",
            className: FIELD_CONTROL,
            attributes:
              'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
          })}
          ${renderSelectField({
            label: "Degree type",
            name: "degreeType",
            options: degreeOptions,
            value: student.degreeType,
            className: FIELD_CONTROL,
          })}
          ${renderInputField({
            label: "Thesis topic (optional)",
            name: "thesisTopic",
            value: student.thesisTopic || "",
            className: FIELD_CONTROL,
          })}
          ${renderSelectField({
            label: "Phase",
            name: "currentPhase",
            options: phaseOptions,
            value: student.currentPhase,
            className: FIELD_CONTROL,
          })}
          ${renderInputField({
            label: "Start date",
            name: "startDate",
            type: "date",
            required: true,
            value: student.startDate,
            className: FIELD_CONTROL,
          })}
          ${renderInputField({
            label: "Target submission date",
            name: "targetSubmissionDate",
            type: "date",
            required: true,
            value: student.targetSubmissionDate,
            className: FIELD_CONTROL,
          })}
          ${renderInputField({
            label: "Next meeting",
            name: "nextMeetingAt",
            type: "datetime-local",
            value: toDateTimeLocalInput(student.nextMeetingAt),
            className: FIELD_CONTROL,
          })}
          ${renderButton({
            label: "Save student updates",
            type: "submit",
            variant: "primaryBlock",
          })}
        </form>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Add Log Entry</h2>
        <form action="/actions/add-log/${student.id}" method="post" class="mt-3 space-y-3">
          ${renderInputField({
            label: "Meeting date/time",
            name: "happenedAt",
            type: "datetime-local",
            className: FIELD_CONTROL,
          })}
          ${renderTextareaField({
            label: "What was discussed",
            name: "discussed",
            required: true,
            className: FIELD_CONTROL,
          })}
          ${renderTextareaField({
            label: "Agreed plan / next actions",
            name: "agreedPlan",
            required: true,
            className: FIELD_CONTROL,
          })}
          ${renderInputField({
            label: "Next-step deadline (optional)",
            name: "nextStepDeadline",
            type: "date",
            className: FIELD_CONTROL,
          })}
          ${renderButton({
            label: "Save log entry",
            type: "submit",
            variant: "successBlock",
          })}
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
          ${renderButton({
            label: "Delete student",
            type: "submit",
            variant: "dangerBlock",
          })}
        </form>
      </section>
    </article>
  `;
}

export function renderLoginPage(showError: boolean): string {
  return renderDocument(
    "Thesis Journey Tracker - Login",
    `<main class="mx-auto flex h-full max-w-md items-center px-6">
      <section class="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <h1 class="text-2xl font-semibold">Thesis Journey Tracker</h1>
        <p class="mt-2 ${SUBTLE_TEXT}">Private advisor dashboard login</p>
        ${
          showError
            ? '<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200">Invalid password. Please try again.</p>'
            : ""
        }
        <form action="/login" method="post" class="mt-6 space-y-4">
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800" />
          ${renderButton({
            label: "Sign in",
            type: "submit",
            variant: "primaryBlock",
            className: "transition",
          })}
        </form>
      </section>
    </main>`,
    BODY_CLASS_LOGIN,
  );
}
