import { PAGE_WRAP } from "../ui/app";
import { renderCard, SUBTLE_TEXT } from "../ui/foundation";
import type { UIExampleSection } from "../ui/examples";
import { getAlertExamplesSection } from "../ui/app/alert.examples";
import { getBadgeExamplesSection } from "../ui/app/badge.examples";
import { getHeaderExamplesSection } from "../ui/app/header.examples";
import { getButtonExamplesSection } from "../ui/foundation/button.examples";
import { getCardExamplesSection } from "../ui/foundation/card.examples";
import { getFieldExamplesSection } from "../ui/foundation/field.examples";
import { getFieldShellExamplesSection } from "../ui/foundation/field-shell.examples";
import { getPatternExamplesSection } from "../ui/foundation/patterns.examples";
import { raw } from "../htmlisp";
import { renderAuthedPageDocument, renderView } from "./shared.htmlisp";
import type { ViewerContext } from "./types";

function renderStyleGuideSection(section: UIExampleSection): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold" &children="title"></h2>
      <p &class="subtleText" &children="description"></p>
      <fragment &children="contentHtml"></fragment>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        title: section.title,
        description: section.description,
        contentHtml: raw(section.contentHtml),
      },
    ),
  );
}

export function renderStyleGuidePage(viewer: ViewerContext): string {
  const buttonsCard = renderStyleGuideSection(getButtonExamplesSection());
  const badgesCard = renderStyleGuideSection(getBadgeExamplesSection());
  const alertsCard = renderStyleGuideSection(getAlertExamplesSection());
  const headerShellCard = renderStyleGuideSection(getHeaderExamplesSection());
  const formFieldsCard = renderStyleGuideSection(getFieldExamplesSection());
  const fieldShellCard = renderStyleGuideSection(getFieldShellExamplesSection());
  const surfacesCard = renderStyleGuideSection(getCardExamplesSection());
  const patternsCard = renderStyleGuideSection(getPatternExamplesSection());

  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker - Style Guide",
    headerTitle: "Style Guide",
    headerDescription: "Reusable UI patterns for buttons, badges, fields, surfaces, alerts, and app chrome.",
    currentPage: "style-guide",
    viewer,
    pageWrapClass: PAGE_WRAP,
    showStyleGuide: true,
    flashKind: "none",
    sections: [
      `<section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        ${buttonsCard}
        ${badgesCard}
      </section>`,
      `<section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        ${formFieldsCard}
        ${fieldShellCard}
      </section>`,
      `<section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        ${surfacesCard}
        ${alertsCard}
      </section>`,
      `<section>${headerShellCard}</section>`,
      `<section>${patternsCard}</section>`,
    ],
  });
}
