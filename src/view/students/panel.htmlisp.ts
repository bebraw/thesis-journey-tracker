import { formatDateTime, toDateTimeLocalInput } from "../../formatting";
import { raw } from "../../htmlisp";
import type { DashboardLaneDefinition } from "../../dashboard-lanes";
import { DEGREE_TYPES, getDegreeLabel, getPhaseLabel, getStudentFormValues, getTargetSubmissionDate, PHASES } from "../../students";
import type { MeetingLog, PhaseAuditEntry, Student } from "../../students/store";
import { FIELD_CONTROL, FORM_STACK, renderButton, renderInputField, renderTextareaField } from "../../ui";
import type { DashboardFilters } from "../types";
import { renderView } from "../shared.htmlisp";
import { renderStudentFormFields } from "./form-fields";

interface StudentPanelOptions {
  canEdit?: boolean;
  dashboardLanes?: DashboardLaneDefinition[];
  filters?: DashboardFilters;
  timeZone?: string;
}

export function renderEmptySelectedPanel(message = "Select a student to record meeting notes."): string {
  return renderView('<p class="text-sm text-app-text-muted dark:text-app-text-muted-dark" &children="message"></p>', { message });
}

function phaseLabel(phaseId: string, lanes: DashboardLaneDefinition[]): string {
  return lanes.find((lane) => lane.phaseId === phaseId)?.label || getPhaseLabel(phaseId, PHASES);
}

function renderLog(log: MeetingLog, timeZone?: string): string {
  return renderView(
    `<article class="space-y-2 py-2 text-sm">
      <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="timestamp"></p>
      <div><h4 class="font-medium">Discussion</h4><p class="mt-1 whitespace-pre-wrap break-words" &children="discussed"></p></div>
      <div><h4 class="font-medium">Next actions</h4><p class="mt-1 whitespace-pre-wrap break-words" &children="agreedPlan"></p></div>
      <p &visibleIf="hasDeadline" class="text-xs">Next-step deadline: <span &children="deadline"></span></p>
    </article>`,
    {
      timestamp: formatDateTime(log.happenedAt, timeZone),
      discussed: log.discussed,
      agreedPlan: log.agreedPlan,
      hasDeadline: Boolean(log.nextStepDeadline),
      deadline: log.nextStepDeadline || "",
    },
  );
}

function disclosure(label: string, content: string, attrs = ""): string {
  return renderView(`<details ${attrs}><summary &children="label"></summary><div class="mt-3" &children="content"></div></details>`, {
    label,
    content: raw(content),
  });
}

