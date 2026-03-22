import type { MeetingLog, Student } from "../db";
import {
  FIELD_CONTROL,
  SURFACE_CARD,
  SUBTLE_TEXT,
  renderBadge,
  renderButton,
  renderInputField,
  renderSelectField,
  renderTextareaField,
  type SelectOption,
} from "../components";
import { type HtmlispComponents } from "../htmlisp";
import { escapeHtml, escapeJsString, toDateTimeLocalInput } from "../utils";
import { renderView } from "./shared";
import { DEGREE_TYPES, PHASES } from "./types";
import { formatDateTime } from "../utils";

export function renderEmptySelectedPanel(
  message = "Select a student from the table to edit details and view/add supervision logs.",
): string {
  return renderView(
    `<article &class="(get props cardClass)">
      <h2 class="text-lg font-semibold">Student Details & Logs</h2>
      <p &class="(get props subtleText)" &children="(get props message)"></p>
    </article>`,
    {
      cardClass: escapeHtml(SURFACE_CARD),
      subtleText: escapeHtml(`mt-2 ${SUBTLE_TEXT}`),
      message: escapeHtml(message),
    },
  );
}

interface PreparedLogEntry {
  timestampText: string;
  mockBadgeHtml: string;
  discussed: string;
  agreedPlan: string;
  hasDeadline: boolean;
  deadlineText: string;
}

function prepareLogEntries(logs: MeetingLog[]): PreparedLogEntry[] {
  return logs.map((log) => ({
    timestampText: escapeHtml(formatDateTime(log.happenedAt)),
    mockBadgeHtml: log.isMock
      ? renderBadge({
          label: "Mock",
          variant: "mock",
          className: "ml-2",
        })
      : "",
    discussed: escapeHtml(log.discussed),
    agreedPlan: escapeHtml(log.agreedPlan),
    hasDeadline: Boolean(log.nextStepDeadline),
    deadlineText: escapeHtml(log.nextStepDeadline || ""),
  }));
}

