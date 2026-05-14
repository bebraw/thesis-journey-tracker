import type { DashboardLaneDefinition } from "../../dashboard-lanes";
import type { Student } from "../../students/store";
import { EMPTY_STATE_CARD } from "../../ui";
import { DEGREE_TYPES, getAssumedProjectEndDate, getDegreeLabel, meetingStatusId } from "../../students";
import { renderView } from "../shared.htmlisp";
import type { DashboardFilters } from "../types";

interface PreparedGanttMonth {
  key: string;
  label: string;
  widthPercent: string;
  styleAttr: string;
}

interface PreparedGanttStudent {
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
  barVisible: boolean;
  studentName: string;
  barLabel: string;
  barTitle: string;
  showStartDatePlaceholder: boolean;
  barStyleAttr: string;
  barClassAttr: string;
}

interface PreparedGanttTimeline {
  months: PreparedGanttMonth[];
  timelineWidthStyleAttr: string;
  todayLineVisible: boolean;
  todayLineLeftPercent: string;
  todayLineStyleAttr: string;
  students: PreparedGanttStudent[];
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

function getPhaseLabelMap(dashboardLanes: DashboardLaneDefinition[]): Map<string, string> {
  return new Map(dashboardLanes.map((lane) => [lane.phaseId, lane.label]));
}

function startOfMonth(dateText: string): Date {
  const date = new Date(`${dateText}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(dateText: string): Date {
  const date = new Date(`${dateText}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(dateText: string): string {
  return new Date(`${dateText}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function diffDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function clampPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(3)}%`;
}

function resolveTimelineBounds(students: Student[], today: Date): { start: Date; end: Date } {
  const datedStudents = students
    .map((student) => ({
      startDate: student.startDate,
      projectedEndDate: getAssumedProjectEndDate(student),
    }))
    .filter((item) => item.startDate && item.projectedEndDate) as Array<{ startDate: string; projectedEndDate: string }>;

  if (datedStudents.length === 0) {
    const start = addUtcMonths(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), -2);
    const end = endOfMonth(addUtcMonths(start, 7).toISOString().slice(0, 10));
    return { start, end };
  }

  const earliest = datedStudents.reduce((min, item) => (item.startDate < min ? item.startDate : min), datedStudents[0]!.startDate);
  const latest = datedStudents.reduce(
    (max, item) => (item.projectedEndDate > max ? item.projectedEndDate : max),
    datedStudents[0]!.projectedEndDate,
  );

  return {
    start: addUtcMonths(startOfMonth(earliest), -1),
    end: endOfMonth(addUtcMonths(startOfMonth(latest), 1).toISOString().slice(0, 10)),
  };
}

function prepareGanttTimeline(
  students: Student[],
  selectedStudent: Student | null,
  filters: DashboardFilters,
  dashboardLanes: DashboardLaneDefinition[],
  embedded: boolean,
  today = new Date(),
): PreparedGanttTimeline {
  const bounds = resolveTimelineBounds(students, today);
  const totalDays = Math.max(1, diffDays(bounds.start, bounds.end) + 1);
  const phaseLabelMap = getPhaseLabelMap(dashboardLanes);
  const months: PreparedGanttMonth[] = [];

  for (let cursor = new Date(bounds.start); cursor <= bounds.end; cursor = addUtcMonths(cursor, 1)) {
    const nextMonth = addUtcMonths(cursor, 1);
    const monthEnd = new Date(Math.min(nextMonth.getTime() - 86_400_000, bounds.end.getTime()));
    const monthDays = diffDays(cursor, monthEnd) + 1;

    months.push({
      key: cursor.toISOString(),
      label: formatMonthLabel(cursor),
      widthPercent: clampPercent((monthDays / totalDays) * 100),
      styleAttr: `width:${clampPercent((monthDays / totalDays) * 100)}`,
    });
  }

  const todayLineVisible = today >= bounds.start && today <= bounds.end;
  const todayLineLeftPercent = clampPercent((diffDays(bounds.start, today) / totalDays) * 100);

  return {
    months,
    timelineWidthStyleAttr: `min-width:${Math.max(58, months.length * 4.75)}rem`,
    todayLineVisible,
    todayLineLeftPercent,
    todayLineStyleAttr: `left:${todayLineLeftPercent}`,
    students: students.map((student) => {
      const phaseLabel = phaseLabelMap.get(student.currentPhase) || student.currentPhase;
      const startDate = student.startDate;
      const projectedEndDate = getAssumedProjectEndDate(student);
      const hasTimeline = Boolean(startDate && projectedEndDate);
      const timelineStart = hasTimeline ? new Date(`${startDate}T00:00:00Z`) : null;
      const timelineEnd = hasTimeline ? new Date(`${projectedEndDate}T00:00:00Z`) : null;
      const leftPercent = timelineStart ? clampPercent((diffDays(bounds.start, timelineStart) / totalDays) * 100) : "0%";
      const widthPercent =
        timelineStart && timelineEnd ? clampPercent(((diffDays(timelineStart, timelineEnd) + 1) / totalDays) * 100) : "0%";
      const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
      const degreeLabel = getDegreeLabel(student.degreeType, DEGREE_TYPES);
      const timelineRangeText = hasTimeline ? `${startDate} -> ${projectedEndDate}` : "";
      const shortRangeText = startDate && projectedEndDate ? `${formatShortDate(startDate)} -> ${formatShortDate(projectedEndDate)}` : "";

      return {
        rowClass: `grid grid-cols-[12rem_1fr] transition group ${
          isSelected
            ? "bg-app-brand-soft/70 dark:bg-app-brand-soft-dark/20"
            : "bg-app-surface hover:bg-app-surface-soft dark:bg-app-surface-dark dark:hover:bg-app-surface-soft-dark/40"
        }`,
        selectedAttr: isSelected ? "true" : "false",
        selectHref: buildDashboardHref(filters, student.id),
        studentIdAttr: String(student.id),
        dataName: student.name.toLowerCase(),
        dataEmail: (student.email || "").toLowerCase(),
        dataTopic: (student.thesisTopic || "").toLowerCase(),
        dataNotes: (student.studentNotes || "").toLowerCase(),
        dataDegree: student.degreeType,
        dataDegreeLabel: getDegreeLabel(student.degreeType, DEGREE_TYPES).toLowerCase(),
        dataPhase: student.currentPhase,
        dataPhaseLabel: phaseLabel.toLowerCase(),
        dataStatusId: meetingStatusId(student),
        dataTargetDate: projectedEndDate || "",
        dataNextMeetingDate: student.nextMeetingAt || "",
        dataLogCount: String(student.logCount),
        barVisible: hasTimeline,
        studentName: student.name,
        barLabel: hasTimeline ? `${degreeLabel} · ${phaseLabel} · ${shortRangeText}` : student.name,
        barTitle: hasTimeline ? `${student.name} · ${degreeLabel} · ${phaseLabel} · ${timelineRangeText}` : student.name,
        showStartDatePlaceholder: !hasTimeline,
        barStyleAttr: `left:${leftPercent}; width:${widthPercent}`,
        barClassAttr: `absolute top-1/2 min-w-0 -translate-y-1/2 truncate rounded-control px-control-x py-badge-pill-y text-sm font-medium shadow-sm ${
          student.degreeType === "bsc"
            ? "bg-app-warning text-app-warning-text dark:bg-app-warning-soft-dark/65 dark:text-app-warning-text-dark"
            : student.degreeType === "dsc"
              ? "bg-app-mock-soft text-app-mock-text dark:bg-app-mock-soft-dark/60 dark:text-app-mock-text-dark"
              : "bg-app-brand-soft text-app-brand-strong dark:bg-app-brand-soft-dark/55 dark:text-app-text-dark"
        }`,
      };
    }),
  };
}

export function renderDashboardGantt(
  students: Student[],
  selectedStudent: Student | null,
  filters: DashboardFilters,
  dashboardLanes: DashboardLaneDefinition[],
  options: { embedded?: boolean; today?: Date } = {},
): string {
  const { embedded = false, today = new Date() } = options;
  const timeline = prepareGanttTimeline(students, selectedStudent, filters, dashboardLanes, embedded, today);

  return renderView(
    `<section &class="sectionClass">
      <div class="space-y-1">
        <h2 &visibleIf="showHeader" class="text-lg font-semibold">Gantt View</h2>
        <p class="text-sm text-app-text-soft dark:text-app-text-soft-dark">Advisor workload across assumed thesis timelines.</p>
      </div>
      <div class="overflow-x-auto rounded-card border border-app-line bg-app-surface-soft/35 px-0 py-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/20">
        <div &style="timeline.timelineWidthStyleAttr">
          <div class="rounded-card border border-app-line bg-app-surface shadow-sm dark:border-app-line-dark dark:bg-app-surface-dark">
            <div class="grid grid-cols-[12rem_1fr] border-b border-app-line bg-app-surface-soft/70 dark:border-app-line-dark dark:bg-app-surface-soft-dark/30">
              <div class="sticky left-0 z-30 border-r border-app-line bg-app-surface-soft px-panel-sm py-badge-pill-y text-[11px] font-semibold uppercase tracking-[0.14em] text-app-text-muted shadow-[8px_0_18px_-18px_rgb(15_23_42_/_0.55)] dark:border-app-line-dark dark:bg-app-surface-soft-dark dark:text-app-text-muted-dark">Student</div>
              <div class="relative min-w-0">
                <div class="flex text-[11px] font-semibold uppercase tracking-[0.14em] text-app-text-muted dark:text-app-text-muted-dark">
                  <fragment &foreach="timeline.months as month">
                    <div class="box-border shrink-0 border-r border-app-line px-badge-pill-x py-badge-pill-y last:border-r-0 dark:border-app-line-dark" &style="month.styleAttr" &children="month.label"></div>
                  </fragment>
                </div>
                <div &visibleIf="timeline.todayLineVisible" class="pointer-events-none absolute inset-y-0 z-10 w-px bg-app-danger/70 dark:bg-app-danger-line-dark" &style="timeline.todayLineStyleAttr"></div>
              </div>
            </div>
            <div id="ganttStudentRows" class="divide-y divide-app-line dark:divide-app-line-dark">
              <fragment &visibleIf="hasStudents">
                <fragment &foreach="timeline.students as student">
                  <article
                    &class="student.rowClass"
                    data-gantt-student-row
                    &data-select-href="student.selectHref"
                    &data-student-id="student.studentIdAttr"
                    &data-name="student.dataName"
                    &data-email="student.dataEmail"
                    &data-topic="student.dataTopic"
                    &data-notes="student.dataNotes"
                    &data-degree="student.dataDegree"
                    &data-degree-label="student.dataDegreeLabel"
                    &data-phase="student.dataPhase"
                    &data-phase-label="student.dataPhaseLabel"
                    &data-status-id="student.dataStatusId"
                    &data-target-date="student.dataTargetDate"
                    &data-next-meeting-date="student.dataNextMeetingDate"
                    &data-log-count="student.dataLogCount"
                    &aria-selected="student.selectedAttr"
                    tabindex="0"
                  >
                    <div class="sticky left-0 z-20 min-w-0 border-r border-app-line bg-app-surface px-panel-sm py-stack-xs shadow-[8px_0_18px_-18px_rgb(15_23_42_/_0.45)] group-hover:bg-app-surface-soft dark:border-app-line-dark dark:bg-app-surface-dark dark:group-hover:bg-app-surface-soft-dark/40">
                      <div class="flex min-h-[2rem] items-center">
                        <a
                          &href="student.selectHref"
                          data-inline-select="1"
                          &data-student-id="student.studentIdAttr"
                          class="truncate text-sm font-medium text-app-text underline-offset-2 hover:underline dark:text-app-text-dark"
                          &children="student.studentName"
                        ></a>
                      </div>
                    </div>
                    <div class="relative flex min-h-[5rem] min-w-0 items-center px-control-x">
                      <div class="pointer-events-none absolute inset-0 flex">
                        <fragment &foreach="timeline.months as month">
                          <div class="box-border shrink-0 border-r border-app-line/70 last:border-r-0 dark:border-app-line-dark/70" &style="month.styleAttr"></div>
                        </fragment>
                      </div>
                      <div &visibleIf="timeline.todayLineVisible" class="pointer-events-none absolute inset-y-0 z-10 w-px bg-app-danger/70 dark:bg-app-danger-line-dark" &style="timeline.todayLineStyleAttr"></div>
                      <div &visibleIf="student.barVisible" &class="student.barClassAttr" &style="student.barStyleAttr" &title="student.barTitle" &children="student.barLabel"></div>
                      <p &visibleIf="student.showStartDatePlaceholder" class="relative z-20 w-full truncate rounded-control border border-dashed border-app-line-strong px-control-x py-badge-pill-y text-xs text-app-text-muted dark:border-app-line-dark-strong dark:text-app-text-muted-dark">Start date needed</p>
                    </div>
                  </article>
                </fragment>
              </fragment>
              <p &visibleIf="showEmptyState" &class="emptyStateClass">No students yet.</p>
            </div>
          </div>
        </div>
      </div>
    </section>`,
    {
      sectionClass: embedded ? "space-y-stack-xs" : "space-y-stack-xs",
      showHeader: !embedded,
      hasStudents: timeline.students.length > 0,
      showEmptyState: timeline.students.length === 0,
      emptyStateClass: EMPTY_STATE_CARD,
      timeline,
    },
  );
}