export function renderSelectedStudentPanel(
  student: Student,
  logs: MeetingLog[],
  phaseAudit: PhaseAuditEntry[],
  options: StudentPanelOptions = {},
): string {
  const { canEdit = true, dashboardLanes = [], filters, timeZone } = options;
  const editable = canEdit && !student.archivedAt;
  const params = new URLSearchParams({ selected: String(student.id) });
  if (filters) {
    if (filters.scope === "archived") params.set("scope", "archived");
    for (const key of ["search", "degree", "phase", "status"] as const) {
      if (filters[key]) params.set(key, filters[key]);
    }
    if (filters.viewMode !== "list") params.set("view", filters.viewMode);
    if (filters.sortKey !== "nextMeeting" || filters.sortDirection !== "asc") {
      params.set("sort", filters.sortKey);
      params.set("dir", filters.sortDirection);
    }
  }
  const returnTo = `/?${params.toString()}`;
  const hiddenReturn = renderView('<input type="hidden" name="returnTo" &value="returnTo" />', { returnTo });
  const fields = renderStudentFormFields({ values: getStudentFormValues(student, timeZone), dashboardLanes });
  const editForm = renderView(
    `<form &action="action" method="post" &class="formStack" data-student-draft="edit">
      <fragment &children="hiddenReturn"></fragment>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fragment &children="nameField"></fragment><fragment &children="emailField"></fragment>
        <fragment &children="degreeField"></fragment><fragment &children="phaseField"></fragment>
        <fragment &children="topicField"></fragment><fragment &children="startDateField"></fragment>
        <fragment &children="nextMeetingField"></fragment>
      </div>
      <fragment &children="notesField"></fragment>
      <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark">MSc target: six months from the start date.</p>
      <fragment &children="save"></fragment>
    </form>`,
    {
      action: `/actions/update-student/${student.id}`,
      formStack: FORM_STACK,
      hiddenReturn: raw(hiddenReturn),
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, raw(value)])),
      save: raw(renderButton({ label: "Save student updates", type: "submit", variant: "primary" })),
    },
  );
  const overview = renderView(
    `<dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      <dt>Email</dt><dd class="break-words" &children="email"></dd>
      <dt>Start date</dt><dd &children="startDate"></dd>
      <dt>Target</dt><dd &children="target"></dd>
      <dt>Student notes</dt><dd class="whitespace-pre-wrap break-words" &children="notes"></dd>
    </dl>`,
    {
      email: student.email || "Not set",
      startDate: student.startDate || "Not set",
      target: getTargetSubmissionDate(student) || "Not set",
      notes: student.studentNotes || "Not set",
    },
  );
  const noteForm = renderView(
    `<section class="border-t border-app-line pt-3 dark:border-app-line-dark">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold">New meeting note</h3>
        <span data-draft-status class="text-xs text-app-text-muted dark:text-app-text-muted-dark" role="status"></span>
      </div>
      <form &action="action" method="post" class="mt-3 space-y-3" data-student-draft="log">
        <fragment &children="hiddenReturn"></fragment>
        <fragment &children="happenedAt"></fragment>
        <fragment &children="discussed"></fragment>
        <fragment &children="agreedPlan"></fragment>
        <label class="block text-sm">Follow-up
          <select name="followUpAction" &class="selectClass">
            <option value="keep">Keep current meeting</option>
            <option value="clear">Not booked</option>
            <option value="set">Set new meeting</option>
          </select>
        </label>
        <div data-next-meeting-field><fragment &children="nextMeeting"></fragment></div>
        <fragment &children="save"></fragment>
        <p data-save-error class="hidden text-sm text-app-danger-text dark:text-app-danger-text-dark" role="alert"></p>
      </form>
    </section>`,
    {
      action: `/actions/add-log/${student.id}`,
      hiddenReturn: raw(hiddenReturn),
      selectClass: `mt-1 ${FIELD_CONTROL}`,
      happenedAt: raw(
        renderInputField({
          label: "Meeting time",
          name: "happenedAt",
          type: "datetime-local",
          required: true,
          value: toDateTimeLocalInput(new Date().toISOString(), timeZone),
          className: FIELD_CONTROL,
          attrs: { step: "60" },
        }),
      ),
      discussed: raw(
        renderTextareaField({ label: "Discussion", name: "discussed", required: true, className: FIELD_CONTROL, attrs: { rows: "3" } }),
      ),
      agreedPlan: raw(
        renderTextareaField({ label: "Next actions", name: "agreedPlan", required: true, className: FIELD_CONTROL, attrs: { rows: "3" } }),
      ),
      nextMeeting: raw(
        renderInputField({
          label: "Next meeting",
          name: "nextMeetingAt",
          type: "datetime-local",
          className: FIELD_CONTROL,
          attrs: { step: "1800" },
        }),
      ),
      save: raw(renderButton({ label: "Save note", type: "submit", variant: "primary" })),
    },
  );
  const latestLog = logs[0];
  const lastMeeting = renderView(
    `<section><h3 class="text-xs font-semibold uppercase tracking-wide">Last meeting</h3><fragment &children="content"></fragment></section>`,
    {
      content: raw(
        latestLog
          ? renderLog(latestLog, timeZone)
          : '<p class="py-3 text-sm text-app-text-muted dark:text-app-text-muted-dark">No meeting notes yet.</p>',
      ),
    },
  );
  const audit =
    phaseAudit
      .map((entry) =>
        renderView(
          '<p class="py-2 text-sm"><span class="block text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="timestamp"></span><span &children="transition"></span></p>',
          {
            timestamp: formatDateTime(entry.changedAt, timeZone),
            transition: `${phaseLabel(entry.fromPhase, dashboardLanes)} → ${phaseLabel(entry.toPhase, dashboardLanes)}`,
          },
        ),
      )
      .join("") || '<p class="text-sm">No phase changes recorded yet.</p>';
  const archiveAction = canEdit
    ? renderView(
        `<form &action="action" method="post" &data-confirm-message="confirmMessage">
      <fragment &children="hiddenReturn"></fragment><fragment &children="button"></fragment>
    </form>`,
        {
          action: `/actions/${student.archivedAt ? "restore" : "archive"}-student/${student.id}`,
          hiddenReturn: raw(hiddenReturn),
          confirmMessage: student.archivedAt
            ? `Restore ${student.name} to active students?`
            : `Archive ${student.name}? Supervision history will be retained.`,
          button: raw(
            renderButton({
              label: student.archivedAt ? "Restore to active students" : "Archive student",
              type: "submit",
              variant: "neutral",
            }),
          ),
        },
      )
    : "";

  return renderView(
    `<article class="space-y-3" &data-panel-student-id="studentId">
      <div class="back-to-students"><button type="button" data-back-to-students class="text-sm text-app-brand underline dark:text-app-brand-ring">← Back to students</button></div>
      <header>
        <div class="flex items-start justify-between gap-3">
          <h2 data-selected-student-heading="1" tabindex="-1" class="text-xl font-semibold break-words" &children="name"></h2>
          <fragment &children="close"></fragment>
        </div>
        <p &visibleIf="hasTopic" class="mt-1 text-sm text-app-text-muted dark:text-app-text-muted-dark break-words" &children="topic"></p>
        <p class="mt-2 text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="summary"></p>
        <p class="mt-1 text-xs text-app-text-muted dark:text-app-text-muted-dark" &children="meeting"></p>
        <p &visibleIf="archived" class="mt-2 text-sm font-medium" &children="archiveDate"></p>
        <p &visibleIf="readonly" class="mt-2 text-xs">Read-only</p>
      </header>
      <fragment &children="lastMeeting"></fragment>
      <fragment &visibleIf="editable" &children="noteForm"></fragment>
      <div>
        <fragment &children="details"></fragment>
        <fragment &children="earlierNotes"></fragment>
        <fragment &children="phaseHistory"></fragment>
        <fragment &visibleIf="canEdit" &children="recordActions"></fragment>
      </div>
    </article>`,
    {
      studentId: String(student.id),
      name: student.name,
      hasTopic: Boolean(student.thesisTopic),
      topic: student.thesisTopic || "",
      summary: `${getDegreeLabel(student.degreeType, DEGREE_TYPES)} · ${phaseLabel(student.currentPhase, dashboardLanes)} · Target ${getTargetSubmissionDate(student) || "not set"}`,
      meeting: `Next meeting: ${student.nextMeetingAt ? formatDateTime(student.nextMeetingAt, timeZone) : "Not booked"}`,
      archived: Boolean(student.archivedAt),
      archiveDate: student.archivedAt ? `Archived ${formatDateTime(student.archivedAt, timeZone)}` : "",
      readonly: !canEdit,
      editable,
      canEdit,
      close: raw(
        renderButton({
          label: "Close",
          type: "button",
          variant: "inline",
          attrs: { id: "closeSelectedStudentPanelButton", "aria-label": "Close student workspace" },
        }),
      ),
      lastMeeting: raw(lastMeeting),
      noteForm: raw(noteForm),
      details: raw(disclosure(editable ? "Edit details" : "Student details", editable ? editForm : overview, "data-student-details")),
      earlierNotes: raw(
        disclosure(
          `Earlier notes (${Math.max(0, logs.length - 1)})`,
          logs
            .slice(1)
            .map((log) => renderLog(log, timeZone))
            .join("") || '<p class="text-sm">No earlier notes.</p>',
        ),
      ),
      phaseHistory: raw(disclosure(`Phase history (${phaseAudit.length})`, audit)),
      recordActions: raw(disclosure("Record actions", archiveAction)),
    },
  );
}
