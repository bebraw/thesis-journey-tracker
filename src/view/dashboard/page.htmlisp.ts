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
  const { students, selectedStudent, logs, notice, error, metrics } = data;
  const selectedPanel = selectedStudent ? renderSelectedStudentPanel(selectedStudent, logs) : renderEmptySelectedPanel();

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <noop &children="(get props metricsHtml)"></noop>
      <noop &children="(get props phaseLanesHtml)"></noop>
      <noop &children="(get props studentsTableHtml)"></noop>
    </div>
    <noop &children="(get props dashboardScript)"></noop>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "MSc Thesis Journey Tracker",
        "Track phases, next meetings, and supervision logs in one place.",
        `${renderButton({
          label: "Style guide",
          href: "/style-guide",
          variant: "neutral",
        })}${renderButton({
          label: "Add student",
          href: "/students/new",
          variant: "primary",
        })}`,
      ),
      flashHtml: renderFlashMessages(notice, error),
      metricsHtml: renderMetricCards(metrics),
      phaseLanesHtml: renderPhaseLanes(students, selectedStudent),
      studentsTableHtml: renderStudentsTable(students, selectedStudent, selectedPanel, renderEmptySelectedPanel()),
      dashboardScript: renderDashboardScriptTag(),
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker", bodyContent);
}
