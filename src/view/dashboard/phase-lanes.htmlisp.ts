import { raw } from "../../htmlisp";
import type { Student } from "../../students/store";
import {
  EMPTY_DASHED_CARD,
  MUTED_TEXT_XS,
  SURFACE_CARD_SM,
  TOPIC_TEXT_SM,
  renderBadge,
} from "../../ui";
import { DEGREE_TYPES, getDegreeLabel, getTargetSubmissionDate, meetingStatusId, PHASES } from "../../students";
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
  badgesHtml: unknown;
  topicVisible: boolean;
  topic: string;
}

interface PreparedPhaseLane {
  phaseIdAttr: string;
  label: string;
  countBadgeHtml: unknown;
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
      phaseIdAttr: phase.id,
      label: phase.label,
      countBadgeHtml: raw(renderBadge({
        label: String(laneStudents.length),
        variant: "count",
      })),
      cardClass: `h-full min-h-lane w-full ${SURFACE_CARD_SM}`,
      hasStudents: laneStudents.length > 0,
      isEmpty: laneStudents.length === 0,
      students: laneStudents.map((student) => {
        const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
        const targetSubmissionDate = getTargetSubmissionDate(student);
        const degreeLabel = getDegreeLabel(student.degreeType, DEGREE_TYPES);
        const statusId = meetingStatusId(student);

        return {
          idAttr: String(student.id),
          selectedAttr: isSelected ? "true" : "false",
          cardClass:
            `rounded-card border px-control-x py-badge-pill-y transition cursor-pointer ${
              isSelected
                ? "border-app-brand bg-app-surface-soft dark:border-app-brand-ring dark:bg-app-surface-soft-dark/70"
                : "border-app-line bg-app-surface-soft hover:border-app-line-strong hover:bg-app-surface dark:border-app-line-dark dark:bg-app-surface-soft-dark/70 dark:hover:border-app-line-dark-strong dark:hover:bg-app-surface-dark"
            }`,
          href: buildDashboardHref(filters, student.id),
          dataName: student.name.toLowerCase(),
          dataEmail: (student.email || "").toLowerCase(),
          dataTopic: (student.thesisTopic || "").toLowerCase(),
          dataNotes: (student.studentNotes || "").toLowerCase(),
          dataDegree: student.degreeType,
          dataDegreeLabel: degreeLabel.toLowerCase(),
          dataPhase: student.currentPhase,
          dataPhaseLabel: phase.label.toLowerCase(),
          dataStatusId: statusId,
          dataTargetDate: targetSubmissionDate || "",
          dataNextMeetingDate: student.nextMeetingAt || "",
          dataLogCount: String(student.logCount),
          name: student.name,
          badgesHtml: raw(renderBadge({
            label: degreeLabel,
          })),
          topicVisible: Boolean(student.thesisTopic),
          topic: student.thesisTopic || "",
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

  return renderView(
    `<section &class="sectionClass">
      <div &visibleIf="showHeader">
        <h2 class="text-lg font-semibold">Phase Lanes</h2>
        <p &class="mutedTextXs">Overview of where students currently are in the thesis process.</p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-panel-sm">
        <fragment &foreach="lanes as lane">
          <article &class="lane.cardClass" data-phase-lane &data-phase-id="lane.phaseIdAttr">
            <div class="flex items-start justify-between gap-stack-xs">
              <h3 class="min-h-10 flex-1 text-sm font-semibold leading-5" &children="lane.label"></h3>
              <span data-phase-lane-count &data-phase-id="lane.phaseIdAttr"><fragment &children="lane.countBadgeHtml"></fragment></span>
            </div>
            <ul class="mt-stack-xs max-h-[28rem] space-y-stack-xs overflow-y-auto pr-badge-y" &visibleIf="lane.hasStudents">
              <fragment &foreach="lane.students as student">
                <li
                  &class="student.cardClass"
                  data-lane-student-card
                  &data-student-id="student.idAttr"
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
                  <div class="flex items-start justify-between gap-badge-pill-y">
                    <a
                      &href="student.href"
                      data-inline-select="1"
                      data-lane-select="1"
                      &data-student-id="student.idAttr"
                      class="min-w-0 flex-1 text-sm font-medium text-app-text dark:text-app-text-dark underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark"
                      &children="student.name"
                    ></a>
                    <div class="flex max-w-full flex-wrap gap-badge-y">
                      <fragment &children="student.badgesHtml"></fragment>
                    </div>
                  </div>
                  <p
                    &visibleIf="student.topicVisible"
                    &class="topicTextClass"
                    style="-webkit-line-clamp: 1; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;"
                    &children="student.topic"
                  ></p>
                </li>
              </fragment>
            </ul>
            <p data-lane-empty-state &visibleIf="lane.isEmpty" &class="emptyStateClass">No students in this phase.</p>
          </article>
        </fragment>
      </div>
    </section>`,
    {
      sectionClass: embedded ? "space-y-stack-xs" : "space-y-stack-xs",
      showHeader: !embedded,
      mutedTextXs: MUTED_TEXT_XS,
      emptyStateClass: EMPTY_DASHED_CARD,
      topicTextClass: `mt-badge-y ${TOPIC_TEXT_SM}`,
      lanes: preparePhaseLanes(students, selectedStudent, filters),
    },
  );
}
