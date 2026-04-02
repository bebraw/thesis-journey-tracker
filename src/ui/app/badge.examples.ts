import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { MEETING_STATUS_BADGE_CLASS_MAP, STATUS_BADGE } from "../styles";
import { renderBadge } from "./badge.htmlisp";

export function getBadgeExamplesSection(): UIExampleSection {
  return {
    title: "Badges",
    description: "Badges keep metadata visually consistent across tables, cards, and logs.",
    contentHtml: renderEscapedHTMLisp(
      `<div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="degreeBadge"></fragment>
        <fragment &children="mockBadge"></fragment>
        <fragment &children="countBadge"></fragment>
        <span &class="scheduledBadgeClass">Scheduled</span>
        <span &class="overdueBadgeClass">Overdue</span>
      </div>`,
      {
        degreeBadge: raw(renderBadge({ label: "MSc" })),
        mockBadge: raw(renderBadge({ label: "Mock", variant: "mock" })),
        countBadge: raw(renderBadge({ label: "12", variant: "count" })),
        scheduledBadgeClass: `${STATUS_BADGE} ${MEETING_STATUS_BADGE_CLASS_MAP.scheduled}`,
        overdueBadgeClass: `${STATUS_BADGE} ${MEETING_STATUS_BADGE_CLASS_MAP.overdue}`,
      },
    ),
  };
}
