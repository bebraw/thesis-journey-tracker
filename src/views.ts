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
import { type HtmlispComponents, renderHTMLisp } from "./htmlisp";
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

interface PreparedMetric {
  label: string;
  metricValue: string;
}

interface PreparedFilterOption {
  label: string;
  optionValue: string;
}

interface PreparedLaneStudent {
  idAttr: string;
  selectedAttr: string;
  cardClass: string;
  href: string;
  name: string;
  badgesHtml: string;
  topicVisible: boolean;
  topic: string;
  targetText: string;
  nextMeetingText: string;
  statusBadgeHtml: string;
}

interface PreparedPhaseLane {
  label: string;
  countBadgeHtml: string;
  hasStudents: boolean;
  isEmpty: boolean;
  students: PreparedLaneStudent[];
}

interface PreparedStudentRow {
  rowClass: string;
  selectedAttr: string;
  selectHref: string;
  studentIdAttr: string;
  dataName: string;
  dataEmail: string;
  dataTopic: string;
  dataDegree: string;
  dataPhase: string;
  dataStatusId: string;
  dataTargetDate: string;
  dataNextMeetingDate: string;
  summaryHtml: string;
  degreeLabel: string;
  phaseLabel: string;
  targetDate: string;
  nextMeetingText: string;
  statusBadgeHtml: string;
  logCountText: string;
  actionButtonHtml: string;
}

