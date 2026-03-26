import type { Student } from "../../db";
import {
  FIELD_CONTROL_WITH_MARGIN,
  FILTER_LABEL,
  MUTED_TEXT_XS,
  SURFACE_CARD,
  TABLE_CELL,
  TABLE_HEADER_ROW,
  TEXT_LINK,
  TOPIC_TEXT_SM,
  renderButton,
} from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { escapeHtml, formatDateTime, getDegreeLabel, getPhaseLabel, getTargetSubmissionDate, meetingStatusId } from "../../utils";
import { renderView } from "../shared.htmlisp";
import { DEGREE_TYPES, PHASES } from "../../reference-data";
import type { DashboardFilters } from "../types";

interface PreparedFilterOption {
  label: string;
  optionValue: string;
  selectedAttr: string | null;
}

interface PreparedStudentRow {
  rowClass: string;
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
  degreeLabel: string;
  phaseLabel: string;
  targetDate: string;
  nextMeetingText: string;
  logCountText: string;
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
      `<div class="min-w-0 max-w-[16rem]">
        <div class="font-medium">
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
        linkClass: escapeHtml(TEXT_LINK),
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
        `${isSelected ? "bg-app-brand-soft/90 dark:bg-app-brand-soft-dark/25" : "hover:bg-app-surface-soft/85 dark:hover:bg-app-surface-soft-dark/35"} cursor-pointer transition-colors`,
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
      degreeLabel: escapeHtml(degreeLabel),
      phaseLabel: escapeHtml(phaseLabel),
      targetDate: escapeHtml(targetSubmissionDate || "Not set"),
      nextMeetingText: escapeHtml(student.nextMeetingAt ? formatDateTime(student.nextMeetingAt) : "Not booked"),
      logCountText: String(student.logCount),
    };
  });
}

export function renderStudentsTable(
  students: Student[],
  selectedStudent: Student | null,
  filters: DashboardFilters,
  selectedPanel: string,
  emptySelectedPanel: string,
): string {
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
            <h2 class="text-lg font-semibold">Students</h2>
            <p &class="(get props mutedTextXs)">Find students quickly, then keep the detail panel open while you work through updates.</p>
          </div>
          <noop &children="(get props panelToggleButtonHtml)"></noop>
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
        <div class="mb-badge-pill-y flex flex-col gap-badge-y text-xs text-app-text-muted dark:text-app-text-muted-dark sm:flex-row sm:items-center sm:justify-between">
          <p id="studentResultsMeta"></p>
          <p>Tip: rows open the workspace, filters stay in the URL, and headers sort instantly.</p>
        </div>
        <div class="overflow-x-auto rounded-card border border-app-line bg-app-surface-soft/35 dark:border-app-line-dark dark:bg-app-surface-soft-dark/20">
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
      </article>
      <div id="selectedStudentPanelShell" &class="(get props selectedPanelShellClass)">
        <div id="selectedStudentPanel"><noop &children="(get props selectedPanel)"></noop></div>
      </div>
      <template id="emptySelectedStudentPanelTemplate"><noop &children="(get props emptySelectedPanel)"></noop></template>
    </section>`,
    {
      studentsCardClass: escapeHtml(`min-w-0 flex-1 overflow-hidden ${SURFACE_CARD}`),
      cellClass: escapeHtml(TABLE_CELL),
      studentCellClass: escapeHtml(`${TABLE_CELL} w-[24%] max-w-[16rem] align-top`),
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      filterLabelClass: escapeHtml(FILTER_LABEL),
      filterControlClass: escapeHtml(FIELD_CONTROL_WITH_MARGIN),
      searchValue: escapeHtml(filters.search),
      tableHeaderClass: escapeHtml(TABLE_HEADER_ROW),
      degreeFilterOptions,
      phaseFilterOptions,
      statusFilterOptions,
      sortHeaders,
      hasStudentRows: studentRows.length > 0,
      panelToggleButtonHtml: renderButton({
        label: "Show details panel",
        type: "button",
        variant: "neutral",
        attributes: 'id="toggleStudentPanelButton" aria-expanded="false"',
      }),
      selectedPanelShellClass: escapeHtml("hidden min-w-0 xl:sticky xl:top-6 xl:w-[32rem] xl:shrink-0"),
      showEmptyRow: studentRows.length === 0,
      studentRows,
      selectedPanel,
      emptySelectedPanel,
    },
    components,
  );
}
