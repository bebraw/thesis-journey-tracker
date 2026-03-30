import { DASHBOARD_BOOTSTRAP_SECTION } from "./script/bootstrap";
import { DASHBOARD_DOM_SECTION } from "./script/dom";
import { DASHBOARD_EVENT_SECTION } from "./script/events";
import { DASHBOARD_FILTER_SECTION } from "./script/filters";
import { DASHBOARD_HELPERS_SECTION } from "./script/helpers";
import { DASHBOARD_SELECTION_SECTION } from "./script/selection";

function joinScriptSections(sections: string[]): string {
  return `${sections.join("\n\n")}\n`;
}

export const DASHBOARD_INTERACTION_SCRIPT = joinScriptSections([
  DASHBOARD_DOM_SECTION,
  DASHBOARD_HELPERS_SECTION,
  DASHBOARD_FILTER_SECTION,
  DASHBOARD_SELECTION_SECTION,
  DASHBOARD_EVENT_SECTION,
  DASHBOARD_BOOTSTRAP_SECTION,
]);

export function renderDashboardScriptTag(): string {
  return '<script src="/dashboard.js" defer></script>';
}
