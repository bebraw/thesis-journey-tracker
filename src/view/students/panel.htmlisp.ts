import { escapeHtml, escapeJsString, formatDateTime } from "../../formatting";
import { type HtmlispComponents } from "../../htmlisp";
import { DEGREE_TYPES, getDegreeLabel, getPhaseLabel, getStudentFormValues, getTargetSubmissionDate, PHASES } from "../../students";
import type { MeetingLog, PhaseAuditEntry, Student } from "../../students/store";
import {
  DANGER_PANEL,
  DANGER_TEXT,
  DANGER_TITLE,
  EMPTY_STATE_CARD,
  FIELD_CONTROL,
  FORM_STACK,
  PANEL_STACK,
  SOFT_SURFACE_CARD,
  SUBTLE_TEXT,
  SURFACE_CARD,
  TOPIC_TEXT,
  renderBadge,
  renderButton,
  renderInputField,
  renderTextareaField,
} from "../../ui";
import type { DashboardFilters } from "../types";
import { renderView } from "../shared.htmlisp";
import { renderStudentFormFields } from "./form-fields";

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
}

interface PreparedReadonlyField {
  label: string;
  text: string;
}

interface PreparedToolAction {
  key: string;
  label: string;
  meta?: string;
}

function prepareLogEntries(logs: MeetingLog[]): PreparedLogEntry[] {
  return logs.map((log) => ({
    timestampText: escapeHtml(formatDateTime(log.happenedAt)),
    discussed: escapeHtml(log.discussed),
    agreedPlan: escapeHtml(log.agreedPlan),
    hasDeadline: Boolean(log.nextStepDeadline),
    deadlineText: escapeHtml(log.nextStepDeadline || ""),
  }));
}

function preparePhaseAuditEntries(entries: PhaseAuditEntry[]): PreparedPhaseAuditEntry[] {
  return entries.map((entry) => ({
    timestampText: escapeHtml(formatDateTime(entry.changedAt)),
    transitionText: escapeHtml(`${getPhaseLabel(entry.fromPhase, PHASES)} -> ${getPhaseLabel(entry.toPhase, PHASES)}`),
  }));
}

function prepareReadonlyFields(student: Student): PreparedReadonlyField[] {
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
    { label: "Next meeting", value: student.nextMeetingAt ? formatDateTime(student.nextMeetingAt) : "Not booked" },
    { label: "Saved meeting logs", value: String(student.logCount) },
  ].map((field) => ({
    label: escapeHtml(field.label),
    text: escapeHtml(field.value),
  }));
}

function renderReadonlyStudentSummary(student: Student): string {
  const readonlyFields = prepareReadonlyFields(student);

  return renderView(
    `<section>
      <h2 class="text-lg font-semibold">Student Overview</h2>
      <p &class="(get props currentStudentLineClass)" &children="(get props currentlyViewingText)"></p>
      <p &visibleIf="(get props topicVisible)" &class="(get props topicTextClass)" &children="(get props topic)"></p>
      <p &class="(get props readonlyNoticeClass)">Read-only access to details, supervision logs, and the phase timeline.</p>
      <dl class="mt-stack-xs grid grid-cols-1 gap-stack-xs sm:grid-cols-2">
        <noop &foreach="(get props readonlyFields)">
          <div class="rounded-card border border-app-line bg-app-surface-soft/70 px-panel-sm py-stack-xs text-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/40">
            <dt class="text-xs font-medium uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark" &children="(get props label)"></dt>
            <dd class="mt-1 font-medium" &children="(get props text)"></dd>
          </div>
        </noop>
      </dl>
    </section>`,
    {
      subtleText: escapeHtml(SUBTLE_TEXT),
      currentStudentLineClass: escapeHtml(`mt-1 truncate ${SUBTLE_TEXT}`),
      topicTextClass: escapeHtml(TOPIC_TEXT),
      readonlyNoticeClass: escapeHtml(`mt-3 ${SUBTLE_TEXT}`),
      currentlyViewingText: escapeHtml(`Currently viewing: ${student.name}`),
      topicVisible: Boolean(student.thesisTopic),
      topic: escapeHtml(student.thesisTopic || ""),
      readonlyFields,
    },
  );
}

