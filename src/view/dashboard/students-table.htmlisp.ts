import type { Student } from "../../db";
import {
  FIELD_CONTROL_WITH_MARGIN,
  FILTER_LABEL,
  MUTED_TEXT_XS,
  STATUS_BADGE,
  SURFACE_CARD,
  TABLE_CELL,
  TABLE_HEADER_ROW,
  TEXT_LINK,
  TOPIC_TEXT_SM,
  getMeetingStatusBadgeClass,
  renderBadge,
  renderButton,
} from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { escapeHtml, formatDateTime, getDegreeLabel, getPhaseLabel, meetingStatusId, meetingStatusText } from "../../utils";
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

function prepareFilterOptions(options: Array<{ value: string; label: string }>): PreparedFilterOption[] {
  return options.map((option) => ({
    optionValue: escapeHtml(option.value),
    label: escapeHtml(option.label),
  }));
}

function prepareStudentRows(students: Student[], selectedStudent: Student | null): PreparedStudentRow[] {
  return students.map((student) => {
    const statusText = meetingStatusText(student);
    const statusId = meetingStatusId(student);
    const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
    const summaryHtml = renderView(
      `<div class="font-medium">
        <a &class="(get props linkClass)" &href="(get props href)" data-inline-select="1" &data-student-id="(get props studentIdAttr)" &children="(get props name)"></a>
      </div>
      <div &visibleIf="(get props topicVisible)" &class="(get props topicTextClass)" &children="(get props topic)"></div>`,
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
      dataPhase: escapeHtml(student.currentPhase),
      dataStatusId: escapeHtml(statusId),
      dataTargetDate: escapeHtml(student.targetSubmissionDate),
      dataNextMeetingDate: escapeHtml(student.nextMeetingAt || ""),
      summaryHtml,
      degreeLabel: escapeHtml(getDegreeLabel(student.degreeType, DEGREE_TYPES)),
      phaseLabel: escapeHtml(getPhaseLabel(student.currentPhase, PHASES)),
      targetDate: escapeHtml(student.targetSubmissionDate),
      nextMeetingText: escapeHtml(student.nextMeetingAt ? formatDateTime(student.nextMeetingAt) : "Not booked"),
      statusBadgeHtml: `<span class="${escapeHtml(
        `${STATUS_BADGE} ${getMeetingStatusBadgeClass(statusId)}`,
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

export function renderStudentsTable(
  students: Student[],
  selectedStudent: Student | null,
  selectedPanel: string,
  emptySelectedPanel: string,
): string {
  const components: HtmlispComponents = {
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
    <td &class="(get props cellClass)"><noop &children="(get props summaryHtml)"></noop></td>
    <td &class="(get props cellClass)" &children="(get props degreeLabel)"></td>
    <td &class="(get props cellClass)" &children="(get props phaseLabel)"></td>
    <td &class="(get props cellClass)" &children="(get props targetDate)"></td>
    <td &class="(get props cellClass)" &children="(get props nextMeetingText)"></td>
    <td &class="(get props cellClass)"><noop &children="(get props statusBadgeHtml)"></noop></td>
    <td &class="(get props cellClass)" &children="(get props logCountText)"></td>
    <td &class="(get props cellClass)"><noop &children="(get props actionButtonHtml)"></noop></td>
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

  return renderView(
    `<section class="grid grid-cols-1 gap-stack xl:grid-cols-3">
      <article &class="(get props studentsCardClass)">
        <div class="mb-panel-sm">
          <h2 class="text-lg font-semibold">Students</h2>
          <p &class="(get props mutedTextXs)">Use filters to quickly find students that need attention.</p>
        </div>
        <div class="mb-panel-sm grid grid-cols-1 gap-stack-xs sm:grid-cols-2 xl:grid-cols-5">
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
        <p id="studentResultsMeta" class="mb-badge-pill-y text-xs text-app-text-muted dark:text-app-text-muted-dark"></p>
        <p class="mb-badge-pill-y text-xs text-app-text-muted dark:text-app-text-muted-dark">Tip: click a row to open student details.</p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-table divide-y divide-app-line text-sm dark:divide-app-line-dark">
            <thead>
              <tr &class="(get props tableHeaderClass)">
                <th class="px-cell-x py-cell-y">Student</th>
                <th class="px-cell-x py-cell-y">Degree</th>
                <th class="px-cell-x py-cell-y">Phase</th>
                <th class="px-cell-x py-cell-y">Target</th>
                <th class="px-cell-x py-cell-y">Next meeting (local)</th>
                <th class="px-cell-x py-cell-y">Status</th>
                <th class="px-cell-x py-cell-y">Logs</th>
                <th class="px-cell-x py-cell-y">Action</th>
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
                <td colspan="8" class="px-cell-x py-stack-xs text-sm text-app-text-muted dark:text-app-text-muted-dark">No students yet.</td>
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
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      filterLabelClass: escapeHtml(FILTER_LABEL),
      filterControlClass: escapeHtml(FIELD_CONTROL_WITH_MARGIN),
      tableHeaderClass: escapeHtml(TABLE_HEADER_ROW),
      degreeFilterOptions,
      phaseFilterOptions,
      hasStudentRows: studentRows.length > 0,
      showEmptyRow: studentRows.length === 0,
      studentRows,
      selectedPanel,
      emptySelectedPanel,
    },
    components,
  );
}
