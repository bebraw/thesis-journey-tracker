import { raw } from "../../htmlisp";
import { PAGE_WRAP } from "../../ui";
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
    `<div &class="pageWrap">
      <fragment &children="headerHtml"></fragment>
      <fragment &children="toastHtml"></fragment>
      <fragment &children="studentsTableHtml"></fragment>
    </div>
    <fragment &children="dashboardScript"></fragment>
    <fragment &children="themeToggleScript"></fragment>`,
    {
      pageWrap: PAGE_WRAP,
      headerHtml: raw(renderAuthedPageHeader(
        "Thesis Journey Tracker",
        canEdit
          ? "A clean overview for tracking thesis progress, supervision follow-ups, and the students who need attention next."
          : "Read-only access for reviewing student progress, meetings, and supervision history without changing records.",
        renderPageHeaderNavigation("dashboard", viewer, showStyleGuide),
        viewer,
      )),
      toastHtml: raw(renderDashboardToastMessages(notice, error)),
      studentsTableHtml: raw(renderStudentsTable(
        students,
        selectedStudent,
        filters,
        renderMetricCards(metrics),
        renderPhaseLanes(students, selectedStudent, filters, { embedded: true }),
        selectedPanel,
        renderEmptySelectedPanel(
          canEdit
            ? "Select a student from the table to edit details and view/add supervision logs."
            : "Select a student from the table to view details, supervision logs, and phase history.",
        ),
        { canEdit },
      )),
      dashboardScript: raw(renderDashboardScriptTag()),
      themeToggleScript: raw(THEME_TOGGLE_SCRIPT),
    },
  );

  return renderDocument("Thesis Journey Tracker", bodyContent);
}
