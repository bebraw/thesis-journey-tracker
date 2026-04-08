import { escapeJsString, formatDateTime, toDateTimeLocalInput } from "../../formatting";
import { raw } from "../../htmlisp";
import { DEGREE_TYPES, getDegreeLabel, getPhaseLabel, getStudentFormValues, getTargetSubmissionDate, PHASES } from "../../students";
import type { MeetingLog, PhaseAuditEntry, Student } from "../../students/store";
import {
  EMPTY_STATE_CARD,
  FIELD_CONTROL,
  FORM_STACK,
  PANEL_STACK,
  SOFT_SURFACE_CARD,
  SUBTLE_TEXT,
  SURFACE_CARD,
  TOGGLE_BUTTON_PANEL,
  TOPIC_TEXT,
  renderBadge,
  renderButton,
  renderInsetCard,
  renderInputField,
  renderMetadataList,
  renderSectionHeader,
  renderToggleGroup,
  renderTextareaField,
} from "../../ui";
import type { DashboardFilters } from "../types";
import { renderView } from "../shared.htmlisp";
import { DATETIME_LOCAL_HALF_HOUR_STEP } from "./date-time";
import { renderStudentFormFields } from "./form-fields";

export function renderEmptySelectedPanel(
  message = "Select a student from the table to edit details and view/add supervision logs.",
): string {
  return renderView(
    `<article &class="cardClass">
      <h2 class="text-lg font-semibold">Student Details & Logs</h2>
      <p &class="subtleText" &children="message"></p>
    </article>`,
    {
      cardClass: SURFACE_CARD,
      subtleText: `mt-2 ${SUBTLE_TEXT}`,
      message,
    },
  );
}

interface PreparedLogEntry {
  timestampText: string;
  discussed: string;
  agreedPlan: string;
  hasDeadline: boolean;
  deadlineText: string;
}

interface PreparedPhaseAuditEntry {
  timestampText: string;
  transitionText: string;
}

interface StudentPanelOptions {
  canEdit?: boolean;
  filters?: DashboardFilters;
  timeZone?: string;
}

interface PreparedReadonlyField {
  label: string;
  value: string;
}

interface PreparedToolAction {
  key: string;
  label: string;
  meta?: string;
}

function prepareLogEntries(logs: MeetingLog[], timeZone?: string): PreparedLogEntry[] {
  return logs.map((log) => ({
    timestampText: formatDateTime(log.happenedAt, timeZone),
    discussed: log.discussed,
    agreedPlan: log.agreedPlan,
    hasDeadline: Boolean(log.nextStepDeadline),
    deadlineText: log.nextStepDeadline || "",
  }));
}

function preparePhaseAuditEntries(entries: PhaseAuditEntry[], timeZone?: string): PreparedPhaseAuditEntry[] {
  return entries.map((entry) => ({
    timestampText: formatDateTime(entry.changedAt, timeZone),
    transitionText: `${getPhaseLabel(entry.fromPhase, PHASES)} -> ${getPhaseLabel(entry.toPhase, PHASES)}`,
  }));
}

function prepareReadonlyFields(student: Student, timeZone?: string): PreparedReadonlyField[] {
  const targetSubmissionDate = getTargetSubmissionDate(student);
  return [
    { label: "Name", value: student.name },
    { label: "Email", value: student.email || "Not set" },
    { label: "Degree type", value: getDegreeLabel(student.degreeType, DEGREE_TYPES) },
    { label: "Phase", value: getPhaseLabel(student.currentPhase, PHASES) },
    { label: "Thesis topic", value: student.thesisTopic || "Not set" },
    { label: "Student notes", value: student.studentNotes || "Not set" },
    { label: "Start date", value: student.startDate || "Not set" },
    { label: "Target submission", value: targetSubmissionDate || "Not set" },
    { label: "Next meeting", value: student.nextMeetingAt ? formatDateTime(student.nextMeetingAt, timeZone) : "Not booked" },
    { label: "Saved meeting logs", value: String(student.logCount) },
  ].map((field) => ({
    label: field.label,
    value: field.value,
  }));
}

function renderReadonlyStudentSummary(student: Student, timeZone?: string): string {
  const readonlyFields = prepareReadonlyFields(student, timeZone);

  return renderView(
    `<section>
      <h2 class="text-lg font-semibold">Student Overview</h2>
      <p &class="currentStudentLineClass" &children="currentlyViewingText"></p>
      <p &visibleIf="topicVisible" &class="topicTextClass" &children="topic"></p>
      <p &class="readonlyNoticeClass">Read-only access to details, supervision logs, and the phase timeline.</p>
      <fragment &children="metadataListHtml"></fragment>
    </section>`,
    {
      currentStudentLineClass: `mt-1 truncate ${SUBTLE_TEXT}`,
      topicTextClass: TOPIC_TEXT,
      readonlyNoticeClass: `mt-3 ${SUBTLE_TEXT}`,
      metadataListHtml: raw(renderMetadataList({
        items: readonlyFields,
        className: "mt-stack-xs",
      })),
      currentlyViewingText: `Currently viewing: ${student.name}`,
      topicVisible: Boolean(student.thesisTopic),
      topic: student.thesisTopic || "",
    },
  );
}

