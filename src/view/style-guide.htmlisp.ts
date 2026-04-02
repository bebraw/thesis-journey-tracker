import { PAGE_WRAP } from "../ui/app";
import { renderButton, renderCard, renderSectionHeader, SUBTLE_TEXT } from "../ui/foundation";
import type { UIExampleScope, UIExampleSection } from "../ui/examples";
import { getAlertExamplesSection } from "../ui/app/alert.examples";
import { getBadgeExamplesSection } from "../ui/app/badge.examples";
import { getHeaderExamplesSection } from "../ui/app/header.examples";
import { raw } from "../htmlisp";
import { getButtonExamplesSection } from "../ui/foundation/button.examples";
import { getCardExamplesSection } from "../ui/foundation/card.examples";
import { getFieldExamplesSection } from "../ui/foundation/field.examples";
import { getFieldShellExamplesSection } from "../ui/foundation/field-shell.examples";
import { getPatternExamplesSection } from "../ui/foundation/patterns.examples";
import { renderAuthedPageDocument, renderView } from "./shared.htmlisp";
import type { ViewerContext } from "./types";

function getScopeLabel(scope: UIExampleScope): string {
  return scope === "foundation" ? "Foundation" : "App";
}

function getScopeBadgeClass(scope: UIExampleScope): string {
  return scope === "foundation"
    ? "inline-flex items-center rounded-full bg-app-brand-soft px-badge-pill-x py-badge-pill-y text-[11px] font-semibold uppercase tracking-[0.16em] text-app-brand-strong dark:bg-app-brand-soft-dark/30 dark:text-app-brand-ring"
    : "inline-flex items-center rounded-full bg-app-surface-soft px-badge-pill-x py-badge-pill-y text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-soft dark:bg-app-surface-soft-dark/35 dark:text-app-text-soft-dark";
}

function renderGuidanceCard(label: string, text: string, tone: "use" | "avoid"): string {
  return renderView(
    `<div &class="cardClass">
      <p class="text-[11px] font-semibold uppercase tracking-[0.16em]" &children="label"></p>
      <p class="mt-1 text-sm leading-6" &children="text"></p>
    </div>`,
    {
      label,
      text,
      cardClass:
        tone === "use"
          ? "rounded-card border border-app-line bg-app-surface-soft/55 px-panel-sm py-stack-xs dark:border-app-line-dark dark:bg-app-surface-soft-dark/30"
          : "rounded-card border border-app-line-strong bg-app-surface-soft/75 px-panel-sm py-stack-xs dark:border-app-line-dark-strong dark:bg-app-surface-soft-dark/20",
    },
  );
}

function renderStyleGuideSection(section: UIExampleSection): string {
  const guidanceHtml = section.whenToUse || section.avoidFor
    ? renderView(
        `<div class="mt-panel-sm grid gap-stack-xs sm:grid-cols-2">
          <fragment &visibleIf="showWhenToUse" &children="whenToUseHtml"></fragment>
          <fragment &visibleIf="showAvoidFor" &children="avoidForHtml"></fragment>
        </div>`,
        {
          showWhenToUse: Boolean(section.whenToUse),
          whenToUseHtml: raw(section.whenToUse ? renderGuidanceCard("Use When", section.whenToUse, "use") : ""),
          showAvoidFor: Boolean(section.avoidFor),
          avoidForHtml: raw(section.avoidFor ? renderGuidanceCard("Avoid For", section.avoidFor, "avoid") : ""),
        },
      )
    : "";

  const cardHtml = renderCard(
    renderView(
      `<div class="flex flex-wrap items-start justify-between gap-stack-xs">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold" &children="title"></h2>
          <p &class="subtleText" &children="description"></p>
        </div>
        <span &class="scopeBadgeClass" &children="scopeLabel"></span>
      </div>
      <fragment &children="guidanceHtml"></fragment>
      <div class="mt-panel-sm rounded-card border border-dashed border-app-line-strong bg-app-surface-soft/40 px-panel-sm py-panel-sm dark:border-app-line-dark-strong dark:bg-app-surface-soft-dark/20">
        <div class="flex flex-wrap items-center justify-between gap-badge-y">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark">Preview</p>
          <p class="text-xs text-app-text-muted dark:text-app-text-muted-dark">Static example</p>
        </div>
        <div class="pointer-events-none select-none">
          <fragment &children="contentHtml"></fragment>
        </div>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        title: section.title,
        description: section.description,
        scopeBadgeClass: getScopeBadgeClass(section.scope),
        scopeLabel: getScopeLabel(section.scope),
        guidanceHtml: raw(guidanceHtml),
        contentHtml: raw(section.contentHtml),
      },
    ),
  );

  return renderView(
    `<section &id="sectionId">
      <fragment &children="cardHtml"></fragment>
    </section>`,
    {
      sectionId: section.id,
      cardHtml: raw(cardHtml),
    },
  );
}

function renderSectionLink(section: UIExampleSection): string {
  return renderButton({
    label: section.title,
    href: `#${section.id}`,
    variant: "neutral",
    className: "bg-transparent px-badge-pill-x py-badge-pill-y text-xs shadow-none hover:bg-app-surface-soft dark:bg-transparent dark:hover:bg-app-surface-soft-dark/55 sm:text-sm",
  });
}

