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
import { type HtmlispComponents } from "../../htmlisp";
import { DEGREE_TYPES, getDegreeLabel, getPhaseLabel, getTargetSubmissionDate, meetingStatusId, PHASES } from "../../students";
import { escapeHtml, formatDateTime } from "../../formatting";
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
  summaryHtml: string;
  degreeBadgeHtml: string;
  phaseBadgeHtml: string;
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
    optionValue: escapeHtml(option.value),
    label: escapeHtml(option.label),
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
          <a &class="(get props linkClass)" &href="(get props href)" data-inline-select="1" &data-student-id="(get props studentIdAttr)" &children="(get props name)"></a>
        </div>
        <div
          &visibleIf="(get props topicVisible)"
          &class="(get props topicTextClass)"
          style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
          &children="(get props topic)"
        ></div>
        <div
          &visibleIf="(get props notesVisible)"
          class="mt-1 text-xs text-app-text-muted dark:text-app-text-muted-dark"
          style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
          &children="(get props notes)"
        ></div>
      </div>`,
      {
        linkClass: escapeHtml(`block text-[15px] leading-6 font-medium ${TEXT_LINK}`),
        href: escapeHtml(buildDashboardHref(filters, student.id)),
        studentIdAttr: String(student.id),
        name: escapeHtml(student.name),
        topicVisible: Boolean(student.thesisTopic),
        topic: escapeHtml(student.thesisTopic || ""),
        notesVisible: Boolean(student.studentNotes),
        notes: escapeHtml(student.studentNotes || ""),
        topicTextClass: escapeHtml(TOPIC_TEXT_SM),
      },
    );

    return {
      rowClass: escapeHtml(
        `${isSelected ? "bg-app-brand-soft dark:bg-app-brand-soft-dark/20" : "hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/35"} cursor-pointer transition-colors`,
      ),
      mobileCardClass: escapeHtml(
        `rounded-card border p-panel-sm transition ${
          isSelected
            ? "border-app-brand bg-app-brand-soft/80 dark:border-app-brand-ring dark:bg-app-brand-soft-dark/20"
            : "border-app-line bg-app-surface hover:border-app-line-strong hover:bg-app-surface-soft dark:border-app-line-dark dark:bg-app-surface-dark dark:hover:border-app-line-dark-strong dark:hover:bg-app-surface-soft-dark/40"
        }`,
      ),
      selectedAttr: isSelected ? "true" : "false",
      selectHref: escapeHtml(buildDashboardHref(filters, student.id)),
      studentIdAttr: String(student.id),
      dataName: escapeHtml(student.name).toLowerCase(),
      dataEmail: escapeHtml(student.email || "").toLowerCase(),
      dataTopic: escapeHtml(student.thesisTopic || "").toLowerCase(),
      dataNotes: escapeHtml(student.studentNotes || "").toLowerCase(),
      dataDegree: escapeHtml(student.degreeType),
      dataDegreeLabel: escapeHtml(degreeLabel).toLowerCase(),
      dataPhase: escapeHtml(student.currentPhase),
      dataPhaseLabel: escapeHtml(phaseLabel).toLowerCase(),
      dataStatusId: escapeHtml(statusId),
      dataTargetDate: escapeHtml(targetSubmissionDate || ""),
      dataNextMeetingDate: escapeHtml(student.nextMeetingAt || ""),
      dataLogCount: String(student.logCount),
      summaryHtml,
      degreeBadgeHtml: renderBadge({
        label: degreeLabel,
      }),
      phaseBadgeHtml: renderBadge({
        label: phaseLabel,
      }),
      degreeLabel: escapeHtml(degreeLabel),
      phaseLabel: escapeHtml(phaseLabel),
      targetDate: escapeHtml(targetSubmissionDate || "Not set"),
      nextMeetingText: escapeHtml(student.nextMeetingAt ? formatDateTime(student.nextMeetingAt) : "Not booked"),
      logCountText: String(student.logCount),
      statusLabel: escapeHtml(
        statusId === "overdue"
          ? "Overdue"
          : statusId === "not_booked"
            ? "Not booked"
            : statusId === "within_2_weeks"
              ? "Meeting soon"
              : "Scheduled",
      ),
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
  const components: HtmlispComponents = {
    SortHeader: `<th
    scope="col"
    class="px-cell-x py-cell-y text-left align-middle"
    aria-sort="none"
  >
    <button
      type="button"
      data-student-sort="1"
      &data-sort-key="(get props key)"
      class="inline-flex items-center gap-1 font-medium text-app-text dark:text-app-text-dark underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark"
    >
      <span &children="(get props label)"></span>
      <span aria-hidden="true" data-sort-indicator="1" class="text-xs text-app-text-muted dark:text-app-text-muted-dark">↕</span>
    </button>
  </th>`,
    StudentTableRow: `<tr
    &class="(get props rowClass)"
    data-student-row
    &data-select-href="(get props selectHref)"
    &data-student-id="(get props studentIdAttr)"
    &data-name="(get props dataName)"
    &data-email="(get props dataEmail)"
    &data-topic="(get props dataTopic)"
    &data-notes="(get props dataNotes)"
    &data-degree="(get props dataDegree)"
    &data-degree-label="(get props dataDegreeLabel)"
    &data-phase="(get props dataPhase)"
    &data-phase-label="(get props dataPhaseLabel)"
    &data-status-id="(get props dataStatusId)"
    &data-target-date="(get props dataTargetDate)"
    &data-next-meeting-date="(get props dataNextMeetingDate)"
    &data-log-count="(get props dataLogCount)"
    &aria-selected="(get props selectedAttr)"
    tabindex="0"
  >
    <td &class="(get props studentCellClass)"><noop &children="(get props summaryHtml)"></noop></td>
    <td &class="(get props cellClass)" &children="(get props degreeLabel)"></td>
    <td &class="(get props cellClass)" &children="(get props phaseLabel)"></td>
    <td &class="(get props cellClass)" &children="(get props targetDate)"></td>
    <td &class="(get props cellClass)" &children="(get props nextMeetingText)"></td>
    <td &class="(get props cellClass)" &children="(get props logCountText)"></td>
  </tr>`,
    MobileStudentCard: `<article
    &class="(get props mobileCardClass)"
    data-mobile-student-card
    &data-select-href="(get props selectHref)"
    &data-student-id="(get props studentIdAttr)"
    &data-name="(get props dataName)"
    &data-email="(get props dataEmail)"
    &data-topic="(get props dataTopic)"
    &data-notes="(get props dataNotes)"
    &data-degree="(get props dataDegree)"
    &data-degree-label="(get props dataDegreeLabel)"
    &data-phase="(get props dataPhase)"
    &data-phase-label="(get props dataPhaseLabel)"
    &data-status-id="(get props dataStatusId)"
    &data-target-date="(get props dataTargetDate)"
    &data-next-meeting-date="(get props dataNextMeetingDate)"
    &data-log-count="(get props dataLogCount)"
    &aria-selected="(get props selectedAttr)"
    tabindex="0"
  >
    <div class="flex items-start justify-between gap-stack-xs">
      <div class="min-w-0 flex-1"><noop &children="(get props summaryHtml)"></noop></div>
      <div class="shrink-0 flex flex-col items-end gap-badge-y">
        <noop &children="(get props degreeBadgeHtml)"></noop>
        <noop &children="(get props phaseBadgeHtml)"></noop>
      </div>
    </div>
    <dl class="mt-stack-xs grid grid-cols-2 gap-x-stack-xs gap-y-badge-y text-xs">
      <div>
        <dt class="text-app-text-muted dark:text-app-text-muted-dark">Target</dt>
        <dd class="mt-1 font-medium" &children="(get props targetDate)"></dd>
      </div>
      <div>
        <dt class="text-app-text-muted dark:text-app-text-muted-dark">Next meeting</dt>
        <dd class="mt-1 font-medium" &children="(get props nextMeetingText)"></dd>
      </div>
      <div>
        <dt class="text-app-text-muted dark:text-app-text-muted-dark">Logs</dt>
        <dd class="mt-1 font-medium" &children="(get props logCountText)"></dd>
      </div>
      <div>
        <dt class="text-app-text-muted dark:text-app-text-muted-dark">Status</dt>
        <dd class="mt-1 font-medium" &children="(get props statusLabel)"></dd>
      </div>
    </dl>
  </article>`,
  };

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
    `<section id="dashboardWorkspace" class="flex flex-col gap-stack xl:flex-row xl:items-start">
      <article &class="(get props studentsCardClass)">
        <div class="mb-panel-sm flex flex-col gap-stack-xs sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold">Student Workspace</h2>
            <p &class="(get props mutedTextXs)">Switch between a sortable list and phase-based view without leaving the same workspace.</p>
          </div>
          <div class="flex flex-wrap items-center gap-badge-y sm:justify-end">
            <div class="inline-flex rounded-control border border-app-field bg-app-surface-soft/80 p-1 shadow-sm dark:border-app-field-dark dark:bg-app-surface-soft-dark/45">
              <button
                type="button"
                data-workspace-view-button="list"
                &class="(get props workspaceViewButtonClass)"
                &aria-pressed="(get props listViewPressed)"
              >List</button>
              <button
                type="button"
                data-workspace-view-button="phases"
                &class="(get props workspaceViewButtonClass)"
                &aria-pressed="(get props phasesViewPressed)"
              >Phases</button>
            </div>
            <noop &children="(get props clearSelectionButtonHtml)"></noop>
            <noop &children="(get props addStudentButtonHtml)"></noop>
            <noop &children="(get props panelToggleButtonHtml)"></noop>
          </div>
        </div>
        <div class="mb-panel-sm space-y-badge-y">
          <div class="flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between">
            <h3 class="text-sm font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark">Quick filters</h3>
            <p class="text-xs text-app-text-soft dark:text-app-text-soft-dark">Tap a stat to jump straight into the matching student set.</p>
          </div>
          <div id="workspaceMetricStrip"><noop &children="(get props metricsHtml)"></noop></div>
        </div>
        <div class="mb-panel-sm rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35">
          <div class="grid grid-cols-1 gap-stack-xs sm:grid-cols-2 xl:grid-cols-4">
            <label &class="(get props filterLabelClass)">
              Search
              <input
                id="studentSearch"
                type="search"
                placeholder="Name, email, topic, or notes"
                aria-describedby="studentResultsMeta"
                &class="(get props filterControlClass)"
                &value="(get props searchValue)"
              />
            </label>
            <label &class="(get props filterLabelClass)">
              Degree type
              <select id="degreeFilter" &class="(get props filterControlClass)">
                <noop &foreach="(get props degreeFilterOptions)">
                  <option &value="(get props optionValue)" &selected="(get props selectedAttr)" &children="(get props label)"></option>
                </noop>
              </select>
            </label>
            <label &class="(get props filterLabelClass)">
              Phase
              <select id="phaseFilter" &class="(get props filterControlClass)">
                <noop &foreach="(get props phaseFilterOptions)">
                  <option &value="(get props optionValue)" &selected="(get props selectedAttr)" &children="(get props label)"></option>
                </noop>
              </select>
            </label>
            <label &class="(get props filterLabelClass)">
              Meeting status
              <select id="statusFilter" &class="(get props filterControlClass)">
                <noop &foreach="(get props statusFilterOptions)">
                  <option &value="(get props optionValue)" &selected="(get props selectedAttr)" &children="(get props label)"></option>
                </noop>
              </select>
            </label>
          </div>
        </div>
        <div id="activeDashboardFilters" class="mb-panel-sm hidden rounded-card border border-app-line bg-app-surface-soft/55 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/25"></div>
        <div class="mb-badge-pill-y flex flex-col gap-badge-y text-xs text-app-text-muted dark:text-app-text-muted-dark sm:flex-row sm:items-center sm:justify-between">
          <p id="studentResultsMeta"></p>
          <p>Tip: selection, filters, and the current view stay in the URL.</p>
        </div>
        <div id="workspaceListView" &class="(get props listViewClass)">
          <div id="mobileStudentCardList" class="space-y-stack-xs sm:hidden">
            <noop &visibleIf="(get props hasStudentRows)">
              <noop &foreach="(get props studentRows)">
                <MobileStudentCard
                  &mobileCardClass="(get props mobileCardClass)"
                  &selectedAttr="(get props selectedAttr)"
                  &selectHref="(get props selectHref)"
                  &studentIdAttr="(get props studentIdAttr)"
                  &dataName="(get props dataName)"
                  &dataEmail="(get props dataEmail)"
                  &dataTopic="(get props dataTopic)"
                  &dataNotes="(get props dataNotes)"
                  &dataDegree="(get props dataDegree)"
                  &dataDegreeLabel="(get props dataDegreeLabel)"
                  &dataPhase="(get props dataPhase)"
                  &dataPhaseLabel="(get props dataPhaseLabel)"
                  &dataStatusId="(get props dataStatusId)"
                  &dataTargetDate="(get props dataTargetDate)"
                  &dataNextMeetingDate="(get props dataNextMeetingDate)"
                  &dataLogCount="(get props dataLogCount)"
                  &summaryHtml="(get props summaryHtml)"
                  &degreeBadgeHtml="(get props degreeBadgeHtml)"
                  &phaseBadgeHtml="(get props phaseBadgeHtml)"
                  &targetDate="(get props targetDate)"
                  &nextMeetingText="(get props nextMeetingText)"
                  &logCountText="(get props logCountText)"
                  &statusLabel="(get props statusLabel)"
                ></MobileStudentCard>
              </noop>
            </noop>
            <p &visibleIf="(get props showEmptyRow)" class="rounded-card border border-app-line bg-app-surface-soft/55 px-panel-sm py-stack-xs text-sm text-app-text-muted dark:border-app-line-dark dark:bg-app-surface-soft-dark/25 dark:text-app-text-muted-dark">
              No students yet.
            </p>
          </div>
          <div class="hidden overflow-x-auto rounded-card border border-app-line bg-app-surface-soft/35 dark:border-app-line-dark dark:bg-app-surface-soft-dark/20 sm:block">
            <table class="w-full min-w-table divide-y divide-app-line text-sm dark:divide-app-line-dark">
              <thead>
                <tr &class="(get props tableHeaderClass)">
                  <noop &foreach="(get props sortHeaders)">
                    <SortHeader &key="(get props key)" &label="(get props label)"></SortHeader>
                  </noop>
                </tr>
              </thead>
              <tbody id="studentsTableBody" class="divide-y divide-app-surface-soft dark:divide-app-surface-soft-dark">
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
                      &dataNotes="(get props dataNotes)"
                      &dataDegree="(get props dataDegree)"
                      &dataDegreeLabel="(get props dataDegreeLabel)"
                      &dataPhase="(get props dataPhase)"
                      &dataPhaseLabel="(get props dataPhaseLabel)"
                      &dataStatusId="(get props dataStatusId)"
                      &dataTargetDate="(get props dataTargetDate)"
                      &dataNextMeetingDate="(get props dataNextMeetingDate)"
                      &dataLogCount="(get props dataLogCount)"
                      &summaryHtml="(get props summaryHtml)"
                      &degreeLabel="(get props degreeLabel)"
                      &phaseLabel="(get props phaseLabel)"
                      &targetDate="(get props targetDate)"
                      &nextMeetingText="(get props nextMeetingText)"
                      &logCountText="(get props logCountText)"
                    ></StudentTableRow>
                  </noop>
                </noop>
                <tr &visibleIf="(get props showEmptyRow)">
                  <td colspan="6" class="px-cell-x py-stack-xs text-sm text-app-text-muted dark:text-app-text-muted-dark">No students yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div id="workspacePhaseView" &class="(get props phaseViewClass)">
          <noop &children="(get props phaseLanesHtml)"></noop>
        </div>
      </article>
      <div id="selectedStudentPanelShell" &class="(get props selectedPanelShellClass)">
        <div id="selectedStudentPanel"><noop &children="(get props selectedPanel)"></noop></div>
      </div>
      <template id="emptySelectedStudentPanelTemplate"><noop &children="(get props emptySelectedPanel)"></noop></template>
    </section>`,
    {
      studentsCardClass: escapeHtml(`min-w-0 flex-1 overflow-hidden ${SURFACE_CARD}`),
      cellClass: escapeHtml(TABLE_CELL),
      studentCellClass: escapeHtml(`${TABLE_CELL} w-[30%] min-w-[18rem] max-w-[22rem] align-top pr-panel-sm`),
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      filterLabelClass: escapeHtml(FILTER_LABEL),
      filterControlClass: escapeHtml(FIELD_CONTROL_WITH_MARGIN),
      workspaceViewButtonClass: escapeHtml(
        "rounded-control px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-text transition aria-[pressed='true']:bg-app-brand aria-[pressed='true']:text-white dark:text-app-text-dark dark:aria-[pressed='true']:bg-app-brand-strong sm:text-sm",
      ),
      listViewPressed: filters.viewMode === "list" ? "true" : "false",
      phasesViewPressed: filters.viewMode === "phases" ? "true" : "false",
      listViewClass: escapeHtml(filters.viewMode === "list" ? "" : "hidden "),
      phaseViewClass: escapeHtml(filters.viewMode === "phases" ? "" : "hidden "),
      searchValue: escapeHtml(filters.search),
      tableHeaderClass: escapeHtml(TABLE_HEADER_ROW),
      degreeFilterOptions,
      phaseFilterOptions,
      statusFilterOptions,
      sortHeaders,
      hasStudentRows: studentRows.length > 0,
      clearSelectionButtonHtml: renderButton({
        label: "Clear selection",
        type: "button",
        variant: "neutral",
        className: `${selectedStudent ? "" : "hidden "}w-full sm:w-auto`,
        attributes: `id="clearSelectedStudentButton" ${selectedStudent ? "" : 'aria-hidden="true"'}`,
      }),
      addStudentButtonHtml: canEdit
        ? renderButton({
            label: "Add student",
            href: "/students/new",
            variant: "primary",
            className: "w-full sm:w-auto",
          })
        : "",
      panelToggleButtonHtml: renderButton({
        label: selectedStudent ? "Hide student workspace" : "Show student workspace",
        type: "button",
        variant: "neutral",
        className: "xl:hidden",
        attributes: `id="toggleStudentPanelButton" aria-expanded="${selectedStudent ? "true" : "false"}"`,
      }),
      selectedPanelShellClass: escapeHtml(`${selectedStudent ? "" : "hidden "}min-w-0 xl:sticky xl:top-6 xl:w-[32rem] xl:shrink-0`),
      showEmptyRow: studentRows.length === 0,
      studentRows,
      metricsHtml,
      phaseLanesHtml,
      selectedPanel,
      emptySelectedPanel,
    },
    components,
  );
}
