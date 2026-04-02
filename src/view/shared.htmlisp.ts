import { ALERT_CLASS_MAP, BODY_CLASS, BUTTON_CLASS_MAP, HEADER_CARD, THEME_TOGGLE_BUTTON, renderButton } from "../ui";
import { type HtmlispComponents, type HtmlispRenderOptions, raw, renderEscapedHTMLisp, renderHTMLisp } from "../htmlisp";
import type { ViewerContext } from "./types";

const THEME_BOOTSTRAP_SCRIPT = `<script>
      (function applyTheme() {
        var stored = localStorage.getItem("theme");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.classList.add("dark");
        }
      }());
    </script>`;

export const THEME_TOGGLE_SCRIPT = `<script>
    var themeToggle = document.getElementById("themeToggle");
    var root = document.documentElement;

    function syncThemeToggleAccessibility() {
      var nextMode = root.classList.contains("dark") ? "light" : "dark";
      var label = "Switch to " + nextMode + " mode";
      themeToggle.setAttribute("title", label);
      themeToggle.setAttribute("aria-label", label);
    }

    syncThemeToggleAccessibility();

    themeToggle.addEventListener("click", function () {
      root.classList.toggle("dark");
      localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
      syncThemeToggleAccessibility();
    });
  </script>`;

export function renderView(
  htmlInput: string,
  props: Record<string, unknown> = {},
  components: HtmlispComponents = {},
  renderOptions?: HtmlispRenderOptions,
): string {
  return renderOptions ? renderHTMLisp(htmlInput, props, components, renderOptions) : renderEscapedHTMLisp(htmlInput, props, components);
}

export function renderDocument(title: string, bodyContent: string, bodyClass = BODY_CLASS): string {
  const components: HtmlispComponents = {
    Document: `<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title &children="title"></title>
    <fragment &children="themeBootstrapScript"></fragment>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body &class="bodyClass">
    <fragment &children="bodyContent"></fragment>
  </body>
</html>`,
  };

  return renderView(
    `<Document
      &title="title"
      &bodyClass="bodyClass"
      &bodyContent="bodyContent"
      &themeBootstrapScript="themeBootstrapScript"
    ></Document>`,
    {
      title,
      bodyClass,
      bodyContent: raw(bodyContent),
      themeBootstrapScript: raw(THEME_BOOTSTRAP_SCRIPT),
    },
    components,
    { escapeByDefault: true },
  );
}

export function renderFlashMessages(notice: string | null, error: string | null): string {
  const components: HtmlispComponents = {
    NoticeFlash: `<p
      &visibleIf="visible"
      role="status"
      aria-live="polite"
      &class="noticeClass"
      &children="message"
    ></p>`,
    ErrorFlash: `<p
      &visibleIf="visible"
      role="alert"
      aria-live="assertive"
      &class="errorClass"
      &children="message"
    ></p>`,
  };

  return renderView(
    `<fragment>
      <NoticeFlash
        &visible="noticeVisible"
        &message="noticeMessage"
        &noticeClass="noticeClass"
      ></NoticeFlash>
      <ErrorFlash
        &visible="errorVisible"
        &message="errorMessage"
        &errorClass="errorClass"
      ></ErrorFlash>
    </fragment>`,
    {
      noticeVisible: Boolean(notice),
      noticeClass: ALERT_CLASS_MAP.success,
      noticeMessage: notice || "",
      errorVisible: Boolean(error),
      errorClass: ALERT_CLASS_MAP.error,
      errorMessage: error || "",
    },
    components,
    { escapeByDefault: true },
  );
}

