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
} from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { addSixMonths, escapeHtml, formatDateTime, getDegreeLabel, getPhaseLabel, meetingStatusId } from "../../utils";
import { renderView } from "../shared.htmlisp";
import { DEGREE_TYPES, PHASES } from "../../reference-data";

interface PreparedFilterOption {
  label: string;
  optionValue: string;
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

function prepareFilterOptions(options: Array<{ value: string; label: string }>): PreparedFilterOption[] {
  return options.map((option) => ({
    optionValue: escapeHtml(option.value),
    label: escapeHtml(option.label),
  }));
}

function prepareStudentRows(students: Student[], selectedStudent: Student | null): PreparedStudentRow[] {
  return students.map((student) => {
    const statusId = meetingStatusId(student);
    const targetSubmissionDate = addSixMonths(student.startDate);
    const degreeLabel = getDegreeLabel(student.degreeType, DEGREE_TYPES);
    const phaseLabel = getPhaseLabel(student.currentPhase, PHASES);
    const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
    const summaryHtml = renderView(
      `<div class="min-w-0 max-w-[24rem]">
        <div class="font-medium">
          <a &class="(get props linkClass)" &href="(get props href)" data-inline-select="1" &data-student-id="(get props studentIdAttr)" &children="(get props name)"></a>
        </div>
        <div
          &visibleIf="(get props topicVisible)"
          &class="(get props topicTextClass)"
          style="-webkit-line-clamp: 1; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
          &children="(get props topic)"
        ></div>
      </div>`,
      {
        linkClass: escapeHtml(TEXT_LINK),
        href: escapeHtml(`/?selected=${student.id}`),
        studentIdAttr: String(student.id),
        name: escapeHtml(student.name),
        topicVisible: Boolean(student.thesisTopic),
        topic: escapeHtml(student.thesisTopic || ""),
        topicTextClass: escapeHtml(TOPIC_TEXT_SM),
      },
    );

    return {
      rowClass: escapeHtml(
        `${isSelected ? "bg-app-brand-soft dark:bg-app-brand-soft-dark/20" : "hover:bg-app-surface-soft dark:hover:bg-app-surface-soft-dark/35"} cursor-pointer`,
      ),
      selectedAttr: isSelected ? "true" : "false",
      selectHref: escapeHtml(`/?selected=${student.id}`),
      studentIdAttr: String(student.id),
      dataName: escapeHtml(student.name).toLowerCase(),
      dataEmail: escapeHtml(student.email || "").toLowerCase(),
      dataTopic: escapeHtml(student.thesisTopic || "").toLowerCase(),
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
  const sortHeaders: PreparedSortHeader[] = [
    { key: "student", label: "Student" },
    { key: "degree", label: "Degree" },
    { key: "phase", label: "Phase" },
    { key: "target", label: "Target" },
    { key: "nextMeeting", label: "Next meeting (local)" },
    { key: "logs", label: "Logs" },
  ];

  return renderView(
    `<section class="grid grid-cols-1 gap-stack xl:grid-cols-3">
      <article &class="(get props studentsCardClass)">
        <div class="mb-panel-sm">
          <h2 class="text-lg font-semibold">Students</h2>
          <p &class="(get props mutedTextXs)">Use filters to quickly find students that need attention.</p>
        </div>
        <div class="mb-panel-sm grid grid-cols-1 gap-stack-xs sm:grid-cols-2 xl:grid-cols-4">
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
              <option value="within_2_weeks">Meeting soon</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </label>
        </div>
        <p id="studentResultsMeta" class="mb-badge-pill-y text-xs text-app-text-muted dark:text-app-text-muted-dark"></p>
        <p class="mb-badge-pill-y text-xs text-app-text-muted dark:text-app-text-muted-dark">
          Tip: click a row to open student details, or click a column header to sort ascending or descending.
        </p>
        <div class="overflow-x-auto">
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
      <div id="selectedStudentPanel"><noop &children="(get props selectedPanel)"></noop></div>
      <template id="emptySelectedStudentPanelTemplate"><noop &children="(get props emptySelectedPanel)"></noop></template>
    </section>`,
    {
      studentsCardClass: escapeHtml(`overflow-hidden xl:col-span-2 ${SURFACE_CARD}`),
      cellClass: escapeHtml(TABLE_CELL),
      studentCellClass: escapeHtml(`${TABLE_CELL} w-[32%] max-w-[24rem] align-top`),
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      filterLabelClass: escapeHtml(FILTER_LABEL),
      filterControlClass: escapeHtml(FIELD_CONTROL_WITH_MARGIN),
      tableHeaderClass: escapeHtml(TABLE_HEADER_ROW),
      degreeFilterOptions,
      phaseFilterOptions,
      sortHeaders,
      hasStudentRows: studentRows.length > 0,
      showEmptyRow: studentRows.length === 0,
      studentRows,
      selectedPanel,
      emptySelectedPanel,
    },
    components,
  );
}