interface PreparedLogEntry {
  timestampText: string;
  mockBadgeHtml: string;
  discussed: string;
  agreedPlan: string;
  hasDeadline: boolean;
  deadlineText: string;
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

const THEME_BOOTSTRAP_SCRIPT = `<script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>`;

const THEME_TOGGLE_SCRIPT = `<script>
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

const DASHBOARD_INTERACTION_SCRIPT = `<script>
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
        });
      }

      function applySelectedLaneState(selectedId) {
        laneStudentCards.forEach(function (card) {
          var isSelected = selectedId > 0 && getLaneStudentId(card) === selectedId;
          card.classList.toggle("ring-2", isSelected);
          card.classList.toggle("ring-blue-400/60", isSelected);
          card.classList.toggle("dark:ring-blue-400/40", isSelected);
          card.setAttribute("aria-selected", isSelected ? "true" : "false");
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
    </script>`;

const VIEW_COMPONENTS: HtmlispComponents = {
  Document: `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title &children="(get props title)"></title>
    <noop &children="(get props themeBootstrapScript)"></noop>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body &class="(get props bodyClass)">
    <noop &children="(get props bodyContent)"></noop>
  </body>
</html>`,
  ThemeToggleButton: `<button
    id="themeToggle"
    type="button"
    title="Switch to dark mode"
    aria-label="Switch to dark mode"
    &class="(get props className)"
  >
    <svg class="h-5 w-5 text-slate-700 dark:hidden dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg class="hidden h-5 w-5 text-slate-700 dark:block dark:text-slate-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  </button>`,
  NoticeFlash:
    '<p &visibleIf="(get props visible)" role="status" aria-live="polite" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200" &children="(get props message)"></p>',
  ErrorFlash:
    '<p &visibleIf="(get props visible)" role="alert" aria-live="assertive" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200" &children="(get props message)"></p>',
  AuthHeader: `<header &class="(get props headerClass)">
    <div>
      <h1 class="text-xl font-semibold" &children="(get props title)"></h1>
      <p &class="(get props descriptionClass)" &children="(get props description)"></p>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
      <noop &children="(get props actionsHtml)"></noop>
      <ThemeToggleButton &className="(get props themeToggleClass)" />
      <form action="/logout" method="post">
        <noop &children="(get props logoutButtonHtml)"></noop>
      </form>
    </div>
  </header>`,
  MetricCard: `<article &class="(get props cardClass)">
    <p &class="(get props labelClass)" &children="(get props label)"></p>
    <p class="mt-1 text-2xl font-semibold" &children="(get props metricValue)"></p>
  </article>`,
  PhaseLane: `<article &class="(get props cardClass)">
    <div class="flex items-start justify-between gap-3">
      <h3 class="min-h-10 flex-1 text-sm font-semibold leading-5" &children="(get props label)"></h3>
      <noop &children="(get props countBadgeHtml)"></noop>
    </div>
    <ul class="mt-3 space-y-2" &visibleIf="(get props hasStudents)">
      <noop &foreach="(get props students)">
        <LaneStudentCard
          &idAttr="(get props idAttr)"
          &selectedAttr="(get props selectedAttr)"
          &cardClass="(get props cardClass)"
          &href="(get props href)"
          &name="(get props name)"
          &badgesHtml="(get props badgesHtml)"
          &topicVisible="(get props topicVisible)"
          &topic="(get props topic)"
          &targetText="(get props targetText)"
          &nextMeetingText="(get props nextMeetingText)"
          &statusBadgeHtml="(get props statusBadgeHtml)"
        />
      </noop>
    </ul>
    <p &visibleIf="(get props isEmpty)" class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-300">No students in this phase.</p>
  </article>`,
  LaneStudentCard: `<li
    &class="(get props cardClass)"
    data-lane-student-card
    &data-student-id="(get props idAttr)"
    &aria-selected="(get props selectedAttr)"
    tabindex="0"
  >
    <div class="flex flex-wrap items-start justify-between gap-2">
      <a
        &href="(get props href)"
        data-inline-select="1"
        data-lane-select="1"
        &data-student-id="(get props idAttr)"
        class="min-w-0 flex-1 break-words font-medium text-slate-800 dark:text-slate-100 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        &children="(get props name)"
      ></a>
      <div class="flex max-w-full flex-wrap justify-end gap-1">
        <noop &children="(get props badgesHtml)"></noop>
      </div>
    </div>
    <p &visibleIf="(get props topicVisible)" class="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200" &children="(get props topic)"></p>
    <p class="mt-1 text-xs text-slate-500 dark:text-slate-300" &children="(get props targetText)"></p>
    <p class="mt-1 text-xs text-slate-500 dark:text-slate-300" &children="(get props nextMeetingText)"></p>
    <p class="mt-2"><noop &children="(get props statusBadgeHtml)"></noop></p>
  </li>`,
  StudentTableRow: `<tr
    &class="(get props rowClass)"
    data-student-row
    &data-select-href="(get props selectHref)"
    &data-student-id="(get props studentIdAttr)"
    &data-name="(get props dataName)"
    &data-email="(get props dataEmail)"
    &data-topic="(get props dataTopic)"
    &data-degree="(get props dataDegree)"
    &data-phase="(get props dataPhase)"
    &data-status-id="(get props dataStatusId)"
    &data-target-date="(get props dataTargetDate)"
    &data-next-meeting-date="(get props dataNextMeetingDate)"
    &aria-selected="(get props selectedAttr)"
    tabindex="0"
  >
    <td class="px-2 py-2 align-top"><noop &children="(get props summaryHtml)"></noop></td>
    <td class="px-2 py-2 align-top" &children="(get props degreeLabel)"></td>
    <td class="px-2 py-2 align-top" &children="(get props phaseLabel)"></td>
    <td class="px-2 py-2 align-top" &children="(get props targetDate)"></td>
    <td class="px-2 py-2 align-top" &children="(get props nextMeetingText)"></td>
    <td class="px-2 py-2 align-top"><noop &children="(get props statusBadgeHtml)"></noop></td>
    <td class="px-2 py-2 align-top" &children="(get props logCountText)"></td>
    <td class="px-2 py-2 align-top"><noop &children="(get props actionButtonHtml)"></noop></td>
  </tr>`,
  MeetingLogEntry: `<article class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
    <p class="font-medium"><span &children="(get props timestampText)"></span><noop &children="(get props mockBadgeHtml)"></noop></p>
    <p class="mt-1"><span class="font-medium">Discussed:</span> <span &children="(get props discussed)"></span></p>
    <p class="mt-1"><span class="font-medium">Agreed:</span> <span &children="(get props agreedPlan)"></span></p>
    <p &visibleIf="(get props hasDeadline)" class="mt-1"><span class="font-medium">Next-step deadline:</span> <span &children="(get props deadlineText)"></span></p>
  </article>`,
};

function renderView(
  htmlInput: string,
  props: Record<string, unknown> = {},
): string {
  return renderHTMLisp(htmlInput, props, VIEW_COMPONENTS);
}

function renderDocument(
  title: string,
  bodyContent: string,
  bodyClass = BODY_CLASS,
): string {
  return renderView(
    '<Document &title="(get props title)" &bodyClass="(get props bodyClass)" &bodyContent="(get props bodyContent)" &themeBootstrapScript="(get props themeBootstrapScript)"></Document>',
    {
      title: escapeHtml(title),
      bodyClass: escapeHtml(bodyClass),
      bodyContent,
      themeBootstrapScript: THEME_BOOTSTRAP_SCRIPT,
    },
  );
}

function renderFlashMessages(
  notice: string | null,
  error: string | null,
): string {
  return renderView(
    '<noop><NoticeFlash &visible="(get props noticeVisible)" &message="(get props noticeMessage)"></NoticeFlash><ErrorFlash &visible="(get props errorVisible)" &message="(get props errorMessage)"></ErrorFlash></noop>',
    {
      noticeVisible: Boolean(notice),
      noticeMessage: escapeHtml(notice || ""),
      errorVisible: Boolean(error),
      errorMessage: escapeHtml(error || ""),
    },
  );
}

function renderAuthedPageHeader(
  title: string,
  description: string,
  actionsHtml: string,
): string {
  return renderView(
    '<AuthHeader &headerClass="(get props headerClass)" &title="(get props title)" &description="(get props description)" &descriptionClass="(get props descriptionClass)" &actionsHtml="(get props actionsHtml)" &themeToggleClass="(get props themeToggleClass)" &logoutButtonHtml="(get props logoutButtonHtml)"></AuthHeader>',
    {
      headerClass: escapeHtml(HEADER_CARD),
      title: escapeHtml(title),
      description: escapeHtml(description),
      descriptionClass: escapeHtml(SUBTLE_TEXT),
      actionsHtml,
      themeToggleClass: escapeHtml(
        `inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 ${FOCUS_RING}`,
      ),
      logoutButtonHtml: renderButton({
        label: "Log out",
        type: "submit",
        variant: "neutral",
      }),
    },
  );
}

function renderMetricCards(metrics: Metrics): string {
  const preparedMetrics: PreparedMetric[] = [
    { label: "Students tracked", metricValue: String(metrics.total) },
    { label: "Meetings not booked", metricValue: String(metrics.noMeeting) },
    { label: "Past six-month target", metricValue: String(metrics.pastTarget) },
    { label: "Submitted", metricValue: String(metrics.submitted) },
  ];

  return renderView(
    '<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><noop &foreach="(get props metrics)"><MetricCard &cardClass="(get props cardClass)" &labelClass="(get props labelClass)" &label="(get props label)" &metricValue="(get props metricValue)"></MetricCard></noop></section>',
    {
      metrics: preparedMetrics,
      cardClass: escapeHtml(SURFACE_CARD_SM),
      labelClass: escapeHtml(MUTED_TEXT),
    },
  );
}

function preparePhaseLanes(
  students: Student[],
  selectedStudent: Student | null,
): PreparedPhaseLane[] {
  return PHASES.map((phase) => {
    const laneStudents = students
      .filter((student) => student.currentPhase === phase.id)
      .slice()
      .sort(
        (a, b) =>
          a.targetSubmissionDate.localeCompare(b.targetSubmissionDate) ||
          a.name.localeCompare(b.name),
      );

    return {
      label: escapeHtml(phase.label),
      countBadgeHtml: renderBadge({
        label: String(laneStudents.length),
        variant: "count",
      }),
      hasStudents: laneStudents.length > 0,
      isEmpty: laneStudents.length === 0,
      students: laneStudents.map((student) => {
        const isSelected = selectedStudent
          ? selectedStudent.id === student.id
          : false;
        const badgesHtml = [
          renderBadge({
            label: getDegreeLabel(student.degreeType, DEGREE_TYPES),
          }),
          student.isMock ? renderBadge({ label: "Mock", variant: "mock" }) : "",
        ].join("");

        return {
          idAttr: String(student.id),
          selectedAttr: isSelected ? "true" : "false",
          cardClass: escapeHtml(
            `rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors cursor-pointer dark:border-slate-700 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-500${
              isSelected ? " ring-2 ring-blue-400/60 dark:ring-blue-400/40" : ""
            }`,
          ),
          href: escapeHtml(`/?selected=${student.id}`),
          name: escapeHtml(student.name),
          badgesHtml,
          topicVisible: Boolean(student.thesisTopic),
          topic: escapeHtml(student.thesisTopic || ""),
          targetText: escapeHtml(`Target: ${student.targetSubmissionDate}`),
          nextMeetingText: escapeHtml(
            student.nextMeetingAt
              ? `Next: ${formatDateTime(student.nextMeetingAt)}`
              : "Next: not booked",
          ),
          statusBadgeHtml: `<span class="${escapeHtml(
            `${STATUS_BADGE} ${meetingStatusClass(student)}`,
          )}">${escapeHtml(meetingStatusText(student))}</span>`,
        };
      }),
    };
  });
}