export function renderDashboardToastMessages(notice: string | null, error: string | null): string {
  const components: HtmlispComponents = {
    ToastStack: `<div
      id="dashboardFlashMessages"
      class="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col gap-stack-xs sm:left-auto sm:right-4 sm:w-full sm:max-w-sm"
    >
      <fragment &children="toastHtml"></fragment>
    </div>`,
    NoticeToast: `<div
      &visibleIf="visible"
      data-dashboard-toast="1"
      data-toast-kind="notice"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      &class="toastClass"
    >
      <p class="min-w-0 flex-1" &children="message"></p>
      <button
        type="button"
        data-toast-dismiss="1"
        &class="dismissButtonClass"
      >Dismiss</button>
    </div>`,
    ErrorToast: `<div
      &visibleIf="visible"
      data-dashboard-toast="1"
      data-toast-kind="error"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      &class="toastClass"
    >
      <p class="min-w-0 flex-1" &children="message"></p>
      <button
        type="button"
        data-toast-dismiss="1"
        &class="dismissButtonClass"
      >Dismiss</button>
    </div>`,
  };

  return renderView(
    `<ToastStack &toastHtml="toastHtml"></ToastStack>`,
    {
      toastHtml: raw(renderView(
        `<fragment>
          <NoticeToast
            &visible="noticeVisible"
            &message="noticeMessage"
            &toastClass="noticeClass"
            &dismissButtonClass="dismissButtonClass"
          ></NoticeToast>
          <ErrorToast
            &visible="errorVisible"
            &message="errorMessage"
            &toastClass="errorClass"
            &dismissButtonClass="dismissButtonClass"
          ></ErrorToast>
        </fragment>`,
        {
          noticeVisible: Boolean(notice),
          noticeClass:
            "pointer-events-auto flex items-start gap-badge-y rounded-panel border border-app-success-line bg-app-success-soft/96 px-panel-sm py-stack-xs text-sm text-app-success-text opacity-100 shadow-elevated transition duration-200 ease-out supports-[backdrop-filter]:bg-app-success-soft/86 dark:border-app-success-line-dark/45 dark:bg-app-success-soft-dark/88 dark:text-app-success-text-dark dark:supports-[backdrop-filter]:bg-app-success-soft-dark/78",
          noticeMessage: notice || "",
          errorVisible: Boolean(error),
          errorClass:
            "pointer-events-auto flex items-start gap-badge-y rounded-panel border border-app-danger-line bg-app-danger-soft/96 px-panel-sm py-stack-xs text-sm text-app-danger-text opacity-100 shadow-elevated transition duration-200 ease-out supports-[backdrop-filter]:bg-app-danger-soft/86 dark:border-app-danger-line-dark/45 dark:bg-app-danger-soft-dark/88 dark:text-app-danger-text-dark dark:supports-[backdrop-filter]:bg-app-danger-soft-dark/78",
          errorMessage: error || "",
          dismissButtonClass: `shrink-0 ${BUTTON_CLASS_MAP.inline}`,
        },
        components,
        { escapeByDefault: true },
      )),
    },
    components,
    { escapeByDefault: true },
  );
}

export type HeaderPageId = "dashboard" | "schedule" | "data-tools" | "add-student" | "style-guide";

interface RenderAuthedPageDocumentOptions {
  documentTitle: string;
  headerTitle: string;
  headerDescription: string;
  currentPage: HeaderPageId;
  viewer: ViewerContext;
  pageWrapClass: string;
  sections: string[];
  notice?: string | null;
  error?: string | null;
  flashKind?: "inline" | "toast" | "none";
  scripts?: string[];
  showStyleGuide?: boolean;
}

interface HeaderLink {
  label: string;
  href: string;
  current: boolean;
}

function renderHeaderNavLink(link: HeaderLink): string {
  return renderButton({
    label: link.label,
    href: link.href,
    variant: "neutral",
    className: link.current
      ? "border-app-brand bg-app-brand-soft px-badge-pill-x py-badge-pill-y text-xs font-semibold text-app-brand-strong dark:border-app-brand-ring dark:bg-app-brand-soft-dark/30 dark:text-app-brand-ring sm:text-sm"
      : "bg-transparent px-badge-pill-x py-badge-pill-y text-xs shadow-none hover:bg-app-surface-soft dark:bg-transparent dark:hover:bg-app-surface-soft-dark/55 sm:text-sm",
    attrs: link.current ? { "aria-current": "page" } : undefined,
  });
}

export function renderPageHeaderNavigation(currentPage: HeaderPageId, viewer: ViewerContext, showStyleGuide = false): string {
  const primaryLinks: HeaderLink[] = [{ label: "Dashboard", href: "/", current: currentPage === "dashboard" }];

  if (viewer.role === "editor") {
    primaryLinks.push({ label: "Schedule", href: "/schedule", current: currentPage === "schedule" });
  }

  const moreLinks: HeaderLink[] = [];
  if (viewer.role === "editor") {
    moreLinks.push({ label: "Data tools", href: "/data-tools", current: currentPage === "data-tools" });
  }
  if (showStyleGuide) {
    moreLinks.push({ label: "Style guide", href: "/style-guide", current: currentPage === "style-guide" });
  }

  const primaryNavHtml = primaryLinks.map(renderHeaderNavLink).join("");
  if (moreLinks.length === 0) {
    return primaryNavHtml;
  }
  if (moreLinks.length === 1) {
    return `${primaryNavHtml}${renderHeaderNavLink(moreLinks[0]!)}`;
  }

  const moreMenuIsCurrent = moreLinks.some((link) => link.current);
  const moreMenuHtml = renderView(
    `<details class="relative shrink-0">
      <summary &class="summaryClass">
        <span>More</span>
        <span aria-hidden="true" class="text-[10px]">▾</span>
      </summary>
      <div class="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 rounded-card border border-app-line bg-app-surface p-badge-y shadow-elevated dark:border-app-line-dark dark:bg-app-surface-dark">
        <nav aria-label="Secondary">
          <ul class="space-y-1">
            <fragment &foreach="moreLinks as link">
              <li>
                <a
                  &href="link.href"
                  &class="linkClass"
                  &aria-current="link.currentAttr"
                  &children="link.label"
                ></a>
              </li>
            </fragment>
          </ul>
        </nav>
      </div>
    </details>`,
    {
      summaryClass:
        `${BUTTON_CLASS_MAP.neutral} cursor-pointer list-none px-badge-pill-x py-badge-pill-y text-xs [&::-webkit-details-marker]:hidden sm:text-sm ${
          moreMenuIsCurrent
            ? "border-app-brand bg-app-brand-soft text-app-brand-strong dark:border-app-brand-ring dark:bg-app-brand-soft-dark/30 dark:text-app-brand-ring"
            : ""
        }`,
      linkClass:
        "block rounded-control px-control-x py-control-y text-sm text-app-text transition hover:bg-app-surface-soft dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark/55",
      moreLinks: moreLinks.map((link) => ({
        href: link.href,
        label: link.label,
        currentAttr: link.current ? "page" : null,
      })),
    },
    undefined,
    { escapeByDefault: true },
  );

  return `${primaryNavHtml}${moreMenuHtml}`;
}

