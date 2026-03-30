import { PAGE_WRAP } from "../../ui";
import { escapeHtml } from "../../formatting";
import { renderEmptySelectedPanel, renderSelectedStudentPanel } from "../students";
import {
  THEME_TOGGLE_SCRIPT,
  renderAuthedPageHeader,
  renderDashboardToastMessages,
  renderDocument,
  renderPageHeaderNavigation,
  renderView,
} from "../shared.htmlisp";
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
      <noop &children="(get props toastHtml)"></noop>
      <div class="flex flex-col gap-stack">
        <div class="order-2 space-y-stack-xs xl:order-1" id="dashboardMetrics"><noop &children="(get props metricsHtml)"></noop></div>
        <div class="order-1 xl:order-2"><noop &children="(get props studentsTableHtml)"></noop></div>
      </div>
    </div>
    <noop &children="(get props dashboardScript)"></noop>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "Thesis Journey Tracker",
        canEdit
          ? "A clean overview for tracking thesis progress, supervision follow-ups, and the students who need attention next."
          : "Read-only access for reviewing student progress, meetings, and supervision history without changing records.",
        renderPageHeaderNavigation("dashboard", viewer, showStyleGuide),
        viewer,
      ),
      toastHtml: renderDashboardToastMessages(notice, error),
      metricsHtml: renderMetricCards(metrics),
      studentsTableHtml: renderStudentsTable(
        students,
        selectedStudent,
        filters,
        renderPhaseLanes(students, selectedStudent, filters, { embedded: true }),
        selectedPanel,
        renderEmptySelectedPanel(
          canEdit
            ? "Select a student from the table to edit details and view/add supervision logs."
            : "Select a student from the table to view details, supervision logs, and phase history.",
        ),
        { canEdit },
      ),
      dashboardScript: renderDashboardScriptTag(),
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker", bodyContent);
}