export function renderSelectedStudentPanel(
  student: Student,
  logs: MeetingLog[],
): string {
  const components: HtmlispComponents = {
    MeetingLogEntry: `<article class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
    <p class="font-medium"><span &children="(get props timestampText)"></span><noop &children="(get props mockBadgeHtml)"></noop></p>
    <p class="mt-1"><span class="font-medium">Discussed:</span> <span &children="(get props discussed)"></span></p>
    <p class="mt-1"><span class="font-medium">Agreed:</span> <span &children="(get props agreedPlan)"></span></p>
    <p &visibleIf="(get props hasDeadline)" class="mt-1"><span class="font-medium">Next-step deadline:</span> <span &children="(get props deadlineText)"></span></p>
  </article>`,
  };

  const degreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));
  const phaseOptions: SelectOption[] = PHASES.map((phase) => ({
    label: phase.label,
    value: phase.id,
  }));
  const preparedLogs = prepareLogEntries(logs);

  const editFormHtml = renderView(
    `<form &action="(get props action)" method="post" class="mt-3 space-y-3">
      <noop &children="(get props nameField)"></noop>
      <noop &children="(get props emailField)"></noop>
      <noop &children="(get props degreeField)"></noop>
      <noop &children="(get props topicField)"></noop>
      <noop &children="(get props phaseField)"></noop>
      <noop &children="(get props startDateField)"></noop>
      <noop &children="(get props targetDateField)"></noop>
      <noop &children="(get props nextMeetingField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/update-student/${student.id}`),
      nameField: renderInputField({
        label: "Name",
        name: "name",
        required: true,
        value: student.name,
        className: FIELD_CONTROL,
      }),
      emailField: renderInputField({
        label: "Email",
        name: "studentEmail",
        value: student.email || "",
        className: FIELD_CONTROL,
        attributes:
          'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
      }),
      degreeField: renderSelectField({
        label: "Degree type",
        name: "degreeType",
        options: degreeOptions,
        value: student.degreeType,
        className: FIELD_CONTROL,
      }),
      topicField: renderInputField({
        label: "Thesis topic (optional)",
        name: "thesisTopic",
        value: student.thesisTopic || "",
        className: FIELD_CONTROL,
      }),
      phaseField: renderSelectField({
        label: "Phase",
        name: "currentPhase",
        options: phaseOptions,
        value: student.currentPhase,
        className: FIELD_CONTROL,
      }),
      startDateField: renderInputField({
        label: "Start date",
        name: "startDate",
        type: "date",
        required: true,
        value: student.startDate,
        className: FIELD_CONTROL,
      }),
      targetDateField: renderInputField({
        label: "Target submission date",
        name: "targetSubmissionDate",
        type: "date",
        required: true,
        value: student.targetSubmissionDate,
        className: FIELD_CONTROL,
      }),
      nextMeetingField: renderInputField({
        label: "Next meeting",
        name: "nextMeetingAt",
        type: "datetime-local",
        value: toDateTimeLocalInput(student.nextMeetingAt),
        className: FIELD_CONTROL,
      }),
      submitButton: renderButton({
        label: "Save student updates",
        type: "submit",
        variant: "primaryBlock",
      }),
    },
  );

  const addLogFormHtml = renderView(
    `<form &action="(get props action)" method="post" class="mt-3 space-y-3">
      <noop &children="(get props happenedAtField)"></noop>
      <noop &children="(get props discussedField)"></noop>
      <noop &children="(get props agreedPlanField)"></noop>
      <noop &children="(get props nextStepDeadlineField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/add-log/${student.id}`),
      happenedAtField: renderInputField({
        label: "Meeting date/time",
        name: "happenedAt",
        type: "datetime-local",
        className: FIELD_CONTROL,
      }),
      discussedField: renderTextareaField({
        label: "What was discussed",
        name: "discussed",
        required: true,
        className: FIELD_CONTROL,
      }),
      agreedPlanField: renderTextareaField({
        label: "Agreed plan / next actions",
        name: "agreedPlan",
        required: true,
        className: FIELD_CONTROL,
      }),
      nextStepDeadlineField: renderInputField({
        label: "Next-step deadline (optional)",
        name: "nextStepDeadline",
        type: "date",
        className: FIELD_CONTROL,
      }),
      submitButton: renderButton({
        label: "Save log entry",
        type: "submit",
        variant: "successBlock",
      }),
    },
  );

  return renderView(
    `<article &class="(get props cardClass)">
      <section>
        <h2 class="text-lg font-semibold">Edit Student</h2>
        <p &class="(get props subtleText)" &children="(get props currentlyViewingText)"></p>
        <p &visibleIf="(get props topicVisible)" class="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200" &children="(get props topic)"></p>
        <noop &children="(get props editFormHtml)"></noop>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Add Log Entry</h2>
        <noop &children="(get props addLogFormHtml)"></noop>
      </section>

      <section>
        <h2 class="text-lg font-semibold">Meeting Log History</h2>
        <div class="mt-3 space-y-3" &visibleIf="(get props hasLogs)">
          <noop &foreach="(get props logs)">
            <MeetingLogEntry
              &timestampText="(get props timestampText)"
              &mockBadgeHtml="(get props mockBadgeHtml)"
              &discussed="(get props discussed)"
              &agreedPlan="(get props agreedPlan)"
              &hasDeadline="(get props hasDeadline)"
              &deadlineText="(get props deadlineText)"
            ></MeetingLogEntry>
          </noop>
        </div>
        <p &visibleIf="(get props showNoLogs)" class="rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">No entries yet.</p>
      </section>

      <section class="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
        <h2 class="text-lg font-semibold text-rose-900 dark:text-rose-100">Delete Student</h2>
        <p class="mt-1 text-sm text-rose-800 dark:text-rose-200">This removes the student and all related meeting log entries permanently.</p>
        <form
          &action="(get props deleteAction)"
          method="post"
          class="mt-4"
          &onsubmit="(get props deleteConfirm)"
        >
          <noop &children="(get props deleteButtonHtml)"></noop>
        </form>
      </section>
    </article>`,
    {
      cardClass: escapeHtml(`space-y-6 ${SURFACE_CARD}`),
      subtleText: escapeHtml(SUBTLE_TEXT),
      currentlyViewingText: escapeHtml(`Currently viewing: ${student.name}`),
      topicVisible: Boolean(student.thesisTopic),
      topic: escapeHtml(student.thesisTopic || ""),
      editFormHtml,
      addLogFormHtml,
      hasLogs: preparedLogs.length > 0,
      showNoLogs: preparedLogs.length === 0,
      logs: preparedLogs,
      deleteAction: escapeHtml(`/actions/delete-student/${student.id}`),
      deleteConfirm: escapeHtml(
        `return window.confirm('Delete ${escapeJsString(
          student.name,
        )}? This will also remove all supervision logs for this student.');`,
      ),
      deleteButtonHtml: renderButton({
        label: "Delete student",
        type: "submit",
        variant: "dangerBlock",
      }),
    },
    components,
  );
}
