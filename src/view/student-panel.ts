import type { MeetingLog, Student } from "../db";
import {
  DANGER_PANEL,
  DANGER_TEXT,
  DANGER_TITLE,
  DISCLOSURE,
  DISCLOSURE_CONTENT,
  DISCLOSURE_SUMMARY,
  EMPTY_STATE_CARD,
  FIELD_CONTROL,
  FORM_STACK,
  PANEL_STACK,
  SECTION_STACK_SM,
  SOFT_SURFACE_CARD,
  SURFACE_CARD,
  SUBTLE_TEXT,
  TOPIC_TEXT,
  renderBadge,
  renderButton,
  renderInputField,
  renderTextareaField,
} from "../ui";
import { type HtmlispComponents } from "../htmlisp";
import { getStudentFormValues } from "../student-form";
import { escapeHtml, escapeJsString, formatDateTime } from "../utils";
import { renderView } from "./shared";
import { renderStudentFormFields } from "./student-form-fields";

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
    MeetingLogEntry: `<article &class="(get props cardClass)">
    <p class="font-medium"><span &children="(get props timestampText)"></span><noop &children="(get props mockBadgeHtml)"></noop></p>
    <p class="mt-1"><span class="font-medium">Discussed:</span> <span &children="(get props discussed)"></span></p>
    <p class="mt-1"><span class="font-medium">Agreed:</span> <span &children="(get props agreedPlan)"></span></p>
    <p &visibleIf="(get props hasDeadline)" class="mt-1"><span class="font-medium">Next-step deadline:</span> <span &children="(get props deadlineText)"></span></p>
  </article>`,
  };

  const preparedLogs = prepareLogEntries(logs);
  const fields = renderStudentFormFields({
    values: getStudentFormValues(student),
  });

  const editFormHtml = renderView(
    `<form &action="(get props action)" method="post" &class="(get props formStack)">
      <noop &children="(get props topicField)"></noop>
      <noop &children="(get props phaseField)"></noop>
      <details &class="(get props disclosureClass)">
        <summary &class="(get props disclosureSummaryClass)">
          <span>Additional student details</span>
          <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark">
            Name, email, degree, dates
          </span>
        </summary>
        <div &class="(get props disclosureContentClass)">
          <div &class="(get props disclosureFieldsClass)">
            <noop &children="(get props nameField)"></noop>
            <noop &children="(get props emailField)"></noop>
            <noop &children="(get props degreeField)"></noop>
            <noop &children="(get props startDateField)"></noop>
            <noop &children="(get props targetDateField)"></noop>
            <noop &children="(get props nextMeetingField)"></noop>
          </div>
        </div>
      </details>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/update-student/${student.id}`),
      disclosureClass: escapeHtml(DISCLOSURE),
      disclosureContentClass: escapeHtml(DISCLOSURE_CONTENT),
      disclosureFieldsClass: escapeHtml(SECTION_STACK_SM),
      disclosureSummaryClass: escapeHtml(DISCLOSURE_SUMMARY),
      formStack: escapeHtml(FORM_STACK),
      ...fields,
      submitButton: renderButton({
        label: "Save student updates",
        type: "submit",
        variant: "primaryBlock",
      }),
    },
  );

  const addLogFormHtml = renderView(
    `<form &action="(get props action)" method="post" &class="(get props formStack)">
      <noop &children="(get props happenedAtField)"></noop>
      <noop &children="(get props discussedField)"></noop>
      <noop &children="(get props agreedPlanField)"></noop>
      <noop &children="(get props nextStepDeadlineField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/add-log/${student.id}`),
      formStack: escapeHtml(FORM_STACK),
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
        <p &visibleIf="(get props topicVisible)" &class="(get props topicTextClass)" &children="(get props topic)"></p>
        <noop &children="(get props editFormHtml)"></noop>
      </section>

      <details &class="(get props disclosureClass)">
        <summary &class="(get props disclosureSummaryClass)">
          <span>Add Log Entry</span>
          <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark">Expand</span>
        </summary>
        <div &class="(get props disclosureContentClass)">
          <noop &children="(get props addLogFormHtml)"></noop>
        </div>
      </details>

      <details &class="(get props disclosureClass)">
        <summary &class="(get props disclosureSummaryClass)">
          <span>Meeting Log History</span>
          <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props logSummaryText)"></span>
        </summary>
        <div &class="(get props disclosureContentClass)">
          <div &class="(get props formStack)" &visibleIf="(get props hasLogs)">
            <noop &foreach="(get props logs)">
              <MeetingLogEntry
                &cardClass="(get props logEntryClass)"
                &timestampText="(get props timestampText)"
                &mockBadgeHtml="(get props mockBadgeHtml)"
                &discussed="(get props discussed)"
                &agreedPlan="(get props agreedPlan)"
                &hasDeadline="(get props hasDeadline)"
                &deadlineText="(get props deadlineText)"
              ></MeetingLogEntry>
            </noop>
          </div>
          <p &visibleIf="(get props showNoLogs)" &class="(get props emptyStateClass)">No entries yet.</p>
        </div>
      </details>

      <section &class="(get props dangerPanelClass)">
        <h2 &class="(get props dangerTitleClass)">Delete Student</h2>
        <p &class="(get props dangerTextClass)">This removes the student and all related meeting log entries permanently.</p>
        <form
          &action="(get props deleteAction)"
          method="post"
          class="mt-panel-sm"
          &onsubmit="(get props deleteConfirm)"
        >
          <noop &children="(get props deleteButtonHtml)"></noop>
        </form>
      </section>
    </article>`,
    {
      cardClass: escapeHtml(`${PANEL_STACK} ${SURFACE_CARD}`),
      dangerPanelClass: escapeHtml(DANGER_PANEL),
      dangerTextClass: escapeHtml(DANGER_TEXT),
      dangerTitleClass: escapeHtml(DANGER_TITLE),
      disclosureClass: escapeHtml(DISCLOSURE),
      disclosureContentClass: escapeHtml(DISCLOSURE_CONTENT),
      disclosureSummaryClass: escapeHtml(DISCLOSURE_SUMMARY),
      emptyStateClass: escapeHtml(EMPTY_STATE_CARD),
      formStack: escapeHtml(FORM_STACK),
      logSummaryText: escapeHtml(
        preparedLogs.length > 0
          ? `${preparedLogs.length} entr${preparedLogs.length === 1 ? "y" : "ies"}`
          : "Empty",
      ),
      logEntryClass: escapeHtml(SOFT_SURFACE_CARD),
      subtleText: escapeHtml(SUBTLE_TEXT),
      topicTextClass: escapeHtml(TOPIC_TEXT),
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
