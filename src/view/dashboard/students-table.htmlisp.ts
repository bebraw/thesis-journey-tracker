import { raw } from "../../htmlisp";
import type { DashboardLaneDefinition } from "../../dashboard-lanes";
import type { Student } from "../../students/store";
import {
  FIELD_CONTROL_WITH_MARGIN,
  FILTER_LABEL,
  FOCUS_RING,
  TABLE_CELL,
  TABLE_HEADER_ROW,
  TEXT_LINK,
  TOGGLE_BUTTON_SEGMENTED,
  TOGGLE_GROUP_SEGMENTED,
  renderButton,
  renderToggleGroup,
} from "../../ui";
import {
  DEGREE_TYPES,
  getDegreeLabel,
  getPhaseLabel,
  getTargetSubmissionDate,
  meetingStatusId,
  isPastTargetSubmissionDate,
  PHASES,
} from "../../students";
import { formatCompactDateTime, formatDateTime } from "../../formatting";
import { renderView } from "../shared.htmlisp";
import type { DashboardFilters } from "../types";

interface PreparedFilterOption {
  label: string;
  optionValue: string;
  selectedAttr: string | null;
}

interface PreparedStudentRow {
  rowClass: string;
  mobileCardClass: string;
  selectedAttr: string;
  selectHref: string;
  studentIdAttr: string;
  dataName: string;
  dataEmail: string;
  dataTopic: string;
  dataNotes: string;
  dataDegree: string;
  dataDegreeLabel: string;
  dataPhase: string;
  dataPhaseLabel: string;
  dataStatusId: string;
  dataTargetDate: string;
  dataPastTarget: string;
  dataNextMeetingDate: string;
  dataArchivedAt: string;
  dataLogCount: string;
  summaryHtml: unknown;
  degreeLabel: string;
  phaseLabel: string;
  targetDate: string;
  nextMeetingText: string;
  nextMeetingTitle: string;
  meetingTextClass: string;
  hasStatusLabel: boolean;
  archivedAtText: string;
  logCountText: string;
  statusLabel: string;
}

interface PreparedSortHeader {
  key: string;
  label: string;
}

function prepareFilterOptions(options: Array<{ value: string; label: string }>, currentValue: string): PreparedFilterOption[] {
  return options.map((option) => ({
    optionValue: option.value,
    label: option.label,
    selectedAttr: option.value === currentValue ? "selected" : null,
  }));
}