function renderToolActions(actions: PreparedToolAction[]): string {
  return renderToggleGroup({
    className: "flex flex-wrap gap-badge-y",
    buttonClassName: TOGGLE_BUTTON_PANEL,
    items: actions.map((action) => ({
      label: action.label,
      meta: action.meta,
      attrs: {
        "data-selected-tool-button": "1",
        "data-tool-key": action.key,
      },
    })),
  });
}

function renderStudentHistoryContent(
  historySummaryText: string,
  logSummaryText: string,
  auditSummaryText: string,
  logs: PreparedLogEntry[],
  phaseAuditEntries: PreparedPhaseAuditEntry[],
): string {
  return renderView(
    `<fragment &children="historyHeaderHtml"></fragment>
    <div class="mt-stack-xs grid grid-cols-1 gap-stack-xs xl:grid-cols-2">
      <section class="space-y-stack-xs">
        <fragment &children="logHeaderHtml"></fragment>
        <div &class="formStack" &visibleIf="hasLogs">
          <fragment &foreach="logs as log">
            <article &class="logEntryClass">
              <p class="font-medium"><span &children="log.timestampText"></span></p>
              <p class="mt-1"><span class="font-medium">Discussed:</span> <span &children="log.discussed"></span></p>
              <p class="mt-1"><span class="font-medium">Agreed:</span> <span &children="log.agreedPlan"></span></p>
              <p &visibleIf="log.hasDeadline" class="mt-1"><span class="font-medium">Next-step deadline:</span> <span &children="log.deadlineText"></span></p>
            </article>
          </fragment>
        </div>
        <p &visibleIf="showNoLogs" &class="emptyStateClass">No entries yet.</p>
      </section>
      <section class="space-y-stack-xs">
        <fragment &children="auditHeaderHtml"></fragment>
        <div &class="formStack" &visibleIf="hasPhaseAudit">
          <fragment &foreach="phaseAuditEntries as entry">
            <article &class="logEntryClass">
              <p class="font-medium"><span &children="entry.timestampText"></span></p>
              <p class="mt-1"><span class="font-medium">Phase change:</span> <span &children="entry.transitionText"></span></p>
            </article>
          </fragment>
        </div>
        <p &visibleIf="showNoPhaseAudit" &class="emptyStateClass">No phase changes recorded yet.</p>
      </section>
    </div>`,
    {
      emptyStateClass: EMPTY_STATE_CARD,
      formStack: FORM_STACK,
      historyHeaderHtml: raw(renderSectionHeader({
        title: "History",
        meta: historySummaryText,
      })),
      logHeaderHtml: raw(renderSectionHeader({
        title: "Meeting log history",
        meta: logSummaryText,
        headingLevel: 4,
        headingClassName: "text-sm font-semibold",
      })),
      auditHeaderHtml: raw(renderSectionHeader({
        title: "Phase timeline",
        meta: auditSummaryText,
        headingLevel: 4,
        headingClassName: "text-sm font-semibold",
      })),
      logEntryClass: SOFT_SURFACE_CARD,
      hasLogs: logs.length > 0,
      showNoLogs: logs.length === 0,
      logs,
      hasPhaseAudit: phaseAuditEntries.length > 0,
      showNoPhaseAudit: phaseAuditEntries.length === 0,
      phaseAuditEntries,
    },
  );
}