function renderPhaseLanes(
  students: Student[],
  selectedStudent: Student | null,
): string {
  return renderView(
    `<section class="space-y-3">
      <div>
        <h2 class="text-lg font-semibold">Phase Lanes</h2>
        <p &class="(get props mutedTextXs)">Overview of where students currently are in the thesis process.</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <noop &foreach="(get props lanes)">
          <PhaseLane
            &cardClass="(get props cardClass)"
            &label="(get props label)"
            &countBadgeHtml="(get props countBadgeHtml)"
            &hasStudents="(get props hasStudents)"
            &isEmpty="(get props isEmpty)"
            &students="(get props students)"
          ></PhaseLane>
        </noop>
      </div>
    </section>`,
    {
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      cardClass: escapeHtml(`snap-start min-h-[14rem] ${SURFACE_CARD_SM}`),
      lanes: preparePhaseLanes(students, selectedStudent),
    },
  );
}

function prepareFilterOptions(
  options: Array<{ value: string; label: string }>,
): PreparedFilterOption[] {
  return options.map((option) => ({
    optionValue: escapeHtml(option.value),
    label: escapeHtml(option.label),
  }));
}

function prepareStudentRows(
  students: Student[],
  selectedStudent: Student | null,
): PreparedStudentRow[] {
  return students.map((student) => {
    const statusText = meetingStatusText(student);
    const statusId = meetingStatusId(student);
    const isSelected = selectedStudent
      ? selectedStudent.id === student.id
      : false;
    const summaryHtml = renderView(
      `<div class="font-medium">
        <a &class="(get props linkClass)" &href="(get props href)" data-inline-select="1" &data-student-id="(get props studentIdAttr)" &children="(get props name)"></a>
      </div>
      <div &visibleIf="(get props topicVisible)" class="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200" &children="(get props topic)"></div>
      <div &class="(get props metaClass)" &children="(get props metaText)"></div>
      <noop &children="(get props mockBadgeHtml)"></noop>`,
      {
        linkClass: escapeHtml(TEXT_LINK),
        href: escapeHtml(`/?selected=${student.id}`),
        studentIdAttr: String(student.id),
        name: escapeHtml(student.name),
        topicVisible: Boolean(student.thesisTopic),
        topic: escapeHtml(student.thesisTopic || ""),
        metaClass: escapeHtml(MUTED_TEXT_XS),
        metaText: escapeHtml(
          `${getDegreeLabel(student.degreeType, DEGREE_TYPES)} · ${
            student.email || "-"
          }`,
        ),
        mockBadgeHtml: student.isMock
          ? renderBadge({
              label: "Mock",
              variant: "mock",
              className: "mt-1 inline-block",
            })
          : "",
      },
    );

    return {
      rowClass: escapeHtml(
        `${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/35"} cursor-pointer`,
      ),
      selectedAttr: isSelected ? "true" : "false",
      selectHref: escapeHtml(`/?selected=${student.id}`),
      studentIdAttr: String(student.id),
      dataName: escapeHtml(student.name).toLowerCase(),
      dataEmail: escapeHtml(student.email || "").toLowerCase(),
      dataTopic: escapeHtml(student.thesisTopic || "").toLowerCase(),
      dataDegree: escapeHtml(student.degreeType),
      dataPhase: escapeHtml(student.currentPhase),
      dataStatusId: escapeHtml(statusId),
      dataTargetDate: escapeHtml(student.targetSubmissionDate),
      dataNextMeetingDate: escapeHtml(student.nextMeetingAt || ""),
      summaryHtml,
      degreeLabel: escapeHtml(getDegreeLabel(student.degreeType, DEGREE_TYPES)),
      phaseLabel: escapeHtml(getPhaseLabel(student.currentPhase, PHASES)),
      targetDate: escapeHtml(student.targetSubmissionDate),
      nextMeetingText: escapeHtml(
        student.nextMeetingAt
          ? formatDateTime(student.nextMeetingAt)
          : "Not booked",
      ),
      statusBadgeHtml: `<span class="${escapeHtml(
        `${STATUS_BADGE} ${meetingStatusClass(student)}`,
      )}">${escapeHtml(statusText)}</span>`,
      logCountText: String(student.logCount),
      actionButtonHtml: renderButton({
        label: "View & Edit",
        href: `/?selected=${student.id}`,
        variant: "inline",
        attributes: `data-inline-select="1" data-student-id="${student.id}"`,
      }),
    };
  });
}