function renderStyleGuideIndex(sections: UIExampleSection[]): string {
  const foundationSections = sections.filter((section) => section.scope === "foundation");
  const appSections = sections.filter((section) => section.scope === "app");

  return renderCard(
    renderView(
      `<div class="space-y-panel-sm">
        <div>
          <h2 class="text-lg font-semibold">Style Guide Index</h2>
          <p &class="subtleText" &children="description"></p>
        </div>
        <div class="grid gap-panel-sm lg:grid-cols-2">
          <div class="space-y-stack-xs">
            <fragment &children="foundationHeader"></fragment>
            <div class="flex flex-wrap gap-badge-y">
              <fragment &foreach="foundationLinks as link">
                <fragment &children="link"></fragment>
              </fragment>
            </div>
          </div>
          <div class="space-y-stack-xs">
            <fragment &children="appHeader"></fragment>
            <div class="flex flex-wrap gap-badge-y">
              <fragment &foreach="appLinks as link">
                <fragment &children="link"></fragment>
              </fragment>
            </div>
          </div>
        </div>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description: "Use the index to jump between extractable foundation primitives and app-specific UI patterns.",
        foundationHeader: raw(renderSectionHeader({
          title: "Foundation",
          meta: "Portable primitives",
          headingLevel: 3,
        })),
        appHeader: raw(renderSectionHeader({
          title: "App",
          meta: "Project-specific patterns",
          headingLevel: 3,
        })),
        foundationLinks: foundationSections.map((section) => raw(renderSectionLink(section))),
        appLinks: appSections.map((section) => raw(renderSectionLink(section))),
      },
    ),
  );
}

export function renderStyleGuidePage(viewer: ViewerContext): string {
  const buttonsSection = getButtonExamplesSection();
  const badgesSection = getBadgeExamplesSection();
  const alertsSection = getAlertExamplesSection();
  const headerShellSection = getHeaderExamplesSection();
  const formFieldsSection = getFieldExamplesSection();
  const fieldShellSection = getFieldShellExamplesSection();
  const surfacesSection = getCardExamplesSection();
  const patternsSection = getPatternExamplesSection();

  const foundationSections = [
    buttonsSection,
    formFieldsSection,
    fieldShellSection,
    surfacesSection,
    patternsSection,
  ];
  const appSections = [
    badgesSection,
    alertsSection,
    headerShellSection,
  ];

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
      renderStyleGuideIndex([...foundationSections, ...appSections]),
      `<section class="space-y-stack">
        ${renderSectionHeader({
          title: "Foundation",
          meta: "Reusable primitives intended for extraction",
        })}
        <div class="grid grid-cols-1 gap-stack xl:grid-cols-2">
          ${renderStyleGuideSection(buttonsSection)}
          ${renderStyleGuideSection(formFieldsSection)}
        </div>
        <div class="grid grid-cols-1 gap-stack xl:grid-cols-2">
          ${renderStyleGuideSection(fieldShellSection)}
          ${renderStyleGuideSection(surfacesSection)}
        </div>
        ${renderStyleGuideSection(patternsSection)}
      </section>`,
      `<section class="space-y-stack">
        ${renderSectionHeader({
          title: "App",
          meta: "Project-specific shell, status, and chrome patterns",
        })}
        <div class="grid grid-cols-1 gap-stack xl:grid-cols-2">
          ${renderStyleGuideSection(badgesSection)}
          ${renderStyleGuideSection(alertsSection)}
        </div>
        ${renderStyleGuideSection(headerShellSection)}
      </section>`,
    ],
  });
}