function renderToolActions(actions: PreparedToolAction[]): string {
  return renderView(
    `<div class="mt-3 flex flex-wrap gap-badge-y">
      <noop &foreach="(get props actions)">
        <button
          type="button"
          data-selected-tool-button="1"
          &data-tool-key="(get props key)"
          aria-pressed="false"
          &class="(get props buttonClass)"
        >
          <span class="leading-tight" &children="(get props label)"></span>
          <span
            &visibleIf="(get props metaVisible)"
            class="mt-0.5 text-[11px] leading-tight font-medium text-app-text-muted dark:text-app-text-muted-dark"
            &children="(get props meta)"
          ></span>
        </button>
      </noop>
    </div>`,
    {
      buttonClass: escapeHtml(
        "inline-flex min-w-[8.25rem] flex-col items-start rounded-control border border-app-field bg-app-surface px-control-x py-badge-pill-y text-left text-sm font-medium text-app-text shadow-sm transition hover:bg-app-surface-soft aria-[pressed='true']:border-app-brand aria-[pressed='true']:bg-app-brand-soft/70 dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark dark:aria-[pressed='true']:border-app-brand-ring dark:aria-[pressed='true']:bg-app-brand-soft-dark/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-app-surface-dark",
      ),
      actions: actions.map((action) => ({
        key: escapeHtml(action.key),
        label: escapeHtml(action.label),
        metaVisible: Boolean(action.meta),
        meta: escapeHtml(action.meta || ""),
      })),
    },
  );
}

