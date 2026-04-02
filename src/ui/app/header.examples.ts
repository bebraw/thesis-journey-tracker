import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { renderButton } from "../foundation";
import { HEADER_CARD, THEME_TOGGLE_BUTTON } from "../styles";

function renderHeaderNavButton(label: string, href: string, current = false): string {
  return renderButton({
    label,
    href,
    variant: "neutral",
    className: current
      ? "border-app-brand bg-app-brand-soft px-badge-pill-x py-badge-pill-y text-xs font-semibold text-app-brand-strong dark:border-app-brand-ring dark:bg-app-brand-soft-dark/30 dark:text-app-brand-ring sm:text-sm"
      : "bg-transparent px-badge-pill-x py-badge-pill-y text-xs shadow-none hover:bg-app-surface-soft dark:bg-transparent dark:hover:bg-app-surface-soft-dark/55 sm:text-sm",
    attrs: current ? { "aria-current": "page" } : undefined,
  });
}

export function getHeaderExamplesSection(): UIExampleSection {
  return {
    id: "app-header-shell",
    scope: "app",
    title: "App Header Shell",
    description: "The app shell keeps page context, navigation, viewer identity, theme switching, and sign-out in one compact sticky header.",
    whenToUse: "Use this shell at the top of authenticated app pages where navigation, account context, and workspace actions need to stay reachable.",
    avoidFor: "Avoid reusing the full shell inside nested cards or feature panels. It is page-level chrome, not a local section header.",
    contentHtml: renderEscapedHTMLisp(
      `<div class="mt-panel-sm">
        <header &class="headerClass">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted dark:text-app-text-muted-dark">Advisor Workspace</p>
            <h3 class="mt-2 text-lg font-semibold leading-tight sm:text-xl">Thesis Journey Tracker</h3>
            <p class="mt-1 text-sm text-app-text-soft dark:text-app-text-soft-dark">
              Sticky page header for navigation, account context, and workspace-level actions.
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-badge-y sm:flex-nowrap sm:justify-end sm:gap-badge-pill-y">
            <div class="rounded-control bg-app-surface-soft/70 px-badge-pill-x py-badge-pill-y text-xs text-app-text-soft dark:bg-app-surface-soft-dark/35 dark:text-app-text-soft-dark">
              Signed in as <span class="font-semibold">Alex Editor</span>
            </div>
            <div class="flex min-w-0 flex-1 items-center gap-badge-y overflow-visible pb-0.5 pr-badge-y sm:flex-nowrap sm:justify-end sm:pb-0 sm:pr-0 [&>*]:shrink-0">
              <fragment &children="dashboardLink"></fragment>
              <fragment &children="scheduleLink"></fragment>
              <fragment &children="dataToolsLink"></fragment>
            </div>
            <div class="flex shrink-0 items-center gap-badge-y sm:gap-badge-pill-y">
              <button type="button" aria-label="Switch theme" title="Switch theme" &class="themeToggleClass">
                <svg class="h-5 w-5 text-app-text-soft dark:text-app-text-soft-dark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
              <fragment &children="logoutButton"></fragment>
            </div>
          </div>
        </header>
      </div>`,
      {
        headerClass: HEADER_CARD,
        dashboardLink: raw(renderHeaderNavButton("Dashboard", "#", true)),
        scheduleLink: raw(renderHeaderNavButton("Schedule", "#")),
        dataToolsLink: raw(renderHeaderNavButton("Data tools", "#")),
        themeToggleClass: THEME_TOGGLE_BUTTON,
        logoutButton: raw(renderButton({
          label: "Log out",
          type: "button",
          variant: "neutral",
        })),
      },
    ),
  };
}