export function renderSelectedStudentPanel(
  student: Student,
  logs: MeetingLog[],
  phaseAudit: PhaseAuditEntry[],
  options: StudentPanelOptions = {},
): string {
  const { canEdit = true, filters, timeZone } = options;
  const returnSearchParams = new URLSearchParams();
  returnSearchParams.set("selected", String(student.id));
  if (filters?.search) {
    returnSearchParams.set("search", filters.search);
  }
  if (filters?.degree) {
    returnSearchParams.set("degree", filters.degree);
  }
  if (filters?.phase) {
    returnSearchParams.set("phase", filters.phase);
  }
  if (filters?.status) {
    returnSearchParams.set("status", filters.status);
  }
  if (filters && (filters.sortKey !== "nextMeeting" || filters.sortDirection !== "asc")) {
    returnSearchParams.set("sort", filters.sortKey);
    returnSearchParams.set("dir", filters.sortDirection);
  }
  const returnTo = `/?${returnSearchParams.toString()}`;

  const preparedLogs = prepareLogEntries(logs, timeZone);
  const preparedPhaseAudit = preparePhaseAuditEntries(phaseAudit, timeZone);
  const fields = renderStudentFormFields({
    values: getStudentFormValues(student, timeZone),
  });
  const targetSubmissionDate = getTargetSubmissionDate(student) || "Not set";
  const nextMeetingText = student.nextMeetingAt ? formatDateTime(student.nextMeetingAt, timeZone) : "Not booked";
  const defaultMeetingDateTimeValue = toDateTimeLocalInput(student.nextMeetingAt, timeZone);
  const summaryBadgesHtml = raw([
    renderBadge({ label: getDegreeLabel(student.degreeType, DEGREE_TYPES) }),
    renderBadge({ label: getPhaseLabel(student.currentPhase, PHASES) }),
    renderBadge({ label: `Target ${targetSubmissionDate}` }),
    renderBadge({ label: `Next ${nextMeetingText}` }),
  ].join(""));
  const historySummaryText = `${preparedLogs.length} entr${preparedLogs.length === 1 ? "y" : "ies"} · ${preparedPhaseAudit.length} change${preparedPhaseAudit.length === 1 ? "" : "s"}`;
  const logSummaryText = preparedLogs.length > 0 ? `${preparedLogs.length} entr${preparedLogs.length === 1 ? "y" : "ies"}` : "Empty";
  const auditSummaryText = preparedPhaseAudit.length > 0 ? `${preparedPhaseAudit.length} change${preparedPhaseAudit.length === 1 ? "" : "s"}` : "Empty";

  const editFormHtml = renderView(
    `<form &action="action" method="post" &class="formStack">
      <input type="hidden" name="returnTo" &value="returnTo" />
      <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark">
        Update student details directly here without opening extra sections.
      </p>
      <div class="grid grid-cols-1 gap-stack-xs sm:grid-cols-2">
        <fragment &children="nameField"></fragment>
        <fragment &children="emailField"></fragment>
        <fragment &children="degreeField"></fragment>
        <fragment &children="phaseField"></fragment>
        <fragment &children="topicField"></fragment>
        <fragment &children="startDateField"></fragment>
        <fragment &children="nextMeetingField"></fragment>
      </div>
      <div>
        <fragment &children="notesField"></fragment>
      </div>
      <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark">
        MSc target submission is calculated automatically as six months from the start date.
      </p>
      <fragment &children="submitButton"></fragment>
    </form>`,
    {
      action: `/actions/update-student/${student.id}`,
      formStack: FORM_STACK,
      returnTo,
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, raw(value)])),
      submitButton: raw(renderButton({
        label: "Save student updates",
        type: "submit",
        variant: "primaryBlock",
      })),
    },
  );

  const addLogFormHtml = renderView(
    `<form &action="action" method="post" &class="formStack">
      <input type="hidden" name="returnTo" &value="returnTo" />
      <fragment &children="happenedAtField"></fragment>
      <fragment &children="nextMeetingField"></fragment>
      <fragment &children="discussedField"></fragment>
      <fragment &children="agreedPlanField"></fragment>
      <fragment &children="submitButton"></fragment>
    </form>`,
    {
      action: `/actions/add-log/${student.id}`,
      formStack: FORM_STACK,
      returnTo,
      happenedAtField: raw(renderInputField({
        label: "Meeting date/time",
        name: "happenedAt",
        type: "datetime-local",
        value: defaultMeetingDateTimeValue,
        className: FIELD_CONTROL,
        attrs: DATETIME_LOCAL_HALF_HOUR_STEP,
      })),
      nextMeetingField: raw(renderInputField({
        label: "Possible next meeting (optional)",
        name: "nextMeetingAt",
        type: "datetime-local",
        className: FIELD_CONTROL,
        attrs: DATETIME_LOCAL_HALF_HOUR_STEP,
      })),
      discussedField: raw(renderTextareaField({
        label: "What was discussed",
        name: "discussed",
        required: true,
        className: FIELD_CONTROL,
      })),
      agreedPlanField: raw(renderTextareaField({
        label: "Agreed plan / next actions",
        name: "agreedPlan",
        required: true,
        className: FIELD_CONTROL,
      })),
      submitButton: raw(renderButton({
        label: "Save log entry",
        type: "submit",
        variant: "successBlock",
      })),
    },
  );

  const historyContentHtml = renderStudentHistoryContent(
    historySummaryText,
    logSummaryText,
    auditSummaryText,
    preparedLogs,
    preparedPhaseAudit,
  );

  if (!canEdit) {
    return renderView(
      `<article &class="cardClass">
        <fragment &children="summaryHtml"></fragment>
        <fragment &children="historyPanelHtml"></fragment>
      </article>`,
      {
        cardClass: `${PANEL_STACK} ${SURFACE_CARD}`,
        summaryHtml: raw(renderReadonlyStudentSummary(student, timeZone)),
        historyPanelHtml: raw(renderInsetCard(
          historyContentHtml,
          "bg-app-surface-soft/60 dark:bg-app-surface-soft-dark/30",
        )),
      },
    );
  }

  const editPanelHtml = renderInsetCard(
    renderView(
      `<fragment &children="headerHtml"></fragment>
      <div class="mt-stack-xs">
        <fragment &children="editFormHtml"></fragment>
      </div>`,
      {
        headerHtml: raw(renderSectionHeader({
          title: "Edit student",
          meta: "Core details",
        })),
        editFormHtml: raw(editFormHtml),
      },
    ),
    "hidden bg-app-surface-soft/60 dark:bg-app-surface-soft-dark/30",
    {
      "data-selected-tool-panel": "1",
      "data-tool-key": "edit",
    },
  );

  const logPanelHtml = renderInsetCard(
    renderView(
      `<fragment &children="headerHtml"></fragment>
      <div class="mt-stack-xs">
        <fragment &children="addLogFormHtml"></fragment>
      </div>`,
      {
        headerHtml: raw(renderSectionHeader({
          title: "Add log entry",
          meta: "Meeting notes",
        })),
        addLogFormHtml: raw(addLogFormHtml),
      },
    ),
    "hidden bg-app-surface-soft/60 dark:bg-app-surface-soft-dark/30",
    {
      "data-selected-tool-panel": "1",
      "data-tool-key": "log",
    },
  );

  const historyPanelHtml = renderInsetCard(
    historyContentHtml,
    "hidden bg-app-surface-soft/60 dark:bg-app-surface-soft-dark/30",
    {
      "data-selected-tool-panel": "1",
      "data-tool-key": "history",
    },
  );

  return renderView(
    `<article &class="cardClass">
      <section>
        <div class="flex items-start justify-between gap-stack-xs">
          <div class="min-w-0">
            <h2
              data-selected-student-heading="1"
              tabindex="-1"
              class="text-lg font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark"
              &children="selectedHeadingText"
            ></h2>
          </div>
          <fragment &children="closeButtonHtml"></fragment>
        </div>
        <p &visibleIf="topicVisible" &class="topicTextClass" &children="topic"></p>
        <div class="mt-3 flex flex-wrap gap-badge-y">
          <fragment &children="summaryBadgesHtml"></fragment>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-badge-y gap-stack-xs">
          <fragment &children="toolActionsHtml"></fragment>
          <fragment &children="archiveActionHtml"></fragment>
        </div>
      </section>
      <fragment &children="editPanelHtml"></fragment>
      <fragment &children="logPanelHtml"></fragment>
      <fragment &children="historyPanelHtml"></fragment>
    </article>`,
    {
      cardClass: `${PANEL_STACK} ${SURFACE_CARD}`,
      topicTextClass: TOPIC_TEXT,
      selectedHeadingText: `Selected student: ${student.name}`,
      topicVisible: Boolean(student.thesisTopic),
      topic: student.thesisTopic || "",
      summaryBadgesHtml,
      toolActionsHtml: raw(renderToolActions([
        { key: "edit", label: "Edit" },
        { key: "log", label: "Add log" },
        { key: "history", label: "History", meta: historySummaryText },
      ])),
      archiveActionHtml: raw(renderView(
        `<form
          &action="deleteAction"
          method="post"
          class="shrink-0"
          &onsubmit="deleteConfirm"
        >
          <input type="hidden" name="returnTo" &value="returnTo" />
          <fragment &children="deleteButtonHtml"></fragment>
        </form>`,
        {
          deleteAction: `/actions/archive-student/${student.id}`,
          returnTo,
          deleteConfirm: `return window.confirm('Archive ${escapeJsString(student.name)}? This will hide the student from the active dashboard but keep the history intact.');`,
          deleteButtonHtml: raw(renderButton({
            label: "Archive",
            type: "submit",
            variant: "inline",
            className:
              "border-app-danger-line bg-app-surface text-app-danger-text hover:bg-app-danger-soft/75 dark:border-app-danger-soft-dark/65 dark:bg-app-surface-dark dark:text-app-danger-text-dark dark:hover:bg-app-danger-soft-dark/35",
          })),
        },
      )),
      closeButtonHtml: raw(renderButton({
        label: "Close",
        type: "button",
        variant: "inline",
        attrs: {
          id: "closeSelectedStudentPanelButton",
          "aria-label": "Close student workspace",
        },
      })),
      editPanelHtml: raw(editPanelHtml),
      logPanelHtml: raw(logPanelHtml),
      historyPanelHtml: raw(historyPanelHtml),
    },
  );
}
