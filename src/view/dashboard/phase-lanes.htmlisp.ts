import type { Student } from "../../db";
import {
  EMPTY_DASHED_CARD,
  MUTED_TEXT_XS,
  SURFACE_CARD_SM,
  STATUS_BADGE,
  TOPIC_TEXT_SM,
  getMeetingStatusBadgeClass,
  renderBadge,
} from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { escapeHtml, formatDateTime, getDegreeLabel, meetingStatusId, meetingStatusText } from "../../utils";
import { renderView } from "../shared.htmlisp";
import { DEGREE_TYPES, PHASES } from "../../reference-data";

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

function preparePhaseLanes(students: Student[], selectedStudent: Student | null): PreparedPhaseLane[] {
  return PHASES.map((phase) => {
    const laneStudents = students
      .filter((student) => student.currentPhase === phase.id)
      .slice()
      .sort((a, b) => a.targetSubmissionDate.localeCompare(b.targetSubmissionDate) || a.name.localeCompare(b.name));

    return {
      label: escapeHtml(phase.label),
      countBadgeHtml: renderBadge({
        label: String(laneStudents.length),
        variant: "count",
      }),
      hasStudents: laneStudents.length > 0,
      isEmpty: laneStudents.length === 0,
      students: laneStudents.map((student) => {
        const isSelected = selectedStudent ? selectedStudent.id === student.id : false;
        const badgesHtml = [
          renderBadge({
            label: getDegreeLabel(student.degreeType, DEGREE_TYPES),
          }),
        ].join("");

        return {
          idAttr: String(student.id),
          selectedAttr: isSelected ? "true" : "false",
          cardClass: escapeHtml(
            `rounded-card border border-app-line bg-app-surface-soft p-stack-xs transition-colors cursor-pointer dark:border-app-line-dark dark:bg-app-surface-soft-dark/70 hover:border-app-line-strong dark:hover:border-app-line-dark-strong${
              isSelected ? " ring-2 ring-app-brand-ring/60 dark:ring-app-brand-ring/40" : ""
            }`,
          ),
          href: escapeHtml(`/?selected=${student.id}`),
          name: escapeHtml(student.name),
          badgesHtml,
          topicVisible: Boolean(student.thesisTopic),
          topic: escapeHtml(student.thesisTopic || ""),
          targetText: escapeHtml(`Target: ${student.targetSubmissionDate}`),
          nextMeetingText: escapeHtml(
            student.nextMeetingAt ? `Next meeting: ${formatDateTime(student.nextMeetingAt)}` : "Next meeting: Not booked",
          ),
          statusBadgeHtml: `<span class="${escapeHtml(
            `${STATUS_BADGE} ${getMeetingStatusBadgeClass(meetingStatusId(student))}`,
          )}">${escapeHtml(meetingStatusText(student))}</span>`,
        };
      }),
    };
  });
}

export function renderPhaseLanes(students: Student[], selectedStudent: Student | null): string {
  const components: HtmlispComponents = {
    PhaseLane: `<article &class="(get props cardClass)">
    <div class="flex items-start justify-between gap-stack-xs">
      <h3 class="min-h-10 flex-1 text-sm font-semibold leading-5" &children="(get props label)"></h3>
      <noop &children="(get props countBadgeHtml)"></noop>
    </div>
    <ul class="mt-stack-xs space-y-badge-pill-y" &visibleIf="(get props hasStudents)">
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
    <p &visibleIf="(get props isEmpty)" &class="(get props emptyStateClass)">No students in this phase.</p>
  </article>`,
    LaneStudentCard: `<li
    &class="(get props cardClass)"
    data-lane-student-card
    &data-student-id="(get props idAttr)"
    &aria-selected="(get props selectedAttr)"
    tabindex="0"
  >
    <div class="flex flex-wrap items-start justify-between gap-badge-pill-y">
      <a
        &href="(get props href)"
        data-inline-select="1"
        data-lane-select="1"
        &data-student-id="(get props idAttr)"
        class="min-w-0 flex-1 wrap-break-word font-medium text-app-text dark:text-app-text-dark underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark"
        &children="(get props name)"
      ></a>
      <div class="flex max-w-full flex-wrap justify-end gap-badge-y">
        <noop &children="(get props badgesHtml)"></noop>
      </div>
    </div>
    <p &visibleIf="(get props topicVisible)" &class="(get props topicTextClass)" &children="(get props topic)"></p>
    <p class="mt-1 text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="(get props targetText)"></p>
    <p class="mt-1 text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="(get props nextMeetingText)"></p>
    <p class="mt-2"><noop &children="(get props statusBadgeHtml)"></noop></p>
  </li>`,
  };

  return renderView(
    `<section class="space-y-stack-xs">
      <div>
        <h2 class="text-lg font-semibold">Phase Lanes</h2>
        <p &class="(get props mutedTextXs)">Overview of where students currently are in the thesis process.</p>
      </div>
      <div class="grid grid-cols-1 gap-panel-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
      cardClass: escapeHtml(`snap-start min-h-lane ${SURFACE_CARD_SM}`),
      emptyStateClass: escapeHtml(EMPTY_DASHED_CARD),
      topicTextClass: escapeHtml(TOPIC_TEXT_SM),
      lanes: preparePhaseLanes(students, selectedStudent),
    },
    components,
  );
}