function buildDashboardHref(filters: DashboardFilters, selectedId?: number): string {
  const searchParams = new URLSearchParams();

  if (selectedId) {
    searchParams.set("selected", String(selectedId));
  }
  if (filters.scope === "archived") {
    searchParams.set("scope", "archived");
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
  if (filters.viewMode !== "list") {
    searchParams.set("view", filters.viewMode);
  }
  if (filters.sortKey !== "nextMeeting" || filters.sortDirection !== "asc") {
    searchParams.set("sort", filters.sortKey);
    searchParams.set("dir", filters.sortDirection);
  }

  const query = searchParams.toString();
  return query ? `/?${query}` : "/";
}

function prepareStudentRows(
  students: Student[],
  selectedStudent: Student | null,
  filters: DashboardFilters,
  dashboardLanes: DashboardLaneDefinition[],
  timeZone?: string,
): PreparedStudentRow[] {
  const phaseLabelMap = new Map(dashboardLanes.map((lane) => [lane.phaseId, lane.label]));

  return students.map((student) => {
    const statusId = meetingStatusId(student);
    const targetSubmissionDate = getTargetSubmissionDate(student);
    const degreeLabel = getDegreeLabel(student.degreeType, DEGREE_TYPES);
    const phaseLabel = phaseLabelMap.get(student.currentPhase) || getPhaseLabel(student.currentPhase, PHASES);
    const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
    const summaryHtml = renderView(
      `<div class="min-w-0">
        <a &class="linkClass" &href="href" data-inline-select="1" &data-student-id="studentIdAttr" &children="name"></a>
        <span class="mt-0.5 block text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="degreeLabel"></span>
      </div>`,
      {
        linkClass: `block text-sm leading-5 font-medium ${TEXT_LINK}`,
        href: buildDashboardHref(filters, student.id),
        studentIdAttr: String(student.id),
        name: student.name,
        degreeLabel,
      },
    );

    return {
      rowClass: `${isSelected ? "bg-app-brand-soft dark:bg-app-brand-soft-dark/20" : "hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/35"} cursor-pointer transition-colors`,
      mobileCardClass: `grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-app-line py-3 text-sm dark:border-app-line-dark cursor-pointer ${isSelected ? "bg-app-brand-soft dark:bg-app-brand-soft-dark/20" : "hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/35"}`,
      selectedAttr: isSelected ? "true" : "false",
      selectHref: buildDashboardHref(filters, student.id),
      studentIdAttr: String(student.id),
      dataName: student.name.toLowerCase(),
      dataEmail: (student.email || "").toLowerCase(),
      dataTopic: (student.thesisTopic || "").toLowerCase(),
      dataNotes: (student.studentNotes || "").toLowerCase(),
      dataDegree: student.degreeType,
      dataDegreeLabel: degreeLabel.toLowerCase(),
      dataPhase: student.currentPhase,
      dataPhaseLabel: phaseLabel.toLowerCase(),
      dataStatusId: statusId,
      dataTargetDate: targetSubmissionDate || "",
      dataPastTarget: isPastTargetSubmissionDate(student, new Date().toISOString().slice(0, 10)) ? "1" : "0",
      dataNextMeetingDate: student.nextMeetingAt || "",
      dataArchivedAt: student.archivedAt || "",
      dataLogCount: String(student.logCount),
      summaryHtml: raw(summaryHtml),
      degreeLabel,
      phaseLabel,
      targetDate: targetSubmissionDate || "Not set",
      nextMeetingText: student.nextMeetingAt ? formatCompactDateTime(student.nextMeetingAt, timeZone) : "Not booked",
      nextMeetingTitle: student.nextMeetingAt ? formatDateTime(student.nextMeetingAt, timeZone) : "Not booked",
      meetingTextClass: statusId === "overdue" ? "text-app-danger-text dark:text-app-danger-text-dark" : "",
      hasStatusLabel: Boolean(student.nextMeetingAt) && statusId !== "not_booked",
      archivedAtText: student.archivedAt ? formatDateTime(student.archivedAt, timeZone) : "Unknown",
      logCountText: String(student.logCount),
      statusLabel:
        statusId === "overdue"
          ? "Overdue"
          : statusId === "not_booked"
            ? "Not booked"
            : statusId === "within_2_weeks"
              ? "Meeting soon"
              : "Scheduled",
    };
  });
}

export function renderStudentsTable(
  students: Student[],
  selectedStudent: Student | null,
  filters: DashboardFilters,
  dashboardLanes: DashboardLaneDefinition[],
  ganttHtml: string,
  phaseLanesHtml: string,
  selectedPanel: string,
  emptySelectedPanel: string,
  options: { canEdit?: boolean; timeZone?: string; activeStudentCount?: number; archivedStudentCount?: number } = {},
): string {
  const { canEdit = false, timeZone, activeStudentCount = students.length, archivedStudentCount = 0 } = options;
  const isArchivedScope = filters.scope === "archived";
  const degreeFilterOptions = prepareFilterOptions(
    [
      { value: "", label: "All degree types" },
      ...DEGREE_TYPES.map((degree) => ({
        value: degree.id,
        label: degree.label,
      })),
    ],
    filters.degree,
  );
  const phaseFilterOptions = prepareFilterOptions(
    [
      { value: "", label: "All phases" },
      ...PHASES.map((phase) => ({
        value: phase.id,
        label: dashboardLanes.find((lane) => lane.phaseId === phase.id)?.label || phase.label,
      })),
    ],
    filters.phase,
  );
  const statusFilterOptions = prepareFilterOptions(
    [
      { value: "", label: "All statuses" },
      { value: "not_booked", label: "Not booked" },
      { value: "overdue", label: "Overdue" },
      { value: "within_2_weeks", label: "Meeting soon" },
      { value: "scheduled", label: "Scheduled" },
      { value: "past_target", label: "Past MSc target" },
    ],
    filters.status,
  );
  const studentRows = prepareStudentRows(students, selectedStudent, filters, dashboardLanes, timeZone);
  const sortHeaders: PreparedSortHeader[] = isArchivedScope
    ? [
        { key: "student", label: "Student" },
        { key: "phase", label: "Last phase" },
        { key: "archived", label: "Archived (local)" },
      ]
    : [
        { key: "student", label: "Student" },
        { key: "phase", label: "Phase" },
        { key: "nextMeeting", label: "Next meeting" },
        { key: "target", label: "Target" },
      ];
  const filtersPanelHtml = renderView(
    `<div class="flex flex-wrap items-start gap-3">
        <label class="min-w-0 flex-1 text-xs font-medium">
          Search
          <input
            id="studentSearch"
            type="search"
            placeholder="Search students"
            aria-describedby="studentResultsMeta"
            &class="filterControlClass"
            &value="searchValue"
          />
        </label>
        <details class="min-w-0 pt-5">
          <summary class="cursor-pointer text-sm font-medium">Filters</summary>
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label &class="filterLabelClass">
          Degree type
          <select id="degreeFilter" &class="filterControlClass">
            <fragment &foreach="degreeFilterOptions as option">
              <option &value="option.optionValue" &selected="option.selectedAttr" &children="option.label"></option>
            </fragment>
          </select>
        </label>
        <label &class="filterLabelClass">
          Phase
          <select id="phaseFilter" &class="filterControlClass">
            <fragment &foreach="phaseFilterOptions as option">
              <option &value="option.optionValue" &selected="option.selectedAttr" &children="option.label"></option>
            </fragment>
          </select>
        </label>
        <label &visibleIf="showMeetingStatusFilter" &class="filterLabelClass">
          Meeting status
          <select id="statusFilter" &class="filterControlClass">
            <fragment &foreach="statusFilterOptions as option">
              <option &value="option.optionValue" &selected="option.selectedAttr" &children="option.label"></option>
            </fragment>
          </select>
        </label>
          </div>
        </details>
      </div>`,
    {
      filterLabelClass: FILTER_LABEL,
      showMeetingStatusFilter: !isArchivedScope,
      filterControlClass: FIELD_CONTROL_WITH_MARGIN,
      searchValue: filters.search,
      degreeFilterOptions,
      phaseFilterOptions,
      statusFilterOptions,
    },
  );
  const activeFiltersPanelHtml = '<div id="activeDashboardFilters" class="mb-3 hidden"></div>';
  const workspaceViewToggleHtml = renderToggleGroup({
    className: TOGGLE_GROUP_SEGMENTED,
    items: [
      {
        label: "List",
        pressed: filters.viewMode === "list",
        attrs: {
          "data-workspace-view-button": "list",
        },
      },
      {
        label: "Phases",
        pressed: filters.viewMode === "phases",
        attrs: {
          "data-workspace-view-button": "phases",
        },
      },
      {
        label: "Gantt",
        pressed: filters.viewMode === "gantt",
        attrs: {
          "data-workspace-view-button": "gantt",
        },
      },
    ],
  });
  const scopeToggleHtml = renderView(
    `<nav aria-label="Student scope" &class="toggleGroupClass">
      <a href="/" &class="toggleButtonClass" &aria-pressed="activePressed">Active <span &children="activeCount"></span></a>
      <a href="/?scope=archived&sort=archived&dir=desc" &class="toggleButtonClass" &aria-pressed="archivedPressed">Archived <span &children="archivedCount"></span></a>
    </nav>`,
    {
      toggleGroupClass: TOGGLE_GROUP_SEGMENTED,
      toggleButtonClass: `${TOGGLE_BUTTON_SEGMENTED} ${FOCUS_RING}`,
      activePressed: isArchivedScope ? "false" : "true",
      archivedPressed: isArchivedScope ? "true" : "false",
      activeCount: String(activeStudentCount),
      archivedCount: String(archivedStudentCount),
    },
  );

  return renderView(
    `<section id="dashboardWorkspace" &class="workspaceClass">
      <article class="student-cohort min-w-0">
        <div class="mb-panel-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold" &children="scopeHeading"></h2>
          </div>
          <fragment &children="scopeToggleHtml"></fragment>
        </div>
        <fragment &children="filtersPanelHtml"></fragment>
        <fragment &children="activeFiltersPanelHtml"></fragment>
        <div class="my-3 flex flex-wrap items-center justify-between gap-3">
          <p id="studentResultsMeta" class="sr-only min-w-0 text-sm sm:not-sr-only font-medium text-app-text-muted dark:text-app-text-muted-dark"></p>
          <div class="flex flex-wrap items-center gap-2">
            <fragment &visibleIf="showWorkspaceViews" &children="workspaceViewToggleHtml"></fragment>
            <div class="flex items-center gap-2">
              <fragment &children="addStudentButtonHtml"></fragment>
            </div>
          </div>
        </div>
        <div id="workspaceListView" &class="listViewClass">
          <div class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-app-line pb-2 text-xs text-app-text-muted dark:border-app-line-dark dark:text-app-text-muted-dark sm:hidden" aria-hidden="true">
            <span>Student</span><span &children="phaseColumnLabel"></span><span &children="meetingColumnLabel"></span>
          </div>
          <div id="mobileStudentCardList" class="sm:hidden">
            <fragment &visibleIf="hasStudentRows">
              <fragment &foreach="studentRows as row">
                <article
                  &class="row.mobileCardClass"
                  data-mobile-student-card
                  &data-select-href="row.selectHref"
                  &data-student-id="row.studentIdAttr"
                  &data-name="row.dataName"
                  &data-email="row.dataEmail"
                  &data-topic="row.dataTopic"
                  &data-notes="row.dataNotes"
                  &data-degree="row.dataDegree"
                  &data-degree-label="row.dataDegreeLabel"
                  &data-phase="row.dataPhase"
                  &data-phase-label="row.dataPhaseLabel"
                  &data-status-id="row.dataStatusId"
                  &data-target-date="row.dataTargetDate"
                  &data-past-target="row.dataPastTarget"
                  &data-next-meeting-date="row.dataNextMeetingDate"
                  &data-archived-at="row.dataArchivedAt"
                  &data-log-count="row.dataLogCount"
                  &aria-selected="row.selectedAttr"
                  tabindex="0"
                >
                  <div class="min-w-0"><fragment &children="row.summaryHtml"></fragment></div>
                  <p class="min-w-0 text-xs" &children="row.phaseLabel"></p>
                  <div class="min-w-0 text-xs">
                    <p &visibleIf="showActiveColumns" &class="row.meetingTextClass" &title="row.nextMeetingTitle" &children="row.nextMeetingText"></p>
                    <p &visibleIf="showArchivedColumn" &children="row.archivedAtText"></p>
                    <p &visibleIf="row.hasStatusLabel" &class="row.meetingTextClass" &children="row.statusLabel"></p>
                  </div>
                </article>
              </fragment>
            </fragment>
            <p &visibleIf="showEmptyRow" class="rounded-card border border-app-line bg-app-surface-soft/55 px-panel-sm py-stack-xs text-sm text-app-text-muted dark:border-app-line-dark dark:bg-app-surface-soft-dark/25 dark:text-app-text-muted-dark" &children="emptyStateText"></p>
          </div>
          <div class="hidden sm:block">
            <table class="student-table divide-y divide-app-line text-sm dark:divide-app-line-dark">
              <thead>
                <tr &class="tableHeaderClass">
                  <fragment &foreach="sortHeaders as header">
                    <th scope="col" class="px-cell-x py-stack-xs text-left align-middle" aria-sort="none">
                      <button
                        type="button"
                        data-student-sort="1"
                        &data-sort-key="header.key"
                        class="inline-flex items-center gap-1 font-medium text-app-text dark:text-app-text-dark underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark"
                      >
                        <span &children="header.label"></span>
                        <span aria-hidden="true" data-sort-indicator="1" class="text-xs text-app-text-muted dark:text-app-text-muted-dark">↕</span>
                      </button>
                    </th>
                  </fragment>
                </tr>
              </thead>
              <tbody id="studentsTableBody" class="divide-y divide-app-surface-soft dark:divide-app-surface-soft-dark">
                <fragment &visibleIf="hasStudentRows">
                  <fragment &foreach="studentRows as row">
                    <tr
                      &class="row.rowClass"
                      data-student-row
                      &data-select-href="row.selectHref"
                      &data-student-id="row.studentIdAttr"
                      &data-name="row.dataName"
                      &data-email="row.dataEmail"
                      &data-topic="row.dataTopic"
                      &data-notes="row.dataNotes"
                      &data-degree="row.dataDegree"
                      &data-degree-label="row.dataDegreeLabel"
                      &data-phase="row.dataPhase"
                      &data-phase-label="row.dataPhaseLabel"
                      &data-status-id="row.dataStatusId"
                      &data-target-date="row.dataTargetDate"
                  &data-past-target="row.dataPastTarget"
                      &data-next-meeting-date="row.dataNextMeetingDate"
                      &data-archived-at="row.dataArchivedAt"
                      &data-log-count="row.dataLogCount"
                      &aria-selected="row.selectedAttr"
                      tabindex="0"
                    >
                      <td &class="studentCellClass"><fragment &children="row.summaryHtml"></fragment></td>
                      <td &class="cellClass" &children="row.phaseLabel"></td>
                      <fragment &visibleIf="showActiveColumns">
                        <td &class="cellClass">
                          <p &class="row.meetingTextClass" &title="row.nextMeetingTitle" &children="row.nextMeetingText"></p>
                          <p &visibleIf="row.hasStatusLabel" class="mt-1 text-xs" &children="row.statusLabel"></p>
                        </td>
                        <td &class="cellClass" &children="row.targetDate"></td>
                      </fragment>
                      <td &visibleIf="showArchivedColumn" &class="cellClass" &children="row.archivedAtText"></td>
                    </tr>
                  </fragment>
                </fragment>
                <tr &visibleIf="showEmptyRow">
                  <td &colspan="emptyColumnCount" class="px-cell-x py-stack-xs text-sm text-app-text-muted dark:text-app-text-muted-dark" &children="emptyStateText"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div id="workspacePhaseView" &class="phaseViewClass">
          <fragment &children="phaseLanesHtml"></fragment>
        </div>
        <div id="workspaceGanttView" &class="ganttViewClass">
          <fragment &children="ganttHtml"></fragment>
        </div>
        <div id="noMatchingStudents" class="hidden border-t border-app-line py-6 text-sm dark:border-app-line-dark" role="status">
          <p>No matching students.</p>
          <button type="button" data-clear-filters class="mt-2 text-app-brand underline dark:text-app-brand-ring">Clear filters</button>
        </div>
      </article>
      <aside id="selectedStudentPanelShell" &class="selectedPanelShellClass" aria-label="Student workspace">
        <div id="selectedStudentPanel"><fragment &children="selectedPanel"></fragment></div>
      </aside>
      <template id="emptySelectedStudentPanelTemplate"><fragment &children="emptySelectedPanel"></fragment></template>
    </section>`,
    {
      workspaceClass: `dashboard-workspace${selectedStudent ? " has-selection" : ""}`,
      cellClass: TABLE_CELL,
      studentCellClass: `${TABLE_CELL} pr-3`,
      workspaceViewToggleHtml: raw(workspaceViewToggleHtml),
      scopeToggleHtml: raw(scopeToggleHtml),
      showWorkspaceViews: !isArchivedScope,
      scopeHeading: isArchivedScope ? "Archived students" : "Students",
      phaseColumnLabel: isArchivedScope ? "Last phase" : "Phase",
      meetingColumnLabel: isArchivedScope ? "Archived" : "Next meeting",
      listViewClass: `${filters.viewMode === "list" ? "" : "hidden "}space-y-stack-xs`,
      phaseViewClass: filters.viewMode === "phases" ? "" : "hidden ",
      ganttViewClass: filters.viewMode === "gantt" ? "" : "hidden ",
      tableHeaderClass: TABLE_HEADER_ROW,
      filtersPanelHtml: raw(filtersPanelHtml),
      activeFiltersPanelHtml: raw(activeFiltersPanelHtml),
      sortHeaders,
      hasStudentRows: studentRows.length > 0,
      addStudentButtonHtml: raw(
        canEdit
          ? renderButton({
              label: "Add student",
              href: "/students/new",
              variant: "neutral",
              className: "inline-flex justify-center",
            })
          : "",
      ),
      selectedPanelShellClass: `${selectedStudent ? "" : "hidden "}student-workspace`,
      showEmptyRow: studentRows.length === 0,
      showActiveColumns: !isArchivedScope,
      showArchivedColumn: isArchivedScope,
      emptyColumnCount: isArchivedScope ? "3" : "4",
      emptyStateText: isArchivedScope ? "No archived students." : "No students yet.",
      studentRows,
      ganttHtml: raw(ganttHtml),
      phaseLanesHtml: raw(phaseLanesHtml),
      selectedPanel: raw(selectedPanel),
      emptySelectedPanel: raw(emptySelectedPanel),
    },
  );
}