function renderStudentsTable(
  students: Student[],
  selectedStudent: Student | null,
  selectedPanel: string,
  emptySelectedPanel: string,
): string {
  const degreeFilterOptions = prepareFilterOptions([
    { value: "", label: "All degree types" },
    ...DEGREE_TYPES.map((degree) => ({
      value: degree.id,
      label: degree.label,
    })),
  ]);
  const phaseFilterOptions = prepareFilterOptions([
    { value: "", label: "All phases" },
    ...PHASES.map((phase) => ({
      value: phase.id,
      label: phase.label,
    })),
  ]);
  const studentRows = prepareStudentRows(students, selectedStudent);

  return renderView(
    `<section class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <article &class="(get props studentsCardClass)">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">Students</h2>
          <p &class="(get props mutedTextXs)">Use filters to quickly find students that need attention.</p>
        </div>
        <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label &class="(get props filterLabelClass)">
            Search
            <input id="studentSearch" type="search" placeholder="Name, email, or topic" &class="(get props filterControlClass)" />
          </label>
          <label &class="(get props filterLabelClass)">
            Degree type
            <select id="degreeFilter" &class="(get props filterControlClass)">
              <noop &foreach="(get props degreeFilterOptions)">
                <option &value="(get props optionValue)" &children="(get props label)"></option>
              </noop>
            </select>
          </label>
          <label &class="(get props filterLabelClass)">
            Phase
            <select id="phaseFilter" &class="(get props filterControlClass)">
              <noop &foreach="(get props phaseFilterOptions)">
                <option &value="(get props optionValue)" &children="(get props label)"></option>
              </noop>
            </select>
          </label>
          <label &class="(get props filterLabelClass)">
            Meeting status
            <select id="statusFilter" &class="(get props filterControlClass)">
              <option value="">All statuses</option>
              <option value="not_booked">Not booked</option>
              <option value="overdue">Overdue</option>
              <option value="within_2_weeks">Within 2 weeks</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </label>
          <label &class="(get props filterLabelClass)">
            Sort by
            <select id="sortBy" &class="(get props filterControlClass)">
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
                <th class="px-2 py-2">Degree</th>
                <th class="px-2 py-2">Phase</th>
                <th class="px-2 py-2">Target</th>
                <th class="px-2 py-2">Next meeting (local)</th>
                <th class="px-2 py-2">Status</th>
                <th class="px-2 py-2">Logs</th>
                <th class="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody id="studentsTableBody" class="divide-y divide-slate-100 dark:divide-slate-800">
              <noop &visibleIf="(get props hasStudentRows)">
                <noop &foreach="(get props studentRows)">
                  <StudentTableRow
                    &rowClass="(get props rowClass)"
                    &selectedAttr="(get props selectedAttr)"
                    &selectHref="(get props selectHref)"
                    &studentIdAttr="(get props studentIdAttr)"
                    &dataName="(get props dataName)"
                    &dataEmail="(get props dataEmail)"
                    &dataTopic="(get props dataTopic)"
                    &dataDegree="(get props dataDegree)"
                    &dataPhase="(get props dataPhase)"
                    &dataStatusId="(get props dataStatusId)"
                    &dataTargetDate="(get props dataTargetDate)"
                    &dataNextMeetingDate="(get props dataNextMeetingDate)"
                    &summaryHtml="(get props summaryHtml)"
                    &degreeLabel="(get props degreeLabel)"
                    &phaseLabel="(get props phaseLabel)"
                    &targetDate="(get props targetDate)"
                    &nextMeetingText="(get props nextMeetingText)"
                    &statusBadgeHtml="(get props statusBadgeHtml)"
                    &logCountText="(get props logCountText)"
                    &actionButtonHtml="(get props actionButtonHtml)"
                  ></StudentTableRow>
                </noop>
              </noop>
              <tr &visibleIf="(get props showEmptyRow)">
                <td colspan="8" class="px-2 py-3 text-sm text-slate-500 dark:text-slate-300">No students yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
      <div id="selectedStudentPanel"><noop &children="(get props selectedPanel)"></noop></div>
      <template id="emptySelectedStudentPanelTemplate"><noop &children="(get props emptySelectedPanel)"></noop></template>
    </section>`,
    {
      studentsCardClass: escapeHtml(
        `overflow-hidden xl:col-span-2 ${SURFACE_CARD}`,
      ),
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      filterLabelClass: escapeHtml(FILTER_LABEL),
      filterControlClass: escapeHtml(FIELD_CONTROL_WITH_MARGIN),
      degreeFilterOptions,
      phaseFilterOptions,
      hasStudentRows: studentRows.length > 0,
      showEmptyRow: studentRows.length === 0,
      studentRows,
      selectedPanel,
      emptySelectedPanel,
    },
  );
}