export function renderSelectedStudentPanel(
  student: Student,
  logs: MeetingLog[],
  phaseAudit: PhaseAuditEntry[],
  options: StudentPanelOptions = {},
): string {
  const { canEdit = true, filters } = options;
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
  const components: HtmlispComponents = {
    MeetingLogEntry: `<article &class="(get props cardClass)">
    <p class="font-medium"><span &children="(get props timestampText)"></span></p>
    <p class="mt-1"><span class="font-medium">Discussed:</span> <span &children="(get props discussed)"></span></p>
    <p class="mt-1"><span class="font-medium">Agreed:</span> <span &children="(get props agreedPlan)"></span></p>
    <p &visibleIf="(get props hasDeadline)" class="mt-1"><span class="font-medium">Next-step deadline:</span> <span &children="(get props deadlineText)"></span></p>
  </article>`,
    PhaseAuditLogEntry: `<article &class="(get props cardClass)">
    <p class="font-medium"><span &children="(get props timestampText)"></span></p>
    <p class="mt-1"><span class="font-medium">Phase change:</span> <span &children="(get props transitionText)"></span></p>
  </article>`,
  };

  const preparedLogs = prepareLogEntries(logs);
  const preparedPhaseAudit = preparePhaseAuditEntries(phaseAudit);
  const fields = renderStudentFormFields({
    values: getStudentFormValues(student),
  });
  const targetSubmissionDate = getTargetSubmissionDate(student) || "Not set";
  const nextMeetingText = student.nextMeetingAt ? formatDateTime(student.nextMeetingAt) : "Not booked";
  const summaryBadgesHtml = [
    renderBadge({ label: getDegreeLabel(student.degreeType, DEGREE_TYPES) }),
    renderBadge({ label: getPhaseLabel(student.currentPhase, PHASES) }),
    renderBadge({ label: `Target ${targetSubmissionDate}` }),
    renderBadge({ label: `Next ${nextMeetingText}` }),
  ].join("");
  const historySummaryText = `${preparedLogs.length} entr${preparedLogs.length === 1 ? "y" : "ies"} · ${preparedPhaseAudit.length} change${preparedPhaseAudit.length === 1 ? "" : "s"}`;

  const editFormHtml = renderView(
    `<form &action="(get props action)" method="post" &class="(get props formStack)">
      <input type="hidden" name="returnTo" &value="(get props returnTo)" />
      <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark">
        Update student details directly here without opening extra sections.
      </p>
      <div class="grid grid-cols-1 gap-stack-xs sm:grid-cols-2">
        <noop &children="(get props nameField)"></noop>
        <noop &children="(get props emailField)"></noop>
        <noop &children="(get props degreeField)"></noop>
        <noop &children="(get props phaseField)"></noop>
        <noop &children="(get props topicField)"></noop>
        <noop &children="(get props startDateField)"></noop>
        <noop &children="(get props nextMeetingField)"></noop>
      </div>
      <div>
        <noop &children="(get props notesField)"></noop>
      </div>
      <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark">
          MSc target submission is calculated automatically as six months from the start date.
      </p>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/update-student/${student.id}`),
      formStack: escapeHtml(FORM_STACK),
      returnTo: escapeHtml(returnTo),
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
      <input type="hidden" name="returnTo" &value="(get props returnTo)" />
      <noop &children="(get props happenedAtField)"></noop>
      <noop &children="(get props nextMeetingField)"></noop>
      <noop &children="(get props discussedField)"></noop>
      <noop &children="(get props agreedPlanField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      action: escapeHtml(`/actions/add-log/${student.id}`),
      formStack: escapeHtml(FORM_STACK),
      returnTo: escapeHtml(returnTo),
      happenedAtField: renderInputField({
        label: "Meeting date/time",
        name: "happenedAt",
        type: "datetime-local",
        className: FIELD_CONTROL,
        attributes: 'step="3600"',
      }),
      nextMeetingField: renderInputField({
        label: "Possible next meeting (optional)",
        name: "nextMeetingAt",
        type: "datetime-local",
        className: FIELD_CONTROL,
        attributes: 'step="3600"',
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
      submitButton: renderButton({
        label: "Save log entry",
        type: "submit",
        variant: "successBlock",
      }),
    },
  );

  if (!canEdit) {
    return renderView(
      `<article &class="(get props cardClass)">
        <noop &children="(get props summaryHtml)"></noop>

        <section class="rounded-card border border-app-line bg-app-surface-soft/60 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/30">
          <div class="flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between">
            <h3 class="text-base font-semibold">History</h3>
            <p class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props historySummaryText)"></p>
          </div>
          <div class="mt-stack-xs grid grid-cols-1 gap-stack-xs xl:grid-cols-2">
            <section class="space-y-stack-xs">
              <div class="flex items-baseline justify-between gap-badge-y">
                <h4 class="text-sm font-semibold">Meeting log history</h4>
                <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props logSummaryText)"></span>
              </div>
              <div &class="(get props formStack)" &visibleIf="(get props hasLogs)">
                <noop &foreach="(get props logs)">
                  <MeetingLogEntry
                    &cardClass="(get props logEntryClass)"
                    &timestampText="(get props timestampText)"
                    &discussed="(get props discussed)"
                    &agreedPlan="(get props agreedPlan)"
                    &hasDeadline="(get props hasDeadline)"
                    &deadlineText="(get props deadlineText)"
                  ></MeetingLogEntry>
                </noop>
              </div>
              <p &visibleIf="(get props showNoLogs)" &class="(get props emptyStateClass)">No entries yet.</p>
            </section>
            <section class="space-y-stack-xs">
              <div class="flex items-baseline justify-between gap-badge-y">
                <h4 class="text-sm font-semibold">Phase timeline</h4>
                <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props auditSummaryText)"></span>
              </div>
              <div &class="(get props formStack)" &visibleIf="(get props hasPhaseAudit)">
                <noop &foreach="(get props phaseAuditEntries)">
                  <PhaseAuditLogEntry
                    &cardClass="(get props logEntryClass)"
                    &timestampText="(get props timestampText)"
                    &transitionText="(get props transitionText)"
                  ></PhaseAuditLogEntry>
                </noop>
              </div>
              <p &visibleIf="(get props showNoPhaseAudit)" &class="(get props emptyStateClass)">No phase changes recorded yet.</p>
            </section>
          </div>
        </section>
      </article>`,
      {
        cardClass: escapeHtml(`${PANEL_STACK} ${SURFACE_CARD}`),
        emptyStateClass: escapeHtml(EMPTY_STATE_CARD),
        formStack: escapeHtml(FORM_STACK),
        historySummaryText: escapeHtml(historySummaryText),
        logSummaryText: escapeHtml(
          preparedLogs.length > 0 ? `${preparedLogs.length} entr${preparedLogs.length === 1 ? "y" : "ies"}` : "Empty",
        ),
        auditSummaryText: escapeHtml(
          preparedPhaseAudit.length > 0 ? `${preparedPhaseAudit.length} change${preparedPhaseAudit.length === 1 ? "" : "s"}` : "Empty",
        ),
        logEntryClass: escapeHtml(SOFT_SURFACE_CARD),
        summaryHtml: renderReadonlyStudentSummary(student),
        hasLogs: preparedLogs.length > 0,
        showNoLogs: preparedLogs.length === 0,
        logs: preparedLogs,
        hasPhaseAudit: preparedPhaseAudit.length > 0,
        showNoPhaseAudit: preparedPhaseAudit.length === 0,
        phaseAuditEntries: preparedPhaseAudit,
      },
      components,
    );
  }

  return renderView(
      `<article &class="(get props cardClass)">
      <section>
        <div class="flex items-start justify-between gap-stack-xs">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold" &children="(get props selectedHeadingText)"></h2>
          </div>
          <noop &children="(get props closeButtonHtml)"></noop>
        </div>
        <p &visibleIf="(get props topicVisible)" &class="(get props topicTextClass)" &children="(get props topic)"></p>
        <div class="mt-3 flex flex-wrap gap-badge-y">
          <noop &children="(get props summaryBadgesHtml)"></noop>
        </div>
        <noop &children="(get props toolActionsHtml)"></noop>
      </section>

      <section
        data-selected-tool-panel="1"
        data-tool-key="edit"
        class="hidden rounded-card border border-app-line bg-app-surface-soft/60 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/30"
      >
        <div class="flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between">
          <h3 class="text-base font-semibold">Edit student</h3>
          <p class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark">Core details</p>
        </div>
        <div class="mt-stack-xs">
          <noop &children="(get props editFormHtml)"></noop>
        </div>
      </section>

      <section
        data-selected-tool-panel="1"
        data-tool-key="log"
        class="hidden rounded-card border border-app-line bg-app-surface-soft/60 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/30"
      >
        <div class="flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between">
          <h3 class="text-base font-semibold">Add log entry</h3>
          <p class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark">Meeting notes</p>
        </div>
        <div class="mt-stack-xs">
          <noop &children="(get props addLogFormHtml)"></noop>
        </div>
      </section>

      <section
        data-selected-tool-panel="1"
        data-tool-key="history"
        class="hidden rounded-card border border-app-line bg-app-surface-soft/60 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/30"
      >
        <div class="flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between">
          <h3 class="text-base font-semibold">History</h3>
          <p class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props historySummaryText)"></p>
        </div>
        <div class="mt-stack-xs grid grid-cols-1 gap-stack-xs xl:grid-cols-2">
          <section class="space-y-stack-xs">
            <div class="flex items-baseline justify-between gap-badge-y">
              <h4 class="text-sm font-semibold">Meeting log history</h4>
              <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props logSummaryText)"></span>
            </div>
            <div &class="(get props formStack)" &visibleIf="(get props hasLogs)">
              <noop &foreach="(get props logs)">
                <MeetingLogEntry
                  &cardClass="(get props logEntryClass)"
                  &timestampText="(get props timestampText)"
                  &discussed="(get props discussed)"
                  &agreedPlan="(get props agreedPlan)"
                  &hasDeadline="(get props hasDeadline)"
                  &deadlineText="(get props deadlineText)"
                ></MeetingLogEntry>
              </noop>
            </div>
            <p &visibleIf="(get props showNoLogs)" &class="(get props emptyStateClass)">No entries yet.</p>
          </section>
          <section class="space-y-stack-xs">
            <div class="flex items-baseline justify-between gap-badge-y">
              <h4 class="text-sm font-semibold">Phase timeline</h4>
              <span class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark" &children="(get props auditSummaryText)"></span>
            </div>
            <div &class="(get props formStack)" &visibleIf="(get props hasPhaseAudit)">
              <noop &foreach="(get props phaseAuditEntries)">
                <PhaseAuditLogEntry
                  &cardClass="(get props logEntryClass)"
                  &timestampText="(get props timestampText)"
                  &transitionText="(get props transitionText)"
                ></PhaseAuditLogEntry>
              </noop>
            </div>
            <p &visibleIf="(get props showNoPhaseAudit)" &class="(get props emptyStateClass)">No phase changes recorded yet.</p>
          </section>
        </div>
      </section>

      <section
        data-selected-tool-panel="1"
        data-tool-key="more"
        class="hidden rounded-card border border-app-line bg-app-surface-soft/60 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/30"
      >
        <div class="flex flex-col gap-badge-y sm:flex-row sm:items-baseline sm:justify-between">
          <h3 class="text-base font-semibold">Archive</h3>
          <p class="text-xs font-medium text-app-text-muted dark:text-app-text-muted-dark">Occasional maintenance</p>
        </div>
        <section class="mt-stack-xs" &class="(get props dangerPanelClass)">
          <h2 &class="(get props dangerTitleClass)">Archive Student</h2>
          <p &class="(get props dangerTextClass)">This removes the student from the active dashboard while preserving meeting logs and phase history.</p>
          <form
            &action="(get props deleteAction)"
            method="post"
            class="mt-panel-sm"
            &onsubmit="(get props deleteConfirm)"
          >
            <input type="hidden" name="returnTo" &value="(get props returnTo)" />
            <noop &children="(get props deleteButtonHtml)"></noop>
          </form>
        </section>
      </section>
    </article>`,
    {
      cardClass: escapeHtml(`${PANEL_STACK} ${SURFACE_CARD}`),
      dangerPanelClass: escapeHtml(DANGER_PANEL),
      dangerTextClass: escapeHtml(DANGER_TEXT),
      dangerTitleClass: escapeHtml(DANGER_TITLE),
      emptyStateClass: escapeHtml(EMPTY_STATE_CARD),
      formStack: escapeHtml(FORM_STACK),
      historySummaryText: escapeHtml(historySummaryText),
      logSummaryText: escapeHtml(
        preparedLogs.length > 0 ? `${preparedLogs.length} entr${preparedLogs.length === 1 ? "y" : "ies"}` : "Empty",
      ),
      auditSummaryText: escapeHtml(
        preparedPhaseAudit.length > 0 ? `${preparedPhaseAudit.length} change${preparedPhaseAudit.length === 1 ? "" : "s"}` : "Empty",
      ),
      logEntryClass: escapeHtml(SOFT_SURFACE_CARD),
      subtleText: escapeHtml(SUBTLE_TEXT),
      topicTextClass: escapeHtml(TOPIC_TEXT),
      selectedHeadingText: escapeHtml(`Selected student: ${student.name}`),
      topicVisible: Boolean(student.thesisTopic),
      topic: escapeHtml(student.thesisTopic || ""),
      summaryBadgesHtml,
      toolActionsHtml: renderToolActions([
        { key: "edit", label: "Edit" },
        { key: "log", label: "Add log" },
        { key: "history", label: "History", meta: historySummaryText },
        { key: "more", label: "Archive" },
      ]),
      closeButtonHtml: renderButton({
        label: "Close",
        type: "button",
        variant: "inline",
        attributes: 'id="closeSelectedStudentPanelButton" aria-label="Close student workspace"',
      }),
      editFormHtml,
      addLogFormHtml,
      hasLogs: preparedLogs.length > 0,
      showNoLogs: preparedLogs.length === 0,
      logs: preparedLogs,
      hasPhaseAudit: preparedPhaseAudit.length > 0,
      showNoPhaseAudit: preparedPhaseAudit.length === 0,
      phaseAuditEntries: preparedPhaseAudit,
      deleteAction: escapeHtml(`/actions/archive-student/${student.id}`),
      returnTo: escapeHtml(returnTo),
      deleteConfirm: escapeHtml(
        `return window.confirm('Archive ${escapeJsString(student.name)}? This will hide the student from the active dashboard but keep the history intact.');`,
      ),
      deleteButtonHtml: renderButton({
        label: "Archive student",
        type: "submit",
        variant: "dangerBlock",
      }),
    },
    components,
  );
}