export function renderAuthedPageHeader(title: string, description: string, navigationHtml: string, viewer: ViewerContext): string {
  const components: HtmlispComponents = {
    ThemeToggleButton: `<button
    id="themeToggle"
    type="button"
    title="Switch to dark mode"
    aria-label="Switch to dark mode"
    &class="className"
  >
    <svg class="h-5 w-5 text-app-text-soft dark:hidden dark:text-app-text-soft-dark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg class="hidden h-5 w-5 text-app-text-soft dark:block dark:text-app-text-soft-dark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  </button>`,
    AuthHeader: `<header &class="headerClass">
    <div class="min-w-0">
      <p class="sr-only">Advisor Workspace</p>
      <h1 class="text-lg font-semibold leading-tight sm:text-xl" &children="title"></h1>
      <p &class="descriptionClass" &children="description"></p>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-badge-y sm:flex-nowrap sm:justify-end sm:gap-badge-pill-y">
      <div &class="viewerSummaryClass">
        <span &children="viewerNameText"></span>
        <span class="font-semibold" &children="viewerRoleText"></span>
      </div>
      <div &class="actionsRowClass">
        <fragment &children="navigationHtml"></fragment>
      </div>
      <div class="flex shrink-0 items-center gap-badge-y sm:gap-badge-pill-y">
        <ThemeToggleButton &className="themeToggleClass" />
        <form action="/logout" method="post">
          <fragment &children="logoutButtonHtml"></fragment>
        </form>
      </div>
    </div>
  </header>`,
  };

  return renderView(
    `<AuthHeader
      &headerClass="headerClass"
      &title="title"
      &description="description"
      &descriptionClass="descriptionClass"
      &viewerSummaryClass="viewerSummaryClass"
      &viewerNameText="viewerNameText"
      &viewerRoleText="viewerRoleText"
      &actionsRowClass="actionsRowClass"
      &navigationHtml="navigationHtml"
      &themeToggleClass="themeToggleClass"
      &logoutButtonHtml="logoutButtonHtml"
    ></AuthHeader>`,
    {
      headerClass: HEADER_CARD,
      title,
      description,
      descriptionClass: "sr-only",
      viewerSummaryClass: "sr-only",
      viewerNameText: `Signed in as ${viewer.name}`,
      viewerRoleText: viewer.role === "readonly" ? "Read-only" : "Editor",
      actionsRowClass:
        "flex min-w-0 flex-1 items-center gap-badge-y overflow-visible pb-0.5 pr-badge-y sm:flex-nowrap sm:justify-end sm:pb-0 sm:pr-0 [&>*]:shrink-0",
      navigationHtml: raw(navigationHtml),
      themeToggleClass: THEME_TOGGLE_BUTTON,
      logoutButtonHtml: raw(renderButton({
        label: "Log out",
        type: "submit",
        variant: "neutral",
      })),
    },
    components,
    { escapeByDefault: true },
  );
}

export function renderAuthedPageDocument(options: RenderAuthedPageDocumentOptions): string {
  const {
    documentTitle,
    headerTitle,
    headerDescription,
    currentPage,
    viewer,
    pageWrapClass,
    sections,
    notice = null,
    error = null,
    flashKind = "inline",
    scripts = [],
    showStyleGuide = false,
  } = options;

  const flashHtml =
    flashKind === "toast"
      ? renderDashboardToastMessages(notice, error)
      : flashKind === "inline"
        ? renderFlashMessages(notice, error)
        : "";
  const bodyContent = renderView(
    `<div &class="pageWrap">
      <fragment &children="headerHtml"></fragment>
      <fragment &children="flashHtml"></fragment>
      <fragment &foreach="sections as section">
        <fragment &children="section"></fragment>
      </fragment>
    </div>
    <fragment &foreach="scripts as script">
      <fragment &children="script"></fragment>
    </fragment>`,
    {
      pageWrap: pageWrapClass,
      headerHtml: raw(renderAuthedPageHeader(
        headerTitle,
        headerDescription,
        renderPageHeaderNavigation(currentPage, viewer, showStyleGuide),
        viewer,
      )),
      flashHtml: raw(flashHtml),
      sections: sections.map((section) => raw(section)),
      scripts: [...scripts, THEME_TOGGLE_SCRIPT].map((script) => raw(script)),
    },
  );

  return renderDocument(documentTitle, bodyContent);
}