export function renderDashboardPage(data: DashboardPageData): string {
  const { students, selectedStudent, logs, notice, error, metrics } = data;
  const selectedPanel = selectedStudent
    ? renderSelectedStudentPanel(selectedStudent, logs)
    : renderEmptySelectedPanel();

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <noop &children="(get props metricsHtml)"></noop>
      <noop &children="(get props phaseLanesHtml)"></noop>
      <noop &children="(get props studentsTableHtml)"></noop>
    </div>
    <noop &children="(get props dashboardScript)"></noop>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "MSc Thesis Journey Tracker",
        "Track phases, next meetings, and supervision logs in one place.",
        `${renderButton({
          label: "Style guide",
          href: "/style-guide",
          variant: "neutral",
        })}${renderButton({
          label: "Add student",
          href: "/students/new",
          variant: "primary",
        })}`,
      ),
      flashHtml: renderFlashMessages(notice, error),
      metricsHtml: renderMetricCards(metrics),
      phaseLanesHtml: renderPhaseLanes(students, selectedStudent),
      studentsTableHtml: renderStudentsTable(
        students,
        selectedStudent,
        selectedPanel,
        renderEmptySelectedPanel(),
      ),
      dashboardScript: DASHBOARD_INTERACTION_SCRIPT,
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker", bodyContent);
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

  const formHtml = renderView(
    `<form action="/actions/add-student" method="post" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <noop &children="(get props nameField)"></noop>
      <noop &children="(get props emailField)"></noop>
      <noop &children="(get props degreeField)"></noop>
      <noop &children="(get props topicField)"></noop>
      <noop &children="(get props phaseField)"></noop>
      <noop &children="(get props startDateField)"></noop>
      <noop &children="(get props targetDateField)"></noop>
      <noop &children="(get props nextMeetingField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      nameField: renderInputField({
        label: "Name",
        name: "name",
        required: true,
        className: FIELD_CONTROL_SM,
      }),
      emailField: renderInputField({
        label: "Email (optional)",
        name: "studentEmail",
        className: FIELD_CONTROL_SM,
        attributes:
          'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
      }),
      degreeField: renderSelectField({
        label: "Degree type",
        name: "degreeType",
        options: degreeOptions,
        value: "msc",
        className: FIELD_CONTROL_SM,
      }),
      topicField: renderInputField({
        label: "Thesis topic (optional)",
        name: "thesisTopic",
        className: FIELD_CONTROL_SM,
        wrapperClassName: `${FORM_LABEL} sm:col-span-2 lg:col-span-3`,
      }),
      phaseField: renderSelectField({
        label: "Phase",
        name: "currentPhase",
        options: phaseOptions,
        className: FIELD_CONTROL_SM,
      }),
      startDateField: renderInputField({
        label: "Start date",
        name: "startDate",
        type: "date",
        required: true,
        className: FIELD_CONTROL_SM,
      }),
      targetDateField: renderInputField({
        label: "Target submission (optional)",
        name: "targetSubmissionDate",
        type: "date",
        className: FIELD_CONTROL_SM,
      }),
      nextMeetingField: renderInputField({
        label: "Next meeting (optional)",
        name: "nextMeetingAt",
        type: "datetime-local",
        className: FIELD_CONTROL_SM,
      }),
      submitButton: renderButton({
        label: "Add student",
        type: "submit",
        variant: "primaryBlock",
        className: "sm:col-span-2 lg:col-span-3",
      }),
    },
  );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <noop &children="(get props cardHtml)"></noop>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP_NARROW),
      headerHtml: renderAuthedPageHeader(
        "Add Student",
        "Create a new thesis supervision entry.",
        `${renderButton({
          label: "Dashboard",
          href: "/",
          variant: "neutral",
        })}${renderButton({
          label: "Style guide",
          href: "/style-guide",
          variant: "neutral",
        })}`,
      ),
      flashHtml: renderFlashMessages(notice, error),
      cardHtml: renderCard(
        renderView(
          `<h2 class="text-lg font-semibold">Student Details</h2>
          <p &class="(get props subtleText)" &children="(get props description)"></p>
          <noop &children="(get props formHtml)"></noop>`,
          {
            subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
            description: escapeHtml(
              "Target submission defaults to six months from start date when left empty.",
            ),
            formHtml,
          },
        ),
      ),
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Add Student", bodyContent);
}

export function renderStyleGuidePage(): string {
  const sampleDegreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));

  const buttonsCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Buttons</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-4 flex flex-wrap gap-3">
        <noop &children="(get props primaryButton)"></noop>
        <noop &children="(get props neutralButton)"></noop>
        <noop &children="(get props inlineButton)"></noop>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <noop &children="(get props primaryBlockButton)"></noop>
        <noop &children="(get props successBlockButton)"></noop>
        <noop &children="(get props dangerBlockButton)"></noop>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml(
          "Primary actions, supporting actions, and destructive actions all come from the same helper.",
        ),
        primaryButton: renderButton({
          label: "Primary",
          href: "#",
          variant: "primary",
        }),
        neutralButton: renderButton({
          label: "Neutral",
          href: "#",
          variant: "neutral",
        }),
        inlineButton: renderButton({
          label: "Inline",
          href: "#",
          variant: "inline",
        }),
        primaryBlockButton: renderButton({
          label: "Primary Block",
          type: "button",
          variant: "primaryBlock",
        }),
        successBlockButton: renderButton({
          label: "Success Block",
          type: "button",
          variant: "successBlock",
        }),
        dangerBlockButton: renderButton({
          label: "Danger Block",
          type: "button",
          variant: "dangerBlock",
        }),
      },
    ),
  );

  const badgesCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Badges</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-4 flex flex-wrap gap-3">
        <noop &children="(get props degreeBadge)"></noop>
        <noop &children="(get props mockBadge)"></noop>
        <noop &children="(get props countBadge)"></noop>
        <span &class="(get props scheduledBadgeClass)">Scheduled</span>
        <span &class="(get props overdueBadgeClass)">Overdue</span>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml(
          "Badges keep metadata visually consistent across tables, cards, and logs.",
        ),
        degreeBadge: renderBadge({ label: "MSc" }),
        mockBadge: renderBadge({ label: "Mock", variant: "mock" }),
        countBadge: renderBadge({ label: "12", variant: "count" }),
        scheduledBadgeClass: escapeHtml(
          `${STATUS_BADGE} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200`,
        ),
        overdueBadgeClass: escapeHtml(
          `${STATUS_BADGE} bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200`,
        ),
      },
    ),
  );

  const formFieldsCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Form Fields</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <form class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <noop &children="(get props studentNameField)"></noop>
        <noop &children="(get props degreeField)"></noop>
        <noop &children="(get props topicField)"></noop>
        <noop &children="(get props notesField)"></noop>
      </form>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml(
          "Inputs, selects, and textareas are rendered from small wrapper functions so labels and spacing stay aligned.",
        ),
        studentNameField: renderInputField({
          label: "Student name",
          value: "Ada Lovelace",
          className: FIELD_CONTROL_SM,
        }),
        degreeField: renderSelectField({
          label: "Degree type",
          options: sampleDegreeOptions,
          value: "msc",
          className: FIELD_CONTROL_SM,
        }),
        topicField: renderInputField({
          label: "Thesis topic",
          value: "Supervision dashboard usability",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        }),
        notesField: renderTextareaField({
          label: "Advisor notes",
          value:
            "This textarea uses the same label and border patterns as the forms in the app.",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        }),
      },
    ),
  );

  const surfacesCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Surfaces</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-4 grid gap-4">
        <noop &children="(get props compactCard)"></noop>
        <noop &children="(get props standardCard)"></noop>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml(
          "Cards help sections feel consistent while still allowing different densities.",
        ),
        compactCard: renderCompactCard(
          renderView(
            `<h3 class="text-sm font-semibold">Compact Card</h3>
            <p &class="(get props mutedTextXs)" &children="(get props description)"></p>`,
            {
              mutedTextXs: escapeHtml(`mt-1 ${MUTED_TEXT_XS}`),
              description: escapeHtml("Used for metrics and lane columns."),
            },
          ),
        ),
        standardCard: renderCard(
          renderView(
            `<h3 class="text-sm font-semibold">Standard Card</h3>
            <p &class="(get props subtleText)" &children="(get props description)"></p>`,
            {
              subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
              description: escapeHtml(
                "Used for larger panels like the student editor and form pages.",
              ),
            },
          ),
          "p-4",
        ),
      },
    ),
  );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <noop &children="(get props buttonsCard)"></noop>
        <noop &children="(get props badgesCard)"></noop>
      </section>
      <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <noop &children="(get props formFieldsCard)"></noop>
        <noop &children="(get props surfacesCard)"></noop>
      </section>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "Style Guide",
        "Reusable UI patterns for buttons, badges, fields, and surfaces.",
        `${renderButton({
          label: "Dashboard",
          href: "/",
          variant: "neutral",
        })}${renderButton({
          label: "Add student",
          href: "/students/new",
          variant: "primary",
        })}`,
      ),
      buttonsCard,
      badgesCard,
      formFieldsCard,
      surfacesCard,
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Style Guide", bodyContent);
}

export function renderEmptySelectedPanel(
  message = "Select a student from the table to edit details and view/add supervision logs.",
): string {
  return renderView(
    `<article &class="(get props cardClass)">
      <h2 class="text-lg font-semibold">Student Details & Logs</h2>
      <p &class="(get props subtleText)" &children="(get props message)"></p>
    </article>`,
    {
      cardClass: escapeHtml(SURFACE_CARD),
      subtleText: escapeHtml(`mt-2 ${SUBTLE_TEXT}`),
      message: escapeHtml(message),
    },
  );
}

function prepareLogEntries(logs: MeetingLog[]): PreparedLogEntry[] {
  return logs.map((log) => ({
    timestampText: escapeHtml(formatDateTime(log.happenedAt)),
    mockBadgeHtml: log.isMock
      ? renderBadge({
          label: "Mock",
          variant: "mock",
          className: "ml-2",
        })
      : "",
    discussed: escapeHtml(log.discussed),
    agreedPlan: escapeHtml(log.agreedPlan),
    hasDeadline: Boolean(log.nextStepDeadline),
    deadlineText: escapeHtml(log.nextStepDeadline || ""),
  }));
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
  const preparedLogs = prepareLogEntries(logs);

  const editFormHtml = renderView(
    `<form &action="(get props action)" method="post" class="mt-3 space-y-3">
      <noop &children="(get props nameField)"></noop>
      <noop &children="(get props emailField)"></noop>
      <noop &children="(get props degreeField)"></noop>
      <noop &children="(get props topicField)"></noop>
      <noop &children="(get props phaseField)"></noop>
      <noop &children="(get props startDateField)"></noop>
      <noop &children="(get props targetDateField)"></noop>
      <noop &children="(get props nextMeetingField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/update-student/${student.id}`),
      nameField: renderInputField({
        label: "Name",
        name: "name",
        required: true,
        value: student.name,
        className: FIELD_CONTROL,
      }),
      emailField: renderInputField({
        label: "Email",
        name: "studentEmail",
        value: student.email || "",
        className: FIELD_CONTROL,
        attributes:
          'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
      }),
      degreeField: renderSelectField({
        label: "Degree type",
        name: "degreeType",
        options: degreeOptions,
        value: student.degreeType,
        className: FIELD_CONTROL,
      }),
      topicField: renderInputField({
        label: "Thesis topic (optional)",
        name: "thesisTopic",
        value: student.thesisTopic || "",
        className: FIELD_CONTROL,
      }),
      phaseField: renderSelectField({
        label: "Phase",
        name: "currentPhase",
        options: phaseOptions,
        value: student.currentPhase,
        className: FIELD_CONTROL,
      }),
      startDateField: renderInputField({
        label: "Start date",
        name: "startDate",
        type: "date",
        required: true,
        value: student.startDate,
        className: FIELD_CONTROL,
      }),
      targetDateField: renderInputField({
        label: "Target submission date",
        name: "targetSubmissionDate",
        type: "date",
        required: true,
        value: student.targetSubmissionDate,
        className: FIELD_CONTROL,
      }),
      nextMeetingField: renderInputField({
        label: "Next meeting",
        name: "nextMeetingAt",
        type: "datetime-local",
        value: toDateTimeLocalInput(student.nextMeetingAt),
        className: FIELD_CONTROL,
      }),
      submitButton: renderButton({
        label: "Save student updates",
        type: "submit",
        variant: "primaryBlock",
      }),
    },
  );

  const addLogFormHtml = renderView(
    `<form &action="(get props action)" method="post" class="mt-3 space-y-3">
      <noop &children="(get props happenedAtField)"></noop>
      <noop &children="(get props discussedField)"></noop>
      <noop &children="(get props agreedPlanField)"></noop>
      <noop &children="(get props nextStepDeadlineField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/add-log/${student.id}`),
      happenedAtField: renderInputField({
        label: "Meeting date/time",
        name: "happenedAt",
        type: "datetime-local",
        className: FIELD_CONTROL,
      }),
      discussedField: renderTextareaField({
        label: "What was discussed",
        name: "discussed",
        required: true,
        className: FIELD_CONTROL,
      }),
      agreedPlanField: renderTextareaField({
        label: "Agreed plan / next actions",
        name: "agreedPlan",
        required: true,
        className: FIELD_CONTROL,
      }),
      nextStepDeadlineField: renderInputField({
        label: "Next-step deadline (optional)",
        name: "nextStepDeadline",
        type: "date",
        className: FIELD_CONTROL,
      }),
      submitButton: renderButton({
        label: "Save log entry",
        type: "submit",
        variant: "successBlock",
      }),
    },
  );

  return renderView(
    `<article &class="(get props cardClass)">
      <section>
        <h2 class="text-lg font-semibold">Edit Student</h2>
        <p &class="(get props subtleText)" &children="(get props currentlyViewingText)"></p>
        <p &visibleIf="(get props topicVisible)" class="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200" &children="(get props topic)"></p>
        <noop &children="(get props editFormHtml)"></noop>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Add Log Entry</h2>
        <noop &children="(get props addLogFormHtml)"></noop>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Meeting Log History</h2>
        <div class="mt-3 space-y-3" &visibleIf="(get props hasLogs)">
          <noop &foreach="(get props logs)">
            <MeetingLogEntry
              &timestampText="(get props timestampText)"
              &mockBadgeHtml="(get props mockBadgeHtml)"
              &discussed="(get props discussed)"
              &agreedPlan="(get props agreedPlan)"
              &hasDeadline="(get props hasDeadline)"
              &deadlineText="(get props deadlineText)"
            ></MeetingLogEntry>
          </noop>
        </div>
        <p &visibleIf="(get props showNoLogs)" class="rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">No entries yet.</p>
      </section>

      <section class="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
        <h2 class="text-lg font-semibold text-rose-900 dark:text-rose-100">Delete Student</h2>
        <p class="mt-1 text-sm text-rose-800 dark:text-rose-200">This removes the student and all related meeting log entries permanently.</p>
        <form
          &action="(get props deleteAction)"
          method="post"
          class="mt-4"
          &onsubmit="(get props deleteConfirm)"
        >
          <noop &children="(get props deleteButtonHtml)"></noop>
        </form>
      </section>
    </article>`,
    {
      cardClass: escapeHtml(`space-y-6 ${SURFACE_CARD}`),
      subtleText: escapeHtml(SUBTLE_TEXT),
      currentlyViewingText: escapeHtml(`Currently viewing: ${student.name}`),
      topicVisible: Boolean(student.thesisTopic),
      topic: escapeHtml(student.thesisTopic || ""),
      editFormHtml,
      addLogFormHtml,
      hasLogs: preparedLogs.length > 0,
      showNoLogs: preparedLogs.length === 0,
      logs: preparedLogs,
      deleteAction: escapeHtml(`/actions/delete-student/${student.id}`),
      deleteConfirm: escapeHtml(
        `return window.confirm('Delete ${escapeJsString(
          student.name,
        )}? This will also remove all supervision logs for this student.');`,
      ),
      deleteButtonHtml: renderButton({
        label: "Delete student",
        type: "submit",
        variant: "dangerBlock",
      }),
    },
  );
}

export function renderLoginPage(showError: boolean): string {
  const bodyContent = renderView(
    `<main class="mx-auto flex h-full max-w-md items-center px-6">
      <section class="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <h1 class="text-2xl font-semibold">Thesis Journey Tracker</h1>
        <p &class="(get props subtleText)">Private advisor dashboard login</p>
        <ErrorFlash &visible="(get props showError)" &message="(get props errorMessage)"></ErrorFlash>
        <form action="/login" method="post" class="mt-6 space-y-4">
          <label class="block text-sm font-medium" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800" />
          <noop &children="(get props signInButtonHtml)"></noop>
        </form>
      </section>
    </main>`,
    {
      subtleText: escapeHtml(`mt-2 ${SUBTLE_TEXT}`),
      showError,
      errorMessage: escapeHtml("Invalid password. Please try again."),
      signInButtonHtml: renderButton({
        label: "Sign in",
        type: "submit",
        variant: "primaryBlock",
        className: "transition",
      }),
    },
  );

  return renderDocument(
    "Thesis Journey Tracker - Login",
    bodyContent,
    BODY_CLASS_LOGIN,
  );
}
