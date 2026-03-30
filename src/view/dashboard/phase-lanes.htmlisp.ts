import type { Student } from "../../students/store";
import {
  EMPTY_DASHED_CARD,
  MUTED_TEXT_XS,
  SURFACE_CARD_SM,
  TOPIC_TEXT_SM,
  renderBadge,
} from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { DEGREE_TYPES, getDegreeLabel, getTargetSubmissionDate, meetingStatusId, PHASES } from "../../students";
import { escapeHtml } from "../../formatting";
import { renderView } from "../shared.htmlisp";
import type { DashboardFilters } from "../types";

interface PreparedLaneStudent {
  idAttr: string;
  selectedAttr: string;
  cardClass: string;
  href: string;
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
  name: string;
  badgesHtml: string;
  topicVisible: boolean;
  topic: string;
}

interface PreparedPhaseLane {
  phaseIdAttr: string;
  label: string;
  countBadgeHtml: string;
  cardClass: string;
  hasStudents: boolean;
  isEmpty: boolean;
  students: PreparedLaneStudent[];
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

function preparePhaseLanes(students: Student[], selectedStudent: Student | null, filters: DashboardFilters): PreparedPhaseLane[] {
  return PHASES.map((phase) => {
    const laneStudents = students
      .filter((student) => student.currentPhase === phase.id)
      .slice()
      .sort((a, b) => {
        const targetA = getTargetSubmissionDate(a) || "9999-12-31";
        const targetB = getTargetSubmissionDate(b) || "9999-12-31";
        return targetA.localeCompare(targetB) || a.name.localeCompare(b.name);
      });

    return {
      phaseIdAttr: escapeHtml(phase.id),
      label: escapeHtml(phase.label),
      countBadgeHtml: renderBadge({
        label: String(laneStudents.length),
        variant: "count",
      }),
      cardClass: escapeHtml(`h-full min-h-lane w-full ${SURFACE_CARD_SM}`),
      hasStudents: laneStudents.length > 0,
      isEmpty: laneStudents.length === 0,
      students: laneStudents.map((student) => {
        const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
        const targetSubmissionDate = getTargetSubmissionDate(student);
        const degreeLabel = getDegreeLabel(student.degreeType, DEGREE_TYPES);
        const statusId = meetingStatusId(student);
        const badgesHtml = [
          renderBadge({
            label: degreeLabel,
          }),
        ].join("");

        return {
          idAttr: String(student.id),
          selectedAttr: isSelected ? "true" : "false",
          cardClass: escapeHtml(
            `rounded-card border px-control-x py-badge-pill-y transition cursor-pointer ${
              isSelected
                ? "border-app-brand bg-app-surface-soft dark:border-app-brand-ring dark:bg-app-surface-soft-dark/70"
                : "border-app-line bg-app-surface-soft hover:border-app-line-strong hover:bg-app-surface dark:border-app-line-dark dark:bg-app-surface-soft-dark/70 dark:hover:border-app-line-dark-strong dark:hover:bg-app-surface-dark"
            }`,
          ),
          href: escapeHtml(buildDashboardHref(filters, student.id)),
          dataName: escapeHtml(student.name).toLowerCase(),
          dataEmail: escapeHtml(student.email || "").toLowerCase(),
          dataTopic: escapeHtml(student.thesisTopic || "").toLowerCase(),
          dataNotes: escapeHtml(student.studentNotes || "").toLowerCase(),
          dataDegree: escapeHtml(student.degreeType),
          dataDegreeLabel: escapeHtml(degreeLabel).toLowerCase(),
          dataPhase: escapeHtml(student.currentPhase),
          dataPhaseLabel: escapeHtml(phase.label).toLowerCase(),
          dataStatusId: escapeHtml(statusId),
          dataTargetDate: escapeHtml(targetSubmissionDate || ""),
          dataNextMeetingDate: escapeHtml(student.nextMeetingAt || ""),
          dataLogCount: String(student.logCount),
          name: escapeHtml(student.name),
          badgesHtml,
          topicVisible: Boolean(student.thesisTopic),
          topic: escapeHtml(student.thesisTopic || ""),
        };
      }),
    };
  });
}

export function renderPhaseLanes(
  students: Student[],
  selectedStudent: Student | null,
  filters: DashboardFilters,
  options: { embedded?: boolean } = {},
): string {
  const { embedded = false } = options;
  const components: HtmlispComponents = {
    PhaseLane: `<article &class="(get props cardClass)" data-phase-lane &data-phase-id="(get props phaseIdAttr)">
    <div class="flex items-start justify-between gap-stack-xs">
      <h3 class="min-h-10 flex-1 text-sm font-semibold leading-5" &children="(get props label)"></h3>
      <span data-phase-lane-count &data-phase-id="(get props phaseIdAttr)"><noop &children="(get props countBadgeHtml)"></noop></span>
    </div>
    <ul class="mt-stack-xs max-h-[28rem] space-y-stack-xs overflow-y-auto pr-badge-y" &visibleIf="(get props hasStudents)">
      <noop &foreach="(get props students)">
        <LaneStudentCard
          &idAttr="(get props idAttr)"
          &selectedAttr="(get props selectedAttr)"
          &cardClass="(get props cardClass)"
          &href="(get props href)"
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
          &name="(get props name)"
          &badgesHtml="(get props badgesHtml)"
          &topicVisible="(get props topicVisible)"
          &topic="(get props topic)"
        />
      </noop>
    </ul>
    <p data-lane-empty-state &visibleIf="(get props isEmpty)" &class="(get props emptyStateClass)">No students in this phase.</p>
  </article>`,
    LaneStudentCard: `<li
    &class="(get props cardClass)"
    data-lane-student-card
    &data-student-id="(get props idAttr)"
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
    <div class="flex items-start justify-between gap-badge-pill-y">
      <a
        &href="(get props href)"
        data-inline-select="1"
        data-lane-select="1"
        &data-student-id="(get props idAttr)"
        class="min-w-0 flex-1 text-sm font-medium text-app-text dark:text-app-text-dark underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark"
        &children="(get props name)"
      ></a>
      <div class="flex max-w-full flex-wrap gap-badge-y">
        <noop &children="(get props badgesHtml)"></noop>
      </div>
    </div>
    <p
      &visibleIf="(get props topicVisible)"
      &class="(get props topicTextClass)"
      style="-webkit-line-clamp: 1; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
      &children="(get props topic)"
    ></p>
  </li>`,
  };

  return renderView(
    `<section &class="(get props sectionClass)">
      <div &visibleIf="(get props showHeader)">
        <h2 class="text-lg font-semibold">Phase Lanes</h2>
        <p &class="(get props mutedTextXs)">Overview of where students currently are in the thesis process.</p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-panel-sm">
        <noop &foreach="(get props lanes)">
          <PhaseLane
            &cardClass="(get props cardClass)"
            &phaseIdAttr="(get props phaseIdAttr)"
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
      sectionClass: escapeHtml(embedded ? "space-y-stack-xs" : "space-y-stack-xs"),
      showHeader: !embedded,
      mutedTextXs: escapeHtml(MUTED_TEXT_XS),
      emptyStateClass: escapeHtml(EMPTY_DASHED_CARD),
      topicTextClass: escapeHtml(`mt-badge-y ${TOPIC_TEXT_SM}`),
      lanes: preparePhaseLanes(students, selectedStudent, filters),
    },
    components,
  );
}
