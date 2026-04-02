import { raw } from "../../htmlisp";
import type { Student } from "../../students/store";
import {
  FIELD_CONTROL_WITH_MARGIN,
  FILTER_LABEL,
  MUTED_TEXT_XS,
  SURFACE_CARD,
  TABLE_CELL,
  TABLE_HEADER_ROW,
  TEXT_LINK,
  TOPIC_TEXT_SM,
  renderBadge,
  renderButton,
} from "../../ui";
import { DEGREE_TYPES, getDegreeLabel, getPhaseLabel, getTargetSubmissionDate, meetingStatusId, PHASES } from "../../students";
import { formatDateTime } from "../../formatting";
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
  dataNextMeetingDate: string;
  dataLogCount: string;
  summaryHtml: unknown;
  degreeBadgeHtml: unknown;
  phaseBadgeHtml: unknown;
  degreeLabel: string;
  phaseLabel: string;
  targetDate: string;
  nextMeetingText: string;
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

function prepareStudentRows(students: Student[], selectedStudent: Student | null, filters: DashboardFilters): PreparedStudentRow[] {
  return students.map((student) => {
    const statusId = meetingStatusId(student);
    const targetSubmissionDate = getTargetSubmissionDate(student);
    const degreeLabel = getDegreeLabel(student.degreeType, DEGREE_TYPES);
    const phaseLabel = getPhaseLabel(student.currentPhase, PHASES);
    const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
    const summaryHtml = renderView(
      `<div class="min-w-0 max-w-[21rem] space-y-1 pr-badge-y p-2">
        <div>
          <a &class="linkClass" &href="href" data-inline-select="1" &data-student-id="studentIdAttr" &children="name"></a>
        </div>
        <div
          &visibleIf="topicVisible"
          &class="topicTextClass"
          style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
          &children="topic"
        ></div>
        <div
          &visibleIf="notesVisible"
          class="mt-1 text-xs text-app-text-muted dark:text-app-text-muted-dark"
          style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
          &children="notes"
        ></div>
      </div>`,
      {
        linkClass: `block text-[15px] leading-6 font-medium ${TEXT_LINK}`,
        href: buildDashboardHref(filters, student.id),
        studentIdAttr: String(student.id),
        name: student.name,
        topicVisible: Boolean(student.thesisTopic),
        topic: student.thesisTopic || "",
        notesVisible: Boolean(student.studentNotes),
        notes: student.studentNotes || "",
        topicTextClass: TOPIC_TEXT_SM,
      },
    );

    return {
      rowClass:
        `${isSelected ? "bg-app-brand-soft dark:bg-app-brand-soft-dark/20" : "hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/35"} cursor-pointer transition-colors`,
      mobileCardClass:
        `rounded-card border p-panel-sm transition ${
          isSelected
            ? "border-app-brand bg-app-brand-soft/80 dark:border-app-brand-ring dark:bg-app-brand-soft-dark/20"
            : "border-app-line bg-app-surface hover:border-app-line-strong hover:bg-app-surface-soft dark:border-app-line-dark dark:bg-app-surface-dark dark:hover:border-app-line-dark-strong dark:hover:bg-app-surface-soft-dark/40"
        }`,
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
      dataNextMeetingDate: student.nextMeetingAt || "",
      dataLogCount: String(student.logCount),
      summaryHtml: raw(summaryHtml),
      degreeBadgeHtml: raw(renderBadge({
        label: degreeLabel,
      })),
      phaseBadgeHtml: raw(renderBadge({
        label: phaseLabel,
      })),
      degreeLabel,
      phaseLabel,
      targetDate: targetSubmissionDate || "Not set",
      nextMeetingText: student.nextMeetingAt ? formatDateTime(student.nextMeetingAt) : "Not booked",
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
  metricsHtml: string,
  phaseLanesHtml: string,
  selectedPanel: string,
  emptySelectedPanel: string,
  options: { canEdit?: boolean } = {},
): string {
  const { canEdit = false } = options;
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
        label: phase.label,
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
    ],
    filters.status,
  );
  const studentRows = prepareStudentRows(students, selectedStudent, filters);
  const sortHeaders: PreparedSortHeader[] = [
    { key: "student", label: "Student" },
    { key: "degree", label: "Degree" },
    { key: "phase", label: "Phase" },
    { key: "target", label: "Target" },
    { key: "nextMeeting", label: "Next meeting (local)" },
    { key: "logs", label: "Logs" },
  ];

  return renderView(
    `<section id="dashboardWorkspace">
      <article &class="studentsCardClass">
        <div class="mb-panel-sm">
          <div id="workspaceMetricStrip"><fragment &children="metricsHtml"></fragment></div>
        </div>
        <div class="mb-panel-sm rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35">
          <div class="grid grid-cols-1 gap-stack-xs sm:grid-cols-2 xl:grid-cols-4">
            <label &class="filterLabelClass">
              Search
              <input
                id="studentSearch"
                type="search"
                placeholder="Name, email, topic, or notes"
                aria-describedby="studentResultsMeta"
                &class="filterControlClass"
                &value="searchValue"
              />
            </label>
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
            <label &class="filterLabelClass">
              Meeting status
              <select id="statusFilter" &class="filterControlClass">
                <fragment &foreach="statusFilterOptions as option">
                  <option &value="option.optionValue" &selected="option.selectedAttr" &children="option.label"></option>
                </fragment>
              </select>
            </label>
          </div>
        </div>
        <div id="activeDashboardFilters" class="mb-panel-sm hidden rounded-card border border-app-line bg-app-surface-soft/55 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/25"></div>
        <div class="mb-badge-pill-y flex flex-col gap-badge-y lg:flex-row lg:items-center lg:justify-between">
          <p id="studentResultsMeta" class="min-w-0 text-sm font-medium text-app-text-muted dark:text-app-text-muted-dark"></p>
          <div class="flex flex-wrap items-center gap-badge-y self-start lg:justify-end">
            <div class="inline-flex items-center gap-1 rounded-control bg-app-surface-soft/45 p-0.5 dark:bg-app-surface-soft-dark/25">
              <button
                type="button"
                data-workspace-view-button="list"
                &class="workspaceViewButtonClass"
                &aria-pressed="listViewPressed"
              >List</button>
              <button
                type="button"
                data-workspace-view-button="phases"
                &class="workspaceViewButtonClass"
                &aria-pressed="phasesViewPressed"
              >Phases</button>
            </div>
            <fragment &children="addStudentButtonHtml"></fragment>
            <fragment &children="panelToggleButtonHtml"></fragment>
          </div>
        </div>
        <div id="selectedStudentPanelShell" &class="selectedPanelShellClass">
          <div id="selectedStudentPanel"><fragment &children="selectedPanel"></fragment></div>
        </div>
        <div id="workspaceListView" &class="listViewClass">
          <div id="mobileStudentCardList" class="space-y-stack-xs sm:hidden">
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
                  &data-next-meeting-date="row.dataNextMeetingDate"
                  &data-log-count="row.dataLogCount"
                  &aria-selected="row.selectedAttr"
                  tabindex="0"
                >
                  <div class="flex items-start justify-between gap-stack-xs">
                    <div class="min-w-0 flex-1"><fragment &children="row.summaryHtml"></fragment></div>
                    <div class="shrink-0 flex flex-col items-end gap-badge-y">
                      <fragment &children="row.degreeBadgeHtml"></fragment>
                      <fragment &children="row.phaseBadgeHtml"></fragment>
                    </div>
                  </div>
                  <dl class="mt-stack-xs grid grid-cols-2 gap-x-stack-xs gap-y-badge-y text-xs">
                    <div>
                      <dt class="text-app-text-muted dark:text-app-text-muted-dark">Target</dt>
                      <dd class="mt-1 font-medium" &children="row.targetDate"></dd>
                    </div>
                    <div>
                      <dt class="text-app-text-muted dark:text-app-text-muted-dark">Next meeting</dt>
                      <dd class="mt-1 font-medium" &children="row.nextMeetingText"></dd>
                    </div>
                    <div>
                      <dt class="text-app-text-muted dark:text-app-text-muted-dark">Logs</dt>
                      <dd class="mt-1 font-medium" &children="row.logCountText"></dd>
                    </div>
                    <div>
                      <dt class="text-app-text-muted dark:text-app-text-muted-dark">Status</dt>
                      <dd class="mt-1 font-medium" &children="row.statusLabel"></dd>
                    </div>
                  </dl>
                </article>
              </fragment>
            </fragment>
            <p &visibleIf="showEmptyRow" class="rounded-card border border-app-line bg-app-surface-soft/55 px-panel-sm py-stack-xs text-sm text-app-text-muted dark:border-app-line-dark dark:bg-app-surface-soft-dark/25 dark:text-app-text-muted-dark">
              No students yet.
            </p>
          </div>
          <div class="hidden overflow-x-auto rounded-card border border-app-line bg-app-surface-soft/35 dark:border-app-line-dark dark:bg-app-surface-soft-dark/20 sm:block">
            <table class="w-full min-w-table divide-y divide-app-line text-sm dark:divide-app-line-dark">
              <thead>
                <tr &class="tableHeaderClass">
                  <fragment &foreach="sortHeaders as header">
                    <th scope="col" class="px-cell-x py-cell-y text-left align-middle" aria-sort="none">
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
                      &data-next-meeting-date="row.dataNextMeetingDate"
                      &data-log-count="row.dataLogCount"
                      &aria-selected="row.selectedAttr"
                      tabindex="0"
                    >
                      <td &class="studentCellClass"><fragment &children="row.summaryHtml"></fragment></td>
                      <td &class="cellClass" &children="row.degreeLabel"></td>
                      <td &class="cellClass" &children="row.phaseLabel"></td>
                      <td &class="cellClass" &children="row.targetDate"></td>
                      <td &class="cellClass" &children="row.nextMeetingText"></td>
                      <td &class="cellClass" &children="row.logCountText"></td>
                    </tr>
                  </fragment>
                </fragment>
                <tr &visibleIf="showEmptyRow">
                  <td colspan="6" class="px-cell-x py-stack-xs text-sm text-app-text-muted dark:text-app-text-muted-dark">No students yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div id="workspacePhaseView" &class="phaseViewClass">
          <fragment &children="phaseLanesHtml"></fragment>
        </div>
      </article>
      <template id="emptySelectedStudentPanelTemplate"><fragment &children="emptySelectedPanel"></fragment></template>
    </section>`,
    {
      studentsCardClass: `min-w-0 flex-1 overflow-hidden ${SURFACE_CARD}`,
      cellClass: TABLE_CELL,
      studentCellClass: `${TABLE_CELL} w-[30%] min-w-[18rem] max-w-[22rem] align-top pr-panel-sm`,
      mutedTextXs: MUTED_TEXT_XS,
      filterLabelClass: FILTER_LABEL,
      filterControlClass: FIELD_CONTROL_WITH_MARGIN,
      workspaceViewButtonClass:
        "rounded-control border border-transparent px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-text transition hover:bg-app-surface hover:text-app-text aria-[pressed='true']:border-app-brand aria-[pressed='true']:bg-app-surface aria-[pressed='true']:text-app-brand-strong aria-[pressed='true']:shadow-sm dark:text-app-text-dark dark:hover:bg-app-surface-dark dark:hover:text-app-text-dark dark:aria-[pressed='true']:border-app-brand-ring dark:aria-[pressed='true']:bg-app-surface-dark dark:aria-[pressed='true']:text-app-brand-ring sm:text-sm",
      listViewPressed: filters.viewMode === "list" ? "true" : "false",
      phasesViewPressed: filters.viewMode === "phases" ? "true" : "false",
      listViewClass: `${filters.viewMode === "list" ? "" : "hidden "}space-y-stack-xs`,
      phaseViewClass: filters.viewMode === "phases" ? "" : "hidden ",
      searchValue: filters.search,
      tableHeaderClass: TABLE_HEADER_ROW,
      degreeFilterOptions,
      phaseFilterOptions,
      statusFilterOptions,
      sortHeaders,
      hasStudentRows: studentRows.length > 0,
      addStudentButtonHtml: raw(
        canEdit
          ? renderButton({
              label: "Add student",
              href: "/students/new",
              variant: "primary",
              className: "w-full sm:w-auto",
            })
          : "",
      ),
      panelToggleButtonHtml: raw(renderButton({
        label: selectedStudent ? "Hide details" : "Show details",
        type: "button",
        variant: "neutral",
        className: "xl:hidden",
        attrs: {
          id: "toggleStudentPanelButton",
          "aria-expanded": selectedStudent ? "true" : "false",
        },
      })),
      selectedPanelShellClass: `${selectedStudent ? "" : "hidden "}mb-panel-sm`,
      showEmptyRow: studentRows.length === 0,
      studentRows,
      metricsHtml: raw(metricsHtml),
      phaseLanesHtml: raw(phaseLanesHtml),
      selectedPanel: raw(selectedPanel),
      emptySelectedPanel: raw(emptySelectedPanel),
    },
  );
}
