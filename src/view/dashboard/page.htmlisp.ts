import { PAGE_WRAP, renderButton } from "../../ui";
import { escapeHtml } from "../../utils";
import { renderEmptySelectedPanel, renderSelectedStudentPanel } from "../student-panel.htmlisp";
import { THEME_TOGGLE_SCRIPT, renderAuthedPageHeader, renderDocument, renderFlashMessages, renderView } from "../shared.htmlisp";
import type { DashboardPageData } from "../types";
import { renderDashboardScriptTag } from "./interaction-script";
import { renderMetricCards } from "./metrics.htmlisp";
import { renderPhaseLanes } from "./phase-lanes.htmlisp";
import { renderStudentsTable } from "./students-table.htmlisp";

export function renderDashboardPage(data: DashboardPageData): string {
  const { viewer, students, selectedStudent, logs, phaseAudit, filters, notice, error, metrics, showStyleGuide } = data;
  const canEdit = viewer.role === "editor";
  const selectedPanel = selectedStudent
    ? renderSelectedStudentPanel(selectedStudent, logs, phaseAudit, { canEdit, filters })
    : renderEmptySelectedPanel(
        canEdit
          ? "Select a student from the table to edit details and view/add supervision logs."
          : "Select a student from the table to view details, supervision logs, and phase history.",
      );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <div id="dashboardFlashMessages"><noop &children="(get props flashHtml)"></noop></div>
      <div id="dashboardMetrics"><noop &children="(get props metricsHtml)"></noop></div>
      <div id="dashboardPhaseLanes"><noop &children="(get props phaseLanesHtml)"></noop></div>
      <noop &children="(get props studentsTableHtml)"></noop>
    </div>
    <noop &children="(get props dashboardScript)"></noop>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "MSc Thesis Journey Tracker",
        canEdit
          ? "Track phases, next meetings, and supervision logs in one place."
          : "Read-only access for checking student progress, meetings, and supervision history.",
        canEdit
          ? `${renderButton({
              label: "Schedule",
              href: "/schedule",
              variant: "neutral",
            })}${renderButton({
              label: "Data tools",
              href: "/data-tools",
              variant: "neutral",
            })}${showStyleGuide ? renderButton({
              label: "Style guide",
              href: "/style-guide",
              variant: "neutral",
            }) : ""}${renderButton({
              label: "Add student",
              href: "/students/new",
              variant: "primary",
            })}`
          : "",
        viewer,
      ),
      flashHtml: renderFlashMessages(notice, error),
      metricsHtml: renderMetricCards(metrics),
      phaseLanesHtml: renderPhaseLanes(students, selectedStudent, filters),
      studentsTableHtml: renderStudentsTable(
        students,
        selectedStudent,
        filters,
        selectedPanel,
        renderEmptySelectedPanel(
          canEdit
            ? "Select a student from the table to edit details and view/add supervision logs."
            : "Select a student from the table to view details, supervision logs, and phase history.",
        ),
      ),
      dashboardScript: renderDashboardScriptTag(),
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker", bodyContent);
}
